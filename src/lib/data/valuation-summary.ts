export type ValuationSummary = {
  sampleCount: number;
  maePctPoints: number | null;
  maxErrorPctPoints: number | null;
  p95ErrorPctPoints: number | null;
  recent5MaePctPoints: number | null;
  recent20MaePctPoints: number | null;
  rating: "stable" | "watch" | "diverged" | "insufficient";
};

export type SettledValuationRecord = {
  code: string;
  date: string;
  absoluteErrorPctPoints: number | null;
  status: "settled" | "missing_intraday" | "missing_official";
};

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function mae(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/** Build a trustworthy validation summary using only settled observations. */
export function summarizeValuationHistory(records: SettledValuationRecord[]): ValuationSummary {
  const unique = new Map<string, SettledValuationRecord>();
  for (const record of records) {
    if (record.status !== "settled" || record.absoluteErrorPctPoints == null) continue;
    unique.set(`${record.code}:${record.date}`, record);
  }

  const values = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date)).map((record) => record.absoluteErrorPctPoints as number);
  const recent5 = values.slice(-5);
  const recent20 = values.slice(-20);
  const maeValue = mae(values);
  let rating: ValuationSummary["rating"] = "insufficient";
  if (values.length >= 20 && maeValue != null) {
    rating = maeValue <= 0.35 ? "stable" : maeValue <= 0.9 ? "watch" : "diverged";
  } else if (values.length >= 5 && maeValue != null) {
    rating = maeValue <= 0.35 ? "stable" : maeValue <= 0.9 ? "watch" : "diverged";
  }

  return {
    sampleCount: values.length,
    maePctPoints: maeValue,
    maxErrorPctPoints: values.length ? Math.max(...values) : null,
    p95ErrorPctPoints: percentile(values, 0.95),
    recent5MaePctPoints: mae(recent5),
    recent20MaePctPoints: mae(recent20),
    rating,
  };
}
