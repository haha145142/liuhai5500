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
    return { mode: "unavailable", price: null, pct: null, label: "暂无可靠行情", dataDate: null, confidence: "none" };
  }

  if (isOfficialNavToday(fund, now) && fund.nav != null) {
    return {
      mode: "official_today",
      price: fund.nav,
      pct: fund.dayPct,
      label: "今日官方净值",
      dataDate: fund.navDate,
      confidence: "high",
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
    };
  }

  if (fund.nav != null) {
    return {
      mode: "latest_official",
      price: fund.nav,
      pct: fund.dayPct,
      label: fund.navDate ? `最近官方净值 · ${fund.navDate}` : "最近官方净值",
      dataDate: fund.navDate,
      confidence: "high",
    };
  }

  return { mode: "unavailable", price: null, pct: null, label: "暂无可靠行情", dataDate: null, confidence: "none" };
}
