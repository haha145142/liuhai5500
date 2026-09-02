export type SharedCacheEntry<T> = { value: T; savedAt: number; expiresAt: number };

type UpstashResponse<T> = { result?: T };

function config() {
  const url = String(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").trim();
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "").trim();
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function command<T>(parts: Array<string | number>): Promise<T | null> {
  const cfg = config();
  if (!cfg) return null;
  try {
    const response = await fetch(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([parts]),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as UpstashResponse<T>[];
    return payload[0]?.result ?? null;
  } catch {
    return null;
  }
}

export function sharedCacheConfigured() {
  return !!config();
}

export async function sharedCacheGet<T>(key: string): Promise<SharedCacheEntry<T> | null> {
  const raw = await command<string>(["GET", key]);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SharedCacheEntry<T>;
    if (!parsed || typeof parsed.savedAt !== "number" || typeof parsed.expiresAt !== "number" || !("value" in parsed)) return null;
    if (parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function sharedCacheSet<T>(key: string, value: T, ttlMs: number): Promise<boolean> {
  const now = Date.now();
  const entry: SharedCacheEntry<T> = { value, savedAt: now, expiresAt: now + Math.max(1_000, ttlMs) };
  const result = await command<string>(["SET", key, JSON.stringify(entry), "PX", Math.max(1_000, ttlMs)]);
  return result === "OK";
}

export async function sharedCacheDelete(key: string): Promise<boolean> {
  const result = await command<number>(["DEL", key]);
  return result === 1;
}
