import { cnTime } from "./format";
import { isAshareTradingDay } from "./data/trading-day";

export type MarketPhase = "preopen" | "morning" | "lunch" | "afternoon" | "postclose" | "weekend";

export function isWeekend(d = new Date()): boolean {
  return !isAshareTradingDay(d);
}

/**
 * A-share continuous auction: 09:30–11:30, 13:00–15:00 CST.
 * Weekends and configured exchange holidays are treated as non-trading days.
 */
export function getMarketPhase(d = new Date()): MarketPhase {
  if (!isAshareTradingDay(d)) return "weekend";
  const t = cnTime(d);
  const mins = t.getUTCHours() * 60 + t.getUTCMinutes();
  if (mins < 9 * 60 + 30) return "preopen";
  if (mins <= 11 * 60 + 30) return "morning";
  if (mins < 13 * 60) return "lunch";
  if (mins <= 15 * 60) return "afternoon";
  return "postclose";
}

export function isTradeTime(d = new Date()): boolean {
  const phase = getMarketPhase(d);
  return phase === "morning" || phase === "afternoon";
}

export function sessionLabel(d = new Date()): string {
  switch (getMarketPhase(d)) {
    case "weekend": return "休市 · 显示最近交易日";
    case "preopen": return "开盘前 · 最近交易日数据";
    case "morning": return "上午盘中实时";
    case "lunch": return "午间休市 · 沿用上午数据";
    case "afternoon": return "下午盘中实时";
    case "postclose": return "已收盘 · 等待官方净值";
  }
}
