/**
 * Fund AI Pro 交易日工具
 * 所有日期判断统一使用中国标准时间，避免 Vercel/浏览器时区差异。
 *
 * 2026 A股休市日期依据上交所/深交所已公布的年度休市安排。
 */
function cnDate(date = new Date()): Date {
  const d = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dateLabel(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// Exchange-wide 2026 closed dates. Weekend dates are handled separately.
const EXCHANGE_CLOSED_2026 = new Set([
  "2026-01-01",
  "2026-01-02",
  "2026-01-03",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-02-20",
  "2026-02-23",
  "2026-04-06",
  "2026-05-01",
  "2026-05-04",
  "2026-05-05",
  "2026-06-19",
  "2026-09-25",
  "2026-10-01",
  "2026-10-02",
  "2026-10-05",
  "2026-10-06",
  "2026-10-07",
]);

function isNormalizedClosedDate(d: Date): boolean {
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return true;
  return EXCHANGE_CLOSED_2026.has(dateLabel(d));
}

export function isExchangeClosed(date = new Date()): boolean {
  return isNormalizedClosedDate(cnDate(date));
}

/** Canonical trading-day predicate used by market-hours.ts. */
export function isAshareTradingDay(date = new Date()): boolean {
  return !isExchangeClosed(date);
}

/** Backward-compatible closed-day alias used by data services. */
export function isWeekend(date = new Date()): boolean {
  return isExchangeClosed(date);
}

export function isTradingDay(date = new Date()): boolean {
  return isAshareTradingDay(date);
}

export function latestTradingDate(date = new Date()): Date {
  const d = cnDate(date);
  while (isNormalizedClosedDate(d)) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

export function tradingDateLabel(date = new Date()): string {
  return dateLabel(latestTradingDate(date));
}
