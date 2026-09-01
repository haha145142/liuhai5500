import { useMemo, useState } from "react";
import { Tone } from "@/components/ui/Glass";
import { calcSixFactor } from "@/lib/calc/six-factor";
import { calcSwingTrade } from "@/lib/calc/indicators";
import { calcHoldingReturn } from "@/lib/calc/portfolio-returns";
import { matchFundSector } from "@/lib/data/sectors";
import { fmtMoney, fmtPctShort, fmtPrice, cnTime } from "@/lib/format";
import type { FundQuote, Holding, SectorQuote } from "@/lib/types";

type Period = "week" | "month" | "quarter" | "half" | "year";
function points(fund?: FundQuote) { return [...(fund?.historyPoints || [])].filter((p) => Number.isFinite(p.nav) && p.nav > 0 && p.date).sort((a, b) => a.date.localeCompare(b.date)); }
function periodReturn(fund: FundQuote | undefined, period: Period, current: number | null, shares: number) {
  if (!fund || current == null) return { amount: null as number | null, pct: null as number | null };
  const list = points(fund); const days = period === "week" ? 5 : period === "month" ? 20 : period === "quarter" ? 60 : period === "half" ? 120 : 250;
  if (list.length <= days) return { amount: null, pct: null };
  const base = list[list.length - 1 - days]?.nav ?? null;
  return base && base > 0 ? { amount: (current - base) * shares, pct: ((current - base) / base) * 100 } : { amount: null, pct: null };
}
function isOfficialToday(fund?: FundQuote) {
  if (!fund?.navDate || fund.officialNavPublished !== true) return false;
  const now = cnTime();
  const [y, m, d] = fund.navDate.split(/[-/]/).map(Number);
  return y === now.getUTCFullYear() && m === now.getUTCMonth() + 1 && d === now.getUTCDate();
}

export function FundCard({ holding, fund, sector, benchPct, totalMarketValue, onRemove, onUpdate }: { holding: Holding; fund?: FundQuote; sector?: SectorQuote; benchPct: number | null; totalMarketValue: number; onRemove: () => void; onUpdate: (patch: Partial<Holding>) => void }) {
  const [period, setPeriod] = useState<Period>("week");
  const [expanded, setExpanded] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [shares, setShares] = useState(String(holding.shares));
  const [cost, setCost] = useState(String(holding.cost));
  const name = fund?.name || holding.name || holding.code;
  const officialToday = isOfficialToday(fund);
  const ret = calcHoldingReturn(holding, fund);
  const useEstimate = ret.quoteMode === "live_estimate";
  const hasReliableQuote = ret.marketValue != null;
  const px = ret.price;
  const displayPct = ret.todayPnlPct;
  const mapped = matchFundSector(name); const six = sector && sector.available ? calcSixFactor(sector, benchPct) : null;
  const swing = calcSwingTrade(fund?.metrics ?? null, holding.cost, px || 0);
  const selected = useMemo(() => periodReturn(fund, period, px, holding.shares), [fund, period, px, holding.shares]);
  const selectedLabel = period === "week" ? "近1周收益" : period === "month" ? "近1月收益" : period === "quarter" ? "近3月收益" : period === "half" ? "近6月收益" : "近1年收益";
  const holdingPct = ret.marketValue != null && totalMarketValue > 0 ? (ret.marketValue / totalMarketValue) * 100 : null;
  const score = fund?.metrics?.trendScore ?? null; const trend = fund?.metrics?.trend ?? "—";
  const quoteDate = useEstimate ? (fund?.estimateTime || "") : (fund?.navDate || "");
  const statusText = officialToday
    ? `今日官方净值 · ${quoteDate || "已发布"}`
    : useEstimate
      ? `盘中实时估值 · ${quoteDate || "当前"}`
      : fund?.nav != null
        ? `最近官方净值 · ${quoteDate || "未知日期"}`
        : "暂无可靠净值";
  const saveEdit = () => { const s = Number(shares); const c = Number(cost); if (s > 0 && c > 0) { onUpdate({ shares: s, cost: c }); setEditing(false); } };
  const toggleExpand = () => { setExpanded((v) => !v); setWhyOpen(false); };

  return (
    <article className="fund-card-v6 mb-2 overflow-hidden rounded-[21px] border border-white/78 bg-white/60 p-3 shadow-[0_10px_28px_rgba(38,78,112,.06),inset_0_1px_0_rgba(255,255,255,.98)] backdrop-blur-[16px] saturate-150">
      <button type="button" onClick={toggleExpand} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold leading-[1.25] tracking-tight text-fg">{name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-muted"><span>{holding.code}</span><span>·</span><span>{statusText}</span></div>
          </div>
          <div className="shrink-0 text-right">
            <Tone v={displayPct} className="text-[24px] font-bold leading-none">{displayPct == null ? "—" : fmtPctShort(displayPct)}</Tone>
            <div className="mt-1 text-[9px] text-muted">{officialToday ? "官方" : useEstimate ? "盘中" : hasReliableQuote ? "参考净值" : "行情待更新"}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative h-2 flex-1 overflow-hidden rounded-full" style={{background:"linear-gradient(90deg,#ef5350 0%,#ffca28 25%,#42a5f5 58%,#26a69a 100%)"}}>{score != null ? <span className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-slate-700 bg-white shadow" style={{left:`calc(${Math.max(0,Math.min(100,score))}% - 7px)`}} /> : null}</div><span className="shrink-0 text-[10px] font-semibold text-muted">{trend} {score ?? "—"}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted">
          <span>持仓 {fmtMoney(ret.marketValue)}</span><Tone v={ret.holdingPnl}>持有 {fmtMoney(ret.holdingPnl)}</Tone><Tone v={ret.holdingPnlPct}>收益率 {fmtPctShort(ret.holdingPnlPct)}</Tone>
        </div>
        <div className="mt-2 flex items-center justify-between text-[9px] text-subtle"><span>{expanded ? "收起详情" : "点击查看详情"}</span><span>{expanded ? "⌃" : "⌄"}</span></div>
      </button>
      {expanded ? <div className="mt-3 border-t border-black/[.045] pt-3">
        <div className="rounded-[16px] bg-white/58 px-3 py-2"><div className="grid grid-cols-4 gap-1 text-[9px] text-muted"><span>持仓金额</span><span>持有收益</span><span>今日收益</span><span>昨日收益</span></div><div className="mt-1 grid grid-cols-4 gap-1"><b className="text-[11px] tabular-nums">{fmtMoney(ret.marketValue)}</b><Tone v={ret.holdingPnl} className="text-[11px] font-semibold tabular-nums">{fmtMoney(ret.holdingPnl)}</Tone><Tone v={ret.todayPnl} className="text-[11px] font-semibold tabular-nums">{ret.todayPnl == null ? "—" : fmtMoney(ret.todayPnl)}</Tone><Tone v={ret.previousOfficialNav != null && px != null ? (px - ret.previousOfficialNav) * holding.shares : null} className="text-[11px] font-semibold tabular-nums">{ret.previousOfficialNav != null && px != null ? fmtMoney((px - ret.previousOfficialNav) * holding.shares) : "—"}</Tone></div></div>
        <div className="mt-2 rounded-[16px] bg-white/54 px-3 py-2"><div className="flex items-center justify-between"><span className="text-[9px] text-muted">持仓成本 {fmtMoney(ret.costValue)}</span><b className="text-[17px] tabular-nums">{fmtMoney(ret.marketValue)}</b></div><div className="mt-1 text-[9px] text-muted">持仓占比 <span className="float-right text-[11px] font-semibold text-fg">{holdingPct == null ? "—" : `${holdingPct.toFixed(1)}%`}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/80"><div className="h-full rounded-full bg-accent" style={{width:`${Math.max(0,Math.min(100,holdingPct ?? 0))}%`}} /></div><div className="mt-1 text-[9px] text-muted">持有收益率 <Tone v={ret.holdingPnlPct}>{fmtPctShort(ret.holdingPnlPct)}</Tone></div></div>
        <div className="mt-2 rounded-[16px] bg-white/54 p-0.5 ring-1 ring-white/70 grid grid-cols-5 gap-1">{([['week','1周'],['month','1月'],['quarter','3月'],['half','6月'],['year','1年']] as const).map(([id,label]) => <button key={id} type="button" onClick={(e) => {e.stopPropagation();setPeriod(id)}} className={`rounded-[13px] py-2 text-[11px] font-medium ${period === id ? "bg-blue-500 text-white" : "bg-white/76 text-muted"}`}>{label}</button>)}</div>
        <div className="mt-2 rounded-[16px] bg-white/54 px-3 py-2"><div className="flex items-end justify-between gap-2"><div><div className="text-[9px] text-muted">{selectedLabel}</div><Tone v={selected.amount} className="mt-1 block text-[20px] font-bold leading-none">{selected.amount == null ? "—" : fmtMoney(selected.amount)}</Tone></div><Tone v={selected.pct} className="text-[13px] font-semibold">{selected.pct == null ? "—" : fmtPctShort(selected.pct)}</Tone></div><div className="mt-1.5 text-[9px] leading-[1.45] text-muted">{fund?.metrics?.band ? `${fund.metrics.band} · ` : ""}{fund?.metrics?.trend ? `趋势${fund.metrics.trend} · ` : ""}{fund?.metrics?.combo || swing?.reason || "暂无可靠波段结论"}{fund?.metrics?.rsi != null ? ` · RSI ${fmtPrice(fund.metrics.rsi,1)}` : ""}{fund?.metrics?.bias != null ? ` · BIAS ${fmtPctShort(fund.metrics.bias)}` : ""}</div></div>
        <button type="button" className="mt-2 flex w-full items-center justify-between rounded-[16px] bg-white/60 px-3 py-2 text-left text-[11px] font-medium text-fg" onClick={(e)=>{e.stopPropagation();setWhyOpen(v=>!v)}}><span>📊 为什么涨？</span><span className="text-[9px] text-muted">{whyOpen ? "收起" : "展开"}</span></button>
        {whyOpen ? <div className="mt-2 rounded-[16px] bg-white/54 p-3 text-[9px] leading-[1.5] text-muted"><b className="text-fg">指标：</b>{fund?.metrics ? `RSI ${fmtPrice(fund.metrics.rsi,1)} · BIAS ${fmtPctShort(fund.metrics.bias)} · MACD ${fmtPrice(fund.metrics.macd,4)} · MA20 ${fmtPrice(fund.metrics.ma20,4)} · MA60 ${fmtPrice(fund.metrics.ma60,4)}` : "暂无可靠指标数据"}{mapped ? <div className="mt-1"><b className="text-fg">关联板块：</b>{mapped.name}{sector?.change != null ? ` · 今日 ${fmtPctShort(sector.change)}` : ""}</div> : null}{six ? <div className="mt-1">组合判断：{six.advice} · 置信 {six.confidence}%</div> : null}</div> : null}
        <div className="mt-2 flex gap-2"><button type="button" onClick={(e)=>{e.stopPropagation();setEditing(true)}} className="flex-1 rounded-full bg-white/78 py-2 text-[11px] text-muted ring-1 ring-white/80">编辑</button><button type="button" onClick={(e)=>{e.stopPropagation();onRemove()}} className="rounded-full bg-white/78 px-4 py-2 text-[11px] text-red-500 ring-1 ring-red-200/70">删除</button></div>
        {editing ? <div className="mt-2 grid grid-cols-2 gap-2"><input value={shares} onChange={(e)=>setShares(e.target.value)} inputMode="decimal" className="h-9 rounded-xl bg-white/84 px-2 text-[11px] ring-1 ring-white/80" placeholder="份额"/><input value={cost} onChange={(e)=>setCost(e.target.value)} inputMode="decimal" className="h-9 rounded-xl bg-white/84 px-2 text-[11px] ring-1 ring-white/80" placeholder="成本价"/><button type="button" onClick={saveEdit} className="rounded-xl bg-blue-500 py-2 text-[11px] font-semibold text-white">保存</button><button type="button" onClick={()=>setEditing(false)} className="rounded-xl bg-white/78 py-2 text-[11px]">取消</button></div> : null}
      </div> : null}
    </article>
  );
}
