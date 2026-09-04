import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { EmptyNote, Glass, SectionTitle, DataStatus, Tone } from "@/components/ui/Glass";
import { calcSwingTrade } from "@/lib/calc/indicators";
import { fmtPctShort, fmtPrice } from "@/lib/format";
import { selectFundDisplayQuote } from "@/lib/data/quote-mode";
import { useApp } from "@/lib/store";
import type { FundQuote } from "@/lib/types";

export const Route = createFileRoute("/band")({ component: BandPage });
type HoldingLike = { code: string; name: string; shares: number; cost: number };

function BandPage() {
  const portfolio = useApp((s) => s.portfolio) as HoldingLike[];
  const funds = useApp((s) => s.funds);
  if (!portfolio.length) return <Glass className="band-empty"><EmptyNote>添加持仓后，这里会显示完整的波段信号、实时估值与做T计划。</EmptyNote></Glass>;
  return (
    <div className="band-page space-y-2.5 pb-3">
      <Glass className="band-intro mb-0 px-3 py-2.5">
        <SectionTitle title="📊 波段信号 · 趋势强弱" hint="一眼判断" />
        <p className="mt-[-3px] text-[10px] leading-[1.4] text-muted">波段看当前位置，趋势看方向强弱；下面同时给出实时估值/官方净值和买卖、做T参考。</p>
      </Glass>
      <div className="band-list space-y-2.5">{portfolio.map((holding) => <FundSignalGroup key={holding.code} holding={holding} fund={funds[holding.code]} />)}</div>
    </div>
  );
}

function FundSignalGroup({ holding, fund }: { holding: HoldingLike; fund?: FundQuote }) {
  const [expanded, setExpanded] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
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
    <Glass className="band-card mb-0 overflow-hidden rounded-[20px] border border-white/78 bg-white/52 p-2.5 shadow-[0_10px_28px_rgba(38,78,112,.06)] backdrop-blur-[18px] saturate-150">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="block w-full text-left" aria-expanded={expanded}>
        <div className="flex items-center justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-[13px] font-semibold tracking-tight text-fg">{fund?.name || holding.name}</h3><div className="mt-0.5 flex items-center gap-1.5 text-[8px] text-muted"><span>{holding.code}</span><span>·</span><DataStatus mode={statusMode} detail={quote.dataDate || undefined} /></div></div><div className="flex items-center gap-2"><Tone v={quote.pct} className="text-[15px] font-bold">{quote.pct == null ? "—" : fmtPctShort(quote.pct)}</Tone>{expanded ? <ChevronUp className="size-3.5 text-slate-400" /> : <ChevronDown className="size-3.5 text-slate-400" />}</div></div>
      </button>
      <div className="mt-1.5 flex gap-1.5"><span className="flex-1 rounded-[12px] bg-white/58 px-2 py-1 text-[8px] text-muted">波段 <b className="ml-1 text-slate-700">{bandLabel}</b>{bandScore != null ? ` · ${bandScore}` : ""}</span><span className="flex-1 rounded-[12px] bg-white/58 px-2 py-1 text-[8px] text-muted">趋势 <b className="ml-1 text-slate-700">{trendLabel}</b>{trendScore != null ? ` · ${trendScore}` : ""}</span></div>

      {expanded ? <>
        <div className="mt-2 rounded-[14px] bg-blue-50/40 px-2.5 py-2 ring-1 ring-blue-100/70">
          <div className="flex items-center justify-between gap-2"><span className="text-[9px] text-blue-700">当前价格口径</span><span className="text-[10px] font-semibold text-slate-700">{quote.label}</span></div>
          <div className="mt-0.5 flex items-center justify-between gap-2"><span className="text-[8px] text-subtle">价格</span><span className="text-[14px] font-bold tabular-nums text-fg">{fmtPrice(price, 4)}</span></div>
          <div className="mt-0.5 text-[8px] leading-[1.35] text-muted">{quote.reason || ""}</div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <SignalCard title="波段信号" label={bandLabel} score={bandScore} tone={metrics?.bandTone ?? "neutral"} subtitle={bandSubtitle(metrics?.bandTone, bandLabel)} />
          <SignalCard title="趋势强弱" label={trendLabel} score={trendScore} tone="neutral" subtitle={trendSubtitle(trendScore, trendLabel)} />
        </div>

        <div className="mt-1.5 rounded-[15px] bg-white/48 ring-1 ring-white/70">
          <button type="button" onClick={() => setComboOpen((v) => !v)} className="block w-full px-2.5 py-2 text-left" aria-expanded={comboOpen}>
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-[10px] font-semibold text-fg">组合判断</div><p className="mt-0.5 text-[9px] leading-[1.35] text-muted">{metrics?.combo || "暂无可靠组合判断"}</p></div><span className="shrink-0 text-[8px] text-subtle">{comboOpen ? "收起" : "详情"}</span></div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[7.5px] text-subtle"><span>RSI {formatMetric(metrics?.rsi,1)} · BIAS {formatMetric(metrics?.bias,2)}% · MACD {formatMetric(metrics?.macd,3)}</span><span>置信 {metrics?.conf ?? "—"}</span></div>
          </button>
          {comboOpen ? <div className="border-t border-black/[.04] px-2.5 pb-2.5 pt-2"><div className="grid grid-cols-3 gap-1.5 text-center"><Stat k="RSI" v={formatMetric(metrics?.rsi,1)} /><Stat k="BIAS" v={`${formatMetric(metrics?.bias,2)}%`} /><Stat k="MACD" v={formatMetric(metrics?.macd,3)} /><Stat k="BOLL上轨" v={fmtPrice(metrics?.upper,4)} /><Stat k="BOLL下轨" v={fmtPrice(metrics?.lower,4)} /><Stat k="MA20" v={fmtPrice(metrics?.ma20,4)} /></div></div> : null}
        </div>

        <SwingAdviceCard swing={swing} quote={quote} />
      </> : null}
    </Glass>
  );
}

function SwingAdviceCard({ swing, quote }: { swing: ReturnType<typeof calcSwingTrade>; quote: ReturnType<typeof selectFundDisplayQuote> }) {
  return <section className="band-advice mt-2.5 overflow-hidden rounded-[18px] border border-amber-200/70 bg-amber-50/45 p-2.5" aria-label="卖出提示 做T波段">
    <div className="flex items-center justify-between gap-2"><div><div className="text-[12px] font-semibold text-fg">💰 卖出提示 · 做T/波段</div><div className="text-[8px] text-muted">震荡行情高抛低吸 · 趋势行情禁做T</div></div><span className="rounded-full bg-white/75 px-2 py-1 text-[8px] font-semibold text-amber-700">{swing ? `做T ${swing.env}/100` : "等待数据"}</span></div>
    {!swing ? <div className="mt-2 rounded-[13px] bg-white/62 px-2.5 py-2.5 text-center text-[9px] text-muted">{quote.price == null ? "暂无可靠价格，暂不生成买入/卖出价位。" : "历史指标不足，暂不生成做T计划。"}</div> : <>
      <div className="mt-2 rounded-[14px] bg-white/64 px-2.5 py-2.5 ring-1 ring-white/80"><div className="flex items-center justify-between gap-2"><b className="text-[11px] text-fg">{swing.action}</b><span className="text-[8px] font-medium text-muted">{swing.envLevel}</span></div><div className="mt-0.5 text-[9px] leading-[1.45] text-muted">{swing.reason}</div></div>
      <div className="mt-2 grid grid-cols-2 gap-1.5"><PriceCell label="卖出参考" value={swing.sellGrid} /><PriceCell label="买入/接回参考" value={swing.buyGrid} /></div>
      <div className="mt-1.5 rounded-[14px] bg-white/58 px-2.5 py-2 text-[8px] leading-[1.45] text-muted">{swing.allowT ? "当前允许做T：优先分批，单格不要一次性动用全部仓位。" : "当前不建议强行做T：等待趋势确认，避免卖飞或接下跌刀。"}</div>
    </>}
  </section>;
}
function PriceCell({ label, value }: { label: string; value: number | null }) { return <div className="rounded-[14px] bg-white/70 px-2.5 py-2 text-center"><div className="text-[8px] text-subtle">{label}</div><div className="mt-0.5 text-[15px] font-bold tabular-nums text-fg">{value == null ? "—" : fmtPrice(value, 4)}</div></div>; }
function SignalCard({ title, label, score, tone, subtitle }: { title:string; label:string; score:number|null; tone:"low"|"high"|"neutral"; subtitle:string }) { const pct = score == null ? 50 : Math.max(0, Math.min(100, score)); const labelClass = tone === "low" ? "text-[#66879e]" : tone === "high" ? "text-[#997d6d]" : "text-[#647588]"; return <div className="band-signal min-h-[108px] rounded-[15px] border border-white/80 bg-white/55 px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-[8px] font-medium text-muted">{title}</div><div className={`mt-0.5 text-[17px] font-bold leading-none ${labelClass}`}>{label}</div></div><div className="text-right"><div className="text-[7px] text-subtle">评分</div><div className={`text-[11px] font-bold tabular-nums ${labelClass}`}>{score == null ? "—" : `${score}/100`}</div></div></div><p className="mt-1.5 min-h-[25px] text-[8px] leading-[1.35] text-muted">{subtitle}</p><div className="mt-2 relative h-1.5 overflow-hidden rounded-full" style={{background:"linear-gradient(90deg,#e8c6c3 0%,#eee0c6 25%,#d5dce4 50%,#c3d0df 70%,#c7ddd8 100%)"}}><span className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-slate-400/70 bg-white/92 shadow-sm" style={{left:`calc(${pct}% - 7px)`}} /></div><div className="mt-0.5 flex justify-between text-[6.5px] text-subtle"><span>弱</span><span>中</span><span>强</span></div></div>; }
function trendSubtitle(score:number|null,label:string){if(score==null)return"趋势历史不足，等待更多净值。";if(score>=75)return`当前${label}，多周期方向明确。`;if(score>=60)return`当前${label}，中短期方向偏强。`;if(score>=40)return`当前${label}，多空暂未形成单边。`;if(score>=25)return`当前${label}，多周期动量偏弱。`;return`当前${label}，趋势明显偏弱。`;}
function bandSubtitle(tone:"low"|"high"|"neutral"|undefined,label:string){if(tone==="low")return`当前位置${label}，偏低，观察企稳。`;if(tone==="high")return`当前位置${label}，偏高，注意回撤。`;return`当前位置${label}，中性，等待确认。`;}
function formatMetric(v:number|null|undefined,d:number){return v==null||!Number.isFinite(v)?"—":v.toFixed(d);}
function Stat({k,v}:{k:string;v:string}){return <div className="rounded-[10px] bg-bg-elevated py-1"><div className="text-[7px] text-subtle">{k}</div><div className="text-[9.5px] font-semibold tabular-nums text-fg">{v}</div></div>;}
