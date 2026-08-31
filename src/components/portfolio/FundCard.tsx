import { useMemo, useState } from "react";
import { Tone } from "@/components/ui/Glass";
import { calcSixFactor } from "@/lib/calc/six-factor";
import { calcSwingTrade } from "@/lib/calc/indicators";
import { calcHoldingReturn } from "@/lib/calc/portfolio-returns";
import { matchFundSector } from "@/lib/data/sectors";
import { fmtMoney, fmtPctShort, fmtPrice, cnTime } from "@/lib/format";
import { isTradeTime } from "@/lib/market-hours";
import type { FundQuote, Holding, SectorQuote } from "@/lib/types";

type Period = "week" | "month" | "quarter" | "half" | "year";

function points(fund?: FundQuote) {
  return [...(fund?.historyPoints || [])]
    .filter((p) => Number.isFinite(p.nav) && p.nav > 0 && p.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function periodReturn(fund: FundQuote | undefined, period: Period, current: number | null, shares: number) {
  if (!fund || current == null) return { amount: null as number | null, pct: null as number | null };
  const list = points(fund);
  const days = period === "week" ? 5 : period === "month" ? 20 : period === "quarter" ? 60 : period === "half" ? 120 : 250;
  if (list.length <= days) return { amount: null, pct: null };
  const base = list[list.length - 1 - days]?.nav ?? null;
  if (base == null || base <= 0) return { amount: null, pct: null };
  return { amount: (current - base) * shares, pct: ((current - base) / base) * 100 };
}

function isOfficialToday(fund?: FundQuote) {
  if (!fund?.navDate) return false;
  if (fund.officialNavPublished === true) return true;
  const now = cnTime();
  const [y, m, d] = fund.navDate.split(/[-/]/).map(Number);
  return y === now.getUTCFullYear() && m === now.getUTCMonth() + 1 && d === now.getUTCDate();
}

export function FundCard({ holding, fund, sector, benchPct, onRemove, onUpdate }: { holding: Holding; fund?: FundQuote; sector?: SectorQuote; benchPct: number | null; onRemove: () => void; onUpdate: (patch: Partial<Holding>) => void }) {
  const [period, setPeriod] = useState<Period>("week");
  const [whyOpen, setWhyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [shares, setShares] = useState(String(holding.shares));
  const [cost, setCost] = useState(String(holding.cost));
  const name = fund?.name || holding.name || holding.code;
  const live = isTradeTime();
  const officialToday = isOfficialToday(fund);
  const useEstimate = !officialToday && live && fund?.estimate != null;
  const px = useEstimate ? fund.estimate! : (fund?.nav ?? null);
  const day = useEstimate ? (fund?.estimatePct ?? null) : (fund?.dayPct ?? null);
  const ret = calcHoldingReturn(holding, fund);
  const mapped = matchFundSector(name);
  const six = sector && sector.available ? calcSixFactor(sector, benchPct) : null;
  const swing = calcSwingTrade(fund?.metrics ?? null, holding.cost, px || 0);
  const selected = useMemo(() => periodReturn(fund, period, px, holding.shares), [fund, period, px, holding.shares]);
  const selectedLabel = period === "week" ? "近1周收益" : period === "month" ? "近1月收益" : period === "quarter" ? "近3月收益" : period === "half" ? "近6月收益" : "近1年收益";

  const saveEdit = () => {
    const s = Number(shares);
    const c = Number(cost);
    if (s > 0 && c > 0) { onUpdate({ shares: s, cost: c }); setEditing(false); }
  };

  return (
    <article className="mb-3 overflow-hidden rounded-[28px] border border-white/75 bg-white/50 p-4 shadow-[0_18px_48px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[20px] saturate-150">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><div className="text-[17px] font-semibold tracking-tight text-fg">{name}</div><div className="mt-0.5 text-xs text-muted">{holding.code}</div><div className="mt-1 rounded-lg bg-blue-50/75 px-2 py-1 text-[10px] text-blue-500">{useEstimate ? "盘中估值" : "收盘官方净值"}{fund?.estimateTime ? ` · ${fund.estimateTime}` : ""}</div></div>
        <div className="text-right"><Tone v={day} className="text-[27px] font-bold leading-none">{fmtPctShort(day)}</Tone><div className="mt-1 text-[9px] text-muted">{useEstimate ? "估值涨跌" : "官方净值涨跌"}</div></div>
      </div>

      <div className="mt-3 border-b border-black/[.05] pb-3"><div className="grid grid-cols-4 gap-2 text-[11px] text-muted"><span>持仓金额</span><span>持有收益</span><span>今日收益</span><span>昨日收益</span></div><div className="mt-1 grid grid-cols-4 gap-2"><b className="text-sm tabular-nums">{fmtMoney(ret.marketValue)}</b><Tone v={ret.holdingPnl} className="text-sm font-semibold tabular-nums">{fmtMoney(ret.holdingPnl)}</Tone><Tone v={ret.todayPnl} className="text-sm font-semibold tabular-nums">{ret.todayPnl == null ? "—" : fmtMoney(ret.todayPnl)}</Tone><Tone v={ret.previousOfficialNav != null && px != null ? (px - ret.previousOfficialNav) * holding.shares : null} className="text-sm font-semibold tabular-nums">{ret.previousOfficialNav != null && px != null ? fmtMoney((px - ret.previousOfficialNav) * holding.shares) : "—"}</Tone></div></div>
      <div className="mt-2 rounded-2xl bg-white/48 px-3 py-2.5"><div className="flex items-center justify-between"><span className="text-[10px] text-muted">持仓成本 {fmtMoney(ret.costValue)}</span><b className="text-[20px] tabular-nums">{fmtMoney(ret.marketValue)}</b></div><div className="mt-1 text-[10px] text-muted">持有收益率 <Tone v={ret.holdingPnlPct}>{fmtPctShort(ret.holdingPnlPct)}</Tone></div></div>

      <div className="mt-3 grid grid-cols-5 gap-1.5 rounded-2xl bg-white/42 p-1 ring-1 ring-white/70">
        {([['week','1周'],['month','1月'],['quarter','3月'],['half','6月'],['year','1年']] as const).map(([id,label]) => <button key={id} type="button" onClick={() => setPeriod(id)} className={`rounded-2xl px-1.5 py-2.5 text-sm font-medium ${period === id ? "bg-blue-500 text-white shadow-[0_5px_14px_rgba(59,130,246,.22)]" : "bg-white/66 text-muted"}`}>{label}</button>)}
      </div>

      <div className="mt-2 rounded-[20px] bg-white/50 px-3 py-3"><div className="flex items-end justify-between"><div><div className="text-[11px] text-muted">{selectedLabel}</div><Tone v={selected.amount} className="mt-1 block text-[25px] font-bold">{selected.amount == null ? "—" : fmtMoney(selected.amount)}</Tone></div><Tone v={selected.pct} className="text-base font-semibold">{selected.pct == null ? "—" : fmtPctShort(selected.pct)}</Tone></div><div className="mt-2 text-xs leading-relaxed text-muted">{fund?.metrics?.trend ? `趋势${fund.metrics.trend}` : "趋势待确认"} · {fund?.metrics?.combo || swing?.reason || "暂无可靠波段结论"}</div></div>

      <button type="button" className="mt-2 flex w-full items-center justify-between rounded-[18px] bg-white/58 px-3 py-2.5 text-left text-sm font-medium text-fg" onClick={() => setWhyOpen((v) => !v)}><span>📊 为什么涨？</span><span className="text-[10px] text-muted">{whyOpen ? "收起" : "展开"}</span></button>
      {whyOpen ? <div className="mt-2 rounded-[18px] bg-white/48 p-3 text-[11px] leading-relaxed text-muted"><b className="text-fg">指标：</b>{fund?.metrics ? `RSI ${fmtPrice(fund.metrics.rsi,1)} · BIAS ${fmtPctShort(fund.metrics.bias)} · MACD ${fmtPrice(fund.metrics.macd,4)} · MA20 ${fmtPrice(fund.metrics.ma20,4)} · MA60 ${fmtPrice(fund.metrics.ma60,4)}` : "暂无可靠指标数据"}{mapped ? <div className="mt-1"><b className="text-fg">关联板块：</b>{mapped.name}{sector?.change != null ? ` · 今日 ${fmtPctShort(sector.change)}` : ""}</div> : null}{six ? <div className="mt-1">组合判断：{six.advice} · 置信 {six.confidence}%</div> : null}</div> : null}

      <div className="mt-2 flex gap-2"><button type="button" onClick={() => setEditing(true)} className="flex-1 rounded-full bg-white/66 py-2 text-sm text-muted ring-1 ring-white/70">编辑</button><button type="button" onClick={onRemove} className="rounded-full bg-white/66 px-4 py-2 text-sm text-red-500 ring-1 ring-red-200/60">删除</button></div>
      {editing ? <div className="mt-2 grid grid-cols-2 gap-2"><input value={shares} onChange={(e) => setShares(e.target.value)} inputMode="decimal" className="h-10 rounded-xl bg-white/70 px-3 text-sm ring-1 ring-white/70" placeholder="份额"/><input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" className="h-10 rounded-xl bg-white/70 px-3 text-sm ring-1 ring-white/70" placeholder="成本价"/><button type="button" onClick={saveEdit} className="rounded-xl bg-blue-500 py-2 text-sm font-semibold text-white">保存</button><button type="button" onClick={() => setEditing(false)} className="rounded-xl bg-white/70 py-2 text-sm">取消</button></div> : null}
    </article>
  );
}
