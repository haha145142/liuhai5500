import type { ValuationObservation } from "./valuation-calibration";

const KEY = "fund-ai-pro:valuation-observations:v1";
const MAX = 2000;

type StoredObservation = ValuationObservation & {
  id: string;
  fundCode: string;
  estimateTime: string;
  officialDate?: string;
  createdAt: string;
  settled: boolean;
  settledAt?: number;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readAll(): StoredObservation[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: StoredObservation[]) {
  if (!canUseStorage()) return;
  try { window.localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX))); } catch {}
}

function idFor(fundCode: string, estimateTime: string) {
  return `${fundCode}:${estimateTime}`;
}

export function recordPendingValuation(input: {
  fundCode: string;
  fundType?: string;
  estimatePct: number | null | undefined;
  coveragePct?: number;
  sourceAgreementPct?: number;
  estimateTime?: string | null;
}) {
  if (!input.fundCode || !Number.isFinite(input.estimatePct)) return null;
  const estimateTime = input.estimateTime || new Date().toISOString();
  const current = readAll();
  const id = idFor(input.fundCode, estimateTime);
  const existing = current.find((x) => x.id === id);
  if (existing) return existing;
  const next: StoredObservation = {
    fundCode: input.fundCode,
    fundType: input.fundType,
    estimatePct: input.estimatePct as number,
    coveragePct: input.coveragePct,
    sourceAgreementPct: input.sourceAgreementPct,
    estimateTime,
    createdAt: new Date().toISOString(),
    id,
    settled: false,
  };
  current.push(next);
  writeAll(current);
  return next;
}

export function settleOfficialNav(code: string, officialDate: string, officialPct: number, settledAt = Date.now()) {
  if (!code || !officialDate || !Number.isFinite(officialPct)) return [];
  const current = readAll();
  const settled: Array<StoredObservation & { officialPct: number }> = [];
  let changed = false;
  for (let i = 0; i < current.length; i++) {
    const item = current[i];
    if (item.fundCode !== code || item.settled || !Number.isFinite(item.estimatePct)) continue;
    if (item.estimateTime.slice(0, 10) !== officialDate) continue;
    const next = { ...item, officialPct, officialDate, settled: true, settledAt } as StoredObservation & { officialPct: number };
    current[i] = next;
    settled.push(next);
    changed = true;
  }
  if (changed) writeAll(current);
  return settled;
}

export function getSettledObservations(code?: string): ValuationObservation[] {
  return readAll()
    .filter((x) => x.settled && (!code || x.fundCode === code) && Number.isFinite((x as any).officialPct))
    .map((x) => ({
      fundType: x.fundType,
      estimatePct: x.estimatePct,
      officialPct: (x as any).officialPct,
      coveragePct: x.coveragePct,
      sourceAgreementPct: x.sourceAgreementPct,
    }));
}

export function clearValuationObservations() {
  if (!canUseStorage()) return;
  try { window.localStorage.removeItem(KEY); } catch {}
}
