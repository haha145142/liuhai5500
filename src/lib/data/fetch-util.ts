import { providerAllowedAsync, recordProviderFailureAsync, recordProviderSuccessAsync, providerFromUrl } from "./provider-health";

export async function fetchText(url: string, timeout = 5000, headers: Record<string, string> = {}): Promise<string> {
  const safeTimeout = Math.min(Math.max(1000, timeout), 15_000);
  const totalBudget = Math.min(3500, safeTimeout + 400);
  const provider = providerFromUrl(url);
  const endpoint = url.split("?")[0];
  if (!(await providerAllowedAsync(provider, endpoint))) throw new Error(`provider-circuit-open:${provider}`);
  const started = Date.now();
  const delays = [0, 120, 240];
  let lastError: unknown = null;
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    const elapsed = Date.now() - started;
    const remaining = totalBudget - elapsed;
    if (remaining <= 150) break;
    const attemptTimeout = Math.min(safeTimeout, remaining);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), attemptTimeout);
    try {
      const response = await fetch(url, { signal: ctrl.signal, cache: "no-store", headers: { Accept: "application/json,text/plain,*/*", "User-Agent": "Mozilla/5.0 (compatible; FundAIPro/1.0)", ...headers } });
      if (!response.ok) {
        const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
        lastError = new Error(`HTTP ${response.status}`);
        if (!retryable || attempt === delays.length - 1) throw lastError;
        continue;
      }
      const text = await response.text();
      await recordProviderSuccessAsync(provider, endpoint, Date.now() - started);
      return text;
    } catch (error) {
      lastError = error instanceof Error && error.name === "AbortError" ? new Error(`请求超时（${Math.ceil(attemptTimeout / 1000)}秒）`) : error;
      if (attempt === delays.length - 1 || Date.now() - started >= totalBudget) break;
    } finally { clearTimeout(timer); }
  }
  await recordProviderFailureAsync(provider, endpoint, Date.now() - started);
  throw lastError instanceof Error ? lastError : new Error("请求失败");
}

export function parseMaybeJsonp(text: string): unknown {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch {
    const match = trimmed.match(/^[a-zA-Z_$][\w$]*\((.*)\)\s*;?\s*$/s);
    if (match) { try { return JSON.parse(match[1]); } catch { return null; } }
    const start = trimmed.indexOf("{"); const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) { try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { return null; } }
    return null;
  }
}

export function asArr(value: unknown): Record<string, unknown>[] { if (Array.isArray(value)) return value as Record<string, unknown>[]; if (value && typeof value === "object") return Object.values(value) as Record<string, unknown>[]; return []; }
export function n(value: unknown): number | null { if (value == null || value === "" || value === "-" || value === "—") return null; const parsed = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, "")); return Number.isFinite(parsed) ? parsed : null; }
