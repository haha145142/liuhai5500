import type { ValuationObservation } from "./valuation-observation";

const KEY = "fund-ai-pro:valuation-observations:v1";
const MAX = 2000;

export type StoredObservation = ValuationObservation & {
  id: string;
  settled?: boolean;
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
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX)));
  } catch {
    // Storage can fail in private mode or when quota is exhausted.
  }
}

function makeId(o: ValuationObservation) {
  return [o.code, o.valuationDate, o.observedAt].join(":");
}

export function recordValuationObservation(observation: ValuationObservation): StoredObservation | null {
  if (!observation.code || !observation.valuationDate || !Number.isFinite(observation.estimatedPct)) return null;
  const current = readAll();
  const id = makeId(observation);
  const existing = current.find((x) => x.id === id);
  if (existing) return existing;
  const next: StoredObservation = { ...observation, id, settled: false };
  current.push(next);
  writeAll(current);
  return next;
}

export function settleOfficialNav(
  code: string,
  valuationDate: string,
  officialPct: number,
  settledAt = Date.now(),
): StoredObservation[] {
  if (!Number.isFinite(officialPct)) return [];
  const current = readAll();
  const settled: StoredObservation[] = [];
  let changed = false;
  for (let i = 0; i < current.length; i++) {
    const item = current[i];
    if (item.code !== code || item.valuationDate !== valuationDate || item.settled || !Number.isFinite(item.estimatedPct)) continue;
    const errorPct = item.estimatedPct - officialPct;
    current[i] = { ...item, officialPct, errorPct, settled: true, settledAt };
    settled.push(current[i]);
    changed = true;
  }
  if (changed) writeAll(current);
  return settled;
}

export function getSettledObservations(code?: string): StoredObservation[] {
  return readAll().filter((x) => x.settled && (!code || x.code === code));
}

export function getCalibrationSamples(code?: string) {
  return getSettledObservations(code)
    .filter((x) => Number.isFinite(x.estimatedPct) && Number.isFinite(x.officialPct) && Number.isFinite(x.errorPct))
    .map((x) => ({
      code: x.code,
      fundType: x.fundType,
      estimatedPct: x.estimatedPct,
      officialPct: x.officialPct as number,
      errorPct: x.errorPct as number,
      absoluteErrorPct: Math.abs(x.errorPct as number),
      directionCorrect: Math.sign(x.estimatedPct) === Math.sign(x.officialPct as number),
      observedAt: x.observedAt,
      settledAt: x.settledAt,
    }));
}

export function clearValuationObservations() {
  if (!canUseStorage()) return;
  try { window.localStorage.removeItem(KEY); } catch {}
}
