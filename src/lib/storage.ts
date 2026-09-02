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
const DEFAULT_SETTINGS: AppSettings = { autoRefreshMs: 180_000, newsRefreshMs: 3 * 60_000 };
const RELIABLE_MARKET_CACHE_MAX_AGE = 14 * 24 * 60 * 60_000;
const NEWS_CACHE_MAX_AGE = 48 * 60 * 60_000;

function readJson<T>(key: string, fallback: T): T { if (typeof window === "undefined") return fallback; try { const raw = localStorage.getItem(key); if (!raw) return fallback; return JSON.parse(raw) as T; } catch { return fallback; } }
function saveJson(key: string, value: unknown) { if (typeof window === "undefined") return; try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function loadCache<T>(key: string, maxAge: number): T | null { if (typeof window === "undefined") return null; try { const item = JSON.parse(localStorage.getItem(key) || "null") as CacheEnvelope<T> | null; if (!item || typeof item.savedAt !== "number" || Date.now() - item.savedAt > maxAge) return null; return item.data ?? null; } catch { return null; } }
function saveCache<T>(key: string, data: T) { saveJson(key, { savedAt: Date.now(), data } satisfies CacheEnvelope<T>); }

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
    const purchaseDate = typeof x.purchaseDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.purchaseDate) ? x.purchaseDate : null;
    const purchaseDateSource = x.purchaseDateSource === "manual" || x.purchaseDateSource === "estimated" ? x.purchaseDateSource : null;
    out.push({ code, name: String(x.name || code).trim() || code, shares, cost, purchaseDate, purchaseDateSource });
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
export function savePortfolio(list: Holding[]) { saveJson(PORT_KEYS[0], sanitizePortfolio(list)); }

export function getDSKey(): string { if (typeof window === "undefined") return ""; return localStorage.getItem(DS_KEY) || ""; }
export function setDSKey(key: string) { if (!key) localStorage.removeItem(DS_KEY); else localStorage.setItem(DS_KEY, key); }
export function getDSModel(): string { if (typeof window === "undefined") return "deepseek-chat"; return localStorage.getItem(DS_MODEL) || "deepseek-chat"; }
export function setDSModel(model: string) { localStorage.setItem(DS_MODEL, model || "deepseek-chat"); }

export function loadSelectedSectors(): string[] { const saved = readJson<string[]>(SECTOR_KEY, DEFAULT_FUND_SECTOR_IDS); const validIds = new Set(FUND_SECTORS.map((s) => s.id)); const cleaned = Array.isArray(saved) ? saved.filter((id) => validIds.has(id)) : []; if (cleaned.length) return cleaned; saveSelectedSectors(DEFAULT_FUND_SECTOR_IDS); return [...DEFAULT_FUND_SECTOR_IDS]; }
export function saveSelectedSectors(ids: string[]) { saveJson(SECTOR_KEY, ids.filter((id) => FUND_SECTORS.some((s) => s.id === id))); }
export function loadWatchlist(): string[] { return readJson<string[]>(WATCH_KEY, []).filter((x) => /^\d{6}$/.test(String(x))); }
export function saveWatchlist(codes: string[]) { saveJson(WATCH_KEY, codes.filter((x) => /^\d{6}$/.test(String(x)))); }
export function loadSettings(): AppSettings { const saved = readJson<Partial<AppSettings>>(SETTINGS_KEY, {}); const autoRefreshMs = Number(saved.autoRefreshMs); const newsRefreshMs = Number(saved.newsRefreshMs); return { ...DEFAULT_SETTINGS, ...saved, autoRefreshMs: Number.isFinite(autoRefreshMs) ? Math.max(30_000, Math.min(autoRefreshMs, 30 * 60_000)) : DEFAULT_SETTINGS.autoRefreshMs, newsRefreshMs: Number.isFinite(newsRefreshMs) ? Math.max(60_000, Math.min(newsRefreshMs, 60 * 60_000)) : DEFAULT_SETTINGS.newsRefreshMs }; }
export function saveSettings(s: AppSettings) { saveJson(SETTINGS_KEY, s); }
