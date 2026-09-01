import type { FundQuote, Holding } from "../types";

type ReturnQuote = {
  price: number | null;
  mode: "live_estimate" | "official_today" | "latest_official" | "none";
};

export type HoldingReturn = {
  costValue: number;
  marketValue: number | null;
  holdingPnl: number | null;
  holdingPnlPct: number | null;
  todayPnl: number | null;
  todayPnlPct: number | null;
  previousOfficialNav: number | null;
  price: number | null;
  quoteMode: ReturnQuote["mode"];
};

function finitePositive(value: number | null | undefined) {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function selectReturnQuote(fund: FundQuote | undefined): ReturnQuote {
  if (!fund) return { price: null, mode: "none" };
  const estimateIsCurrent =
    fund.estimate != null &&
    (fund.valuationStatus === "estimate" || fund.valuationStatus === "live_estimate") &&
    fund.officialNavPublished !== true;
  const estimate = estimateIsCurrent ? finitePositive(fund.estimate) : null;
  if (estimate != null) return { price: estimate, mode: "live_estimate" };

  const nav = finitePositive(fund.nav);
  if (nav != null) {
    return {
      price: nav,
      mode: fund.officialNavPublished === true && fund.valuationStatus === "official_nav"
        ? "official_today"
        : "latest_official",
    };
  }
  return { price: null, mode: "none" };
}

/**
 * Return the previous trading day's official NAV from the chronological history.
 */
function previousOfficialNav(fund: FundQuote | undefined, currentPrice: number | null) {
  if (!fund || currentPrice == null) return null;
  const history = Array.isArray(fund.history) ? fund.history.filter((x) => Number.isFinite(x) && x > 0) : [];
  if (history.length < 2) return null;

  const latest = history[history.length - 1];
  const latestNav = finitePositive(fund.nav);
  if (latestNav != null && Math.abs(latest - latestNav) > Math.max(0.0000001, latestNav * 0.000001)) {
    return latestNav;
  }
  return history[history.length - 2];
}

/**
 * Single-source return calculation used by fund cards and portfolio summaries.
 */
export function calcHoldingReturn(holding: Holding, fund?: FundQuote): HoldingReturn {
  const shares = Number(holding.shares);
  const cost = Number(holding.cost);
  const safeShares = Number.isFinite(shares) && shares > 0 ? shares : 0;
  const safeCost = finitePositive(cost) ?? 0;
  const costValue = safeShares * safeCost;
  const quote = selectReturnQuote(fund);
  const marketValue = quote.price != null ? safeShares * quote.price : null;
  const holdingPnl = marketValue != null ? marketValue - costValue : null;
  const holdingPnlPct = holdingPnl != null && costValue > 0 ? (holdingPnl / costValue) * 100 : null;
  const previousNav = previousOfficialNav(fund, quote.price);
  const canCalculateToday =
    quote.price != null &&
    previousNav != null &&
    (quote.mode === "live_estimate" || quote.mode === "official_today");
  const todayPnl = canCalculateToday ? (quote.price! - previousNav!) * safeShares : null;
  const todayPnlPct = canCalculateToday && previousNav! > 0 ? ((quote.price! - previousNav!) / previousNav!) * 100 : null;

  return {
    costValue,
    marketValue,
    holdingPnl,
    holdingPnlPct,
    todayPnl,
    todayPnlPct,
    previousOfficialNav: previousNav,
    price: quote.price,
    quoteMode: quote.mode,
  };
}

export function calcPortfolioReturn(holdings: Holding[], funds: Record<string, FundQuote>): {
  costValue: number;
  marketValue: number;
  holdingPnl: number;
  holdingPnlPct: number | null;
  todayPnl: number | null;
  todayPnlPct: number | null;
  pricedCount: number;
  totalCount: number;
} {
  const results = holdings.map((holding) => calcHoldingReturn(holding, funds[holding.code]));
  const costValue = results.reduce((sum, x) => sum + x.costValue, 0);
  const priced = results.filter((x) => x.marketValue != null);
  const marketValue = priced.reduce((sum, x) => sum + (x.marketValue ?? 0), 0);
  const holdingPnl = priced.reduce((sum, x) => sum + (x.holdingPnl ?? 0), 0);
  const todayResults = results.filter((x) => x.todayPnl != null);
  const todayPnl = todayResults.length === priced.length && priced.length > 0
    ? todayResults.reduce((sum, x) => sum + (x.todayPnl ?? 0), 0)
    : null;
  return {
    costValue,
    marketValue,
    holdingPnl,
    holdingPnlPct: costValue > 0 && priced.length === holdings.length ? (holdingPnl / costValue) * 100 : null,
    todayPnl,
    todayPnlPct: todayPnl != null && marketValue - todayPnl > 0 ? (todayPnl / (marketValue - todayPnl)) * 100 : null,
    pricedCount: priced.length,
    totalCount: holdings.length,
  };
}
