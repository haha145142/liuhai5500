import { createServerFn } from "@tanstack/react-start";
import { getValidatedFund } from "./validated-fund";
import { getDirectFundFallback } from "./fund-direct-fallback";
import type { FundQuote } from "../types";

function hasUsableFundData(quote: FundQuote | null | undefined) {
  return !!quote && (
    quote.nav != null ||
    quote.estimate != null ||
    quote.historyPoints.length > 0 ||
    quote.metrics != null
  );
}

const IN_FLIGHT = new Map<string, Promise<FundQuote>>();
const RECENT = new Map<string, { at: number; value: FundQuote }>();
const CACHE_TTL_MS = 15_000;

async function loadFund(code: string): Promise<FundQuote> {
  const [validatedResult, directResult] = await Promise.allSettled([
    getValidatedFund({ data: { code } }),
    getDirectFundFallback({ data: { code } }),
  ]);

  if (validatedResult.status === "fulfilled" && hasUsableFundData(validatedResult.value)) {
    return validatedResult.value;
  }
  if (directResult.status === "fulfilled" && directResult.value) {
    return directResult.value;
  }

  return {
    code,
    name: code,
    type: "基金",
    nav: null,
    navDate: null,
    estimate: null,
    estimatePct: null,
    estimateTime: null,
    dayPct: null,
    weekPct: null,
    monthPct: null,
    history: [],
    historyPoints: [],
    metrics: null,
    source: "基金数据源暂不可用 · 已保存本地持仓",
    officialNavPublished: false,
    valuationStatus: "unavailable",
    estimateConfidence: "low",
    historyMae20: null,
    historySample20: 0,
    historyMaxError: null,
    historyP95Error: null,
    historyMae5: null,
  };
}

export const getResilientFund = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<FundQuote> => {
    const code = data.code.trim();
    if (!/^\d{6}$/.test(code)) {
      return loadFund(code);
    }

    const recent = RECENT.get(code);
    if (recent && Date.now() - recent.at < CACHE_TTL_MS && hasUsableFundData(recent.value)) {
      return recent.value;
    }

    const running = IN_FLIGHT.get(code);
    if (running) return running;

    const request = loadFund(code)
      .then((value) => {
        if (hasUsableFundData(value)) RECENT.set(code, { at: Date.now(), value });
        return value;
      })
      .finally(() => IN_FLIGHT.delete(code));

    IN_FLIGHT.set(code, request);
    return request;
  });
