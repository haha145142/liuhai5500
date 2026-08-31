export type ValuationHistoryRecord = {
  code: string;
  date: string;
  observedAt: string;
  calculatedPct: number | null;
  referencePct: number | null;
  deviationPctPoints: number | null;
  coveragePct: number;
  calibration: "aligned" | "close" | "diverged" | "insufficient";
  confidence: "high" | "medium" | "low";
};

const KEY_PREFIX = "fund-ai-pro:valuation-history:";
const MAX_RECORDS = 60;

function key(code: string) {
  return `${KEY_PREFIX}${code.trim()}`;
}

export function appendValuationHistory(record: ValuationHistoryRecord): void {
  if (typeof window === "undefined") return;
  const code = record.code.trim();
  if (!code) return;
  try {
    const raw = window.localStorage.getItem(key(code));
    const previous = raw ? JSON.parse(raw) : [];
    const list: ValuationHistoryRecord[] = Array.isArray(previous) ? previous : [];
    const next = [record, ...list.filter((x) => !(x.date === record.date && x.observedAt === record.observedAt))]
      .slice(0, MAX_RECORDS);
    window.localStorage.setItem(key(code), JSON.stringify(next));
  } catch {
    // Local history is advisory only; a storage failure must never break quotes.
  }
}

export function readValuationHistory(code: string): ValuationHistoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(code));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function summarizeValuationHistory(records: ValuationHistoryRecord[]) {
  const usable = records.filter((x) => x.deviationPctPoints != null);
  if (!usable.length) return { samples: 0, meanAbsDeviation: null, maxAbsDeviation: null };
  const deviations = usable.map((x) => Math.abs(x.deviationPctPoints as number));
  return {
    samples: deviations.length,
    meanAbsDeviation: deviations.reduce((s, x) => s + x, 0) / deviations.length,
    maxAbsDeviation: Math.max(...deviations),
  };
}
