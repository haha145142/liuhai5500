import type { FundQuote, Holding } from "../types";
import { calcHoldingReturn } from "./portfolio-returns";

type HistoryPoint = { date: string; nav: number };

function pointsFor(fund: FundQuote | undefined): HistoryPoint[] {
  return (fund?.historyPoints ?? [])
    .filter((p) => p && typeof p.date === "string" && Number.isFinite(p.nav) && p.nav > 0)
    .map((p) => ({ date: p.date, nav: p.nav }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function atOrBefore(points: HistoryPoint[], dateKey: string): HistoryPoint | null {
  let found: HistoryPoint | null = null;
  for (const point of points) {
    if (point.date > dateKey) break;
    found = point;
  }
  return found;
}

function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type PeriodId = "week" | "month" | "year";
export type PeriodReturn = {
  id: PeriodId;
  label: string;
  amount: number | null;
  pct: number | null;
  pricedCount: number;
  eligibleCount: number;
  baseDate: string | null;
};

function periodStart(id: PeriodId, now = new Date()): string {
  if (id === "year") return `${now.getFullYear()}-01-01`;
  if (id === "month") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const day = now.getDay();
  const delta = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - delta);
  return localDateKey(monday);
}

/**
 * Calendar-period return, based on the first available official NAV on or before
 * the period start. The current price still comes from the same quote selector
 * used by the portfolio return core, so no second pricing rule is introduced.
 */
export function calcPortfolioPeriodReturn(
  period: PeriodId,
  holdings: Holding[],
  funds: Record<string, FundQuote>,
  now = new Date(),
): PeriodReturn {
  const labels: Record<PeriodId, string> = { week: "本周", month: "本月", year: "今年" };
  const start = periodStart(period, now);
  let amount = 0;
  let baseValue = 0;
  let pricedCount = 0;
  let eligibleCount = 0;
  const baseDates = new Set<string>();

  for (const holding of holdings) {
    const fund = funds[holding.code];
    const holdingReturn = calcHoldingReturn(holding, fund);
    if (holdingReturn.marketValue == null) continue;
    pricedCount += 1;
    const base = atOrBefore(pointsFor(fund), start);
    if (!base) continue;
    eligibleCount += 1;
    amount += (holdingReturn.price! - base.nav) * holding.shares;
    baseValue += base.nav * holding.shares;
    baseDates.add(base.date);
  }

  return {
    id: period,
    label: labels[period],
    amount: eligibleCount > 0 ? amount : null,
    pct: eligibleCount > 0 && baseValue > 0 ? (amount / baseValue) * 100 : null,
    pricedCount,
    eligibleCount,
    baseDate: baseDates.size === 1 ? [...baseDates][0] : null,
  };
}

export type DailyPnl = { amount: number | null; coveredFunds: number; totalFunds: number };

/**
 * Daily portfolio P&L from official NAVs. This is historical review only and
 * deliberately does not mix today's intraday estimate into calendar cells.
 */
export function calcDailyPortfolioPnl(dateKey: string, holdings: Holding[], funds: Record<string, FundQuote>): DailyPnl {
  let amount = 0;
  let coveredFunds = 0;
  for (const holding of holdings) {
    const points = pointsFor(funds[holding.code]);
    const index = points.findIndex((point) => point.date === dateKey);
    if (index <= 0) continue;
    const current = points[index];
    const previous = points[index - 1];
    if (current && previous) {
      amount += holding.shares * (current.nav - previous.nav);
      coveredFunds += 1;
    }
  }
  return {
    amount: coveredFunds > 0 ? amount : null,
    coveredFunds,
    totalFunds: holdings.length,
  };
}
