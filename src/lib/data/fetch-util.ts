export async function fetchText(
  url: string,
  timeout = 10000,
  headers: Record<string, string> = {},
): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);

  try {
    try {
      const r = await fetch(url, {
        signal: ctrl.signal,
        cache: "no-store",
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Connection: "close",
          ...headers,
        },
      });

      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch {
      const { execFile } = await import("node:child_process");

      const args = [
        "-4",
        "--http1.1",
        "--max-time",
        String(Math.max(5, Math.ceil(timeout / 1000))),
        "-sS",
        "-H",
        "Accept: application/json,text/plain,*/*",
        "-H",
        "User-Agent: Mozilla/5.0",
        "-H",
        "Connection: close",
      ];

      for (const [k, v] of Object.entries(headers)) {
        args.push("-H", `${k}: ${v}`);
      }

      args.push(url);

      return await new Promise((resolve, reject) => {
        execFile(
          "curl",
          args,
          {
            timeout: timeout + 3000,
            maxBuffer: 4 * 1024 * 1024,
          },
          (error, stdout, stderr) => {
            if (error) {
              reject(
                new Error(
                  `curl failed: ${error.message}${stderr ? `: ${stderr.trim()}` : ""}`,
                ),
              );
              return;
            }
            resolve(stdout);
          },
        );
      });
    }
  } finally {
    clearTimeout(t);
  }
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
