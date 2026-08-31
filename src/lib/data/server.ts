import { getResilientFund } from "./resilient-fund";
import { getSnapshot as getStableSnapshot } from "./server-stable";
import { getMultiSourceQuote } from "./multi-source-quotes";
import type { FundQuote } from "../types";

export { calcIndicators } from "./server-stable";
export { getNews } from "./server-news";
export { getFundSectorQuotes } from "./fund-sector";
export { searchFund, getFundRank, analyzeMarket, analyzeNews } from "./compat";
export { testDeepSeek, analyzeDeepSeek } from "./deepseek";

const FUND_CACHE_TTL_MS = 15_000;
const fundResolved = new Map<string, { at: number; value: FundQuote }>();
const fundPending = new Map<string, Promise<FundQuote>>();

/**
 * Shared server-side single-flight/cache for fund quotes.
 * Failed/unusable fund responses are never persisted as the short-lived cache.
 */
export const getFund = async ({ data }: { data: { code: string } }): Promise<FundQuote> => {
  const code = data.code.trim();
  const cached = fundResolved.get(code);
  if (cached && Date.now() - cached.at < FUND_CACHE_TTL_MS) return cached.value;

  const running = fundPending.get(code);
  if (running) return running;

  const request = getResilientFund({ data: { code } })
    .then((value) => {
      if (value.nav != null || value.estimate != null || value.historyPoints.length > 0 || value.metrics != null) {
        fundResolved.set(code, { at: Date.now(), value });
      }
      return value;
    })
    .finally(() => fundPending.delete(code));

  fundPending.set(code, request);
  return request;
};

const INDEX_CODES = ["000001", "399001", "399006", "000688"] as const;

/**
 * The stable snapshot remains the fallback, but the four headline A-share
 * indices are re-validated through the dedicated Tencent/Eastmoney/Sina
 * consensus layer before they reach the UI.
 */
export const getSnapshot = async () => {
  const snapshot = await getStableSnapshot();
  const checked = await Promise.all(INDEX_CODES.map(async (code) => {
    try {
      return { code, quote: await getMultiSourceQuote(code) };
    } catch {
      return { code, quote: null };
    }
  }));

  let changed = false;
  const indices = snapshot.indices.map((index) => {
    const hit = checked.find((item) => item.code === index.code)?.quote;
    if (!hit || hit.pct == null || hit.price == null) return index;
    if (hit.agreement === "three_source" || hit.agreement === "two_source" || hit.agreement === "single_source") {
      changed = true;
      return { ...index, price: hit.price, pct: hit.pct, change: hit.price - (index.price != null ? index.price - (index.change ?? 0) : 0) };
    }
    return index;
  });

  if (!changed) return snapshot;

  const sources = snapshot.sources.map((entry) =>
    entry.name === "指数"
      ? { ...entry, note: "腾讯 + 东方财富 + 新浪多源校验；分歧时保留原双源结果" }
      : entry,
  );

  return { ...snapshot, indices, sources, validation: checked.some((x) => x.quote?.agreement === "three_source") ? "cross_checked" : snapshot.validation };
};
