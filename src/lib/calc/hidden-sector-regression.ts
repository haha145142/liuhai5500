export type RiskStats = { returnPct: number | null; volatilityPct: number | null; maxDrawdownPct: number | null; sharpe: number | null; sample: number };
export type RegressionFactor = { id: string; name: string; returns: number[] };
export type RegressionWeight = { id: string; name: string; weightPct: number };
export type HiddenSectorFit = { sample: number; r2: number | null; residualPct: number | null; weights: RegressionWeight[] };
export type PersistentDrift = { id: string; name: string; inferredPct: number; disclosedPct: number; deltaPct: number; persistentWindows: number; probableRebalance: boolean };

function clean(values: number[]) { return values.filter((v) => Number.isFinite(v) && v > 0); }
export function periodReturn(values: number[]): number | null { const v = clean(values); return v.length < 2 ? null : (v.at(-1)! / v[0] - 1) * 100; }
export function maxDrawdown(values: number[]): number | null { const v = clean(values); if (v.length < 2) return null; let peak = v[0], max = 0; for (const x of v) { peak = Math.max(peak, x); if (peak > 0) max = Math.max(max, (peak - x) / peak * 100); } return max; }
export function dailyReturns(values: number[]): number[] { const v = clean(values); const out: number[] = []; for (let i = 1; i < v.length; i += 1) if (v[i - 1] > 0) out.push(v[i] / v[i - 1] - 1); return out; }
export function volatilityAnnualized(values: number[]): number | null { const r = dailyReturns(values); if (r.length < 2) return null; const mean = r.reduce((a, b) => a + b, 0) / r.length; const variance = r.reduce((s, x) => s + (x - mean) ** 2, 0) / (r.length - 1); return Math.sqrt(Math.max(0, variance)) * Math.sqrt(252) * 100; }
export function sharpeAnnualized(values: number[], riskFreeAnnualPct = 1.5): number | null { const r = dailyReturns(values); if (r.length < 2) return null; const mean = r.reduce((a, b) => a + b, 0) / r.length; const variance = r.reduce((s, x) => s + (x - mean) ** 2, 0) / (r.length - 1); const sd = Math.sqrt(Math.max(0, variance)); if (sd === 0) return null; const rfDaily = Math.pow(1 + riskFreeAnnualPct / 100, 1 / 252) - 1; return ((mean - rfDaily) / sd) * Math.sqrt(252); }
export function riskStats(values: number[]): RiskStats { const v = clean(values); return { returnPct: periodReturn(v), volatilityPct: volatilityAnnualized(v), maxDrawdownPct: maxDrawdown(v), sharpe: sharpeAnnualized(v), sample: v.length }; }
export function normalized(values: number[]): number[] { const v = clean(values); return !v.length ? [] : v.map((x) => x / v[0]); }

function projectLeqOne(values: number[]) { const x = values.map((v) => Math.max(0, Number.isFinite(v) ? v : 0)); const sum = x.reduce((a, b) => a + b, 0); return sum <= 1 ? x : x.map((v) => v / sum); }
/** Non-negative ridge regression constrained to portfolio weights >=0 and <=100% in total. */
export function fitHiddenSectorRegression(y: number[], factors: RegressionFactor[], lambda = 0.02, iterations = 700): HiddenSectorFit {
  const n = Math.min(y.length, ...factors.map((f) => f.returns.length));
  if (n < 30 || factors.length < 2) return { sample: n, r2: null, residualPct: null, weights: [] };
  const target = y.slice(y.length - n); const xs = factors.map((f) => f.returns.slice(f.returns.length - n));
  let w = factors.map((_, i) => Math.max(0, target.reduce((s, yv, j) => s + xs[i][j] * yv, 0) / n)); const norm = w.reduce((a, b) => a + b, 0) || 1; w = w.map((v) => v / norm);
  for (let iter = 0; iter < iterations; iter += 1) {
    const pred = target.map((_, j) => w.reduce((s, wi, i) => s + wi * xs[i][j], 0));
    const grad = w.map((wi, i) => { let g = 2 * lambda * wi; for (let j = 0; j < n; j += 1) g += 2 * xs[i][j] * (pred[j] - target[j]); return g / n; });
    const step = 0.06 / Math.max(1, Math.sqrt(factors.length)); w = projectLeqOne(w.map((v, i) => v - step * grad[i]));
  }
  const pred = target.map((_, j) => w.reduce((s, wi, i) => s + wi * xs[i][j], 0)); const meanY = target.reduce((s, v) => s + v, 0) / n;
  const sse = target.reduce((s, v, j) => s + (v - pred[j]) ** 2, 0); const sst = target.reduce((s, v) => s + (v - meanY) ** 2, 0); const mae = target.reduce((s, v, j) => s + Math.abs(v - pred[j]), 0) / n;
  return { sample: n, r2: sst > 0 ? Math.max(0, Math.min(1, 1 - sse / sst)) : null, residualPct: mae * 100, weights: factors.map((f, i) => ({ id: f.id, name: f.name, weightPct: w[i] * 100 })).filter((x) => x.weightPct >= 0.5).sort((a, b) => b.weightPct - a.weightPct) };
}
export function persistentDrifts(windowFits: Array<{ fit: HiddenSectorFit; disclosed: Record<string, number> }>, thresholdPct = 3): PersistentDrift[] {
  const ids = new Set<string>(); for (const item of windowFits) for (const w of item.fit.weights) ids.add(w.id);
  return [...ids].map((id) => {
    const samples = windowFits.map((item) => ({ inferred: item.fit.weights.find((w) => w.id === id)?.weightPct ?? 0, disclosed: item.disclosed[id] ?? 0 }));
    const latest = samples[0] ?? { inferred: 0, disclosed: 0 }; const signs = samples.map((s) => s.inferred - s.disclosed).filter((d) => Math.abs(d) >= thresholdPct).map((d) => d > 0 ? 1 : -1); const delta = latest.inferred - latest.disclosed;
    return { id, name: windowFits.flatMap((x) => x.fit.weights).find((w) => w.id === id)?.name ?? id, inferredPct: latest.inferred, disclosedPct: latest.disclosed, deltaPct: delta, persistentWindows: signs.length, probableRebalance: signs.length >= 2 && signs.every((x) => x === signs[0]) };
  }).filter((x) => Math.abs(x.deltaPct) >= thresholdPct).sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
}
