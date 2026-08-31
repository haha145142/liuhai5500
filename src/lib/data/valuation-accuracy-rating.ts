export type ValuationAccuracyRating = "stable" | "watch" | "diverged" | "insufficient";

export type ValuationAccuracyAssessment = {
  rating: ValuationAccuracyRating;
  label: string;
  detail: string;
};

/**
 * Turn settled MAE samples into a conservative user-facing calibration label.
 * This describes historical accuracy only; it is not a forecast of future fund returns.
 */
export function assessValuationAccuracy(
  sampleCount: number,
  recent20MaePctPoints: number | null,
): ValuationAccuracyAssessment {
  if (sampleCount < 5 || recent20MaePctPoints == null) {
    return {
      rating: "insufficient",
      label: "样本不足",
      detail: "需要至少 5 个已结算交易日，暂不评价历史估值稳定性。",
    };
  }
  if (recent20MaePctPoints <= 0.35) {
    return {
      rating: "stable",
      label: "表现稳定",
      detail: `最近样本平均绝对误差约 ${recent20MaePctPoints.toFixed(2)} 个百分点。`,
    };
  }
  if (recent20MaePctPoints <= 0.90) {
    return {
      rating: "watch",
      label: "需要观察",
      detail: `最近样本平均绝对误差约 ${recent20MaePctPoints.toFixed(2)} 个百分点。`,
    };
  }
  return {
    rating: "diverged",
    label: "偏差较大",
    detail: `最近样本平均绝对误差约 ${recent20MaePctPoints.toFixed(2)} 个百分点，应检查重仓披露与行情覆盖。`,
  };
}
