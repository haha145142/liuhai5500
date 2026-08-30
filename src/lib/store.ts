import { create } from "zustand";
import type { FundQuote, Holding, NewsFeed, Snapshot } from "./types";
import {
  loadPortfolio,
  loadSelectedSectors,
  loadSettings,
  loadWatchlist,
  loadCachedSnapshot,
  loadCachedNews,
  loadCachedFunds,
  saveCachedSnapshot,
  saveCachedNews,
  saveCachedFunds,
  savePortfolio,
  saveSelectedSectors,
  saveSettings,
  saveWatchlist,
  type AppSettings,
} from "./storage";
import { getFund, getNews, getSnapshot } from "./data/server";

type AppState = {
  ready: boolean;
  loading: boolean;
  newsLoading: boolean;
  fundsLoading: boolean;
  snapshot: Snapshot | null;
  news: NewsFeed | null;
  portfolio: Holding[];
  funds: Record<string, FundQuote>;
  selectedSectors: string[];
  watchlist: string[];
  settings: AppSettings;
  lastError: string | null;
  hydrate: () => void;
  refreshSnapshot: () => Promise<void>;
  refreshNews: () => Promise<void>;
  refreshFunds: () => Promise<void>;
  addHolding: (h: Holding) => void;
  updateHolding: (code: string, patch: Partial<Holding>) => void;
  removeHolding: (code: string) => void;
  setSectors: (ids: string[]) => void;
  toggleWatch: (code: string) => void;
  setSettings: (s: Partial<AppSettings>) => void;
};

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  loading: false,
  newsLoading: false,
  fundsLoading: false,
  snapshot: null,
  news: null,
  portfolio: [],
  funds: {},
  selectedSectors: [],
  watchlist: [],
  settings: loadSettings(),
  lastError: null,

  hydrate: () => {
    if (get().ready) return;
    set({
      ready: true,
      snapshot: loadCachedSnapshot(),
      news: loadCachedNews(),
      funds: loadCachedFunds(),
      portfolio: loadPortfolio(),
      selectedSectors: loadSelectedSectors(),
      watchlist: loadWatchlist(),
      settings: loadSettings(),
    });
  },

  refreshSnapshot: async () => {
    if (get().loading) return;
    set({ loading: true, lastError: null });
    try {
      const snapshot = await getSnapshot();
      saveCachedSnapshot(snapshot);
      set({ snapshot, loading: false });
    } catch (e) {
      set({ loading: false, lastError: e instanceof Error ? e.message : "行情暂时不可用" });
    }
  },

  refreshNews: async () => {
    if (get().newsLoading) return;
    set({ newsLoading: true });
    try {
      const news = await getNews();
      saveCachedNews(news);
      set({ news, newsLoading: false });
    } catch {
      set({ newsLoading: false });
    }
  },

  refreshFunds: async () => {
    if (get().fundsLoading) return;
    const list = get().portfolio;
    if (!list.length) return;
    set({ fundsLoading: true });
    try {
      const codes = [...new Set(list.map((h) => h.code))];
      const entries = await Promise.allSettled(
        codes.map(async (code) => [code, await getFund({ data: { code } })] as const),
      );
      const funds = { ...get().funds };
      for (const result of entries) {
        if (result.status === "fulfilled") funds[result.value[0]] = result.value[1];
      }
      saveCachedFunds(funds);
      set({ funds });
    } finally {
      set({ fundsLoading: false });
    }
  },

  addHolding: (h) => {
    const list = get().portfolio.slice();
    const i = list.findIndex((x) => x.code === h.code);
    if (i >= 0) list[i] = { ...list[i], ...h };
    else list.push(h);
    savePortfolio(list);
    set({ portfolio: list });
    void get().refreshFunds();
  },

  updateHolding: (code, patch) => {
    const list = get().portfolio.map((x) => (x.code === code ? { ...x, ...patch } : x));
    savePortfolio(list);
    set({ portfolio: list });
  },

  removeHolding: (code) => {
    const list = get().portfolio.filter((x) => x.code !== code);
    savePortfolio(list);
    set({ portfolio: list });
  },

  setSectors: (ids) => {
    saveSelectedSectors(ids);
    set({ selectedSectors: ids });
  },

  toggleWatch: (code) => {
    const cur = get().watchlist;
    const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
    saveWatchlist(next);
    set({ watchlist: next });
  },

  setSettings: (s) => {
    const next = { ...get().settings, ...s };
    saveSettings(next);
    set({ settings: next });
  },
}));
