import { loadWithRuntime, type RuntimeResult } from "./data-runtime";
import { backgroundRefresh } from "./runtime-refresh";
import type { CacheDomain } from "./cache-policy";

export type ScreenSlot<T> = RuntimeResult<T> & {
  key: string;
  domain: CacheDomain;
  status: "realtime" | "cache" | "stale_cache" | "none";
};

export type ScreenLoaders = {
  portfolio?: () => Promise<unknown>;
  market?: () => Promise<unknown>;
  fundSectors?: () => Promise<unknown>;
  news?: () => Promise<unknown>;
};

export type ScreenScopes = Partial<Record<keyof ScreenLoaders, string>>;

const CONFIG: Array<{ name: keyof ScreenLoaders; domain: CacheDomain; timeoutMs: number }> = [
  { name: "portfolio", domain: "portfolio", timeoutMs: 6000 },
  { name: "market", domain: "index", timeoutMs: 5000 },
  { name: "fundSectors", domain: "fundSector", timeoutMs: 7000 },
  { name: "news", domain: "news", timeoutMs: 7000 },
];

function scopedKey(name: keyof ScreenLoaders, scope?: string) {
  const normalized = scope?.trim();
  return normalized ? `screen:${String(name)}:${normalized}` : `screen:${String(name)}`;
}

function statusOf(result: RuntimeResult<unknown>): ScreenSlot<unknown>["status"] {
  if (result.source === "network") return "realtime";
  if (result.source === "cache" && result.stale) return "stale_cache";
  if (result.source === "cache") return "cache";
  return "none";
}

/**
 * 首屏加载编排：四个数据域并行、彼此隔离，不会因为某个接口失败阻塞整个首页。
 * scope 用于区分不同的持仓/板块筛选组合，避免不同参数共用错误缓存。
 */
export async function loadScreenData(
  loaders: ScreenLoaders,
  scopes: ScreenScopes = {},
): Promise<Record<string, ScreenSlot<unknown>>> {
  const jobs = CONFIG
    .filter((x) => typeof loaders[x.name] === "function")
    .map(async ({ name, domain, timeoutMs }) => {
      const key = scopedKey(name, scopes[name]);
      const result = await loadWithRuntime(loaders[name] as () => Promise<unknown>, {
        key,
        domain,
        timeoutMs,
        allowStale: true,
      });
      return [name, { ...result, key, domain, status: statusOf(result) }] as const;
    });

  const settled = await Promise.all(jobs);
  return Object.fromEntries(settled);
}

/**
 * 已有首屏显示后执行后台刷新；某个域失败只影响该域。
 */
export async function refreshScreenData(
  loaders: ScreenLoaders,
  scopes: ScreenScopes = {},
): Promise<Record<string, unknown>> {
  const jobs = CONFIG
    .filter((x) => typeof loaders[x.name] === "function")
    .map(async ({ name, domain }) => {
      const key = scopedKey(name, scopes[name]);
      const value = await backgroundRefresh(key, domain, loaders[name] as () => Promise<unknown>);
      return [name, value] as const;
    });
  return Object.fromEntries(await Promise.all(jobs));
}
