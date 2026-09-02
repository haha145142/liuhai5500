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

function sameChinaDate(value: string | null | undefined, now = new Date()) {
  if (!value) return false;
  const m = String(value).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return false;
  const t = cnTime(now);
  return Number(m[1]) === t.getUTCFullYear() && Number(m[2]) === t.getUTCMonth() + 1 && Number(m[3]) === t.getUTCDate();
}

export function isOfficialNavToday(fund: FundQuote | undefined, now = new Date()) {
  return Boolean(fund?.nav != null && sameChinaDate(fund.navDate, now) && fund.officialNavPublished === true);
}

function hasTodayEstimate(fund: FundQuote, now: Date) {
  const c = fund.estimateConfidence ?? "low";
  return (
    fund.estimate != null &&
    fund.estimatePct != null &&
    sameChinaDate(fund.estimateTime, now) &&
    (fund.valuationStatus === "estimate" || fund.valuationStatus === "live_estimate") &&
    ["high", "medium", "low"].includes(c)
  );
}

function conf(f: FundQuote): "high" | "medium" | "low" {
  return f.estimateConfidence ?? "low";
}

function resolveNavPct(fund: FundQuote, date: string | null | undefined) {
  if (fund.dayPct != null && Number.isFinite(fund.dayPct)) return fund.dayPct;
  if (!date) return null;
  const p = fund.historyPoints.find((x) => x.date === date);
  return p?.changePct != null && Number.isFinite(p.changePct) ? p.changePct : null;
}

function labelConf(c: "high" | "medium" | "low") {
  return c === "high" ? "高" : c === "medium" ? "中" : "低";
}

function latestOfficial(fund: FundQuote): FundDisplayQuote {
  const known = /不使用A股|不生成股票穿透估值|QDII|债券|货币/.test(fund.estimateMethod || "");
  return {
    mode: "latest_official",
    price: fund.nav,
    pct: resolveNavPct(fund, fund.navDate),
    label: `最近官方净值 · ${fund.navDate || "未知日期"}`,
    dataDate: fund.navDate,
    confidence: "high",
    reason: known ? "该基金类型不适用A股盘中穿透估值" : "当前没有当日可验证盘中估值，明确标记为最近官方净值",
  };
}

export function selectFundDisplayQuote(fund: FundQuote | undefined, now = new Date()): FundDisplayQuote {
  if (!fund) return { mode: "unavailable", price: null, pct: null, label: "暂无可靠行情", dataDate: null, confidence: "none", reason: "尚未取得基金数据" };

  // 官方净值一旦确认发布，始终优先于估值；页面下一次刷新/重新计算即可立即切换。
  if (isOfficialNavToday(fund, now)) {
    return {
      mode: "official_today",
      price: fund.nav,
      pct: resolveNavPct(fund, fund.navDate),
      label: "今日官方净值",
      dataDate: fund.navDate,
      confidence: "high",
      reason: "数据层已明确确认今日官方净值发布",
    };
  }

  // 只要今天仍未公布官方净值，今天的盘中估值在收盘后也继续有效展示。
  // 这样15:00之后不会突然回退成昨天净值或空白；显示的是“今日估值涨跌幅”。
  if (hasTodayEstimate(fund, now)) {
    const c = conf(fund);
    const phase = getMarketPhase(now);
    const label = phase === "postclose"
      ? `今日估值 · ${labelConf(c)}置信度`
      : phase === "lunch"
        ? `上午最后估值 · ${labelConf(c)}置信度`
        : `盘中实时估值 · ${labelConf(c)}置信度`;
    return {
      mode: "live_estimate",
      price: fund.estimate,
      pct: fund.estimatePct,
      label,
      dataDate: sameChinaDate(fund.estimateTime, now) ? chinaTodayLabel(now) : null,
      confidence: c,
      reason: phase === "postclose"
        ? "今日官方净值尚未公布，收盘后继续保留最后一笔当日估值；官方净值发布后自动切换。"
        : phase === "lunch"
          ? "午间休市，沿用今日上午最后可用盘中估值"
          : "使用当日三路盘中估值的最终结果；置信度取决于覆盖率与路线一致性",
    };
  }

  // 收盘后且没有当日估值时，才退回最近官方净值；数据不足则明确提示。
  if (getMarketPhase(now) === "postclose") {
    return fund.nav != null && fund.navDate
      ? latestOfficial(fund)
      : { mode: "unavailable", price: null, pct: null, label: "等待今日数据", dataDate: null, confidence: "none", reason: "收盘后既没有当日估值也没有可用官方净值" };
  }

  // 开盘前/休市期间优先展示最近官方净值，避免用户一打开软件就是空白。
  if (fund.nav != null && fund.navDate) return latestOfficial(fund);
  return { mode: "unavailable", price: null, pct: null, label: "暂无可靠行情", dataDate: null, confidence: "none", reason: "没有可用于展示的可靠净值或估值" };
}

function chinaToday(date: Date) {
  const t = cnTime(date);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

function chinaTodayLabel(date = new Date()) {
  return chinaToday(date);
}
