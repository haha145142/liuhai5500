import { useEffect, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { TabBar } from "./TabBar";
import "./BottomNavFix.css";
import { useApp } from "@/lib/store";
import { clockStr } from "@/lib/format";
import { isTradeTime, isWeekend, sessionLabel } from "@/lib/market-hours";
import { tradingDateLabel } from "@/lib/data/trading-day";
import { cn } from "@/lib/cn";

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
      if (isTradeTime()) void refreshFunds();
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

  const onRefresh = () => {
    void refreshSnapshot();
    if (isTradeTime()) void refreshFunds();
    if (pathname.startsWith("/news") || pathname === "/") void refreshNews();
  };

  const failedSources = snapshot?.sources.filter((s) => s.status === "err").map((s) => s.name) || [];
  const statusText = snapshot
    ? isWeekend()
      ? `周末休市 · 最近交易日 ${tradingDateLabel()} · ${failedSources.length ? `${failedSources.join("、")}暂不可用 · ` : ""}更新 ${clockStr(new Date(snapshot.fetchedAt))}`
      : `${failedSources.length ? `${failedSources.join("、")}暂不可用 · ` : ""}更新 ${clockStr(new Date(snapshot.fetchedAt))}`
    : lastError
      ? "行情暂时不可用 · 已保留本地数据"
      : "正在后台接入行情 · 界面不阻塞";

  const header = (
    <header className="app-header">
      <div className="app-header-card">
        <div>
          <h1 className="app-header-title">Fund AI Pro</h1>
          <p className="app-header-meta">
            {sessionLabel()} · {statusText}
          </p>
        </div>
        <button type="button" onClick={onRefresh} aria-label="刷新" className="app-refresh-button">
          <RefreshCw className={cn("size-7", loading && "animate-spin")} />
        </button>
      </div>
    </header>
  );

  return (
    <div className="app-shell">
      {pathname === "/" ? (
        <section className="home-panel">
          {header}
          <main className="app-main home-main">{children}</main>
        </section>
      ) : (
        <>
          {header}
          <main className="app-main">{children}</main>
        </>
      )}
      <TabBar />
    </div>
  );
}
