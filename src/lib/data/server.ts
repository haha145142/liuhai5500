import { getResilientFund } from "./resilient-fund";
import { getSnapshot as getStableSnapshot } from "./server-stable";
import { getMultiSourceQuote } from "./multi-source-quotes";
import { validateGlobalQuotes } from "./global-quote-validation";
import type { FundQuote } from "../types";

export { calcIndicators } from "./server-stable";
export { getNews } from "./server-news";
export { getFundSectorQuotes } from "./fund-sector";
export { searchFund, getFundRank, analyzeMarket, analyzeNews } from "./compat";
export { testDeepSeek, analyzeDeepSeek } from "./deepseek";

const FUND_CACHE_TTL_MS = 15_000;
const fundResolved = new Map<string, { at: number; value: FundQuote }>();
const fundPending = new Map<string, Promise<FundQuote>>();

/** Shared server-side single-flight/cache. Unusable fund responses are not persisted. */
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
 * Stable snapshot is still the base fallback. Headline indices are revalidated
 * through the three-source quote layer; global quotes are independently backed
 * by Sina so a Tencent outage does not blank the whole global strip.
 */
export const getSnapshot = async () => {
  const snapshot = await getStableSnapshot();
  const checked = await Promise.all(INDEX_CODES.map(async (code) => {
    try { return { code, quote: await getMultiSourceQuote(code) }; }
    catch { return { code, quote: null }; }
  }));

  let changed = false;
  const indices = snapshot.indices.map((index) => {
    const hit = checked.find((item) => item.code === index.code)?.quote;
    if (!hit || hit.pct == null || hit.price == null) return index;
    if (["three_source", "two_source", "single_source"].includes(hit.agreement)) {
      changed = true;
      return { ...index, price: hit.price, pct: hit.pct, change: index.change ?? null };
    }
    return index;
  });

  const global = await validateGlobalQuotes(snapshot.global);
  const globalChanged = global.fallback > 0;
  if (!changed && !globalChanged) return snapshot;

  const sources = snapshot.sources.map((entry) => {
    if (entry.name === "指数") {
      return { ...entry, note: "腾讯 + 东方财富 + 新浪多源校验；分歧时保留稳定结果" };
    }
    if (entry.name === "外围") {
      return { ...entry, note: `腾讯财经主源 + 新浪备用/交叉校验；检查${global.checked}项，一致${global.agreed}项，备用补齐${global.fallback}项${global.disputed ? `，分歧${global.disputed}项` : ""}` };
    }
    return entry;
  });

  return {
    ...snapshot,
    indices,
    global: global.list,
    sources,
    validation: checked.some((x) => x.quote?.agreement === "three_source") ? "cross_checked" : snapshot.validation,
  };
};
