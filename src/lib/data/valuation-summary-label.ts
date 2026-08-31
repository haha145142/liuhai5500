import type { ValuationSummary } from "./valuation-summary";

export function valuationSummaryLabel(summary: ValuationSummary): string {
  if (summary.rating === "insufficient" || summary.sampleCount < 5) {
    return `样本不足 · 已结算 ${summary.sampleCount} 个交易日`;
  }
  const mae = summary.maePctPoints == null ? "—" : `${summary.maePctPoints.toFixed(2)} 个百分点`;
  const rating = summary.rating === "stable" ? "表现稳定" : summary.rating === "watch" ? "需要观察" : "偏差较大";
  return `近 ${Math.min(summary.sampleCount, 20)} 个交易日平均误差 ${mae} · ${rating}`;
}
