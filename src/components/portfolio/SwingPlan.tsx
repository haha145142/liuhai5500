import { useMemo, useState } from "react";
import { Tone } from "@/components/ui/Glass";
import { calcSwingTrade } from "@/lib/calc/indicators";
import { fmtPrice, fmtPctShort } from "@/lib/format";
import type { FundQuote, Holding } from "@/lib/types";

type Props = { holding: Holding; fund?: FundQuote; price: number | null; officialToday: boolean };

function ma(values:number[], n:number){ return values.length >= n ? values.slice(-n).reduce((a,b)=>a+b,0)/n : null; }
function clamp(v:number,min=0,max=100){ return Math.max(min,Math.min(max,v)); }

export function SwingPlan({ holding, fund, price, officialToday }: Props) {
  const [open, setOpen] = useState(false);
  const current = price ?? fund?.nav ?? fund?.estimate ?? null;
  const metrics = fund?.metrics ?? null;
  const points = fund?.historyPoints?.map(x=>x.nav).filter(Number.isFinite) ?? [];
  const ma20 = metrics?.ma20 ?? ma(points,20);
  const ma60 = metrics?.ma60 ?? ma(points,60);
  const trendWeak = metrics ? /弱|下|空/.test(metrics.trend) : (ma20 != null && ma60 != null ? ma20 < ma60 : false);
  const positionScore = metrics?.bandScore ?? null;
  const signalStrength = metrics?.sigStrength ?? null;
  const positionLabel = metrics?.bandTone === "high" ? "偏高" : metrics?.bandTone === "low" ? "偏低" : "中性";
  const trendLabel = trendWeak ? "弱势" : metrics?.trend || "数据不足";
  const change = current != null && holding.cost > 0 ? ((current - holding.cost) / holding.cost) * 100 : null;
  const action = useMemo(()=>{
    if(current == null) return "当前没有可靠净值/估值，暂不下结论";
    if(officialToday) return "今日官方净值已发布，按官方净值口径判断";
    if(change != null && change <= -20) return "跌幅较大也先看趋势与基金质量，不机械补仓";
    if(change != null && change >= 15) return "已经进入较高收益档位，波段仓考虑分批止盈";
    if(trendWeak) return "还在下跌趋势里，即使便宜也别急着买";
    return metrics?.combo || "处于中间区间，先观察趋势确认";
  },[current,officialToday,change,trendWeak,metrics]);
  const positionNote = positionScore == null ? "暂无可靠位置数据" : positionScore <= 35 ? "位置偏低，但仍需确认趋势" : positionScore >= 70 ? "位置偏高，注意追涨风险" : "位置处于中间区域";
  const signalText = signalStrength == null ? "暂无可靠信号强度" : `${Math.round(signalStrength)}分`;
  const confirmText = metrics ? `${metrics.sigConds?.length || 0}/${Math.max(1, metrics.sigConds?.length || 1)} 满足 · ${metrics.trend || "趋势"}` : "数据不足";
  const toneScore = positionScore == null ? 0 : positionScore - 50;

  return <section className="mt-3 rounded-[28px] border border-white/75 bg-white/50 p-4 shadow-[0_18px_48px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[20px] saturate-150">
    <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-white/72 text-[25px] shadow-sm ring-1 ring-white/80">📊</div><div className="min-w-0 flex-1"><div className="text-[22px] font-semibold tracking-tight text-fg">波段信号 · {metrics?.trend ? `趋势${metrics.trend}` : "趋势待确认"}</div><div className="mt-0.5 text-xs text-muted">RSI/BIAS/BOLL/MA/MACD</div></div><div className="rounded-full bg-blue-100/70 px-3 py-1.5 text-xs font-semibold text-blue-600">{new Date().toLocaleDateString("zh-CN",{month:"2-digit",day:"2-digit"}).replace("/","/")} {new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}</div></div>

    <div className="mt-3 rounded-[26px] border border-white/80 bg-white/63 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.96)]">
      <div className="text-base text-muted">{fund?.name || holding.name || holding.code} · 波段信号</div>
      <div className="mt-1 text-[32px] font-bold"><Tone v={toneScore}>{positionLabel}</Tone></div>
      <div className="mt-1 text-base text-muted">评分 {positionScore == null ? "—" : Math.round(positionScore)}/100 · {positionNote}</div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-gradient-to-r from-red-400 via-blue-400 to-emerald-400"><div className="h-full rounded-full" style={{width:`${clamp(positionScore ?? 50)}%`,background:"rgba(22,34,55,.82)",maxWidth:"8px",boxShadow:"0 0 0 3px rgba(255,255,255,.92)"}} /></div>
      <div className="mt-3 inline-flex rounded-full bg-blue-100/70 px-3 py-1.5 text-xs font-semibold text-blue-600">{positionLabel}</div>
      <div className="mt-4 border-t border-black/[.06] pt-4"><div className="flex items-center justify-between text-sm text-muted"><span>信号强度</span><span className="text-2xl font-semibold text-fg">{signalText}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/80"><div className="h-full rounded-full bg-slate-400" style={{width:`${clamp(signalStrength ?? 25)}%`}} /></div><div className="mt-2 text-sm text-muted">确认条件：{confirmText}</div></div>
    </div>

    <div className="mt-3 rounded-[26px] border border-white/80 bg-white/58 p-5"><div className="text-base text-muted">{fund?.name || holding.name || holding.code} · 趋势{trendLabel}</div><div className={`mt-1 text-[30px] font-bold ${trendWeak?"text-emerald-600":"text-red-500"}`}>{trendLabel}</div><div className="mt-1 text-base text-muted">{trendWeak ? "走势较弱，短期向下" : "走势偏强，短期向上"}</div><div className="mt-4 h-3 overflow-hidden rounded-full bg-gradient-to-r from-red-400 via-blue-400 to-emerald-400"><div className="h-full rounded-full" style={{width:`${clamp(trendWeak ? 24 : 72)}%`,background:"rgba(22,34,55,.82)",maxWidth:"8px",boxShadow:"0 0 0 3px rgba(255,255,255,.92)"}} /></div><div className="mt-3 inline-flex rounded-full bg-blue-100/70 px-3 py-1.5 text-xs font-semibold text-blue-600">{trendWeak?"弱势":"强势"}</div></div>

    <div className="mt-4 text-[17px] leading-relaxed text-fg"><b>组合判断（{fund?.name || holding.code}）：</b><span className="text-muted">{action}</span></div>
    <div className="mt-4 border-t border-black/[.06] pt-4 text-sm leading-relaxed text-muted">指标明细：RSI {metrics?.rsi?.toFixed(1) ?? "—"} · BIAS {metrics?.bias?.toFixed(2) ?? "—"}% · BOLL {fmtPrice(metrics?.lower ?? null,4)}~{fmtPrice(metrics?.upper ?? null,4)} · MACD {fmtPrice(metrics?.macd ?? null,4)} · MA5 {fmtPrice(metrics?.ma5 ?? null,4)} · MA20 {fmtPrice(metrics?.ma20 ?? null,4)} · MA60 {fmtPrice(metrics?.ma60 ?? null,4)}</div>
    <div className="mt-3 flex items-center justify-between text-[11px] text-muted"><span>当前相对成本 {change == null ? "—" : fmtPctShort(change)}</span><button type="button" onClick={()=>setOpen(v=>!v)} className="rounded-full bg-white/65 px-3 py-1.5 font-semibold ring-1 ring-white/80">{open?"收起详情":"查看详情"}</button></div>
    {open ? <div className="mt-3 rounded-2xl bg-white/60 p-3 text-[11px] leading-relaxed text-muted">{metrics?.combo || "暂无可靠波段结论"}{metrics?.sigConds?.length ? ` · ${metrics.sigConds.join(" · ")}` : ""}</div> : null}
  </section>;
}
