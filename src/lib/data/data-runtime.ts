import { readCache, writeCache, type CacheEnvelope } from "./offline-cache";
import { guardedRequest } from "./request-guard";

export type RuntimeResult<T> = {
  data: T | null;
  source: "network" | "cache" | "none";
  cachedAt?: number;
  stale?: boolean;
  error?: string;
};

export type RuntimeOptions = {
  key: string;
  ttlMs: number;
  timeoutMs?: number;
  allowStale?: boolean;
  cacheVersion?: number;
};

/**
 * UI-facing data runtime:
 * 1) never waits on network before rendering cached content;
 * 2) deduplicates identical requests;
 * 3) returns the freshest successful network value when available;
 * 4) falls back to the last known valid cache on failure/timeout;
 * 5) never manufactures placeholder market numbers.
 */
export async function loadWithRuntime<T>(
  fetcher: () => Promise<T>,
  options: RuntimeOptions,
): Promise<RuntimeResult<T>> {
  const cached = readCache<T>(options.key, options.cacheVersion ?? 1);
  const cacheAge = cached?.savedAt != null ? Date.now() - cached.savedAt : Infinity;
  const cacheFresh = cached?.data != null && cacheAge <= options.ttlMs;

  if (cacheFresh) {
    // Refresh happens in the caller when desired; first render remains instant.
    return { data: cached!.data, source: "cache", cachedAt: cached!.savedAt, stale: false };
  }

  try {
    const data = await guardedRequest(options.key, fetcher, options.timeoutMs ?? 8000);
    if (data == null) throw new Error("empty response");
    writeCache<T>(options.key, data, options.cacheVersion ?? 1);
    return { data, source: "network", cachedAt: Date.now(), stale: false };
  } catch (error) {
    if (cached?.data != null && options.allowStale !== false) {
      return {
        data: cached.data,
        source: "cache",
        cachedAt: cached.savedAt,
        stale: true,
        error: error instanceof Error ? error.message : "请求失败",
      };
    }
    return {
      data: null,
      source: "none",
      error: error instanceof Error ? error.message : "请求失败",
    };
  }
}

export function isStaleResult<T>(result: RuntimeResult<T>) {
  return result.stale === true;
}

export function formatCacheStatus(result: RuntimeResult<unknown>, now = Date.now()) {
  if (!result.cachedAt) return result.source === "none" ? "暂无可靠数据" : "实时数据";
  const ageMinutes = Math.max(0, Math.floor((now - result.cachedAt) / 60000));
  if (result.stale) return ageMinutes < 60 ? `缓存数据 · ${ageMinutes}分钟前` : `缓存数据 · ${Math.floor(ageMinutes / 60)}小时前`;
  return result.source === "cache" ? "本地缓存 · 可刷新" : "刚刚更新";
}
