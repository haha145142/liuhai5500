import type { FundQuote, Holding } from "../types";

type PeriodKey = "week" | "month" | "year";

export type PeriodReturn = {
  key: PeriodKey;
  amount: number | null;
  pct: number | null;
  baseDate: string | null;
  currentDate: string | null;
  pricedCount: number;
  totalCount: number;
};

type Point = { date: string; nav: number };

function validPoints(fund: FundQuote | undefined): Point[] {
  if (!fund) return [];
  return (fund.historyPoints || [])
    .filter((p) => Number.isFinite(p.nav) && p.nav > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function periodStart(date: Date, key: PeriodKey): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (key === "year") return `${year}-01-01`;
  if (key === "month") return `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(year, month, date.getDate() + mondayOffset);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function findBasePoint(points: Point[], startDate: string, currentDate: string): Point | null {
  const candidates = points.filter((p) => p.date >= startDate && p.date <= currentDate);
  return candidates[0] ?? null;
}

function currentPoint(fund: FundQuote | undefined): Point | null {
  const points = validPoints(fund);
  return points.at(-1) ?? null;
}

export function calcFundPeriodReturn(fund: FundQuote | undefined, key: PeriodKey, now = new Date()): { amountPct: number | null; baseDate: string | null; currentDate: string | null } {
  const points = validPoints(fund);
  const current = currentPoint(fund);
  if (!current) return { amountPct: null, baseDate: null, currentDate: null };
  const base = findBasePoint(points, periodStart(now, key), current.date);
  if (!base || base.nav <= 0) return { amountPct: null, baseDate: null, currentDate: current.date };
  return { amountPct: ((current.nav - base.nav) / base.nav) * 100, baseDate: base.date, currentDate: current.date };
}

export function calcPortfolioPeriodReturn(
  holdings: Holding[],
  funds: Record<string, FundQuote>,
  key: PeriodKey,
  now = new Date(),
): PeriodReturn {
  let amount = 0;
  let baseValue = 0;
  let pricedCount = 0;
  let baseDate: string | null = null;
  let currentDate: string | null = null;

  for (const holding of holdings) {
    const fund = funds[holding.code];
    const points = validPoints(fund);
    const current = currentPoint(fund);
    if (!current) continue;
    const base = findBasePoint(points, periodStart(now, key), current.date);
    if (!base) continue;
    const shares = Number(holding.shares);
    if (!Number.isFinite(shares) || shares <= 0) continue;
    amount += (current.nav - base.nav) * shares;
    baseValue += base.nav * shares;
    pricedCount += 1;
    if (!baseDate || base.date < baseDate) baseDate = base.date;
    if (!currentDate || current.date > currentDate) currentDate = current.date;
  }

  return {
    key,
    amount: pricedCount ? amount : null,
    pct: pricedCount && baseValue > 0 ? (amount / baseValue) * 100 : null,
    baseDate,
    currentDate,
    pricedCount,
    totalCount: holdings.length,
  };
}

export function calcStandardPortfolioPeriods(holdings: Holding[], funds: Record<string, FundQuote>, now = new Date()): PeriodReturn[] {
  return (["week", "month", "year"] as const).map((key) => calcPortfolioPeriodReturn(holdings, funds, key, now));
}
