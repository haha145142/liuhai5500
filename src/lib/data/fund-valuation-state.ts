import type { FundQuote } from "../types.ts";

export type FundValuationState = "official_nav" | "same_day_estimate" | "latest_official" | "unavailable";

function chinaDate(date: Date) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function sameChinaDate(value: string | null | undefined, now = new Date()) {
  if (!value) return false;
  return String(value).slice(0, 10) === chinaDate(now);
}

export function resolveFundValuationState(quote: Pick<FundQuote, "nav" | "navDate" | "estimate" | "estimateTime" | "officialNavPublished" | "valuationStatus">, now = new Date()): FundValuationState {
  if (quote.officialNavPublished === true && quote.nav != null && sameChinaDate(quote.navDate, now)) return "official_nav";
  if (quote.estimate != null && sameChinaDate(quote.estimateTime, now) && quote.officialNavPublished !== true && (quote.valuationStatus === "estimate" || quote.valuationStatus === "live_estimate")) return "same_day_estimate";
  if (quote.nav != null) return "latest_official";
  return "unavailable";
}

export function normalizeFundValuationState(quote: FundQuote, now = new Date()): FundQuote {
  const state = resolveFundValuationState(quote, now);
  if (state === "official_nav") return { ...quote, valuationStatus: "official_nav", officialNavPublished: true, estimate: null, estimatePct: null, estimateTime: null, referenceNav: quote.nav, referenceNavDate: quote.navDate };
  if (state === "same_day_estimate") return { ...quote, officialNavPublished: false, valuationStatus: "estimate", referenceNav: quote.nav, referenceNavDate: quote.navDate };
  if (state === "latest_official") return { ...quote, officialNavPublished: false, valuationStatus: "waiting_official_nav", estimate: null, estimatePct: null, estimateTime: null, referenceNav: quote.nav, referenceNavDate: quote.navDate };
  return { ...quote, officialNavPublished: false, valuationStatus: "unavailable", referenceNav: null, referenceNavDate: null };
}
