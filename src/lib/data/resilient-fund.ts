import { createServerFn } from "@tanstack/react-start";
import { getValidatedFund } from "./validated-fund";
import { getDirectFundFallback } from "./fund-direct-fallback";
import { withEstimateSafety } from "./estimate-safety";
import type { FundQuote } from "../types";

function hasUsableFundData(quote: FundQuote | null | undefined) {
  return !!quote && (
    quote.nav != null ||
    quote.estimate != null ||
    quote.historyPoints.length > 0 ||
    quote.metrics != null
  );
}

function hasCurrentEstimate(quote: FundQuote | null | undefined) {
  return !!quote && quote.estimate != null && quote.estimatePct != null && quote.valuationStatus === "estimate";
}

const IN_FLIGHT = new Map<string, Promise<FundQuote>>();
const RECENT = new Map<string, { at: number; value: FundQuote }>();
const CACHE_TTL_MS = 15_000;

/**
 * The validated live-valuation path is authoritative during market hours.
 * The direct pingzhongdata path is historical-NAV fallback only and must not
 * win a race against a slower intraday valuation request.
 */
async function loadFund(code: string): Promise<FundQuote> {
  try {
    const validated = await getValidatedFund({ data: { code } });
    if (hasCurrentEstimate(validated) || validated.officialNavPublished === true) {
      return withEstimateSafety(validated);
    }

    // A validated response may legitimately say there is no usable intraday
    // estimate (for example because the disclosed holdings cannot be verified).
    // In that case keep its explicit state rather than replacing it with an
    // apparently fresh-looking historical NAV.
    if (hasUsableFundData(validated)) return withEstimateSafety(validated);
  } catch {
    // Fall through to the direct historical-NAV fallback below.
  }

  try {
    const direct = await getDirectFundFallback({ data: { code } });
    if (direct && hasUsableFundData(direct)) return withEstimateSafety(direct);
  } catch {
    // Fail closed below.
  }

  return withEstimateSafety({
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
  });
}

export const getResilientFund = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<FundQuote> => {
    const code = data.code.trim();
    if (!/^\d{6}$/.test(code)) return loadFund(code);

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