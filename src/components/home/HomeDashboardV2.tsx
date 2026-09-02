import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Plus, Sparkles, X } from "lucide-react";
import { FundSectorWatchV2 } from "@/components/fund-sector/FundSectorWatchV2";
import { TodayAssessment } from "@/components/home/TodayAssessment";
import { OperationAdvice } from "@/components/market/OperationAdvice";
import { Glass, Tone } from "@/components/ui/Glass";
import { useApp } from "@/lib/store";
import { calcHoldingReturn, calcPortfolioReturn } from "@/lib/calc/portfolio-returns";
import { calcPortfolioPeriodReturn } from "@/lib/calc/portfolio-periods";
import { fmtMoney, fmtPctShort } from "@/lib/format";

type PeriodTab = "today" | "week" | "month" | "quarter" | "since";
const SERVICES = [["/portfolio", "我的持仓", "💼"], ["/portfolio", "收益日历", "🗓️"], ["/portfolio", "止盈止损", "🎯"], ["/portfolio", "持仓分析", "🔎"], ["/band", "波段信号", "🌈"], ["/market", "行情中心", "📊"], ["/funds", "基金排行", "🏆"], ["/news", "市场资讯", "📰"], ["/ai", "AI证据链", "✨"], ["/settings", "设置", "⚙️"]] as const;

export function HomeDashboardV2() {
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  const snapshot = useApp((s) => s.snapshot);
  const news = useApp((s) => s.news);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [periodTab, setPeriodTab] = useState<PeriodTab>("today");
  const summary = portfolio.length ? calcPortfolioReturn(portfolio, funds) : null;
  const visible = expanded ? portfolio : portfolio.slice(0, 8);
  const periods = useMemo(() => ({
    week: calcPortfolioPeriodReturn("week", portfolio, funds),
    month: calcPortfolioPeriodReturn("month", portfolio, funds),
    quarter: calcPortfolioPeriodReturn("quarter", portfolio, funds),
  }), [funds, portfolio]);
  const selected = useMemo(() => {
    if (!summary) return { label: "今日收益", amount: null as number | null, pct: null as number | null };
    if (periodTab === "week") return { label: "一周收益", amount: periods.week.amount, pct: periods.week.pct };
    if (periodTab === "month") return { label: "一个月收益", amount: periods.month.amount, pct: periods.month.pct };
    if (periodTab === "quarter") return { label: "近三个月收益", amount: periods.quarter.amount, pct: periods.quarter.pct };
    if (periodTab === "since") return { label: "买入以来收益", amount: summary.pricedCount === summary.totalCount ? summary.holdingPnl : null, pct: summary.holdingPnlPct };
    return { label: "今日收益", amount: summary.todayPnl, pct: summary.todayPnlPct };
  }, [periodTab, periods, summary]);
  const validation = snapshot?.validation === "cross_checked" ? "双源核验" : snapshot?.validation === "cached_latest_trading_day" ? "最近交易日" : snapshot?.validation === "single_source" ? "单源可用" : "等待可靠行情";
  const latestNews = news?.items?.slice(0, 5) || [];
  const benchPct = snapshot?.indices?.[0]?.pct ?? null;

  return <div className="home-dashboard-v3 pb-4">
    <section className="home-income-card" aria-label="总收益">
      <Glass tight className="mt-0 rounded-[28px] bg-white/58 p-4 shadow-[0_18px_50px_rgba(38,78,112,.09),inset_0_1px_0_rgba(255,255,255,.96)] backdrop-blur-[28px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><div className="text-[11px] font-medium text-slate-500">持仓总收益</div><div className="mt-1 text-[30px] font-bold tracking-tight text-slate-950 tabular-nums">{summary?.holdingPnl == null ? "—" : fmtMoney(summary.holdingPnl)}</div><div className="mt-1 text-[10px] text-slate-400">当前全部持仓 · {portfolio.length ? `${portfolio.length}只基金` : "尚未建仓"}</div></div>
          <span className="shrink-0 rounded-full bg-white/72 px-2.5 py-1 text-[9px] font-semibold text-slate-500">{summary?.holdingPnlPct == null ? "—" : fmtPctShort(summary.holdingPnlPct)}</span>
        </div>
        <div className="home-period-switch mt-3 grid grid-cols-5 gap-1 rounded-2xl bg-white/48 p-0.5 ring-1 ring-white/75">{(["today", "week", "month", "quarter", "since"] as const).map((tab) => { const label = tab === "today" ? "今天" : tab === "week" ? "一周" : tab === "month" ? "一个月" : tab === "quarter" ? "近3月" : "买入以来"; return <button key={tab} type="button" onClick={() => setPeriodTab(tab)} className={`home-period-btn rounded-[14px] px-1.5 py-2 text-[11px] font-medium transition ${periodTab === tab ? "is-active bg-blue-500 text-white shadow-[0_4px_12px_rgba(59,130,246,.20)]" : "bg-white/66 text-muted"}`}>{label}</button>; })}</div>
        <div className="mt-2 rounded-[18px] bg-white/54 px-3 py-2.5 ring-1 ring-white/75"><div className="flex items-center justify-between gap-3"><div><div className="text-[9px] text-slate-400">{selected.label}</div><Tone v={selected.amount} className="mt-1 block text-[17px] font-bold tabular-nums">{selected.amount == null ? "—" : fmtMoney(selected.amount)}</Tone></div><Tone v={selected.pct} className="text-[11px] font-semibold tabular-nums">{selected.pct == null ? "—" : fmtPctShort(selected.pct)}</Tone></div></div>
        <div className="mt-2 grid grid-cols-2 gap-2"><Metric label="持仓市值" value={summary?.marketValue == null ? "—" : fmtMoney(summary.marketValue)} tone={summary?.marketValue ?? null} /><Metric label="持有收益率" value={summary?.holdingPnlPct == null ? "—" : fmtPctShort(summary.holdingPnlPct)} tone={summary?.holdingPnlPct ?? null} /></div>
        <div className="mt-3 flex items-center justify-between border-t border-white/75 pt-2.5 text-[9px] text-slate-400"><span>{snapshot?.marketDate || "等待行情日期"}</span><span>{validation}</span></div>
        {periodTab !== "since" && selected.amount == null ? <div className="mt-2 rounded-xl bg-amber-50/70 px-3 py-1.5 text-[9px] leading-relaxed text-slate-500">该周期需要全部持仓具备对应历史净值；数据不完整时不猜收益。</div> : null}
      </Glass>
    </section>

    <TodayAssessment />

    <section className="home-portfolio-section mt-3" aria-label="我的持仓"><div className="home-section-head mb-2 flex items-end justify-between"><div><div className="text-[16px] font-semibold tracking-tight text-slate-950">我的持仓</div><div className="text-[10px] text-slate-400">实时估值 · 持有收益 · 波段 / 趋势 / 做T</div></div><Link to="/portfolio" className="text-[10px] font-medium text-blue-600">全部 {portfolio.length || 0} 只</Link></div>{portfolio.length ? <Glass tight className="overflow-hidden p-0"><div className="divide-y divide-white/70">{visible.map((h) => { const f = funds[h.code]; const r = f ? calcHoldingReturn(h, f) : null; const liveLabel = r?.quoteMode === "live_estimate" ? `实时估值 ${r.price == null ? "—" : r.price.toFixed(4)}` : null; const referenceLabel = f?.nav == null ? "参考净值 —" : `参考净值 ${f.nav.toFixed(4)}`; return <Link key={h.code} to="/portfolio" className="home-fund-row flex min-h-[58px] items-center gap-2.5 px-3.5 py-2 active:bg-white/45"><span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/72 text-sm shadow-sm">📈</span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold text-slate-900">{f?.name || h.name}</span><span className="mt-0.5 block truncate text-[9px] text-slate-400">{h.code} · {liveLabel ? `${liveLabel} · ${referenceLabel}` : referenceLabel}</span></span><span className="shrink-0 text-right"><Tone v={r?.todayPnlPct ?? null} className="block text-[14px] font-bold tabular-nums">{r?.todayPnlPct == null ? "—" : fmtPctShort(r.todayPnlPct)}</Tone><Tone v={r?.holdingPnlPct ?? null} className="mt-0.5 block text-[9px] font-medium tabular-nums">持有 {r?.holdingPnlPct == null ? "—" : fmtPctShort(r.holdingPnlPct)}</Tone></span><ChevronRight className="size-3.5 shrink-0 text-slate-300" /></Link>; })}</div>{portfolio.length > 8 ? <button type="button" onClick={() => setExpanded((v) => !v)} className="home-expand-btn flex w-full items-center justify-center border-t border-white/70 py-2 text-[10px] font-medium text-slate-500">{expanded ? "收起" : `展开剩余 ${portfolio.length - 8} 只`}</button> : null}</Glass> : <Glass tight className="border-dashed text-center"><div className="py-3 text-[11px] text-slate-500">还没有持仓</div><Link to="/portfolio" className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[10px] text-white"><Plus className="size-3" />添加基金</Link></Glass>}</section>

    <section className="home-sector-section mt-3" aria-label="自选板块"><FundSectorWatchV2 /></section>
    <OperationAdvice sectors={snapshot?.sectors || []} benchPct={benchPct} />

    {latestNews.length ? <section className="home-news-section mb-3 overflow-hidden rounded-[24px] border border-white/75 bg-white/48 p-3 shadow-[0_14px_38px_rgba(38,78,112,.07)] backdrop-blur-[20px]" aria-label="最新资讯"><div className="mb-2 flex items-center justify-between"><div><div className="text-[16px] font-semibold tracking-tight text-fg">最新资讯</div><div className="text-[9px] text-muted">只显示最新 5 条</div></div><Link to="/news" className="text-[9px] text-blue-600">全部 →</Link></div><div className="space-y-1.5">{latestNews.map((item) => <a key={`${item.source}-${item.publishedAt}-${item.title}`} href={item.url || "#"} target="_blank" rel="noreferrer" className="block rounded-[14px] bg-white/58 px-2.5 py-2 active:bg-white/75"><div className="line-clamp-2 text-[10px] font-medium text-slate-800">{item.title}</div><div className="mt-1 text-[8px] text-slate-400">{item.source || "新闻"} · {item.publishedAt || "时间未知"}</div></a>)}</div></section> : null}

    <button type="button" onClick={() => setServicesOpen(true)} className="home-services-trigger mt-3 flex w-full items-center justify-between rounded-[21px] border border-white/75 bg-white/58 px-4 py-3 shadow-[0_10px_30px_rgba(38,78,112,.07)] backdrop-blur-[24px]" aria-label="打开全部服务"><span className="flex items-center gap-2.5"><span className="flex size-9 items-center justify-center rounded-full bg-white/80 shadow-sm"><Sparkles className="size-4 text-slate-700" /></span><span className="text-left"><span className="block text-[13px] font-semibold text-slate-900">全部服务</span><span className="block text-[9px] text-slate-400">低频功能集中收纳，不占首页空间</span></span></span><ChevronRight className="size-4 text-slate-400" /></button>
    {servicesOpen ? <div className="fixed inset-0 z-[7000] flex items-end bg-slate-950/20 backdrop-blur-[4px]" role="dialog" aria-modal="true" aria-label="全部服务" onClick={() => setServicesOpen(false)}><div className="w-full rounded-t-[30px] bg-white/82 px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 shadow-[0_-20px_70px_rgba(22,42,64,.20)] backdrop-blur-[32px]" onClick={(e) => e.stopPropagation()}><div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300/70" /><div className="flex items-center justify-between"><div><div className="text-[18px] font-semibold text-slate-950">全部服务</div><div className="text-[10px] text-slate-400">只收纳当前已经存在的功能</div></div><button type="button" onClick={() => setServicesOpen(false)} aria-label="关闭全部服务" className="flex size-9 items-center justify-center rounded-full bg-white/72"><X className="size-4" /></button></div><div className="mt-4 grid grid-cols-3 gap-2.5">{SERVICES.map(([to, title, icon]) => <Link key={`${to}-${title}`} to={to} onClick={() => setServicesOpen(false)} className="rounded-[18px] bg-white/62 px-2 py-3 text-center ring-1 ring-white/80 active:scale-[0.98]"><span className="mx-auto flex size-10 items-center justify-center rounded-[14px] bg-white/78 text-lg shadow-sm">{icon}</span><span className="mt-1.5 block truncate text-[10px] font-semibold text-slate-800">{title}</span></Link>)}</div></div></div> : null}
  </div>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone: number | null }) {
  return <div className="rounded-[18px] bg-white/54 px-3 py-2.5 ring-1 ring-white/75"><div className="text-[9px] text-slate-400">{label}</div><Tone v={tone} className="mt-1 block text-[16px] font-bold tabular-nums">{value}</Tone></div>;
}
