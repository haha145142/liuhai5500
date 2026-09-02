export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type ProviderHealth = {
  provider: string;
  endpoint: string;
  state: CircuitState;
  consecutiveFailures: number;
  lastSuccess: number;
  lastFailure: number;
  latencyMs: number;
  successCount: number;
  requestCount: number;
  successRate: number;
};

type State = ProviderHealth & { openedAt: number };
const FAILURE_THRESHOLD = 5;
const OPEN_MS = 30_000;
const states = new Map<string, State>();

function key(provider: string, endpoint: string) {
  try { return `${provider}:${new URL(endpoint).host}`; } catch { return `${provider}:${endpoint}`; }
}

export function providerFromUrl(endpoint: string) {
  try {
    const host = new URL(endpoint).hostname.toLowerCase();
    if (host.includes("eastmoney")) return "东方财富";
    if (host.includes("gtimg")) return "腾讯财经";
    if (host.includes("sina")) return "新浪财经";
    if (host.includes("githubusercontent")) return "AKShare快照";
    if (host.includes("10jqka")) return "同花顺";
    if (host.includes("cls.cn")) return "财联社";
    if (host.includes("jin10")) return "金十数据";
    if (host.includes("wscn")) return "华尔街见闻";
    return host;
  } catch { return "unknown"; }
}

export function getProviderHealth(provider: string, endpoint: string): ProviderHealth {
  const k = key(provider, endpoint);
  const current = states.get(k);
  if (!current) {
    const empty: State = { provider, endpoint, state: "CLOSED", consecutiveFailures: 0, lastSuccess: 0, lastFailure: 0, latencyMs: 0, successCount: 0, requestCount: 0, successRate: 1, openedAt: 0 };
    states.set(k, empty);
    return empty;
  }
  if (current.state === "OPEN" && Date.now() - current.openedAt >= OPEN_MS) current.state = "HALF_OPEN";
  return current;
}

export function providerAllowed(provider: string, endpoint: string) {
  return getProviderHealth(provider, endpoint).state !== "OPEN";
}

export function recordProviderSuccess(provider: string, endpoint: string, latencyMs: number) {
  const current = getProviderHealth(provider, endpoint) as State;
  current.requestCount += 1;
  current.successCount += 1;
  current.successRate = current.successCount / Math.max(1, current.requestCount);
  current.consecutiveFailures = 0;
  current.lastSuccess = Date.now();
  current.latencyMs = Math.round(latencyMs);
  current.state = "CLOSED";
  current.openedAt = 0;
}

export function recordProviderFailure(provider: string, endpoint: string, latencyMs: number) {
  const current = getProviderHealth(provider, endpoint) as State;
  current.requestCount += 1;
  current.consecutiveFailures += 1;
  current.successRate = current.successCount / Math.max(1, current.requestCount);
  current.lastFailure = Date.now();
  current.latencyMs = Math.round(latencyMs);
  if (current.state === "HALF_OPEN" || current.consecutiveFailures >= FAILURE_THRESHOLD) {
    current.state = "OPEN";
    current.openedAt = Date.now();
  }
}

export function listProviderHealth(): ProviderHealth[] {
  return [...states.values()].map(({ openedAt: _openedAt, ...entry }) => ({ ...entry }));
}
