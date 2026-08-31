export async function fetchText(
  url: string,
  timeout = 5000,
  headers: Record<string, string> = {},
): Promise<string> {
  const delays = [0, 250, 700];
  let lastError: unknown = null;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, {
        signal: ctrl.signal,
        cache: "no-store",
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          ...headers,
        },
      });

      if (!r.ok) {
        const retryable = r.status === 408 || r.status === 425 || r.status === 429 || r.status >= 500;
        if (!retryable || attempt === delays.length - 1) throw new Error(`HTTP ${r.status}`);
        continue;
      }
      return await r.text();
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error(`请求超时（${Math.ceil(timeout / 1000)}秒）`);
      }
      if (attempt === delays.length - 1) break;
    } finally {
      clearTimeout(t);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("请求失败");
}

export function parseMaybeJsonp(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const m = trimmed.match(/^[a-zA-Z_$][\w$]*\((.*)\)\s*;?\s*$/s);
    if (m) {
      try {
        return JSON.parse(m[1]);
      } catch {
        return null;
      }
    }
    const i = trimmed.indexOf("{");
    const j = trimmed.lastIndexOf("}");
    if (i >= 0 && j > i) {
      try {
        return JSON.parse(trimmed.slice(i, j + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function asArr(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  if (v && typeof v === "object") return Object.values(v) as Record<string, unknown>[];
  return [];
}

export function n(v: unknown): number | null {
  if (v == null || v === "" || v === "-" || v === "—") return null;
  const x = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(x) ? x : null;
}
