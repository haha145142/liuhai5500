import { isWeekendLike, readCached, writeCached } from "./offline-cache";

export type CacheDomain = "ui" | "portfolio" | "fundEstimate" | "index" | "fundSector" | "news" | "officialNav" | "ai";

export const CACHE_TTL_MS: Record<CacheDomain, number | null> = {
  ui: null,
  portfolio: 5 * 60_000,
  fundEstimate: 25_000,
  index: 15_000,
  fundSector: 60_000,
  news: 3 * 60_000,
  officialNav: 60 * 60_000,
  ai: 30 * 60_000,
};

export type CacheContext = { domain: CacheDomain; now?: Date; tradingDate?: string | null };

export function cacheTtl(domain: CacheDomain) { return CACHE_TTL_MS[domain]; }

function chinaDate(now: Date) {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function readDomainCache<T>(key: string, context: CacheContext): { value: T; savedAt: number; tradingDate: string | null } | null {
  const ttl = cacheTtl(context.domain);
  const cached = readCached<T>(key, ttl == null ? undefined : ttl);
  if (!cached) return null;
  const now = context.now ?? new Date();
  const sameTradingDate = !context.tradingDate || !cached.tradingDate || context.tradingDate === cached.tradingDate;
  if (context.domain === "officialNav") return cached;
  if (isWeekendLike(new Date(now.getTime() + 8 * 60 * 60 * 1000)) && cached.tradingDate) return cached;
  if (!sameTradingDate && context.domain !== "news" && context.domain !== "ai") return null;
  return cached;
}

export function writeDomainCache<T>(key: string, value: T, context: CacheContext) {
  return writeCached(key, value, context.tradingDate ?? null);
}

export type MarketDataState = "trading" | "weekend" | "closed_weekday";

export function classifyMarketDataState(input: { now?: Date; latestTradingDate?: string | null }): MarketDataState {
  const now = input.now ?? new Date();
  const today = chinaDate(now);
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  if (isWeekendLike(shifted)) return "weekend";
  if (input.latestTradingDate && input.latestTradingDate !== today) return "closed_weekday";
  return "trading";
}

export function marketDataLabel(state: MarketDataState, latestTradingDate?: string | null) {
  if (state === "weekend") return latestTradingDate ? `休市 · 显示最近交易日 ${latestTradingDate}` : "休市 · 显示最近交易日数据";
  if (state === "closed_weekday") return latestTradingDate ? `当日无可靠行情 · 显示最近交易日 ${latestTradingDate}` : "当日无可靠行情 · 显示最近交易日数据";
  return "交易时段 · 后台实时更新";
}
