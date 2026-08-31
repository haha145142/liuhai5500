export type ValuationObservation = {
  fundType?: string;
  estimatePct: number;
  officialPct: number;
  coveragePct?: number;
  sourceAgreementPct?: number;
};

export type CalibrationStats = {
  sampleSize: number;
  mae: number;
  p90: number;
  maxAbsError: number;
  directionalAccuracyPct: number;
  medianCoveragePct: number | null;
  medianAgreementPct: number | null;
  byType: Record<string, { sampleSize: number; mae: number; directionalAccuracyPct: number }>;
};

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function calibrateValuation(observations: ValuationObservation[]): CalibrationStats {
  const valid = observations.filter((x) => Number.isFinite(x.estimatePct) && Number.isFinite(x.officialPct));
  const errors = valid.map((x) => Math.abs(x.estimatePct - x.officialPct));
  const directionalMatches = valid.filter((x) => Math.sign(x.estimatePct) === Math.sign(x.officialPct)).length;
  const coverage = valid.map((x) => x.coveragePct).filter((x): x is number => Number.isFinite(x as number));
  const agreement = valid.map((x) => x.sourceAgreementPct).filter((x): x is number => Number.isFinite(x as number));

  type Bucket = { errors: number[]; directions: number; total: number };
  const byTypeBuckets: Record<string, Bucket> = {};
  for (const item of valid) {
    const type = item.fundType || "未知类型";
    const bucket = byTypeBuckets[type] || { errors: [], directions: 0, total: 0 };
    bucket.errors.push(Math.abs(item.estimatePct - item.officialPct));
    bucket.directions += Math.sign(item.estimatePct) === Math.sign(item.officialPct) ? 1 : 0;
    bucket.total += 1;
    byTypeBuckets[type] = bucket;
  }

  return {
    sampleSize: valid.length,
    mae: Number(mean(errors).toFixed(4)),
    p90: Number((percentile(errors, 0.9) ?? 0).toFixed(4)),
    maxAbsError: Number((Math.max(0, ...errors)).toFixed(4)),
    directionalAccuracyPct: valid.length ? Number(((directionalMatches / valid.length) * 100).toFixed(2)) : 0,
    medianCoveragePct: coverage.length ? Number((percentile(coverage, 0.5) ?? 0).toFixed(2)) : null,
    medianAgreementPct: agreement.length ? Number((percentile(agreement, 0.5) ?? 0).toFixed(2)) : null,
    byType: Object.fromEntries(Object.entries(byTypeBuckets).map(([type, bucket]) => [type, {
      sampleSize: bucket.total,
      mae: Number(mean(bucket.errors).toFixed(4)),
      directionalAccuracyPct: Number(((bucket.directions / bucket.total) * 100).toFixed(2)),
    }])),
  };
}

export type ReliabilityBand = "高" | "中" | "低";

export function calibratedReliability(stats: CalibrationStats, coveragePct: number, agreementPct: number, currentDeviationPct: number | null): ReliabilityBand {
  if (stats.sampleSize < 20) {
    if (coveragePct >= 70 && agreementPct >= 85 && (currentDeviationPct == null || currentDeviationPct <= 0.5)) return "中";
    return "低";
  }
  const historicalOk = stats.mae <= 0.5 && stats.p90 <= 1.0 && stats.directionalAccuracyPct >= 70;
  const currentOk = coveragePct >= 60 && agreementPct >= 80 && (currentDeviationPct == null || currentDeviationPct <= 0.7);
  if (historicalOk && currentOk) return "高";
  const historicalAcceptable = stats.mae <= 0.9 && stats.p90 <= 1.5 && stats.directionalAccuracyPct >= 60;
  const currentAcceptable = coveragePct >= 35 && agreementPct >= 60 && (currentDeviationPct == null || currentDeviationPct <= 1.2);
  if (historicalAcceptable && currentAcceptable) return "中";
  return "低";
}

export function explainCalibration(stats: CalibrationStats): string {
  if (stats.sampleSize === 0) return "暂无足够的历史估值—官方净值配对样本，暂不校准可信度。";
  return `基于 ${stats.sampleSize} 个有效配对样本：平均绝对误差 ${stats.mae.toFixed(2)} 个百分点，P90 ${stats.p90.toFixed(2)}，最大误差 ${stats.maxAbsError.toFixed(2)}，方向正确率 ${stats.directionalAccuracyPct.toFixed(1)}%。`;
}
