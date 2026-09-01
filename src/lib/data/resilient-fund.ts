import { createServerFn } from "@tanstack/react-start";
import { getValidatedFund } from "./validated-fund";
import { getDirectFundFallback } from "./fund-direct-fallback";
import { withEstimateSafety } from "./estimate-safety";
import { getMarketPhase } from "../market-hours";
import { cnTime } from "../format";
import type { FundQuote } from "../types";

function hasUsableFundData(quote: FundQuote | null | undefined) {
  return !!quote && (
    quote.nav != null ||
    quote.estimate != null ||
    quote.historyPoints.length > 0 ||
    quote.metrics != null
  );
}

function chinaDateLabel(date = new Date()) {
  const t = cnTime(date);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

function isTodayEstimate(quote: FundQuote, now = new Date()) {
  if (quote.estimate == null || quote.estimatePct == null) return false;
  if (quote.valuationStatus !== "estimate") return false;
  if (!quote.estimateTime) return false;
  return quote.estimateTime.slice(0, 10) === chinaDateLabel(now);
}

function isTodayOfficial(quote: FundQuote, now = new Date()) {
  return !!quote.nav && quote.navDate === chinaDateLabel(now) && quote.officialNavPublished === true;
}

/**
 * Intraday rule:
 * 1. During morning/afternoon, the validated live-valuation path is authoritative.
 * 2. A historical NAV fallback must never win a race against today's valuation.
 * 3. If no reliable intraday valuation exists, keep the latest official NAV but
 *    leave the display layer free to label it as stale/latest-official.
 */
async function loadFund(code: string): Promise<FundQuote> {
  const phase = getMarketPhase();

  if (phase === "morning" || phase === "afternoon" || phase === "lunch") {
    try {
      const validated = await getValidatedFund({ data: { code } });
      if (hasUsableFundData(validated)) {
        return withEstimateSafety(validated);
      }
    } catch {
      // Continue to the direct historical fallback only after the live path fails.
    }

    try {
      const direct = await getDirectFundFallback({ data: { code } });
      if (direct && hasUsableFundData(direct)) return withEstimateSafety(direct);
    } catch {
      // fall through to unavailable
    }
  } else {
    const validatedPromise = getValidatedFund({ data: { code } });
    const directPromise = getDirectFundFallback({ data: { code } });
    try {
      const validated = await validatedPromise;
      if (hasUsableFundData(validated)) return withEstimateSafety(validated);
    } catch {
      // try direct below
    }
    try {
      const direct = await directPromise;
      if (direct && hasUsableFundData(direct)) return withEstimateSafety(direct);
    } catch {
      // fall through
    }
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
    const phase = getMarketPhase();
    const now = new Date();

    // During trading hours, never serve a cached historical NAV ahead of a
    // possible live estimate. Only reuse cache when it is itself today's
    // estimate or today's official NAV.
    if (recent && Date.now() - recent.at < CACHE_TTL_MS && hasUsableFundData(recent.value)) {
      if (phase === "morning" || phase === "afternoon" || phase === "lunch") {
        if (isTodayEstimate(recent.value, now) || isTodayOfficial(recent.value, now)) return recent.value;
      } else {
        return recent.value;
      }
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