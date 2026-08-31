export type ValuationSettlementSample = {
  code: string;
  date: string;
  absoluteErrorPctPoints: number | null;
  status: "settled" | "missing_intraday" | "missing_official";
};

export type ValuationHistoryStats = {
  code: string;
  sampleCount: number;
  maePctPoints: number | null;
  maxErrorPctPoints: number | null;
  p95ErrorPctPoints: number | null;
  recent5MaePctPoints: number | null;
  recent20MaePctPoints: number | null;
  dates: string[];
};

function percentile95(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
}

function mae(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/**
 * Summarize only officially settled valuation samples. Duplicate trading-day
 * records are collapsed by date, and unsettled observations are excluded from
 * accuracy statistics rather than treated as zero-error samples.
 */
export function summarizeValuationHistory(
  code: string,
  samples: ValuationSettlementSample[],
): ValuationHistoryStats {
  const settled = new Map<string, number>();
  for (const sample of samples) {
    if (sample.code !== code || sample.status !== "settled" || sample.absoluteErrorPctPoints == null) continue;
    const date = sample.date.trim();
    if (!date) continue;
    settled.set(date, sample.absoluteErrorPctPoints);
  }

  const ordered = [...settled.entries()].sort(([a], [b]) => a.localeCompare(b));
  const errors = ordered.map(([, error]) => error);
  const recent = ordered.slice(-20).map(([, error]) => error);

  return {
    code,
    sampleCount: errors.length,
    maePctPoints: mae(errors),
    maxErrorPctPoints: errors.length ? Math.max(...errors) : null,
    p95ErrorPctPoints: percentile95(errors),
    recent5MaePctPoints: mae(recent.slice(-5)),
    recent20MaePctPoints: mae(recent),
    dates: ordered.map(([date]) => date),
  };
}

export function formatAccuracyStat(value: number | null) {
  return value == null ? "暂无" : `${value.toFixed(2)} 个百分点`;
}
