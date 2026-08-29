import type { Holding } from "./types";
import { DEFAULT_SECTOR_IDS } from "./data/sectors";

const PORT_KEYS = ["fund_ai_pro_portfolio_v3", "fund_ai_pro_portfolio_v2", "fund_ai_pro_portfolio"];
const DS_KEY = "fund_ai_pro_deepseek_key";
const DS_MODEL = "fund_ai_pro_deepseek_model";
const SECTOR_KEY = "fund_ai_pro_selected_sectors_v1";
const WATCH_KEY = "fund_ai_pro_watchlist_v1";
const SETTINGS_KEY = "fund_ai_pro_settings_v1";

export type AppSettings = {
  autoRefreshMs: number;
  newsRefreshMs: number;
};

const DEFAULT_SETTINGS: AppSettings = {
  autoRefreshMs: 120_000,
  newsRefreshMs: 15 * 60_000,
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadPortfolio(): Holding[] {
  if (typeof window === "undefined") return [];
  for (const key of PORT_KEYS) {
    try {
      const arr = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(arr) && arr.length) {
        const cleaned = arr.filter(
          (x: Holding) => x && /^\d{6}$/.test(x.code) && Number(x.shares) > 0 && Number(x.cost) > 0,
        ) as Holding[];
        if (cleaned.length) {
          if (key !== PORT_KEYS[0]) savePortfolio(cleaned);
          return cleaned;
        }
      }
    } catch {
      /* migrate next key */
    }
  }
  return [];
}

export function savePortfolio(list: Holding[]) {
  try {
    localStorage.setItem(PORT_KEYS[0], JSON.stringify(list));
  } catch {
    /* quota */
  }
}

export function getDSKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(DS_KEY) || "";
}

export function setDSKey(key: string) {
  if (!key) localStorage.removeItem(DS_KEY);
  else localStorage.setItem(DS_KEY, key);
}

export function getDSModel(): string {
  if (typeof window === "undefined") return "deepseek-chat";
  return localStorage.getItem(DS_MODEL) || "deepseek-chat";
}

export function setDSModel(model: string) {
  localStorage.setItem(DS_MODEL, model || "deepseek-chat");
}

export function loadSelectedSectors(): string[] {
  const ids = readJson<string[]>(SECTOR_KEY, DEFAULT_SECTOR_IDS);
  return ids.length ? ids : DEFAULT_SECTOR_IDS;
}

export function saveSelectedSectors(ids: string[]) {
  try {
    localStorage.setItem(SECTOR_KEY, JSON.stringify(ids));
  } catch {
    /* quota */
  }
}

export function loadWatchlist(): string[] {
  return readJson<string[]>(WATCH_KEY, []);
}

export function saveWatchlist(codes: string[]) {
  try {
    localStorage.setItem(WATCH_KEY, JSON.stringify(codes));
  } catch {
    /* quota */
  }
}

export function loadSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<AppSettings>>(SETTINGS_KEY, {}) };
}

export function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* quota */
  }
}
