import type { FundHistoryPoint, FundQuote } from "../types";
import { withEstimateSafety } from "../data/estimate-safety";

export type DisclosedPosition = {
  code: string;
  name: string;
  weight: number;
  price?: number | null;
  pct?: number | null;
  quoteStatus?: "cross_checked" | "single_source" | "disagreed" | "unavailable";
};

export type FactorObservation = {
  date: string;
  fundPct: number;
  factors: Record<string, number>;
};

export type EstimateInputs = {
  previousNav: number;
  positions: DisclosedPosition[];
  externalEstimatePct?: number | null;
  managementFeeAnnual?: number | null;
  custodyFeeAnnual?: number | null;
  extraDailyFeeRate?: number | null;
  factorObservations?: FactorObservation[];
  publicFactorWeights?: Record<string, number>;
  stockWeightMin?: number;
  stockWeightMax?: number;
};

export type NavEstimateResult = {
  estimate: number | null;
  pct: number | null;
  grossPct: number | null;
  dailyFeePct: number;
  disclosedWeight: number;
  usableWeight: number;
  coverageOfDisclosed: number;
  crossCheckedWeight: number;
  disagreedWeight: number;
  confidence: "high" | "medium" | "low";
  method: string;
  validation: string;
  inferredFactorWeights: Record<string, number>;
};

function clamp(v: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, v)); }
function finite(v: unknown): v is number { return typeof v === "number" && Number.isFinite(v); }

function weightedRecentRegression(observations: FactorObservation[], factorNames: string[], lambda = 0.992) {
  if (observations.length < Math.max(12, factorNames.length + 3) || !factorNames.length) return null;
  const recent = observations.slice(-120); const t0 = recent.length - 1; const p = factorNames.length + 1;
  const xtwx = Array.from({ length: p }, () => Array.from({ length: p }, () => 0)); const xtwy = Array.from({ length: p }, () => 0);
  for (let i = 0; i < recent.length; i += 1) {
    const row = [1, ...factorNames.map((name) => recent[i].factors[name] ?? 0)]; const y = recent[i].fundPct;
    if (!finite(y) || row.slice(1).some((x) => !finite(x))) continue;
    const w = Math.pow(lambda, t0 - i);
    for (let r = 0; r < p; r += 1) { xtwy[r] += w * row[r] * y; for (let c = 0; c < p; c += 1) xtwx[r][c] += w * row[r] * row[c]; }
  }
  for (let i = 1; i < p; i += 1) xtwx[i][i] += 0.05;
  const a = xtwx.map((row, i) => [...row, xtwy[i]]);
  for (let col = 0; col < p; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < p; row += 1) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-10) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const denom = a[col][col];
    for (let j = col; j <= p; j += 1) a[col][j] /= denom;
    for (let row = 0; row < p; row += 1) { if (row === col) continue; const factor = a[row][col]; for (let j = col; j <= p; j += 1) a[row][j] -= factor * a[col][j]; }
  }
  const beta = a.map((row) => row[p]); return Object.fromEntries(factorNames.map((name, i) => [name, beta[i + 1]]));
}

function combineFactorWeights(publicWeights: Record<string, number>, inferred: Record<string, number> | null, minPct: number, maxPct: number) {
  if (!inferred) return publicWeights;
  const names = new Set([...Object.keys(publicWeights), ...Object.keys(inferred)]); const raw: Record<string, number> = {};
  for (const name of names) { const pub = publicWeights[name] ?? 0; const imp = inferred[name] ?? 0; raw[name] = Math.min(Math.max(imp, pub - minPct), pub + maxPct); }
  const total = Object.values(raw).reduce((s, v) => s + Math.max(0, v), 0); if (total <= 0) return publicWeights;
  const publicTotal = Object.values(publicWeights).reduce((s, v) => s + Math.max(0, v), 0) || 100;
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.max(0, v) * publicTotal / total]));
}
function dailyFeePct(inputs: EstimateInputs) { return (Math.max(0, inputs.managementFeeAnnual ?? 0) + Math.max(0, inputs.custodyFeeAnnual ?? 0)) / 365 * 100 + Math.max(0, inputs.extraDailyFeeRate ?? 0) * 100; }

export function estimateFundNav(inputs: EstimateInputs): NavEstimateResult {
  const positions = inputs.positions.filter((x) => finite(x.weight) && x.weight > 0); const disclosedWeight = positions.reduce((s, x) => s + x.weight, 0);
  const usable = positions.filter((x) => finite(x.pct)); const usableWeight = usable.reduce((s, x) => s + x.weight, 0); const coverageOfDisclosed = disclosedWeight > 0 ? usableWeight / disclosedWeight * 100 : 0;
  const crossCheckedWeight = usable.filter((x) => x.quoteStatus === "cross_checked").reduce((s, x) => s + x.weight, 0); const disagreedWeight = usable.filter((x) => x.quoteStatus === "disagreed").reduce((s, x) => s + x.weight, 0); const feePct = dailyFeePct(inputs);
  if (!finite(inputs.previousNav) || inputs.previousNav <= 0 || !usable.length) return { estimate: null, pct: null, grossPct: null, dailyFeePct: feePct, disclosedWeight, usableWeight, coverageOfDisclosed, crossCheckedWeight, disagreedWeight, confidence: "low", method: "暂无可验证持仓实时行情", validation: "未生成模拟数字", inferredFactorWeights: {} };

  const publicPct = usable.reduce((s, x) => s + x.weight * (x.pct as number), 0) / 100;
  const inferredBeta = inputs.factorObservations && inputs.publicFactorWeights ? weightedRecentRegression(inputs.factorObservations, Object.keys(inputs.publicFactorWeights)) : null;
  const calibratedWeights = combineFactorWeights(inputs.publicFactorWeights ?? {}, inferredBeta, 15, 15);
  let calibratedPct = publicPct;
  if (inferredBeta && inputs.publicFactorWeights) {
    const factorNames = Object.keys(inputs.publicFactorWeights);
    const normalized = factorNames.reduce((sum, name) => sum + (calibratedWeights[name] ?? 0), 0) || 1;
    const weightedBeta = factorNames.reduce((sum, name) => sum + (calibratedWeights[name] ?? 0) * (inferredBeta[name] ?? 0), 0) / normalized;
    calibratedPct = publicPct * 0.7 + weightedBeta * 0.3;
  }
  let grossPct = calibratedPct;
  if (inputs.externalEstimatePct != null && finite(inputs.externalEstimatePct) && coverageOfDisclosed < 95) {
    const confidenceWeight = clamp(coverageOfDisclosed / 100 * 0.7 + (crossCheckedWeight / Math.max(usableWeight, 0.001)) * 0.3, 0, 1);
    grossPct = calibratedPct * confidenceWeight + inputs.externalEstimatePct * (1 - confidenceWeight);
  }
  const pct = grossPct - feePct; const estimate = inputs.previousNav * (1 + pct / 100); const crossRate = usableWeight > 0 ? crossCheckedWeight / usableWeight : 0;
  let confidence: "high" | "medium" | "low" = coverageOfDisclosed >= 70 && crossRate >= 0.7 ? "high" : coverageOfDisclosed >= 45 && crossRate >= 0.4 ? "medium" : "low";
  if (disagreedWeight / Math.max(usableWeight, 0.001) > 0.2) confidence = "low";
  const validation = inputs.externalEstimatePct == null ? `覆盖 ${coverageOfDisclosed.toFixed(1)}% · 交叉一致 ${crossCheckedWeight.toFixed(1)}%` : `自算 ${publicPct.toFixed(2)}% · 校准 ${calibratedPct.toFixed(2)}% · 外部 ${inputs.externalEstimatePct.toFixed(2)}% · 偏差 ${Math.abs(calibratedPct - inputs.externalEstimatePct).toFixed(2)}个百分点`;
  return { estimate, pct, grossPct, dailyFeePct: feePct, disclosedWeight, usableWeight, coverageOfDisclosed, crossCheckedWeight, disagreedWeight, confidence, method: inferredBeta ? "公开持仓 + 近期衰减回归校正 + 多源实时行情 + 日费率" : "公开持仓 + 多源实时行情 + 日费率", validation, inferredFactorWeights: calibratedWeights };
}

export function backtestEstimate(history: FundHistoryPoint[], estimated: number[]) {
  const n = Math.min(history.length, estimated.length); if (!n) return { mae20: null, p95: null, maxError: null, sample: 0 };
  const pairs = history.slice(-n).map((h, i) => ({ h, e: estimated[i] })).filter(({ h, e }) => h.nav > 0 && Number.isFinite(e));
  const errors = pairs.map(({ h, e }) => Math.abs((e - h.nav) / h.nav * 100)).sort((a, b) => a - b); if (!errors.length) return { mae20: null, p95: null, maxError: null, sample: 0 };
  const last20 = errors.slice(-20); return { mae20: last20.reduce((s, v) => s + v, 0) / last20.length, p95: errors[Math.min(errors.length - 1, Math.floor((errors.length - 1) * 0.95))], maxError: errors.at(-1) ?? null, sample: errors.length };
}

export function attachEstimate(quote: FundQuote, result: NavEstimateResult): FundQuote {
  if (result.estimate == null || result.pct == null) return quote;
  return withEstimateSafety({ ...quote, estimate: result.estimate, estimatePct: result.pct, estimateTime: new Date().toISOString(), valuationStatus: "estimate", officialNavPublished: false, estimateConfidence: result.confidence, estimateMethod: result.method, estimateCoverage: result.coverageOfDisclosed, externalEstimatePct: quote.externalEstimatePct ?? null, estimateDeviation: quote.externalEstimatePct != null ? Math.abs(result.pct - quote.externalEstimatePct) : null, estimateValidation: result.validation });
}
