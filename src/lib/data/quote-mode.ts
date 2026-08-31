import type { FundQuote } from "../types";
import { cnTime } from "../format";
import { getMarketPhase } from "../market-hours";

export type FundQuoteMode = "official_today" | "live_estimate" | "latest_official" | "unavailable";

export type FundDisplayQuote = {
  mode: FundQuoteMode;
  price: number | null;
  pct: number | null;
  label: string;
  dataDate: string | null;
  confidence: "high" | "medium" | "low" | "none";
  reason?: string;
};

function sameChinaDate(dateText: string | null | undefined, now = new Date()) {
  if (!dateText) return false;
  const [y, m, d] = dateText.split(/[-/]/).map(Number);
  if (![y, m, d].every(Number.isFinite)) return false;
  const t = cnTime(now);
  return y === t.getUTCFullYear() && m === t.getUTCMonth() + 1 && d === t.getUTCDate();
}

/** Today is official only when the data layer explicitly confirms publication. */
export function isOfficialNavToday(fund: FundQuote | undefined, now = new Date()) {
  return Boolean(fund?.nav != null && sameChinaDate(fund.navDate, now) && fund.officialNavPublished === true);
}

function hasTodayEstimate(fund: FundQuote, now: Date) {
  return (
    fund.estimate != null &&
    fund.estimatePct != null &&
    sameChinaDate(fund.estimateTime, now) &&
    fund.estimateConfidence === "high" &&
    fund.valuationStatus === "estimate"
  );
}

export function selectFundDisplayQuote(fund: FundQuote | undefined, now = new Date()): FundDisplayQuote {
  if (!fund) {
    return { mode: "unavailable", price: null, pct: null, label: "暂无可靠行情", dataDate: null, confidence: "none", reason: "尚未取得基金数据" };
  }

  const phase = getMarketPhase(now);

  if (isOfficialNavToday(fund, now)) {
    return {
      mode: "official_today",
      price: fund.nav,
      pct: fund.dayPct,
      label: "今日官方净值",
      dataDate: fund.navDate,
      confidence: "high",
      reason: "数据层已明确确认今日官方净值发布",
    };
  }

  if ((phase === "morning" || phase === "afternoon") && hasTodayEstimate(fund, now)) {
    return {
      mode: "live_estimate",
      price: fund.estimate,
      pct: fund.estimatePct,
      label: "盘中实时估值 · 双源/三源核验",
      dataDate: chinaToday(fund.estimateTime, now) ? chinaTodayLabel(now) : null,
      confidence: "high",
      reason: "仅使用已通过可靠性门槛的盘中穿透估值，不使用模拟数据",
    };
  }

  if ((phase === "lunch" || phase === "postclose") && hasTodayEstimate(fund, now)) {
    return {
      mode: "live_estimate",
      price: fund.estimate,
      pct: fund.estimatePct,
      label: phase === "lunch" ? "上午收盘估值 · 午间沿用" : "今日收盘估值 · 等待官方净值",
      dataDate: chinaToday(fund.estimateTime, now) ? chinaTodayLabel(now) : null,
      confidence: "high",
      reason: phase === "lunch" ? "午间休市，沿用上午最后可靠估值" : "官方净值尚未明确发布，暂沿用今日最后可靠估值",
    };
  }

  if (fund.nav != null && fund.navDate) {
    const knownOfficialOnly = /不使用A股|不生成股票穿透估值|QDII|债券|货币/.test(fund.estimateMethod || "");
    return {
      mode: "latest_official",
      price: fund.nav,
      pct: fund.dayPct,
      label: `最近官方净值 · ${fund.navDate}`,
      dataDate: fund.navDate,
      confidence: "high",
      reason: knownOfficialOnly ? "该基金类型不适用A股盘中穿透估值" : "当前没有已确认的今日官方净值或可靠盘中估值",
    };
  }

  return { mode: "unavailable", price: null, pct: null, label: "暂无可靠行情", dataDate: null, confidence: "none", reason: "没有可用于展示的可靠净值或估值" };
}

function chinaToday(date: string | null | undefined, now: Date) {
  return Boolean(date && sameChinaDate(date, now));
}

function chinaTodayLabel(date = new Date()) {
  const t = cnTime(date);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}
