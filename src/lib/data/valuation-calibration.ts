export type CalibrationBand = "aligned" | "close" | "diverged" | "insufficient";

export type ValuationCalibration = {
  band: CalibrationBand;
  confidence: "high" | "medium" | "low";
  deviationPctPoints: number | null;
  message: string;
};

/**
 * Compare our independently calculated intraday fund estimate with a
 * third-party reference estimate. The reference is validation only: it never
 * replaces the calculated value.
 */
export function calibrateValuation(
  calculatedPct: number | null,
  referencePct: number | null,
  coveragePct: number,
): ValuationCalibration {
  if (calculatedPct == null || referencePct == null || coveragePct <= 0) {
    return {
      band: "insufficient",
      confidence: "low",
      deviationPctPoints: null,
      message: "缺少可比估值或有效覆盖，暂不做一致性结论",
    };
  }

  const deviation = Math.abs(calculatedPct - referencePct);
  if (coveragePct >= 70 && deviation <= 0.35) {
    return {
      band: "aligned",
      confidence: "high",
      deviationPctPoints: deviation,
      message: `自算与参考估值一致，偏差 ${deviation.toFixed(2)} 个百分点`,
    };
  }
  if (coveragePct >= 45 && deviation <= 0.90) {
    return {
      band: "close",
      confidence: "medium",
      deviationPctPoints: deviation,
      message: `自算与参考估值接近，偏差 ${deviation.toFixed(2)} 个百分点`,
    };
  }

  return {
    band: "diverged",
    confidence: "low",
    deviationPctPoints: deviation,
    message: `自算与参考估值存在明显偏差，偏差 ${deviation.toFixed(2)} 个百分点`,
  };
}
