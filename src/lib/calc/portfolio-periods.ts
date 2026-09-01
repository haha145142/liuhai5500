import type { FundQuote, Holding } from "../types";
import { calcHoldingReturn } from "./portfolio-returns";

type HistoryPoint = { date: string; nav: number };

function pointsFor(fund: FundQuote | undefined): HistoryPoint[] {
  return (fund?.historyPoints ?? [])
    .filter((p) => p && typeof p.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.nav) && p.nav > 0)
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

function chinaDateKey(date = new Date()): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function dateKeyFromParts(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function subtractCalendarMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const targetMonth = m - months;
  const target = new Date(Date.UTC(y, targetMonth, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target;
}

export type PeriodId = "week" | "month" | "quarter" | "year";
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
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  if (id === "year") return `${shifted.getUTCFullYear()}-01-01`;
  if (id === "month") return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-01`;
  if (id === "quarter") return dateKeyFromParts(subtractCalendarMonths(shifted, 3));
  const day = shifted.getUTCDay();
  const delta = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - delta));
  return dateKeyFromParts(monday);
}

/**
 * Portfolio period return.
 * - week/month/year use calendar period boundaries.
 * - quarter is a rolling three-calendar-month window, matching the UI label "近三个月".
 * The current price uses the same quote selector as the portfolio-return core, so
 * an intraday estimate can flow into the headline while the base is always an
 * historical official NAV on or before the period start.
 */
export function calcPortfolioPeriodReturn(
  period: PeriodId,
  holdings: Holding[],
  funds: Record<string, FundQuote>,
  now = new Date(),
): PeriodReturn {
  const labels: Record<PeriodId, string> = { week: "本周", month: "本月", quarter: "近三个月", year: "今年" };
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
 * Daily portfolio P&L from official NAVs. Historical review only; it deliberately
 * does not mix today's intraday estimate into calendar cells.
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
