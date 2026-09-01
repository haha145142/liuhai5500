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
  const text = String(dateText).trim();
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const compactDate = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  const m = isoDate || compactDate;
  if (!m) return false;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (![y, month, day].every(Number.isFinite)) return false;
  const t = cnTime(now);
  return y === t.getUTCFullYear() && month === t.getUTCMonth() + 1 && day === t.getUTCDate();
}

export function isOfficialNavToday(fund: FundQuote | undefined, now = new Date()) {
  return Boolean(fund?.nav != null && sameChinaDate(fund.navDate, now) && fund.officialNavPublished === true);
}

function hasTodayEstimate(fund: FundQuote, now: Date) {
  const confidence = fund.estimateConfidence ?? "low";
  return fund.estimate != null && fund.estimatePct != null && sameChinaDate(fund.estimateTime, now) && fund.valuationStatus === "estimate" && ["high", "medium", "low"].includes(confidence);
}

function estimateConfidence(fund: FundQuote): "high" | "medium" | "low" {
  return fund.estimateConfidence ?? "low";
}

function resolveNavPct(fund: FundQuote, navDate: string | null | undefined) {
  if (fund.dayPct != null && Number.isFinite(fund.dayPct)) return fund.dayPct;
  if (!navDate) return null;
  const match = fund.historyPoints.find((point) => point.date === navDate);
  return match?.changePct != null && Number.isFinite(match.changePct) ? match.changePct : null;
}

export function selectFundDisplayQuote(fund: FundQuote | undefined, now = new Date()): FundDisplayQuote {
  if (!fund) return { mode: "unavailable", price: null, pct: null, label: "暂无可靠行情", dataDate: null, confidence: "none", reason: "尚未取得基金数据" };
  const phase = getMarketPhase(now);

  if (isOfficialNavToday(fund, now)) {
    return { mode: "official_today", price: fund.nav, pct: resolveNavPct(fund, fund.navDate), label: "今日官方净值", dataDate: fund.navDate, confidence: "high", reason: "数据层已明确确认今日官方净值发布" };
  }

  if ((phase === "morning" || phase === "afternoon") && hasTodayEstimate(fund, now)) {
    const confidence = estimateConfidence(fund);
    return { mode: "live_estimate", price: fund.estimate, pct: fund.estimatePct, label: `盘中实时估值 · ${confidence === "high" ? "高" : confidence === "medium" ? "中" : "低"}置信度`, dataDate: chinaToday(fund.estimateTime, now) ? chinaTodayLabel(now) : null, confidence, reason: "使用当日盘中穿透估值；置信度取决于重仓行情覆盖与多源一致性，不以昨日净值替代" };
  }

  if (phase === "lunch" && hasTodayEstimate(fund, now)) {
    const confidence = estimateConfidence(fund);
    return { mode: "live_estimate", price: fund.estimate, pct: fund.estimatePct, label: `上午最后估值 · ${confidence === "high" ? "高" : confidence === "medium" ? "中" : "低"}置信度`, dataDate: chinaToday(fund.estimateTime, now) ? chinaTodayLabel(now) : null, confidence, reason: "午间休市，沿用今日上午最后可用盘中估值" };
  }

  if (fund.nav != null && fund.navDate) {
    const knownOfficialOnly = /不使用A股|不生成股票穿透估值|QDII|债券|货币/.test(fund.estimateMethod || "");
    return { mode: "latest_official", price: fund.nav, pct: resolveNavPct(fund, fund.navDate), label: `最近官方净值 · ${fund.navDate}`, dataDate: fund.navDate, confidence: "high", reason: knownOfficialOnly ? "该基金类型不适用A股盘中穿透估值" : "当前没有当日可验证盘中估值，明确标记为最近官方净值" };
  }

  return { mode: "unavailable", price: null, pct: null, label: "暂无可靠行情", dataDate: null, confidence: "none", reason: "没有可用于展示的可靠净值或估值" };
}

function chinaToday(date: string | null | undefined, now: Date) { return Boolean(date && sameChinaDate(date, now)); }
function chinaTodayLabel(date = new Date()) { const t = cnTime(date); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`; }
