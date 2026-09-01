import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EmptyNote, Glass, SectionTitle, DataStatus } from "@/components/ui/Glass";
import { calcSwingTrade } from "@/lib/calc/indicators";
import { fmtPctShort, fmtPrice } from "@/lib/format";
import { selectFundDisplayQuote } from "@/lib/data/quote-mode";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/band")({ component: BandPage });
type HoldingLike = { code: string; name: string; shares: number; cost: number };

function BandPage() {
  const portfolio = useApp((s) => s.portfolio) as HoldingLike[];
  const funds = useApp((s) => s.funds);
  if (!portfolio.length) return <Glass><EmptyNote>添加持仓后，这里会显示完整的波段信号与趋势强弱。</EmptyNote></Glass>;
  return (
    <div className="space-y-2.5 pb-3">
      <Glass className="mb-0 px-3 py-2.5">
        <SectionTitle title="📊 波段信号 · 趋势强弱" hint="一眼判断" />
        <p className="mt-[-3px] text-[10px] leading-[1.4] text-muted">波段看当前位置，趋势看方向强弱，组合判断再给综合结论。</p>
      </Glass>
      <div className="space-y-2.5">{portfolio.map((holding) => <FundSignalGroup key={holding.code} holding={holding} fund={funds[holding.code]} />)}</div>
    </div>
  );
}

function FundSignalGroup({ holding, fund }: { holding: HoldingLike; fund: any }) {
  const [expanded, setExpanded] = useState(false);
  const metrics = fund?.metrics;
  const quote = selectFundDisplayQuote(fund);
  const price = quote.price;
  const swing = calcSwingTrade(metrics ?? null, holding.cost, price ?? 0);
  const statusMode = quote.mode === "live_estimate" ? "live" : quote.mode === "official_today" ? "official" : quote.mode === "latest_official" ? "latest" : "unavailable";
  const bandScore = metrics?.bandScore ?? null;
  const trendScore = metrics?.trendScore ?? null;
  const bandLabel = metrics?.band ?? "—";
  const trendLabel = metrics?.trend ?? "—";

  return (
    <Glass className="mb-0 overflow-hidden rounded-[20px] border border-white/78 bg-white/52 p-2.5 shadow-[0_10px_28px_rgba(38,78,112,.06)] backdrop-blur-[18px] saturate-150">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0"><h3 className="truncate text-[13px] font-semibold tracking-tight text-fg">{fund?.name || holding.name}</h3><div className="mt-0.5 flex items-center gap-1.5 text-[8px] text-muted"><span>{holding.code}</span><span>·</span><DataStatus mode={statusMode} detail={quote.dataDate || undefined} /></div></div>
        <span className={toneText(quote.pct)}>{quote.pct == null ? "—" : fmtPctShort(quote.pct)}</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <SignalCard title="波段信号" label={bandLabel} score={bandScore} tone={metrics?.bandTone ?? "neutral"} subtitle={bandSubtitle(metrics?.bandTone, bandLabel)} />
        <SignalCard title="趋势强弱" label={trendLabel} score={trendScore} tone="neutral" subtitle={trendSubtitle(trendScore, trendLabel)} />
      </div>

      <div className="mt-1.5 rounded-[15px] bg-white/48 ring-1 ring-white/70">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="block w-full px-2.5 py-2 text-left" aria-expanded={expanded}>
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-[10px] font-semibold text-fg">组合判断</div><p className="mt-0.5 text-[9px] leading-[1.35] text-muted">{metrics?.combo || "暂无可靠组合判断"}</p></div><span className="shrink-0 text-[8px] text-subtle">{expanded ? "收起" : "详情"}⌄</span></div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[7.5px] text-subtle"><span>RSI {formatMetric(metrics?.rsi,1)} · BIAS {formatMetric(metrics?.bias,2)}% · MACD {formatMetric(metrics?.macd,3)}</span><span>置信 {metrics?.conf ?? "—"}</span></div>
        </button>
        {expanded ? <div className="border-t border-black/[.04] px-2.5 pb-2.5 pt-2"><div className="grid grid-cols-3 gap-1.5 text-center"><Stat k="RSI" v={formatMetric(metrics?.rsi,1)} /><Stat k="BIAS" v={`${formatMetric(metrics?.bias,2)}%`} /><Stat k="MACD" v={formatMetric(metrics?.macd,3)} /><Stat k="BOLL上轨" v={fmtPrice(metrics?.upper,4)} /><Stat k="BOLL下轨" v={fmtPrice(metrics?.lower,4)} /><Stat k="MA20" v={fmtPrice(metrics?.ma20,4)} /></div>{swing ? <div className="mt-1.5 rounded-[12px] bg-bg-elevated p-2"><div className="flex items-center justify-between gap-2"><b className="text-[10px] text-fg">{swing.action}</b><span className="text-[8px] font-semibold text-muted">做T环境 {swing.envLevel}</span></div><p className="mt-0.5 text-[8.5px] leading-[1.4] text-muted">{swing.reason}</p>{swing.allowT && swing.buyGrid != null && swing.sellGrid != null ? <p className="mt-0.5 text-[8px] text-subtle">低吸 {fmtPrice(swing.buyGrid,4)} · 高抛 {fmtPrice(swing.sellGrid,4)} · 环境 {swing.env}/100</p> : null}</div> : null}</div> : null}
      </div>
    </Glass>
  );
}

function SignalCard({ title, label, score, tone, subtitle }: { title:string; label:string; score:number|null; tone:"low"|"high"|"neutral"; subtitle:string }) {
  const pct = score == null ? 50 : Math.max(0, Math.min(100, score));
  const labelClass = tone === "low" ? "text-[#66879e]" : tone === "high" ? "text-[#997d6d]" : "text-[#647588]";
  return <div className="min-h-[108px] rounded-[15px] border border-white/80 bg-white/55 px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-[8px] font-medium text-muted">{title}</div><div className={`mt-0.5 text-[17px] font-bold leading-none ${labelClass}`}>{label}</div></div><div className="text-right"><div className="text-[7px] text-subtle">评分</div><div className={`text-[11px] font-bold tabular-nums ${labelClass}`}>{score == null ? "—" : `${score}/100`}</div></div></div><p className="mt-1.5 min-h-[25px] text-[8px] leading-[1.35] text-muted">{subtitle}</p><div className="mt-2 relative h-1.5 overflow-hidden rounded-full" style={{background:"linear-gradient(90deg,#e8c6c3 0%,#eee0c6 25%,#d5dce4 50%,#c3d0df 70%,#c7ddd8 100%)"}}><span className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-slate-400/70 bg-white/92 shadow-sm" style={{left:`calc(${pct}% - 7px)`}} /></div><div className="mt-0.5 flex justify-between text-[6.5px] text-subtle"><span>弱</span><span>中</span><span>强</span></div></div>;
}

function toneText(v:number|null){return v==null?"shrink-0 text-[15px] font-bold text-subtle":v>0?"shrink-0 text-[15px] font-bold text-[#7e6f6b]":"shrink-0 text-[15px] font-bold text-[#6f7d88]";}
function trendSubtitle(score:number|null,label:string){if(score==null)return"趋势历史不足，等待更多净值。";if(score>=75)return`当前${label}，多周期方向明确。`;if(score>=60)return`当前${label}，中短期方向偏强。`;if(score>=40)return`当前${label}，多空暂未形成单边。`;if(score>=25)return`当前${label}，多周期动量偏弱。`;return`当前${label}，趋势明显偏弱。`;}
function bandSubtitle(tone:"low"|"high"|"neutral"|undefined,label:string){if(tone==="low")return`当前位置${label}，偏低，观察企稳。`;if(tone==="high")return`当前位置${label}，偏高，注意回撤。`;return`当前位置${label}，中性，等待确认。`;}
function formatMetric(v:number|null|undefined,d:number){return v==null||!Number.isFinite(v)?"—":v.toFixed(d);}
function Stat({k,v}:{k:string;v:string}){return <div className="rounded-[10px] bg-bg-elevated py-1"><div className="text-[7px] text-subtle">{k}</div><div className="text-[9.5px] font-semibold tabular-nums text-fg">{v}</div></div>;}
