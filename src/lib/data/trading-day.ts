/**
 * Fund AI Pro 交易日工具
 * 所有日期判断统一使用中国标准时间，避免 Vercel/浏览器时区差异。
 */
function cnDate(date = new Date()): Date {
  const d = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isWeekend(date = new Date()): boolean {
  const day = cnDate(date).getUTCDay();
  return day === 0 || day === 6;
}

export function latestTradingDate(date = new Date()): Date {
  const d = cnDate(date);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

export function tradingDateLabel(date = new Date()): string {
  const d = latestTradingDate(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
