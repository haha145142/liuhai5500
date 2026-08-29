import { cnTime } from "./format";

export function isWeekend(d = new Date()): boolean {
  const day = cnTime(d).getUTCDay();
  return day === 0 || day === 6;
}

/** A-share continuous auction: 09:30–11:30, 13:00–15:00 CST, weekdays. */
export function isTradeTime(d = new Date()): boolean {
  const t = cnTime(d);
  const day = t.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = t.getUTCHours() * 60 + t.getUTCMinutes();
  return (mins >= 9 * 60 + 30 && mins <= 11 * 60 + 30) || (mins >= 13 * 60 && mins <= 15 * 60);
}

export function sessionLabel(d = new Date()): string {
  if (isWeekend(d)) return "周末休市";
  if (isTradeTime(d)) return "盘中实时";
  const t = cnTime(d);
  const mins = t.getUTCHours() * 60 + t.getUTCMinutes();
  if (mins < 9 * 60 + 30) return "开盘前";
  if (mins < 13 * 60) return "午间休市";
  return "已收盘";
}
