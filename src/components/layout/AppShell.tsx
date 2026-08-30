import { useEffect, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { TabBar } from "./TabBar";
import "./BottomNavFix.css";
import { useApp } from "@/lib/store";
import { clockStr } from "@/lib/format";
import { isTradeTime, sessionLabel } from "@/lib/market-hours";
import { cn } from "@/lib/cn";

const NEWS_REFRESH_MS = 60_000;

export function AppShell({ children }: { children: ReactNode }) {
  const hydrate = useApp((s) => s.hydrate);
  const refreshSnapshot = useApp((s) => s.refreshSnapshot);
  const refreshNews = useApp((s) => s.refreshNews);
  const refreshFunds = useApp((s) => s.refreshFunds);
  const loading = useApp((s) => s.loading);
  const snapshot = useApp((s) => s.snapshot);
  const settings = useApp((s) => s.settings);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    hydrate();
    void refreshSnapshot();
    void refreshNews();
    void refreshFunds();
  }, [hydrate, refreshSnapshot, refreshNews, refreshFunds]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void refreshSnapshot();
      void refreshFunds();
    }, settings.autoRefreshMs);
    return () => window.clearInterval(id);
  }, [refreshSnapshot, refreshFunds, settings.autoRefreshMs]);

  useEffect(() => {
    if (pathname !== "/" && !pathname.startsWith("/news")) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void refreshNews();
    }, NEWS_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [pathname, refreshNews]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      if (isTradeTime()) void refreshFunds();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [refreshFunds]);

  const onRefresh = () => {
    void refreshSnapshot();
    void refreshFunds();
    if (pathname.startsWith("/news") || pathname === "/") void refreshNews();
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-card">
          <div>
            <h1 className="app-header-title">Fund AI Pro</h1>
            <p className="app-header-meta">
              {sessionLabel()}
              {snapshot ? ` · 数据截至 ${clockStr(new Date(snapshot.fetchedAt))}` : " · 正在接入行情"}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="刷新"
            className="app-refresh-button"
          >
            <RefreshCw className={cn("size-7", loading && "animate-spin")} />
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
      <TabBar />
    </div>
  );
}
