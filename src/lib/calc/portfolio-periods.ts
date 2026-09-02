import type { FundQuote, Holding } from "../types";
import { calcHoldingReturn } from "./portfolio-returns.ts";

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
function chinaDate(date = new Date()): Date { return new Date(date.getTime() + 8 * 60 * 60 * 1000); }
function dateKeyFromParts(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`; }
function subtractCalendarMonths(date: Date, months: number) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}
function subtractCalendarYears(date: Date, years: number) {
  const target = new Date(Date.UTC(date.getUTCFullYear() - years, date.getUTCMonth(), 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}

export type FundPeriodId = "week" | "month" | "quarter" | "half" | "year";
function fundPeriodStart(id: FundPeriodId, now = new Date()) {
  const shifted = chinaDate(now);
  if (id === "week") { const start = new Date(shifted); start.setUTCDate(start.getUTCDate() - 7); return dateKeyFromParts(start); }
  if (id === "month") return dateKeyFromParts(subtractCalendarMonths(shifted, 1));
  if (id === "quarter") return dateKeyFromParts(subtractCalendarMonths(shifted, 3));
  if (id === "half") return dateKeyFromParts(subtractCalendarMonths(shifted, 6));
  return dateKeyFromParts(subtractCalendarYears(shifted, 1));
}
export type FundPeriodReturn = { id: FundPeriodId; amount: number | null; pct: number | null; baseDate: string | null; currentDate: string | null };

function baseForHolding(holding: Holding, points: HistoryPoint[], start: string): { nav: number; date: string } | null {
  const purchaseDate = holding.purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(holding.purchaseDate) ? holding.purchaseDate : null;
  if (purchaseDate && purchaseDate > start) return { nav: holding.cost, date: purchaseDate };
  const base = atOrBefore(points, start);
  return base && base.nav > 0 ? base : null;
}

export function calcFundPeriodReturn(period: FundPeriodId, holding: Holding, fund: FundQuote | undefined, now = new Date()): FundPeriodReturn {
  const points = pointsFor(fund);
  const ret = calcHoldingReturn(holding, fund, now);
  const currentDate = fund?.navDate ?? null;
  if (ret.price == null) return { id: period, amount: null, pct: null, baseDate: null, currentDate };
  const base = baseForHolding(holding, points, fundPeriodStart(period, now));
  if (!base) return { id: period, amount: null, pct: null, baseDate: null, currentDate };
  return { id: period, amount: (ret.price - base.nav) * holding.shares, pct: (ret.price - base.nav) / base.nav * 100, baseDate: base.date, currentDate };
}

export type PeriodId = "week" | "month" | "quarter" | "year";
export type PeriodReturn = { id: PeriodId; label: string; amount: number | null; pct: number | null; pricedCount: number; eligibleCount: number; baseDate: string | null };
function periodStart(id: PeriodId, now = new Date()) {
  const shifted = chinaDate(now);
  if (id === "week") { const start = new Date(shifted); start.setUTCDate(start.getUTCDate() - 7); return dateKeyFromParts(start); }
  if (id === "month") return dateKeyFromParts(subtractCalendarMonths(shifted, 1));
  if (id === "quarter") return dateKeyFromParts(subtractCalendarMonths(shifted, 3));
  return `${shifted.getUTCFullYear()}-01-01`;
}
export function calcPortfolioPeriodReturn(period: PeriodId, holdings: Holding[], funds: Record<string, FundQuote>, now = new Date()): PeriodReturn {
  const labels: Record<PeriodId, string> = { week: "一周", month: "一个月", quarter: "近三个月", year: "今年" };
  const start = periodStart(period, now);
  let amount = 0;
  let baseValue = 0;
  let pricedCount = 0;
  let eligibleCount = 0;
  const baseDates = new Set<string>();
  for (const holding of holdings) {
    const fund = funds[holding.code];
    const holdingReturn = calcHoldingReturn(holding, fund, now);
    if (holdingReturn.marketValue == null) continue;
    pricedCount += 1;
    const base = baseForHolding(holding, pointsFor(fund), start);
    if (!base || base.nav <= 0) continue;
    eligibleCount += 1;
    amount += (holdingReturn.price! - base.nav) * holding.shares;
    baseValue += base.nav * holding.shares;
    baseDates.add(base.date);
  }
  const complete = holdings.length > 0 && pricedCount === holdings.length && eligibleCount === holdings.length;
  return { id: period, label: labels[period], amount: complete ? amount : null, pct: complete && baseValue > 0 ? amount / baseValue * 100 : null, pricedCount, eligibleCount, baseDate: baseDates.size === 1 ? [...baseDates][0] : null };
}

export type DailyPnl = { amount: number | null; coveredFunds: number; totalFunds: number };
export function calcDailyPortfolioPnl(dateKey: string, holdings: Holding[], funds: Record<string, FundQuote>): DailyPnl {
  let amount = 0;
  let coveredFunds = 0;
  for (const holding of holdings) {
    const points = pointsFor(funds[holding.code]);
    const index = points.findIndex((point) => point.date === dateKey);
    if (index <= 0) continue;
    const current = points[index];
    const previous = points[index - 1];
    if (current && previous) { amount += holding.shares * (current.nav - previous.nav); coveredFunds += 1; }
  }
  return { amount: coveredFunds > 0 ? amount : null, coveredFunds, totalFunds: holdings.length };
}
