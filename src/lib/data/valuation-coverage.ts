export type CoveragePolicy = {
  effectivePct: number | null;
  coveragePct: number;
  confidence: "high" | "medium" | "low";
  note: string;
};

/**
 * The raw weighted contribution is always retained. Coverage does not invent
 * missing holdings; it only determines how strongly the result may be trusted.
 */
export function assessValuationCoverage(
  rawContributionPct: number | null,
  usableWeightPct: number,
  disclosedWeightPct: number,
): CoveragePolicy {
  if (rawContributionPct == null || usableWeightPct <= 0 || disclosedWeightPct <= 0) {
    return { effectivePct: null, coveragePct: 0, confidence: "low", note: "没有足够的已披露且有实时行情的持仓" };
  }

  const coveragePct = Math.min(100, usableWeightPct);
  const disclosedCoverage = Math.min(100, (usableWeightPct / disclosedWeightPct) * 100);
  if (coveragePct >= 60 && disclosedCoverage >= 70) {
    return { effectivePct: rawContributionPct, coveragePct, confidence: "high", note: `可用持仓覆盖约 ${coveragePct.toFixed(1)}%，披露项覆盖约 ${disclosedCoverage.toFixed(1)}%` };
  }
  if (coveragePct >= 35 && disclosedCoverage >= 50) {
    return { effectivePct: rawContributionPct, coveragePct, confidence: "medium", note: `可用持仓覆盖有限：约 ${coveragePct.toFixed(1)}%，结果需结合其他证据` };
  }
  return { effectivePct: rawContributionPct, coveragePct, confidence: "low", note: `可用持仓覆盖较低：约 ${coveragePct.toFixed(1)}%，仅作方向参考` };
}
