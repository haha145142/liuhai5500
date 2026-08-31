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

export function isOfficialNavToday(fund: FundQuote | undefined, now = new Date()) {
  return Boolean(
    fund?.nav != null &&
      sameChinaDate(fund.navDate, now) &&
      (fund.officialNavPublished === true || fund.officialNavPublished == null),
  );
}

function hasTodayEstimate(fund: FundQuote, now: Date) {
  return (
    fund.estimate != null &&
    fund.estimatePct != null &&
    sameChinaDate(fund.estimateTime, now) &&
    fund.estimateConfidence !== "low" &&
    fund.valuationStatus !== "unavailable"
  );
}

export function selectFundDisplayQuote(fund: FundQuote | undefined, now = new Date()): FundDisplayQuote {
  if (!fund) {
    return { mode: "unavailable", price: null, pct: null, label: "暂无可靠行情", dataDate: null, confidence: "none", reason: "尚未取得基金数据" };
  }

  const phase = getMarketPhase(now);

  // Once today's official NAV is published, it is the single display authority.
  if (isOfficialNavToday(fund, now) && fund.nav != null) {
    return {
      mode: "official_today",
      price: fund.nav,
      pct: fund.dayPct,
      label: "今日官方净值",
      dataDate: fund.navDate,
      confidence: "high",
      reason: "今日官方净值已经发布，优先采用官方数据",
    };
  }

  // During the two trading sessions, use only the validated self-built estimate.
  if ((phase === "morning" || phase === "afternoon") && hasTodayEstimate(fund, now)) {
    const confidence = fund.estimateConfidence === "high" ? "high" : "medium";
    return {
      mode: "live_estimate",
      price: fund.estimate,
      pct: fund.estimatePct,
      label: confidence === "high" ? "盘中自算估值 · 已交叉验证" : "盘中自算估值 · 中置信度",
      dataDate: sameChinaDate(fund.estimateTime, now) ? fund.navDate : null,
      confidence,
      reason: "交易时段内采用重仓穿透估值，并保留可靠性门槛；不使用模拟数据",
    };
  }

  // Lunch break and post-close keep the latest validated intraday state until
  // today's official NAV is actually available, instead of jumping to yesterday's NAV.
  if ((phase === "lunch" || phase === "postclose") && hasTodayEstimate(fund, now)) {
    const confidence = fund.estimateConfidence === "high" ? "high" : "medium";
    return {
      mode: "live_estimate",
      price: fund.estimate,
      pct: fund.estimatePct,
      label: phase === "lunch" ? "上午收盘估值 · 午间沿用" : "今日收盘估值 · 等待官方净值",
      dataDate: sameChinaDate(fund.estimateTime, now) ? fund.navDate : null,
      confidence,
      reason: phase === "lunch" ? "午间休市，不切回前一交易日；沿用上午最后可靠数据" : "今日交易已结束，官方净值尚未发布，暂沿用今日最后可靠估值",
    };
  }

  // Before open, and on weekends/holidays, show the latest official NAV.
  if (fund.nav != null) {
    const knownOfficialOnly = /不使用A股|不生成股票穿透估值|QDII|债券|货币/.test(fund.estimateMethod || "");
    return {
      mode: "latest_official",
      price: fund.nav,
      pct: fund.dayPct,
      label: fund.navDate ? `最近官方净值 · ${fund.navDate}` : "最近官方净值",
      dataDate: fund.navDate,
      confidence: "high",
      reason: knownOfficialOnly ? "该基金类型不适用A股盘中穿透估值，采用官方净值" : "当前没有今日可用盘中估值，采用最近官方净值",
    };
  }

  return { mode: "unavailable", price: null, pct: null, label: "暂无可靠行情", dataDate: null, confidence: "none", reason: "没有可用于展示的可靠净值或估值" };
}
