import type { FundQuote } from "../types";

/**
 * Estimate safety is deliberately conservative. It is a guardrail, not a
 * promise of statistical accuracy. The underlying NAV is unavailable intraday
 * for an open-end fund, so this layer communicates model uncertainty instead of
 * hiding it behind a single precise-looking number.
 */
export function withEstimateSafety(quote: FundQuote): FundQuote {
  const pct = quote.estimatePct;
  if (pct == null || !Number.isFinite(pct)) {
    return {
      ...quote,
      estimateRangeLowPct: null,
      estimateRangeHighPct: null,
      directionConfidence: "uncertain",
      decisionGuard: "reference_only",
    };
  }

  const coverage = Math.max(0, Math.min(100, quote.estimateCoverage ?? 0));
  const confidence = quote.estimateConfidence ?? "low";
  const externalGap = quote.estimateDeviation != null && Number.isFinite(quote.estimateDeviation)
    ? Math.abs(quote.estimateDeviation)
    : null;
  const sourcePenalty = confidence === "high" ? 0 : confidence === "medium" ? 0.35 : 0.7;
  const coveragePenalty = ((100 - coverage) / 100) * 1.25;
  const externalPenalty = externalGap == null ? 0.45 : Math.min(1.2, externalGap * 0.5);
  const baseUncertainty = Math.max(0.65, 0.65 + sourcePenalty + coveragePenalty + externalPenalty);

  const low = pct - baseUncertainty;
  const high = pct + baseUncertainty;
  const sameDirection = low > 0 || high < 0;
  const strongMargin = sameDirection && Math.abs(pct) >= baseUncertainty * 1.35;

  let directionConfidence: FundQuote["directionConfidence"] = "uncertain";
  let decisionGuard: FundQuote["decisionGuard"] = "reference_only";
  if (sameDirection && strongMargin && confidence === "high") {
    directionConfidence = "high";
    decisionGuard = "higher_confidence";
  } else if (sameDirection && (confidence === "high" || confidence === "medium")) {
    directionConfidence = "medium";
    decisionGuard = "direction_reference";
  } else if (sameDirection) {
    directionConfidence = "low";
    decisionGuard = "reference_only";
  }

  return {
    ...quote,
    estimateRangeLowPct: Number(low.toFixed(2)),
    estimateRangeHighPct: Number(high.toFixed(2)),
    directionConfidence,
    decisionGuard,
    estimateValidation: [
      quote.estimateValidation,
      `模型安全区间 ${low.toFixed(2)}%~${high.toFixed(2)}% · 方向${directionConfidence}`,
    ].filter(Boolean).join(" · "),
  };
}
