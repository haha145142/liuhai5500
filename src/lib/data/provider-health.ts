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
