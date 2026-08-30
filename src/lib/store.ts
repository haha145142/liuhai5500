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
import { crossCheckIndices } from "./data/cross-check";
import { isWeekend } from "./market-hours";
import { tradingDateLabel } from "./data/trading-day";

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
    const cachedSnapshot = loadCachedSnapshot();
    set({
      ready: true,
      snapshot: cachedSnapshot,
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

    // Weekend policy: freeze market data at the latest locally validated trading-day snapshot.
    if (isWeekend()) {
      const cached = get().snapshot || loadCachedSnapshot();
      if (cached) {
        set({
          snapshot: {
            ...cached,
            marketDate: cached.marketDate || tradingDateLabel(),
            validation: "cached_latest_trading_day",
          },
          loading: false,
          lastError: null,
        });
        return;
      }
    }

    set({ loading: true, lastError: null });
    try {
      const snapshot = await getSnapshot();
      const checked = await crossCheckIndices({ data: { indices: snapshot.indices } });
      const previous = get().snapshot;
      const hasInvalidated = checked.validated.some((x) => x.pct == null && x.price == null) &&
        snapshot.indices.some((x) => x.pct != null || x.price != null);

      // A materially divergent new quote is not trusted. Preserve the last good quote
      // for that item rather than surfacing an unexplained number or clearing the screen.
      const indices = checked.validated.map((x) => {
        if (x.pct != null || x.price != null) return x;
        return previous?.indices.find((p) => p.code === x.code) || x;
      });

      const normalized: Snapshot = {
        ...snapshot,
        indices,
        marketDate: snapshot.marketDate || (isWeekend() ? tradingDateLabel() : null),
        validation: checked.checked && !hasInvalidated ? "cross_checked" : "single_source",
        sources: checked.checked
          ? snapshot.sources.map((s) => s.name === "指数" ? { ...s, note: `${s.note} · ${checked.note}` } : s)
          : [...snapshot.sources, { name: "交叉验证", status: "warn", note: checked.note }],
      };

      saveCachedSnapshot(normalized);
      set({ snapshot: normalized, loading: false });
    } catch (e) {
      const cached = get().snapshot || loadCachedSnapshot();
      if (cached) {
        set({
          snapshot: {
            ...cached,
            validation: "cached_latest_trading_day",
            marketDate: cached.marketDate || tradingDateLabel(),
          },
          loading: false,
          lastError: "实时数据源暂不可用 · 已保留最近交易日数据",
        });
      } else {
        set({ loading: false, lastError: e instanceof Error ? e.message : "行情暂时不可用" });
      }
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
      const cached = loadCachedNews();
      set({ news: get().news || cached, newsLoading: false });
    }
  },

  refreshFunds: async () => {
    if (get().fundsLoading) return;
    const list = get().portfolio;
    if (!list.length) return;
    if (isWeekend()) {
      const cached = get().funds;
      if (Object.keys(cached).length) return;
    }

    set({ fundsLoading: true });
    try {
      const codes = [...new Set(list.map((h) => h.code))];
      const entries = await Promise.allSettled(
        codes.map(async (code) => [code, await getFund({ data: { code } })] as const),
      );
      const funds = { ...get().funds };
      for (const result of entries) {
        if (result.status === "fulfilled") {
          const quote = result.value[1];
          const hasUsableValue = quote.nav != null || quote.estimate != null || quote.history.length > 0;
          if (hasUsableValue) funds[result.value[0]] = quote;
        }
      }
      if (Object.keys(funds).length) saveCachedFunds(funds);
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
