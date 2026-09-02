export async function fetchText(
  url: string,
  timeout = 5000,
  headers: Record<string, string> = {},
): Promise<string> {
  const safeTimeout = Math.min(Math.max(1000, timeout), 15_000);
  const delays = [0, 250, 700];
  let lastError: unknown = null;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), safeTimeout);
    try {
      const response = await fetch(url, {
        signal: ctrl.signal,
        cache: "no-store",
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent": "Mozilla/5.0 (compatible; FundAIPro/1.0)",
          ...headers,
        },
      });

      if (!response.ok) {
        const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
        if (!retryable || attempt === delays.length - 1) throw new Error(`HTTP ${response.status}`);
        continue;
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error(`请求超时（${Math.ceil(safeTimeout / 1000)}秒）`);
      }
      if (attempt === delays.length - 1) break;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("请求失败");
}

export function parseMaybeJsonp(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/^[a-zA-Z_$][\w$]*\((.*)\)\s*;?\s*$/s);
    if (match) {
      try { return JSON.parse(match[1]); } catch { return null; }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { return null; }
    }
    return null;
  }
}

export function asArr(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object") return Object.values(value) as Record<string, unknown>[];
  return [];
}

export function n(value: unknown): number | null {
  if (value == null || value === "" || value === "-" || value === "—") return null;
  const parsed = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
