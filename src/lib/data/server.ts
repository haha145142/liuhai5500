import { getResilientFund } from "./resilient-fund";
import type { FundQuote } from "../types";

export { getSnapshot, calcIndicators } from "./server-stable";
export { getNews } from "./server-news";
export { getFundSectorQuotes } from "./fund-sector";
export { searchFund, getFundRank, analyzeMarket, analyzeNews } from "./compat";
export { testDeepSeek, analyzeDeepSeek } from "./deepseek";

const FUND_CACHE_TTL_MS = 15_000;
const fundResolved = new Map<string, { at: number; value: FundQuote }>();
const fundPending = new Map<string, Promise<FundQuote>>();

/** Shared server-side single-flight/cache for fund quotes. */
export const getFund = async ({ data }: { data: { code: string } }): Promise<FundQuote> => {
  const code = data.code.trim();
  const cached = fundResolved.get(code);
  if (cached && Date.now() - cached.at < FUND_CACHE_TTL_MS) return cached.value;

  const running = fundPending.get(code);
  if (running) return running;

  const request = getResilientFund({ data: { code } })
    .then((value) => {
      fundResolved.set(code, { at: Date.now(), value });
      return value;
    })
    .finally(() => fundPending.delete(code));

  fundPending.set(code, request);
  return request;
};
