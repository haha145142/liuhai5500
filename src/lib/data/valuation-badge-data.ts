import { valuationDisplay, type ValuationDisplay } from "./valuation-status";

export function valuationBadgeData(fund: {
  officialNavPublished?: boolean;
  estimatePct?: number | null;
  estimateCoverage?: number;
  estimateValidation?: "一致" | "轻微偏差" | "明显偏差" | "无法验证";
  nav?: number | null;
}): ValuationDisplay {
  return valuationDisplay({
    officialNavPublished: fund.officialNavPublished === true,
    estimatePct: fund.estimatePct ?? null,
    coveragePct: fund.estimateCoverage ?? 0,
    validation: fund.estimateValidation ?? "无法验证",
    hasNav: fund.nav != null,
  });
}
