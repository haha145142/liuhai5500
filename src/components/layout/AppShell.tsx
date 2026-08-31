import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Menu, RefreshCw } from "lucide-react";
import { useApp } from "@/lib/store";
import { clockStr } from "@/lib/format";
import { sessionLabel } from "@/lib/market-hours";
import { tradingDateLabel } from "@/lib/data/trading-day";
import { cn } from "@/lib/cn";
import { QuickAddFund } from "@/components/portfolio/QuickAddFund";
import { SideDrawer } from "./SideDrawer";

const NEWS_REFRESH_MS = 3 * 60_000;
const BOOT_DELAY_MS = 80;

export function AppShell({ children }: { children: ReactNode }) {
  const hydrate = useApp((s) => s.hydrate);
  const refreshSnapshot = useApp((s) => s.refreshSnapshot);
  const refreshNews = useApp((s) => s.refreshNews);
  const refreshFunds = useApp((s) => s.refreshFunds);
  const loading = useApp((s) => s.loading);
  const snapshot = useApp((s) => s.snapshot);
  const settings = useApp((s) => s.settings);
  const lastError = useApp((s) => s.lastError);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    hydrate();
    const id = window.setTimeout(() => {
      void refreshSnapshot();
      void refreshNews();
      void refreshFunds();
    }, BOOT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [hydrate, refreshSnapshot, refreshNews, refreshFunds]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void refreshSnapshot();
      // The store decides whether this is a live-refresh, lunch freeze,
      // post-close official-NAV poll, or latest-trading-day fallback.
      void refreshFunds();
    }, Math.max(30_000, settings.autoRefreshMs));
    return () => window.clearInterval(id);
  }, [refreshSnapshot, refreshFunds, settings.autoRefreshMs]);

  useEffect(() => {
    if (pathname !== "/" && !pathname.startsWith("/news")) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void refreshNews();
    }, Math.max(60_000, settings.newsRefreshMs || NEWS_REFRESH_MS));
    return () => window.clearInterval(id);
  }, [pathname, refreshNews, settings.newsRefreshMs]);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const onRefresh = () => {
    void refreshSnapshot();
    void refreshFunds();
    if (pathname.startsWith("/news") || pathname === "/") void refreshNews();
  };
  const failedSources = snapshot?.sources.filter((s) => s.status === "err").map((s) => s.name) || [];
  const validationLabel = snapshot?.validation === "cross_checked" ? "双源核验" : snapshot?.validation === "cached_latest_trading_day" ? "最近交易日缓存" : snapshot?.validation === "single_source" ? "单源可用" : "数据状态待确认";
  const statusText = snapshot
    ? `${snapshot.marketDate || tradingDateLabel()} · ${validationLabel}${failedSources.length ? ` · ${failedSources.join("、")}暂不可用` : ""} · 更新 ${clockStr(new Date(snapshot.fetchedAt))}`
    : lastError ? "行情暂时不可用 · 已保留本地数据" : "后台连接行情…";

  const header = <header className="app-header"><div className="app-header-card !min-h-[88px] !rounded-[26px] !px-3.5 !py-3.5"><button type="button" onClick={() => setDrawerOpen(true)} aria-label="打开侧边菜单" className="relative z-10 mr-2 flex !size-11 shrink-0 items-center justify-center rounded-2xl border border-white/75 bg-white/58 text-slate-700 shadow-[0_7px_22px_rgba(70,95,120,.10)] backdrop-blur-xl transition active:scale-95"><Menu className="size-5" strokeWidth={2} /></button><div className="min-w-0 flex-1"><h1 className="app-header-title !text-[22px]">Fund AI Pro</h1><p className="app-header-meta !mt-1 !text-[11px] !leading-[1.3]">{sessionLabel()} · {statusText}</p></div><button type="button" onClick={onRefresh} aria-label="刷新" className="app-refresh-button !size-11 !w-11 !h-11 !m-0 !ml-2 !rounded-full"><RefreshCw className={cn("size-4", loading && "animate-spin")} /></button></div></header>;
  const mainContent = pathname === "/portfolio" ? <><QuickAddFund />{children}</> : children;
  return <div className="app-shell" data-app-shell="v4">{pathname === "/" ? <section className="home-panel">{header}<main className="app-main home-main">{mainContent}</main></section> : <><>{header}</><main className="app-main">{mainContent}</main></>}<SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} /></div>;
}
