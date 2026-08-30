import { cacheTtl, type CacheDomain } from "./cache-policy";

export type RefreshPolicy = {
  domain: CacheDomain;
  ttlMs: number | null;
  minIntervalMs: number;
  background: boolean;
};

export type RefreshState = {
  lastStartedAt: number;
  lastSuccessAt: number;
  refreshing: boolean;
};

const DEFAULT_MIN_INTERVAL: Record<CacheDomain, number> = {
  ui: 0,
  portfolio: 30_000,
  fundEstimate: 15_000,
  index: 10_000,
  fundSector: 20_000,
  news: 60_000,
  officialNav: 300_000,
  ai: 60_000,
};

const states = new Map<string, RefreshState>();

export function refreshPolicy(domain: CacheDomain): RefreshPolicy {
  return {
    domain,
    ttlMs: cacheTtl(domain),
    minIntervalMs: DEFAULT_MIN_INTERVAL[domain],
    background: domain !== "ui" && domain !== "ai",
  };
}

export function shouldRefresh(key: string, domain: CacheDomain, now = Date.now()) {
  const state = states.get(key);
  if (!state || state.refreshing) return !state?.refreshing;
  return now - state.lastStartedAt >= refreshPolicy(domain).minIntervalMs;
}

export function beginRefresh(key: string) {
  const previous = states.get(key);
  if (previous?.refreshing) return false;
  states.set(key, {
    lastStartedAt: Date.now(),
    lastSuccessAt: previous?.lastSuccessAt ?? 0,
    refreshing: true,
  });
  return true;
}

export function endRefresh(key: string, success: boolean, now = Date.now()) {
  const previous = states.get(key);
  states.set(key, {
    lastStartedAt: previous?.lastStartedAt ?? now,
    lastSuccessAt: success ? now : previous?.lastSuccessAt ?? 0,
    refreshing: false,
  });
}

export function getRefreshState(key: string): RefreshState | null {
  return states.get(key) ?? null;
}

export async function backgroundRefresh<T>(
  key: string,
  domain: CacheDomain,
  task: () => Promise<T>,
): Promise<T | null> {
  if (!shouldRefresh(key, domain) || !beginRefresh(key)) return null;
  try {
    const value = await task();
    endRefresh(key, true);
    return value;
  } catch {
    endRefresh(key, false);
    return null;
  }
}
