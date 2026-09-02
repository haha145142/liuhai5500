import type { FundHistoryPoint } from "@/lib/types";

export type HoldingEntryEstimate = {
  date: string | null;
  days: number | null;
  nav: number | null;
  distancePct: number | null;
  confidence: "high" | "medium" | "low" | "none";
};

function validPoint(point: FundHistoryPoint) {
  return !!point && /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.nav) && point.nav > 0;
}

/**
 * Infer an approximate entry date from the holding cost and historical NAV.
 * A weighted-average cost can represent multiple purchases, so this is an
 * estimate rather than an exact transaction record.
 */
export function inferHoldingEntryDate(points: FundHistoryPoint[] | null | undefined, cost: number, today = new Date()): HoldingEntryEstimate {
  if (!Array.isArray(points) || !points.length || !Number.isFinite(cost) || cost <= 0) {
    return { date: null, days: null, nav: null, distancePct: null, confidence: "none" };
  }

  const candidates = points.filter(validPoint).map((point) => ({ point, distancePct: Math.abs(point.nav - cost) / cost * 100 })).sort((a, b) => a.distancePct - b.distancePct);
  const best = candidates[0];
  if (!best) return { date: null, days: null, nav: null, distancePct: null, confidence: "none" };

  const entry = new Date(`${best.point.date}T00:00:00+08:00`);
  if (Number.isNaN(entry.getTime()) || entry.getTime() > today.getTime()) return { date: null, days: null, nav: best.point.nav, distancePct: best.distancePct, confidence: "none" };

  const days = Math.max(0, Math.floor((today.getTime() - entry.getTime()) / 86_400_000));
  const confidence = best.distancePct <= 0.03 ? "high" : best.distancePct <= 0.15 ? "medium" : best.distancePct <= 0.5 ? "low" : "none";
  return confidence === "none"
    ? { date: null, days: null, nav: best.point.nav, distancePct: best.distancePct, confidence }
    : { date: best.point.date, days, nav: best.point.nav, distancePct: best.distancePct, confidence };
}
