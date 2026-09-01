import type { FundQuote, Holding } from "../types";
import { calcPortfolioPeriodReturn as calcUnifiedPortfolioPeriodReturn } from "./portfolio-periods";

export type PeriodKey = "week" | "month" | "year";

export type PeriodReturn = {
  key: PeriodKey;
  amount: number | null;
  pct: number | null;
  baseDate: string | null;
  currentDate: string | null;
  pricedCount: number;
  totalCount: number;
};

/**
 * Single public portfolio-period entry point.
 * The implementation intentionally delegates to portfolio-periods.ts so the
 * dashboard, fund cards and portfolio analytics cannot drift into different
 * calendar/date/price definitions.
 */
export function calcPortfolioPeriodReturn(
  holdings: Holding[],
  funds: Record<string, FundQuote>,
  key: PeriodKey,
  now = new Date(),
): PeriodReturn {
  const result = calcUnifiedPortfolioPeriodReturn(key, holdings, funds, now);
  return {
    key,
    amount: result.amount,
    pct: result.pct,
    baseDate: result.baseDate,
    currentDate: result.baseDate ? (result.pricedCount > 0 ? now.toISOString().slice(0, 10) : null) : null,
    pricedCount: result.pricedCount,
    totalCount: result.totalCount,
  };
}

export function calcStandardPortfolioPeriods(
  holdings: Holding[],
  funds: Record<string, FundQuote>,
  now = new Date(),
): PeriodReturn[] {
  return (["week", "month", "year"] as const).map((key) => calcPortfolioPeriodReturn(holdings, funds, key, now));
}
