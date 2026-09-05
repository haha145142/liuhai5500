import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import { FundCard } from "@/components/portfolio/FundCard";
import { PortfolioInsight } from "@/components/portfolio/PortfolioInsight";
import { DeepFundIntelligence } from "@/components/portfolio/DeepFundIntelligence";
import { QuickAddFund } from "@/components/portfolio/QuickAddFund";
import { SmartAlerts } from "@/components/settings/SmartAlerts";
import { EmptyNote, Glass, Tone } from "@/components/ui/Glass";
import { matchFundSector } from "@/lib/data/sectors";
import { fmtMoney, fmtPctShort } from "@/lib/format";
import { useApp } from "@/lib/store";
import { calcPortfolioPeriodReturn } from "@/lib/calc/portfolio-periods";
import { calcPortfolioReturn, calcHoldingReturn } from "@/lib/calc/portfolio-returns";

export const Route = createFileRoute("/portfolio")({ component: PortfolioPage });
type SummaryTab = "today" | "week" | "month" | "quarter" | "since";
function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function monthCells(cursor: Date) { const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const start = new Date(first); start.setDate(1 - first.getDay()); return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; }); }
type CalendarPnl = Map<string, { pnl: number; found: boolean }>;

function PortfolioPage() {
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  const snapshot = useApp((s) => s.snapshot);
  const updateHolding = useApp((s) => s.updateHolding);
  const removeHolding = useApp((s) => s.removeHolding);
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [summaryTab, setSummaryTab] = useState<SummaryTab>("today");
  const [bulkExpanded, setBulkExpanded] = useState<boolean | null>(null);
  const bench = snapshot?.indices.find((x) => x.code === "000300")?.pct ?? null;
  const summary = useMemo(() => calcPortfolioReturn(portfolio, funds), [funds, portfolio]);
  const fullyPriced = summary.pricedCount === summary.totalCount;
  const week = useMemo(() => calcPortfolioPeriodReturn("week", portfolio, funds), [funds, portfolio]);
  const month = useMemo(() => calcPortfolioPeriodReturn("month", portfolio, funds), [funds, portfolio]);
  const quarter = useMemo(() => calcPortfolioPeriodReturn("quarter", portfolio, funds), [funds, portfolio]);
  const holdingReturns = useMemo(() => new Map(portfolio.map((h) => [h.code, calcHoldingReturn(h, funds[h.code])])), [funds, portfolio]);
  const pricedToday = portfolio
    .map((h) => holdingReturns.get(h.code))
    .filter((r): r is NonNullable<typeof r> => r?.todayPnlPct != null);
  const downCount = pricedToday.filter((r) => (r.todayPnlPct ?? 0) < 0).length;
  const upCount = pricedToday.filter((r) => (r.todayPnlPct ?? 0) > 0).length;
  const flatCount = pricedToday.filter((r) => (r.todayPnlPct ?? 0) === 0).length;
  const selectedSummary = useMemo(() => {
    if (summaryTab === "week") return { label: "一周收益", amount: week.amount, pct: week.pct };
    if (summaryTab === "month") return { label: "一个月收益", amount: month.amount, pct: month.pct };
    if (summaryTab === "quarter") return { label: "近3个月收益", amount: quarter.amount, pct: quarter.pct };
    if (summaryTab === "since") return { label: fullyPriced ? "买入以来收益" : "买入以来收益（已计价部分）", amount: summary.holdingPnl, pct: summary.pricedHoldingPnlPct };
    return { label: summary.todayPnl == null ? "今日收益（已计价部分）" : "今日收益", amount: summary.todayPnl, pct: summary.todayPnlPct };
  }, [fullyPriced, month, quarter, summary, summaryTab, week]);
  const calendar = useMemo(() => { const cells = monthCells(calendarCursor); const activeMonth = monthKey(calendarCursor); return cells.map((date) => ({ date, key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`, inMonth: monthKey(date) === activeMonth })); }, [calendarCursor]);
  const calendarPnl = useMemo<CalendarPnl>(() => {
    const result: CalendarPnl = new Map();
    for (const h of portfolio) {
      const points = funds[h.code]?.historyPoints ?? [];
      for (let i = 1; i < points.length; i += 1) {
        const current = points[i]; const previous = points[i - 1];
        if (!current || !previous || current.date === previous.date) continue;
        const delta = h.shares * (current.nav - previous.nav);
        if (!Number.isFinite(delta)) continue;
        const entry = result.get(current.date);
        if (entry) entry.pnl += delta;
        else result.set(current.date, { pnl: delta, found: true });
      }
    }
    return result;
  }, [funds, portfolio]);

  return (
    <div>
      <Glass className="portfolio-shell mb-3 overflow-hidden rounded-[28px] border border-white/75 bg-white/48 p-3 shadow-[0_18px_48px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[20px] saturate-150">
        <div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="text-[17px] font-bold tracking-tight text-fg">💼 我的持仓 <span className="ml-1 text-[9px] font-normal text-muted">盘中估算 · 收盘以官方净值为准</span></div></div><span className="shrink-0 rounded-full bg-blue-100/75 px-2.5 py-1 text-[10px] font-semibold text-blue-600">{portfolio.length}只</span></div>
        <div className="mt-2 flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[10px] text-muted">{fullyPriced ? "持仓总收益" : "持仓总收益（已计价部分）"}</div><Tone v={summary.holdingPnl} className="mt-1 block text-[26px] font-bold leading-none tracking-tight">{summary.totalCount > 0 ? fmtMoney(summary.holdingPnl) : "—"}</Tone><Tone v={summary.pricedHoldingPnlPct} className="mt-1 block text-[12px] font-semibold">{summary.pricedHoldingPnlPct == null ? "—" : fmtPctShort(summary.pricedHoldingPnlPct)}</Tone></div><div className="shrink-0 pt-3 text-right text-[9px] leading-relaxed text-muted"><div>已计价 {pricedToday.length} 只 · {downCount} 跌 / {upCount} 涨 / {flatCount} 平</div><div>未计价 {Math.max(0, portfolio.length - pricedToday.length)} 只</div><div>成本 {fmtMoney(summary.costValue)}</div><div>持仓市值 {summary.marketValue == null ? "—" : fmtMoney(summary.marketValue)}</div></div></div>
        <div className="mt-2 flex items-center justify-between rounded-2xl bg-white/48 px-1 py-1 ring-1 ring-white/75"><span className="px-2 text-[9px] text-muted">详情</span><div className="flex gap-1.5"><button type="button" onClick={() => setBulkExpanded(true)} className="flex size-8 items-center justify-center rounded-full bg-white/78 text-slate-500 shadow-sm ring-1 ring-white/85" aria-label="全部展开" title="全部展开"><ChevronsDown className="size-3.5" /></button><button type="button" onClick={() => setBulkExpanded(false)} className="flex size-8 items-center justify-center rounded-full bg-white/78 text-slate-500 shadow-sm ring-1 ring-white/85" aria-label="全部折叠" title="全部折叠"><ChevronsUp className="size-3.5" /></button></div></div>
        <div className="mt-2.5 grid grid-cols-5 gap-1 rounded-2xl bg-white/48 p-0.5 ring-1 ring-white/75">{(["today","week","month","quarter","since"] as const).map((tab) => { const label = tab === "today" ? "今天" : tab === "week" ? "一周" : tab === "month" ? "一个月" : tab === "quarter" ? "近3月" : "买入以来"; return <button key={tab} type="button" onClick={() => setSummaryTab(tab)} className={`rounded-[13px] px-1 py-1.5 text-[10px] font-medium transition ${summaryTab === tab ? "bg-blue-500 text-white shadow-[0_4px_12px_rgba(59,130,246,.20)]" : "bg-white/66 text-muted"}`}>{label}</button>; })}</div>
        <div className="mt-2 rounded-2xl bg-white/54 px-2.5 py-1.5 ring-1 ring-white/70"><div className="flex items-center justify-between gap-3"><span className="text-[10px] text-muted">{selectedSummary.label}</span><Tone v={selectedSummary.amount} className="text-[16px] font-bold">{selectedSummary.amount == null ? "—" : fmtMoney(selectedSummary.amount)}</Tone></div><div className="mt-0.5 text-right"><Tone v={selectedSummary.pct} className="text-[10px] font-semibold">{selectedSummary.pct == null ? "—" : fmtPctShort(selectedSummary.pct)}</Tone></div></div>
        {summary.totalCount > summary.pricedCount ? <div className="mt-1 rounded-xl bg-amber-50/70 px-2.5 py-1 text-[8px] text-muted">还有 {summary.totalCount - summary.pricedCount} 只基金暂未取得可靠行情；无法确认的数字不猜。</div> : null}
        {summaryTab !== "today" && selectedSummary.amount == null ? <div className="mt-1 rounded-xl bg-amber-50/70 px-2.5 py-1 text-[8px] text-muted">该周期暂缺足够历史净值，无法可靠计算时保持空白。</div> : null}
        {portfolio.length ? portfolio.map((h) => { const fname = funds[h.code]?.name || h.name; const rule = matchFundSector(fname); const sector = rule ? snapshot?.sectors.find((s) => s.id === rule.id) : undefined; return <FundCard key={h.code} holding={h} fund={funds[h.code]} sector={sector} benchPct={bench} totalMarketValue={summary.marketValue} expandedOverride={bulkExpanded} onUpdate={(patch) => updateHolding(h.code, patch)} onRemove={() => removeHolding(h.code)} />; }) : <EmptyNote>还没有持仓。添加基金后会自动拉取官方净值、盘中估算和历史指标。</EmptyNote>}
        <QuickAddFund />
      </Glass>
      <PortfolioInsight holdings={portfolio} funds={Object.values(funds)} sectors={snapshot?.sectors || []} />
      <DeepFundIntelligence holdings={portfolio} funds={funds} />
      <Glass>
        <div className="mb-3 flex items-center justify-between"><div className="text-base font-semibold text-fg">收益日历</div><span className="text-xs text-muted">{calendarCursor.getFullYear()}/{String(calendarCursor.getMonth() + 1).padStart(2, "0")}</span></div>
        <div className="flex items-center justify-between rounded-2xl bg-bg-elevated px-3 py-2"><button type="button" onClick={() => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1))} className="size-9 rounded-full bg-white/70 text-lg">‹</button><b>{calendarCursor.getFullYear()}年{calendarCursor.getMonth() + 1}月</b><button type="button" onClick={() => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1))} className="size-9 rounded-full bg-white/70 text-lg">›</button></div>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] text-muted">{["日","一","二","三","四","五","六"].map((d) => <div key={d} className="py-1">{d}</div>)}{calendar.map((c) => <CalendarCell key={c.key} date={c.date} inMonth={c.inMonth} calendarPnl={calendarPnl} />)}</div>
        <p className="mt-2 text-[10px] text-muted">历史日期只使用官方净值回算。</p>
      </Glass>
      <SmartAlerts />
    </div>
  );
}

function CalendarCell({ date, inMonth, calendarPnl }: { date: Date; inMonth: boolean; calendarPnl: CalendarPnl }) {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const day = calendarPnl.get(key); const pnl = day?.pnl ?? 0; const found = day?.found === true;
  return <div className={`min-h-12 rounded-xl p-1 ${inMonth ? "bg-bg-elevated" : "opacity-30"}`}><div className="text-xs">{date.getDate()}</div><Tone v={found ? pnl : null} className="mt-1 block text-[10px] font-semibold">{found ? fmtMoney(pnl) : "—"}</Tone></div>;
}
