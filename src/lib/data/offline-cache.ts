type CacheEnvelope<T> = {
  version: 1;
  savedAt: number;
  tradingDate?: string | null;
  value: T;
};

const PREFIX = "fund-ai-pro:cache:v1:";

function storageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readCached<T>(key: string, maxAgeMs?: number): { value: T; savedAt: number; tradingDate: string | null } | null {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheEnvelope<T>>;
    if (parsed.version !== 1 || typeof parsed.savedAt !== "number" || !("value" in parsed)) return null;
    if (maxAgeMs != null && Date.now() - parsed.savedAt > maxAgeMs) return null;
    return {
      value: parsed.value as T,
      savedAt: parsed.savedAt,
      tradingDate: parsed.tradingDate ?? null,
    };
  } catch {
    return null;
  }
}

export function writeCached<T>(key: string, value: T, tradingDate?: string | null) {
  if (!storageAvailable()) return false;
  try {
    const envelope: CacheEnvelope<T> = {
      version: 1,
      savedAt: Date.now(),
      tradingDate: tradingDate ?? null,
      value,
    };
    window.localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function removeCached(key: string) {
  if (!storageAvailable()) return;
  try { window.localStorage.removeItem(PREFIX + key); } catch {}
}

export function isWeekendLike(date = new Date()) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function cacheAgeLabel(savedAt: number, now = Date.now()) {
  const age = Math.max(0, now - savedAt);
  if (age < 30_000) return "刚刚更新";
  if (age < 5 * 60_000) return `${Math.max(1, Math.round(age / 60_000))}分钟前更新`;
  if (age < 60 * 60_000) return `${Math.round(age / 60_000)}分钟前更新`;
  return `${Math.round(age / 3_600_000)}小时前更新`;
}

export function mergeCachedValue<T>(fresh: T | null | undefined, cached: T | null | undefined) {
  return fresh != null ? fresh : cached != null ? cached : null;
}
