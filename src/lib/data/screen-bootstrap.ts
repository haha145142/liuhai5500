import { loadWithRuntime, type RuntimeResult } from "./data-runtime";
import { backgroundRefresh } from "./runtime-refresh";
import type { CacheDomain } from "./cache-policy";

export type ScreenSlot<T> = RuntimeResult<T> & {
  key: string;
  domain: CacheDomain;
};

export type ScreenLoaders = {
  portfolio?: () => Promise<unknown>;
  market?: () => Promise<unknown>;
  fundSectors?: () => Promise<unknown>;
  news?: () => Promise<unknown>;
};

const CONFIG: Array<{ name: keyof ScreenLoaders; domain: CacheDomain; timeoutMs: number }> = [
  { name: "portfolio", domain: "portfolio", timeoutMs: 6000 },
  { name: "market", domain: "index", timeoutMs: 5000 },
  { name: "fundSectors", domain: "fundSector", timeoutMs: 7000 },
  { name: "news", domain: "news", timeoutMs: 7000 },
];

/**
 * 首屏加载编排：数据域彼此隔离，绝不因为某一个接口失败阻塞整个首页。
 * 调用方可以先使用返回结果渲染，再在下一帧/Effect 中触发 background refresh。
 */
export async function loadScreenData(loaders: ScreenLoaders): Promise<Record<string, ScreenSlot<unknown>>> {
  const jobs = CONFIG.filter((x) => typeof loaders[x.name] === "function").map(async ({ name, domain, timeoutMs }) => {
    const key = `screen:${String(name)}`;
    const result = await loadWithRuntime(loaders[name] as () => Promise<unknown>, {
      key,
      domain,
      timeoutMs,
      allowStale: true,
    });
    return [name, { ...result, key, domain }] as const;
  });

  const settled = await Promise.all(jobs);
  return Object.fromEntries(settled);
}

/**
 * 在已有首屏显示后执行轻量后台刷新；某个域失败只影响该域。
 */
export async function refreshScreenData(loaders: ScreenLoaders): Promise<Record<string, unknown>> {
  const jobs = CONFIG.filter((x) => typeof loaders[x.name] === "function").map(async ({ name, domain }) => {
    const key = `screen:${String(name)}`;
    const value = await backgroundRefresh(key, domain, loaders[name] as () => Promise<unknown>);
    return [name, value] as const;
  });
  return Object.fromEntries(await Promise.all(jobs));
}
