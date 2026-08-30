import type { FundQuote } from "../types";
import { cnTime } from "../format";
import { isTradeTime } from "../market-hours";

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

export function selectFundDisplayQuote(fund: FundQuote | undefined, now = new Date()): FundDisplayQuote {
  if (!fund) {
    return { mode: "unavailable", price: null, pct: null, label: "暂无可靠行情", dataDate: null, confidence: "none", reason: "尚未取得基金数据" };
  }

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

  const estimateUsable =
    isTradeTime(now) &&
    fund.estimate != null &&
    fund.estimatePct != null &&
    fund.estimateConfidence !== "low" &&
    fund.valuationStatus !== "unavailable";

  if (estimateUsable) {
    const confidence = fund.estimateConfidence === "high" ? "high" : "medium";
    return {
      mode: "live_estimate",
      price: fund.estimate,
      pct: fund.estimatePct,
      label: confidence === "high" ? "盘中自有估值" : "盘中自有估值（中置信度）",
      dataDate: sameChinaDate(fund.navDate, now) ? fund.navDate : null,
      confidence,
      reason: "交易时段内官方净值尚未发布，采用自有穿透估值",
    };
  }

  if (fund.nav != null) {
    const knownOfficialOnly = /不使用A股|不生成股票穿透估值|QDII|债券|货币/.test(fund.estimateMethod || "");
    return {
      mode: "latest_official",
      price: fund.nav,
      pct: fund.dayPct,
      label: fund.navDate ? `最近官方净值 · ${fund.navDate}` : "最近官方净值",
      dataDate: fund.navDate,
      confidence: "high",
      reason: knownOfficialOnly ? "该基金类型暂不适用A股盘中穿透估值，采用官方净值模式" : "当前没有满足可信门槛的盘中估值，采用最近官方净值",
    };
  }

  return { mode: "unavailable", price: null, pct: null, label: "暂无可靠行情", dataDate: null, confidence: "none", reason: "没有可用于展示的可靠净值或估值" };
}
