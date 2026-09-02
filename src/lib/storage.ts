import type { Holding, FundQuote, NewsFeed, Snapshot } from "./types";
import { DEFAULT_FUND_SECTOR_IDS, FUND_SECTORS } from "./data/fund-sectors";

const PORT_KEYS = ["fund_ai_pro_portfolio_v3", "fund_ai_pro_portfolio_v2", "fund_ai_pro_portfolio"];
const DS_KEY = "fund_ai_pro_deepseek_key";
const DS_MODEL = "fund_ai_pro_deepseek_model";
const SECTOR_KEY = "fund_ai_pro_selected_fund_sectors_v2";
const WATCH_KEY = "fund_ai_pro_watchlist_v1";
const SETTINGS_KEY = "fund_ai_pro_settings_v1";
const SNAPSHOT_CACHE_KEY = "fund_ai_pro_snapshot_cache_v1";
const NEWS_CACHE_KEY = "fund_ai_pro_news_cache_v1";
const FUNDS_CACHE_KEY = "fund_ai_pro_funds_cache_v1";

export type AppSettings = { autoRefreshMs: number; newsRefreshMs: number };
type CacheEnvelope<T> = { savedAt: number; data: T };
const DEFAULT_SETTINGS: AppSettings = { autoRefreshMs: 3 * 60_000, newsRefreshMs: 3 * 60_000 };
const RELIABLE_MARKET_CACHE_MAX_AGE = 14 * 24 * 60 * 60_000;
const NEWS_CACHE_MAX_AGE = 48 * 60 * 60_000;

function readJson<T>(key: string, fallback: T): T { if (typeof window === "undefined") return fallback; try { const raw = localStorage.getItem(key); if (!raw) return fallback; return JSON.parse(raw) as T; } catch { return fallback; } }
function saveJson(key: string, value: unknown) { if (typeof window === "undefined") return; try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function loadCache<T>(key: string, maxAge: number): T | null { if (typeof window === "undefined") return null; try { const item = JSON.parse(localStorage.getItem(key) || "null") as CacheEnvelope<T> | null; if (!item || typeof item.savedAt !== "number" || Date.now() - item.savedAt > maxAge) return null; return item.data ?? null; } catch { return null; } }
function saveCache<T>(key: string, data: T) { saveJson(key, { savedAt: Date.now(), data } satisfies CacheEnvelope<T>); }

/** Keep the latest reliable market/fund snapshot long enough to cover weekends and long holidays.
 * The stored marketDate/navDate remains authoritative, so a longer TTL never turns old data into "today".
 */
export function loadCachedSnapshot(maxAge = RELIABLE_MARKET_CACHE_MAX_AGE): Snapshot | null { return loadCache<Snapshot>(SNAPSHOT_CACHE_KEY, maxAge); }
export function saveCachedSnapshot(data: Snapshot) { saveCache(SNAPSHOT_CACHE_KEY, data); }
export function loadCachedNews(maxAge = NEWS_CACHE_MAX_AGE): NewsFeed | null { return loadCache<NewsFeed>(NEWS_CACHE_KEY, maxAge); }
export function saveCachedNews(data: NewsFeed) { saveCache(NEWS_CACHE_KEY, data); }
export function loadCachedFunds(maxAge = RELIABLE_MARKET_CACHE_MAX_AGE): Record<string, FundQuote> { return loadCache<Record<string, FundQuote>>(FUNDS_CACHE_KEY, maxAge) || {}; }
export function saveCachedFunds(data: Record<string, FundQuote>) { saveCache(FUNDS_CACHE_KEY, data); }

export function sanitizePortfolio(value: unknown): Holding[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: Holding[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const x = item as Partial<Holding>;
    const code = String(x.code || "").trim();
    const shares = Number(x.shares);
    const cost = Number(x.cost);
    if (!/^\d{6}$/.test(code) || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(cost) || cost <= 0) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name: String(x.name || code).trim() || code, shares, cost });
  }
  return out;
}

export function loadPortfolio(): Holding[] {
  if (typeof window === "undefined") return [];
  for (const key of PORT_KEYS) {
    try {
      const cleaned = sanitizePortfolio(JSON.parse(localStorage.getItem(key) || "null"));
      if (cleaned.length) {
        if (key !== PORT_KEYS[0]) savePortfolio(cleaned);
        return cleaned;
      }
    } catch {}
  }
  return [];
}
export function savePortfolio(list: Holding[]) { try { localStorage.setItem(PORT_KEYS[0], JSON.stringify(sanitizePortfolio(list))); } catch {} }

export function getDSKey(): string { if (typeof window === "undefined") return ""; return localStorage.getItem(DS_KEY) || ""; }
export function setDSKey(key: string) { if (!key) localStorage.removeItem(DS_KEY); else localStorage.setItem(DS_KEY, key); }
export function getDSModel(): string { if (typeof window === "undefined") return "deepseek-chat"; return localStorage.getItem(DS_MODEL) || "deepseek-chat"; }
export function setDSModel(model: string) { localStorage.setItem(DS_MODEL, model || "deepseek-chat"); }

export function loadSelectedSectors(): string[] { const saved = readJson<string[]>(SECTOR_KEY, DEFAULT_FUND_SECTOR_IDS); const validIds = new Set(FUND_SECTORS.map((s) => s.id)); const cleaned = Array.isArray(saved) ? saved.filter((id) => validIds.has(id)) : []; if (cleaned.length) return cleaned; saveSelectedSectors(DEFAULT_FUND_SECTOR_IDS); return [...DEFAULT_FUND_SECTOR_IDS]; }
export function saveSelectedSectors(ids: string[]) { try { localStorage.setItem(SECTOR_KEY, JSON.stringify(ids)); } catch {} }
export function loadWatchlist(): string[] { return readJson<string[]>(WATCH_KEY, []).filter((x) => /^\d{6}$/.test(String(x))); }
export function saveWatchlist(codes: string[]) { try { localStorage.setItem(WATCH_KEY, JSON.stringify(codes.filter((x) => /^\d{6}$/.test(String(x))))); } catch {} }
export function loadSettings(): AppSettings { const saved = readJson<Partial<AppSettings>>(SETTINGS_KEY, {}); return { ...DEFAULT_SETTINGS, ...saved, autoRefreshMs: Number.isFinite(Number(saved.autoRefreshMs)) ? Math.max(3 * 60_000, Number(saved.autoRefreshMs)) : DEFAULT_SETTINGS.autoRefreshMs, newsRefreshMs: Number.isFinite(Number(saved.newsRefreshMs)) ? Math.max(60_000, Number(saved.newsRefreshMs)) : DEFAULT_SETTINGS.newsRefreshMs }; }
export function saveSettings(s: AppSettings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {} }
