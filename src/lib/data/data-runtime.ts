import { readCached, writeCached } from "./offline-cache";
import { guardedRequest } from "./request-guard";
import { cacheTtl, type CacheDomain } from "./cache-policy";

export type RuntimeResult<T> = {
  data: T | null;
  source: "network" | "cache" | "none";
  cachedAt?: number;
  stale?: boolean;
  error?: string;
};

export type RuntimeOptions = {
  key: string;
  domain?: CacheDomain;
  ttlMs?: number;
  timeoutMs?: number;
  allowStale?: boolean;
  cacheVersion?: number;
  tradingDate?: string | null;
};

/**
 * UI-facing runtime: cached data first, guarded background refresh, and stale fallback.
 * This module deliberately never invents market numbers.
 */
export async function loadWithRuntime<T>(
  fetcher: () => Promise<T>,
  options: RuntimeOptions,
): Promise<RuntimeResult<T>> {
  const ttlMs = options.ttlMs ?? (options.domain ? cacheTtl(options.domain) ?? 0 : 0);
  const cached = readCached<T>(options.key, options.cacheVersion ?? 1);
  const cacheAge = cached ? Date.now() - cached.savedAt : Infinity;
  const cacheFresh = cached?.value != null && (ttlMs <= 0 || cacheAge <= ttlMs);

  if (cacheFresh) {
    return { data: cached!.value, source: "cache", cachedAt: cached!.savedAt, stale: false };
  }

  try {
    const data = await guardedRequest<T>(
      options.key,
      fetcher,
      options.timeoutMs ?? 8000,
      null as T,
    );
    if (data == null) throw new Error("empty response");
    writeCached(options.key, data, options.tradingDate ?? null);
    return { data, source: "network", cachedAt: Date.now(), stale: false };
  } catch (error) {
    if (cached?.value != null && options.allowStale !== false) {
      return {
        data: cached.value,
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
  if (result.stale) {
    return ageMinutes < 60 ? `缓存数据 · ${ageMinutes}分钟前` : `缓存数据 · ${Math.floor(ageMinutes / 60)}小时前`;
  }
  return result.source === "cache" ? "本地缓存 · 可刷新" : "刚刚更新";
}
