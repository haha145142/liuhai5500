import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FundCard } from "@/components/portfolio/FundCard";
import { PortfolioInsight } from "@/components/portfolio/PortfolioInsight";
import { QuickAddFund } from "@/components/portfolio/QuickAddFund";
import { EmptyNote, Glass, Tone } from "@/components/ui/Glass";
import { matchFundSector } from "@/lib/data/sectors";
import { fmtMoney, fmtPctShort } from "@/lib/format";
import { useApp } from "@/lib/store";
import { calcPortfolioPeriodReturn } from "@/lib/calc/portfolio-periods";
import { calcPortfolioReturn, calcHoldingReturn } from "@/lib/calc/portfolio-returns";
import type { FundQuote, Holding } from "@/lib/types";

export const Route = createFileRoute("/portfolio")({ component: PortfolioPage });
type AlertRule = { code: string; kind: "止盈" | "止损"; targetPct: number };
const ALERT_KEY = "fund_ai_pro_alerts_v1";
type SummaryTab = "today" | "week" | "month" | "quarter" | "since";
function readAlerts(): AlertRule[] { if (typeof window === "undefined") return []; try { const raw = JSON.parse(localStorage.getItem(ALERT_KEY) || "[]"); return Array.isArray(raw) ? (raw as AlertRule[]) : []; } catch { return []; } }
function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function monthCells(cursor: Date) { const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const start = new Date(first); start.setDate(1 - first.getDay()); return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; }); }

function PortfolioPage() {
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  const snapshot = useApp((s) => s.snapshot);
  const updateHolding = useApp((s) => s.updateHolding);
  const removeHolding = useApp((s) => s.removeHolding);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [alertCode, setAlertCode] = useState("");
  const [alertKind, setAlertKind] = useState<AlertRule["kind"]>("止盈");
  const [alertPct, setAlertPct] = useState("");
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [summaryTab, setSummaryTab] = useState<SummaryTab>("today");
  useEffect(() => setAlerts(readAlerts()), []);
  useEffect(() => { try { localStorage.setItem(ALERT_KEY, JSON.stringify(alerts)); } catch {} }, [alerts]);
  const bench = snapshot?.indices[0]?.pct ?? null;
  const summary = useMemo(() => calcPortfolioReturn(portfolio, funds), [funds, portfolio]);
  const week = useMemo(() => calcPortfolioPeriodReturn("week", portfolio, funds), [funds, portfolio]);
  const month = useMemo(() => calcPortfolioPeriodReturn("month", portfolio, funds), [funds, portfolio]);
  const quarter = useMemo(() => calcPortfolioPeriodReturn("quarter", portfolio, funds), [funds, portfolio]);
  const year = useMemo(() => calcPortfolioPeriodReturn("year", portfolio, funds), [funds, portfolio]);
  const holdingReturns = useMemo(() => new Map(portfolio.map((h) => [h.code, calcHoldingReturn(h, funds[h.code])])), [funds, portfolio]);
  const downCount = portfolio.filter((h) => (holdingReturns.get(h.code)?.todayPnlPct ?? 0) < 0).length;
  const upCount = portfolio.filter((h) => (holdingReturns.get(h.code)?.todayPnlPct ?? 0) > 0).length;
  const selectedSummary = useMemo(() => {
    if (summaryTab === "week") return { label: "本周收益", amount: week.amount, pct: week.pct };
    if (summaryTab === "month") return { label: "本月收益", amount: month.amount, pct: month.pct };
    if (summaryTab === "quarter") return { label: "近三个月收益", amount: quarter.amount, pct: quarter.pct };
    if (summaryTab === "since") return { label: "买入以来收益", amount: summary.pricedCount === summary.totalCount ? summary.holdingPnl : null, pct: summary.holdingPnlPct };
    return { label: "今日收益", amount: summary.todayPnl, pct: summary.todayPnlPct };
  }, [month, quarter, summary, summaryTab, week]);
  const calendar = useMemo(() => { const cells = monthCells(calendarCursor); const activeMonth = monthKey(calendarCursor); return cells.map((date) => ({ date, key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`, inMonth: monthKey(date) === activeMonth })); }, [calendarCursor]);
  const addAlert = () => { const pct = Number(alertPct); if (!/^\d{6}$/.test(alertCode) || !Number.isFinite(pct) || pct <= 0) return; setAlerts((cur) => [...cur.filter((x) => !(x.code === alertCode && x.kind === alertKind)), { code: alertCode, kind: alertKind, targetPct: pct }]); setAlertCode(""); setAlertPct(""); };
  return (
    <div>
      <Glass className="portfolio-shell mb-3 overflow-hidden rounded-[28px] border border-white/75 bg-white/48 p-3 shadow-[0_18px_48px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[20px] saturate-150">
        <div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="text-[17px] font-bold tracking-tight text-fg">💼 我的持仓 <span className="ml-1 text-[9px] font-normal text-muted">盘中估值 · 收盘以官方净值为准</span></div></div><span className="shrink-0 rounded-full bg-blue-100/75 px-2.5 py-1 text-[10px] font-semibold text-blue-600">{portfolio.length}只</span></div>
        <div className="mt-2 flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[10px] text-muted">持仓总收益</div><Tone v={summary.holdingPnl} className="mt-1 block text-[26px] font-bold leading-none tracking-tight">{summary.pricedCount === summary.totalCount && summary.totalCount > 0 ? fmtMoney(summary.holdingPnl) : "—"}</Tone><Tone v={summary.holdingPnlPct} className="mt-1 block text-[12px] font-semibold">{summary.pricedCount === summary.totalCount && summary.holdingPnlPct != null ? fmtPctShort(summary.holdingPnlPct) : "—"}</Tone></div><div className="shrink-0 pt-3 text-right text-[9px] leading-relaxed text-muted"><div>今日 {downCount} 跌 / {upCount} 涨 / {Math.max(0, portfolio.length - downCount - upCount)} 平</div><div>成本 {fmtMoney(summary.costValue)}</div><div>持仓市值 {fmtMoney(summary.marketValue)}</div></div></div>
        <div className="mt-2.5 grid grid-cols-5 gap-1 rounded-2xl bg-white/48 p-0.5 ring-1 ring-white/75">{(["today","week","month","quarter","since"] as const).map((tab) => { const label = tab === "today" ? "今日" : tab === "week" ? "本周" : tab === "month" ? "本月" : tab === "quarter" ? "近3月" : "以来"; return <button key={tab} type="button" onClick={() => setSummaryTab(tab)} className={`rounded-[13px] px-1 py-1.5 text-[10px] font-medium transition ${summaryTab === tab ? "bg-blue-500 text-white shadow-[0_4px_12px_rgba(59,130,246,.20)]" : "bg-white/66 text-muted"}`}>{label}</button>; })}</div>
        <div className="mt-2 rounded-2xl bg-white/54 px-2.5 py-1.5 ring-1 ring-white/70"><div className="flex items-center justify-between gap-3"><span className="text-[10px] text-muted">{selectedSummary.label}</span><Tone v={selectedSummary.amount} className="text-[16px] font-bold">{selectedSummary.amount == null ? "—" : fmtMoney(selectedSummary.amount)}</Tone></div><div className="mt-0.5 text-right"><Tone v={selectedSummary.pct} className="text-[10px] font-semibold">{selectedSummary.pct == null ? "—" : fmtPctShort(selectedSummary.pct)}</Tone></div></div>
        {summary.totalCount > summary.pricedCount ? <div className="mt-1 rounded-xl bg-amber-50/70 px-2.5 py-1 text-[8px] text-muted">还有 {summary.totalCount - summary.pricedCount} 只基金暂未取得可靠行情；无法确认的数字不猜。</div> : null}
        {summaryTab !== "today" && summaryTab !== "since" && selectedSummary.amount == null ? <div className="mt-1 rounded-xl bg-amber-50/70 px-2.5 py-1 text-[8px] text-muted">该周期需要全部持仓具备对应历史净值；数据不完整时不显示估算收益。</div> : null}
        {portfolio.length ? portfolio.map((h) => { const fname = funds[h.code]?.name || h.name; const rule = matchFundSector(fname); const sector = rule ? snapshot?.sectors.find((s) => s.id === rule.id) : undefined; return <FundCard key={h.code} holding={h} fund={funds[h.code]} sector={sector} benchPct={bench} totalMarketValue={summary.marketValue} onUpdate={(patch) => updateHolding(h.code, patch)} onRemove={() => removeHolding(h.code)} />; }) : <EmptyNote>还没有持仓。添加基金后会自动拉取官方净值、盘中估值和历史指标。</EmptyNote>}
        <QuickAddFund />
      </Glass>
      <PortfolioInsight holdings={portfolio} funds={Object.values(funds)} sectors={snapshot?.sectors || []} />
      <Glass>
        <div className="mb-3 flex items-center justify-between"><div className="text-base font-semibold text-fg">收益日历</div><span className="text-xs text-muted">{calendarCursor.getFullYear()}/{String(calendarCursor.getMonth() + 1).padStart(2, "0")}</span></div>
        <div className="flex items-center justify-between rounded-2xl bg-bg-elevated px-3 py-2"><button type="button" onClick={() => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1))} className="size-9 rounded-full bg-white/70 text-lg">‹</button><b>{calendarCursor.getFullYear()}年{calendarCursor.getMonth() + 1}月</b><button type="button" onClick={() => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1))} className="size-9 rounded-full bg-white/70 text-lg">›</button></div>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] text-muted">{["日","一","二","三","四","五","六"].map((d) => <div key={d} className="py-1">{d}</div>)}{calendar.map((c) => <CalendarCell key={c.key} date={c.date} inMonth={c.inMonth} portfolio={portfolio} funds={funds} />)}</div>
        <p className="mt-2 text-[10px] text-muted">历史日期只使用官方净值回算。</p>
      </Glass>
      <Glass>
        <div className="mb-3 flex items-center justify-between"><div className="text-base font-semibold text-fg">止盈 / 止损提醒</div><span className="text-xs text-muted">本地阈值 · 触发不离场</span></div>
        <div className="grid grid-cols-3 gap-2"><input value={alertCode} onChange={(e) => setAlertCode(e.target.value)} placeholder="基金代码" inputMode="numeric" className="h-11 rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border" /><select value={alertKind} onChange={(e) => setAlertKind(e.target.value as AlertRule["kind"])} className="h-11 rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border"><option>止盈</option><option>止损</option></select><input value={alertPct} onChange={(e) => setAlertPct(e.target.value)} placeholder="收益率 %" inputMode="decimal" className="h-11 rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border" /></div>
        <button type="button" onClick={addAlert} className="mt-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg">添加提醒</button>
        {alerts.length ? <div className="mt-3 space-y-2">{alerts.map((a) => { const h = portfolio.find((x) => x.code === a.code); const f = funds[a.code]; const ret = h ? calcHoldingReturn(h, f) : null; const gain = ret?.holdingPnlPct ?? null; const triggered = gain != null && (a.kind === "止盈" ? gain >= a.targetPct : gain <= -a.targetPct); return <div key={`${a.code}-${a.kind}`} className="flex items-center justify-between rounded-2xl bg-bg-elevated p-3 text-xs"><span>{a.code} · {a.kind} {a.targetPct}%</span><span className={triggered ? "font-semibold text-up" : "text-muted"}>{gain == null ? "等待净值" : triggered ? "已触发" : `当前 ${fmtPctShort(gain)}`}</span></div>; })}</div> : <EmptyNote>暂无提醒。</EmptyNote>}
      </Glass>
    </div>
  );
}
function CalendarCell({ date, inMonth, portfolio, funds }: { date: Date; inMonth: boolean; portfolio: Holding[]; funds: Record<string, FundQuote> }) { const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; let pnl = 0; let found = false; for (const h of portfolio) { const points = funds[h.code]?.historyPoints || []; const idx = points.findIndex((p) => p.date === key); if (idx > 0) { pnl += h.shares * (points[idx].nav - points[idx - 1].nav); found = true; } } return <div className={`min-h-12 rounded-xl p-1 ${inMonth ? "bg-bg-elevated" : "opacity-30"}`}><div className="text-xs">{date.getDate()}</div><Tone v={found ? pnl : null} className="mt-1 block text-[10px] font-semibold">{found ? fmtMoney(pnl) : "—"}</Tone></div>; }
