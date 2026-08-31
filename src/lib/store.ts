import { create } from "zustand";
import type { FundQuote, Holding, NewsFeed, Snapshot } from "./types";
import { loadPortfolio, loadSelectedSectors, loadSettings, loadWatchlist, loadCachedSnapshot, loadCachedNews, loadCachedFunds, saveCachedSnapshot, saveCachedNews, saveCachedFunds, savePortfolio, saveSelectedSectors, saveSettings, saveWatchlist, type AppSettings } from "./storage";
import { getFund, getNews, getSnapshot } from "./data/server";
import { crossCheckIndices } from "./data/cross-check";
import { validateFundQuote } from "./data/validation";
import { getLatestTradingMarketData } from "./data/market-fallback";
import { getMarketPhase } from "./market-hours";
import { tradingDateLabel } from "./data/trading-day";
import { cnTime } from "./format";

let lastFundRoutineKey = "";
let lastPostCloseFundAttemptAt = 0;
let lastWeekendSnapshotKey = "";

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

function chinaTodayLabel(date = new Date()) {
  const t = cnTime(date);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

function withLatestOfficialMode(quote: FundQuote, expectedDate: string): FundQuote {
  const isOfficialLatest = quote.nav != null && quote.navDate === expectedDate && quote.officialNavPublished === true;
  return {
    ...quote,
    estimate: null,
    estimatePct: null,
    estimateTime: null,
    valuationStatus: isOfficialLatest ? "official_nav" : "stale",
    estimateConfidence: isOfficialLatest ? "high" : "low",
  };
}

function usableIndices(indices: Snapshot["indices"]) {
  return indices.filter((x) => x.pct != null || x.price != null).length;
}
function usableSectors(sectors: Snapshot["sectors"]) {
  return sectors.filter((x) => x.change != null).length;
}
function usableGlobal(global: Snapshot["global"]) {
  return global.filter((x) => x.pct != null || x.price != null).length;
}

function mergeSnapshot(previous: Snapshot | null, incoming: Snapshot): Snapshot {
  if (!previous) return incoming;
  const byCode = new Map(previous.indices.map((x) => [x.code, x]));
  const indices = incoming.indices.map((x) => {
    const old = byCode.get(x.code);
    if (!old) return x;
    return { ...old, ...x, price: x.price ?? old.price, pct: x.pct ?? old.pct, change: x.change ?? old.change };
  });
  const bySector = new Map(previous.sectors.map((x) => [x.id, x]));
  const sectors = incoming.sectors.map((x) => {
    const old = bySector.get(x.id);
    if (!old) return x;
    return {
      ...old, ...x,
      change: x.change ?? old.change,
      flow: x.flow ?? old.flow,
      super: x.super ?? old.super,
      large: x.large ?? old.large,
      mid: x.mid ?? old.mid,
      small: x.small ?? old.small,
      turnover: x.turnover ?? old.turnover,
      available: x.change != null ? true : old.available,
      validation: x.validation && x.validation !== "unavailable" ? x.validation : old.validation,
    };
  });
  const byBoard = new Map(previous.boards.map((x) => [x.code, x]));
  const boards = incoming.boards.length ? incoming.boards.map((x) => {
    const old = byBoard.get(x.code);
    return old ? { ...old, ...x, change: x.change ?? old.change, flow: x.flow ?? old.flow } : x;
  }) : previous.boards;
  const flow = incoming.flow || previous.flow || null;
  const globalByName = new Map(previous.global.map((x) => [x.name, x]));
  const global = incoming.global.map((x) => {
    const old = globalByName.get(x.name);
    return old ? { ...old, ...x, price: x.price ?? old.price, pct: x.pct ?? old.pct } : x;
  });
  const sources = incoming.sources.length ? incoming.sources : previous.sources;
  return { ...incoming, indices, sectors, boards, flow, global, sources };
}

export const useApp = create<AppState>((set, get) => ({
  ready: false, loading: false, newsLoading: false, fundsLoading: false,
  snapshot: null, news: null, portfolio: [], funds: {}, selectedSectors: [], watchlist: [],
  settings: loadSettings(), lastError: null,
  hydrate: () => {
    if (get().ready) return;
    set({ ready: true, snapshot: loadCachedSnapshot(), news: loadCachedNews(), funds: loadCachedFunds(), portfolio: loadPortfolio(), selectedSectors: loadSelectedSectors(), watchlist: loadWatchlist(), settings: loadSettings() });
  },
  refreshSnapshot: async () => {
    if (get().loading) return;
    const phase = getMarketPhase();
    const cached = get().snapshot || loadCachedSnapshot();
    if (phase === "lunch") {
      const today = chinaTodayLabel();
      if (cached?.marketDate === today) { set({ snapshot: cached, loading: false, lastError: null }); return; }
    }
    if (phase === "preopen" || phase === "weekend") {
      const latest = tradingDateLabel();
      const cacheKey = `${phase}:${latest}`;
      if (cached?.marketDate === latest && usableIndices(cached.indices) > 0 && usableSectors(cached.sectors) > 0) { set({ snapshot: { ...cached, validation: "cached_latest_trading_day" as const }, loading: false, lastError: null }); return; }
      if (phase === "weekend" && lastWeekendSnapshotKey === cacheKey) { if (cached) set({ snapshot: { ...cached, validation: "cached_latest_trading_day" as const }, loading: false, lastError: null }); return; }
      set({ loading: true, lastError: null });
      try {
        const [fallback, recent] = await Promise.allSettled([getLatestTradingMarketData(), getSnapshot()]);
        const fallbackData = fallback.status === "fulfilled" ? fallback.value : null;
        const recentSnapshot = recent.status === "fulfilled" ? recent.value : null;
        const base = cached || { indices: [], sectors: [], boards: [], flow: null, global: [], sources: [], fetchedAt: Date.now() };
        const historical: Snapshot = { ...base, indices: fallbackData?.indices?.length ? fallbackData.indices : base.indices, sectors: fallbackData?.sectors?.length ? fallbackData.sectors : base.sectors, marketDate: fallbackData?.marketDate || latest, validation: "cached_latest_trading_day", fetchedAt: Date.now(), sources: [...base.sources.filter((s) => s.name !== "最近交易日历史行情"), { name: "最近交易日历史行情", status: fallbackData?.marketDate ? "ok" : "warn", note: fallbackData?.note || "最近交易日历史行情暂不可用" }] };
        const canMergeRecent = !!recentSnapshot && recentSnapshot.marketDate === latest;
        const merged = mergeSnapshot(historical, canMergeRecent ? { ...recentSnapshot!, marketDate: latest, validation: "cached_latest_trading_day" as const } : historical);
        const snapshot: Snapshot = { ...merged, marketDate: latest, validation: "cached_latest_trading_day", fetchedAt: Date.now() };
        const hasUsableData = usableIndices(snapshot.indices) > 0 || usableSectors(snapshot.sectors) > 0 || !!snapshot.flow || usableGlobal(snapshot.global) > 0;
        if (hasUsableData) saveCachedSnapshot(snapshot);
        set({ snapshot, loading: false, lastError: null });
        if (hasUsableData) lastWeekendSnapshotKey = cacheKey;
      } catch {
        if (cached) set({ snapshot: { ...cached, validation: "cached_latest_trading_day" as const, marketDate: cached.marketDate || latest }, loading: false, lastError: "最近交易日历史源暂不可用 · 已保留本地数据" });
        else set({ loading: false, lastError: "暂无最近交易日行情数据" });
      }
      return;
    }
    set({ loading: true, lastError: null });
    try {
      const snapshot = await getSnapshot();
      const checked = await crossCheckIndices({ data: { indices: snapshot.indices } });
      const previous = get().snapshot || loadCachedSnapshot();
      const indices = checked.validated.map((x) => x.pct != null || x.price != null ? x : previous?.indices.find((p) => p.code === x.code) || x);
      const phaseAfterFetch = getMarketPhase();
      const shouldKeepPrevious = phaseAfterFetch === "lunch" && previous?.marketDate === chinaTodayLabel();
      const normalized: Snapshot = { ...snapshot, indices, marketDate: snapshot.marketDate || previous?.marketDate || null, validation: checked.checked ? "cross_checked" : snapshot.validation || previous?.validation || "single_source", sources: checked.checked ? snapshot.sources.map((s) => s.name === "指数" ? { ...s, note: `${s.note} · ${checked.note}` } : s) : [...snapshot.sources, { name: "交叉验证", status: "warn", note: checked.note }] };
      const finalSnapshot = shouldKeepPrevious ? previous! : mergeSnapshot(previous, normalized);
      const hasUsableMarket = usableIndices(finalSnapshot.indices) > 0 || usableSectors(finalSnapshot.sectors) > 0 || !!finalSnapshot.flow || usableGlobal(finalSnapshot.global) > 0;
      if (hasUsableMarket) saveCachedSnapshot(finalSnapshot);
      set({ snapshot: hasUsableMarket ? finalSnapshot : previous || loadCachedSnapshot(), loading: false });
    } catch (e) {
      const fallback = get().snapshot || loadCachedSnapshot();
      if (fallback) set({ snapshot: { ...fallback, validation: phase === "postclose" ? fallback.validation : "cached_latest_trading_day", marketDate: fallback.marketDate || tradingDateLabel() }, loading: false, lastError: "实时数据源暂不可用 · 已保留最近可靠数据" });
      else set({ loading: false, lastError: e instanceof Error ? e.message : "行情暂时不可用" });
    }
  },
  refreshNews: async () => {
    if (get().newsLoading) return;
    set({ newsLoading: true });
    try {
      const news = await getNews();
      const hasUsableNews = news.items.length > 0 || news.sentiment.length > 0;
      if (hasUsableNews) { saveCachedNews(news); set({ news, newsLoading: false }); } else { const cached = get().news || loadCachedNews(); set({ news: cached, newsLoading: false }); }
    } catch { const cached = loadCachedNews(); set({ news: get().news || cached, newsLoading: false }); }
  },
  refreshFunds: async () => {
    if (get().fundsLoading) return;
    const list = get().portfolio;
    if (!list.length) return;
    const phase = getMarketPhase();
    if (phase === "lunch") return;
    const currentFunds = get().funds;
    const codes = [...new Set(list.map((h) => h.code))];
    const referenceDate = phase === "weekend" || phase === "preopen" ? tradingDateLabel() : chinaTodayLabel();
    if (phase === "weekend" || phase === "preopen") {
      const routineKey = `${phase}:${referenceDate}:${codes.join(",")}`;
      if (lastFundRoutineKey === routineKey) return;
    }
    if (phase === "postclose") {
      const allOfficial = codes.every((code) => { const q = currentFunds[code]; return q?.nav != null && q.navDate === referenceDate && q.officialNavPublished === true; });
      if (allOfficial) return;
      if (Date.now() - lastPostCloseFundAttemptAt < 180_000) return;
      lastPostCloseFundAttemptAt = Date.now();
    }
    set({ fundsLoading: true });
    try {
      const entries = await Promise.allSettled(codes.map(async (code) => {
        const raw = await getFund({ data: { code } });
        try { const validated = await validateFundQuote({ data: { quote: raw } }); const quote = (phase === "weekend" || phase === "preopen") ? withLatestOfficialMode(validated.quote, referenceDate) : validated.quote; return [code, quote] as const; }
        catch { const quote = (phase === "weekend" || phase === "preopen") ? withLatestOfficialMode(raw, referenceDate) : raw; return [code, quote] as const; }
      }));
      const funds = { ...get().funds };
      let updatedCount = 0;
      for (const result of entries) { if (result.status !== "fulfilled") continue; const [code, quote] = result.value; const hasUsableValue = quote.nav != null || quote.estimate != null || quote.history.length > 0; if (hasUsableValue) { funds[code] = quote; updatedCount += 1; } }
      if (updatedCount > 0) saveCachedFunds(funds);
      set({ funds });
      if ((phase === "weekend" || phase === "preopen") && updatedCount > 0) lastFundRoutineKey = `${phase}:${referenceDate}:${codes.join(",")}`;
    } finally { set({ fundsLoading: false }); }
  },
  addHolding: (h) => { const list = get().portfolio.slice(); const i = list.findIndex((x) => x.code === h.code); if (i >= 0) list[i] = { ...list[i], ...h }; else list.push(h); savePortfolio(list); set({ portfolio: list }); void get().refreshFunds(); },
  updateHolding: (code, patch) => { const list = get().portfolio.map((x) => (x.code === code ? { ...x, ...patch } : x)); savePortfolio(list); set({ portfolio: list }); },
  removeHolding: (code) => { const list = get().portfolio.filter((x) => x.code !== code); savePortfolio(list); set({ portfolio: list }); },
  setSectors: (ids) => { saveSelectedSectors(ids); set({ selectedSectors: ids }); },
  toggleWatch: (code) => { const cur = get().watchlist; const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur.filter((c) => c !== code), code]; saveWatchlist(next); set({ watchlist: next }); },
  setSettings: (s) => { const next = { ...get().settings, ...s }; saveSettings(next); set({ settings: next }); },
}));
