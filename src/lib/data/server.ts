import { getResilientFund } from "./resilient-fund";
import { getCalculatedFund } from "./live-valuation-v2";
import { getMarketPhase } from "../market-hours";
import { getSnapshot as getStableSnapshot } from "./server-stable";
import { getMultiSourceQuote } from "./multi-source-quotes";
import { validateGlobalQuotes } from "./global-quote-validation";
import { preserveReliableSnapshot } from "./reliable-snapshot";
import type { FundQuote } from "../types";

export { calcIndicators } from "./server-stable";
export { getNews } from "./server-news";
export { getFundSectorQuotes } from "./fund-sector";
export type { FundSectorQuote } from "./fund-sector";
export { searchFund, getFundRank, analyzeMarket, analyzeNews } from "./compat";
export { testDeepSeek, analyzeDeepSeek } from "./deepseek";

const FUND_CACHE_TTL_MS = 15_000;
const fundResolved = new Map<string, { at: number; value: FundQuote }>();
const fundPending = new Map<string, Promise<FundQuote>>();
const postCloseEstimate = new Map<string, FundQuote>();

function chinaDateLabel(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function usableFundData(quote: FundQuote | null | undefined) {
  return !!quote && (quote.nav != null || quote.estimate != null || quote.historyPoints.length > 0 || quote.metrics != null);
}

function isSameDayEstimate(quote: FundQuote | null | undefined) {
  return !!quote
    && quote.officialNavPublished !== true
    && quote.estimate != null
    && quote.estimateTime != null
    && quote.estimateTime.slice(0, 10) === chinaDateLabel();
}

async function loadFundQuote(code: string): Promise<FundQuote> {
  const phase = getMarketPhase();
  try {
    const calculated = await getCalculatedFund({ data: { code } });
    if (isSameDayEstimate(calculated)) postCloseEstimate.set(code, calculated);
    if (usableFundData(calculated) && (
      calculated.officialNavPublished
      || calculated.valuationStatus === "estimate"
      || calculated.estimate != null
    )) {
      return calculated;
    }
  } catch {}

  if (phase === "postclose") {
    const saved = postCloseEstimate.get(code);
    if (isSameDayEstimate(saved)) return saved;
  }

  return getResilientFund({ data: { code } });
}

export const getFund = async ({ data }: { data: { code: string } }): Promise<FundQuote> => {
  const code = data.code.trim();
  const cached = fundResolved.get(code);
  if (cached && Date.now() - cached.at < FUND_CACHE_TTL_MS) return cached.value;
  const running = fundPending.get(code);
  if (running) return running;
  const request = loadFundQuote(code)
    .then((value) => {
      if (usableFundData(value)) fundResolved.set(code, { at: Date.now(), value });
      return value;
    })
    .finally(() => fundPending.delete(code));
  fundPending.set(code, request);
  return request;
};

const INDEX_CODES = ["000001", "399001", "399006", "000688"] as const;

export const getSnapshot = async () => {
  const snapshot = preserveReliableSnapshot(await getStableSnapshot());
  const [checked, global] = await Promise.all([
    Promise.all(INDEX_CODES.map(async (code) => {
      try { return { code, quote: await getMultiSourceQuote(code) }; }
      catch { return { code, quote: null }; }
    })),
    validateGlobalQuotes(snapshot.global),
  ]);
  const indices = snapshot.indices.map((index) => {
    const hit = checked.find((item) => item.code === index.code)?.quote;
    if (!hit || hit.pct == null || hit.price == null) return index;
    if (["three_source", "two_source", "single_source"].includes(hit.agreement)) return { ...index, price: hit.price, pct: hit.pct };
    return index;
  });
  const sources = snapshot.sources.map((entry) => {
    if (entry.name === "指数") return { ...entry, note: "腾讯 + 东方财富 + 新浪多源校验；分歧时保留稳定结果" };
    if (entry.name === "外围") return { ...entry, note: `腾讯财经主源 + 新浪备用/交叉校验；检查${global.checked}项，一致${global.agreed}项，备用补齐${global.fallback}项${global.disputed ? `，分歧${global.disputed}项` : ""}` };
    return entry;
  });
  return preserveReliableSnapshot({
    ...snapshot,
    indices,
    global: global.list,
    sources,
    validation: checked.some((x) => x.quote?.agreement === "three_source") ? "cross_checked" : snapshot.validation,
  });
};
