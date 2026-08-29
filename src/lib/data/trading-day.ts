/**
 * Fund AI Pro 交易日工具
 * 不依赖外部接口。
 */
export function isWeekend(date = new Date()): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function latestTradingDate(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }

  return d;
}

export function tradingDateLabel(date = new Date()): string {
  const d = latestTradingDate(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
