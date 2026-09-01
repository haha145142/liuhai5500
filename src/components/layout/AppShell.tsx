import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouterState, Link } from "@tanstack/react-router";
import { BarChart3, Menu, RefreshCw, UserRound, WalletCards, Star } from "lucide-react";
import { useApp } from "@/lib/store";
import { clockStr } from "@/lib/format";
import { sessionLabel } from "@/lib/market-hours";
import { tradingDateLabel } from "@/lib/data/trading-day";
import { cn } from "@/lib/cn";
import { SideDrawer } from "./SideDrawer";

const NEWS_REFRESH_MS = 3 * 60_000;
const BOOT_DELAY_MS = 80;
const NEWS_BOOT_DELAY_MS = 450;
const RESUME_DEBOUNCE_MS = 2_000;
const NAV = [
  { to: "/" as const, label: "自选", icon: Star },
  { to: "/market" as const, label: "行情", icon: BarChart3 },
  { to: "/portfolio" as const, label: "交易", icon: WalletCards },
  { to: "/settings" as const, label: "我的", icon: UserRound },
];

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
  const lastResumeAtRef = useRef(0);
  const wantsNews = pathname === "/" || pathname.startsWith("/news");
  const refreshCore = useCallback(() => { if (document.hidden) return; void refreshSnapshot(); void refreshFunds(); }, [refreshSnapshot, refreshFunds]);
  const refreshAllVisible = useCallback(() => { if (document.hidden) return; const now = Date.now(); if (now-lastResumeAtRef.current<RESUME_DEBOUNCE_MS) return; lastResumeAtRef.current=now; refreshCore(); if (wantsNews) void refreshNews(); }, [refreshCore, refreshNews, wantsNews]);
  useEffect(() => { hydrate(); const a=window.setTimeout(refreshCore,BOOT_DELAY_MS); const b=wantsNews?window.setTimeout(()=>void refreshNews(),NEWS_BOOT_DELAY_MS):undefined; return()=>{window.clearTimeout(a); if(b!==undefined)window.clearTimeout(b)}; }, [hydrate,refreshCore,refreshNews,wantsNews]);
  useEffect(() => { const id=window.setInterval(refreshCore,Math.max(30_000,settings.autoRefreshMs)); return()=>window.clearInterval(id); }, [refreshCore,settings.autoRefreshMs]);
  useEffect(() => { if(!wantsNews)return; const id=window.setInterval(()=>{if(!document.hidden)void refreshNews()},Math.max(60_000,settings.newsRefreshMs||NEWS_REFRESH_MS)); return()=>window.clearInterval(id); }, [wantsNews,refreshNews,settings.newsRefreshMs]);
  useEffect(() => { const onVisibilityChange=()=>{if(!document.hidden)refreshAllVisible()}; const onOnline=()=>refreshAllVisible(); document.addEventListener("visibilitychange",onVisibilityChange); window.addEventListener("online",onOnline); return()=>{document.removeEventListener("visibilitychange",onVisibilityChange); window.removeEventListener("online",onOnline)}; }, [refreshAllVisible]);
  useEffect(() => { setDrawerOpen(false); }, [pathname]);
  const onRefresh=()=>{refreshCore();if(wantsNews)void refreshNews()};
  const failedSources=snapshot?.sources.filter((s)=>s.status==="err").map((s)=>s.name)||[];
  const validationLabel=snapshot?.validation==="cross_checked"?"双源核验":snapshot?.validation==="cached_latest_trading_day"?"最近交易日缓存":snapshot?.validation==="single_source"?"单源可用":"数据状态待确认";
  const statusText=snapshot?`${snapshot.marketDate||tradingDateLabel()} · ${validationLabel}${failedSources.length?` · ${failedSources.join("、")}暂不可用`:""} · 更新 ${clockStr(new Date(snapshot.fetchedAt))}`:lastError?"行情暂时不可用 · 已保留本地数据":"后台连接行情…";
  const header=<header className="app-header"><div className="app-header-card !min-h-[78px] !rounded-[24px] !px-3.5 !py-3"><button type="button" onClick={()=>setDrawerOpen(true)} aria-label="打开侧边菜单" className="relative z-10 mr-2 flex !size-10 shrink-0 items-center justify-center rounded-2xl border border-white/75 bg-white/58 text-slate-700 shadow-[0_7px_22px_rgba(70,95,120,.10)] backdrop-blur-xl active:scale-95"><Menu className="size-5" strokeWidth={2}/></button><div className="min-w-0 flex-1"><h1 className="app-header-title !text-[20px]">Fund AI Pro</h1><p className="app-header-meta !mt-0.5 !text-[10px] !leading-[1.3]">{sessionLabel()} · {statusText}</p></div><button type="button" onClick={onRefresh} aria-label="刷新" className="app-refresh-button !size-10 !w-10 !h-10 !m-0 !ml-2 !rounded-full"><RefreshCw className={cn("size-4",loading&&"animate-spin")}/></button></div></header>;
  const bottomNav=<nav aria-label="底部导航" className="fixed inset-x-0 bottom-0 z-[5000] px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-1"><div className="mx-auto grid max-w-[520px] grid-cols-4 rounded-[24px] border border-white/80 bg-white/62 p-1.5 shadow-[0_12px_38px_rgba(38,78,112,.16),inset_0_1px_0_rgba(255,255,255,.98)] backdrop-blur-[30px] saturate-150">{NAV.map((item)=>{const Icon=item.icon;const active=item.to==="/"?pathname==="/":pathname.startsWith(item.to);return <Link key={item.to} to={item.to} aria-current={active?"page":undefined} className={cn("relative flex min-h-12 items-center justify-center gap-1 rounded-[18px] px-2 text-[10px] font-medium transition active:scale-95",active?"bg-[linear-gradient(135deg,rgba(110,190,255,.92),rgba(173,126,255,.90),rgba(255,150,190,.86))] text-white shadow-[0_6px_20px_rgba(112,126,220,.22)]":"text-slate-500")}>{Icon&&<Icon className="size-[17px]"/>}<span>{item.label}</span>{active?<span className="absolute inset-x-4 bottom-1 h-0.5 rounded-full bg-white/75"/>:null}</Link>})}</div></nav>;
  return <div className="app-shell pb-[88px]" data-app-shell="v5">{pathname==="/"?<section className="home-panel">{header}<main className="app-main home-main">{children}</main></section>:<><>{header}</><main className="app-main">{children}</main></>}<SideDrawer open={drawerOpen} onClose={()=>setDrawerOpen(false)}/>{bottomNav}</div>;
}
