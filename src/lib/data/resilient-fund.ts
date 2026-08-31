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

export const getResilientFund = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<FundQuote> => {
    const code = data.code.trim();
    try {
      const validated = await getValidatedFund({ data: { code } });
      if (hasUsableFundData(validated)) return validated;
    } catch {
      // direct fallback below
    }

    try {
      const direct = await getDirectFundFallback({ data: { code } });
      if (direct) return direct;
    } catch {
      // fail closed with an explicit unavailable state
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
  });
