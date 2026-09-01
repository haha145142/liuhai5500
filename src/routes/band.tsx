import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EmptyNote, Glass, SectionTitle, Tone, DataStatus } from "@/components/ui/Glass";
import { calcSwingTrade } from "@/lib/calc/indicators";
import { fmtPctShort, fmtPrice } from "@/lib/format";
import { selectFundDisplayQuote } from "@/lib/data/quote-mode";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/band")({ component: BandPage });

function BandPage() {
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  if (!portfolio.length) return <Glass><EmptyNote>添加持仓后，这里会给出 RSI / MACD / 布林 / 做 T 环境。趋势行情禁止做 T。</EmptyNote></Glass>;
  return (
    <div>
      <Glass className="mb-2 p-3">
        <SectionTitle title="📊 波段信号" hint="持仓" />
        <p className="mt-1 text-[10px] leading-[1.4] text-muted">彩虹条一眼看趋势强弱；点开单只基金查看完整指标与做 T 建议。</p>
      </Glass>
      <div className="space-y-2">{portfolio.map((h) => <BandSignalCard key={h.code} holding={h} fund={funds[h.code]} />)}</div>
    </div>
  );
}

function BandSignalCard({ holding, fund }: { holding: typeof useApp extends never ? never : any; fund: any }) {
  const [expanded, setExpanded] = useState(false);
  const m = fund?.metrics;
  const quote = selectFundDisplayQuote(fund);
  const px = quote.price;
  const swing = calcSwingTrade(m ?? null, holding.cost, px ?? 0);
  const statusMode = quote.mode === "live_estimate" ? "live" : quote.mode === "official_today" ? "official" : quote.mode === "latest_official" ? "latest" : "unavailable";
  const score = m?.trendScore ?? null;
  const bandScore = m?.bandScore ?? null;
  return (
    <Glass className="p-3">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-fg">{fund?.name || holding.name}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[9px] text-muted"><span>{holding.code}</span><span>·</span><DataStatus mode={statusMode} detail={quote.dataDate || undefined} /></div>
          </div>
          <Tone v={quote.pct} className="shrink-0 text-[20px] font-bold leading-none">{fmtPctShort(quote.pct)}</Tone>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative h-2 flex-1 overflow-hidden rounded-full" style={{background:"linear-gradient(90deg,#ef5350 0%,#ffca28 25%,#42a5f5 58%,#26a69a 100%)"}}>{score != null ? <span className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-slate-700 bg-white shadow" style={{left:`calc(${Math.max(0,Math.min(100,score))}% - 7px)`}} /> : null}</div>
          <span className="shrink-0 text-[9px] font-semibold text-muted">{m?.trend ?? "—"} {score ?? "—"}</span>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-2 text-[9px] text-muted">
          <span>波段 <b className="text-fg">{m?.band ?? "—"} {bandScore ?? "—"}</b></span>
          <span>趋势 <b className="text-fg">{m?.trend ?? "—"} {score ?? "—"}</b></span>
          <span>信号 <b className="text-fg">{m?.sigStrength ?? "—"}</b></span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[8px] text-subtle"><span>{expanded ? "收起详情" : "点击展开详情"}</span><span>{expanded ? "⌃" : "⌄"}</span></div>
      </button>
      {expanded ? <div className="mt-2 border-t border-black/[.045] pt-2">
        {m ? <div className="grid grid-cols-3 gap-1.5 text-center"><Stat k="RSI" v={Number.isFinite(m.rsi) ? fmtPrice(m.rsi,1) : "—"}/><Stat k="BIAS" v={Number.isFinite(m.bias) ? `${fmtPrice(m.bias,2)}%` : "—"}/><Stat k="MACD" v={Number.isFinite(m.macd) ? fmtPrice(m.macd,3) : "—"}/><Stat k="波段" v={`${m.band ?? "—"} ${m.bandScore ?? "—"}`}/><Stat k="趋势" v={`${m.trend ?? "—"} ${m.trendScore ?? "—"}`}/><Stat k="信号" v={m.sigStrength == null ? "—" : String(m.sigStrength)}/></div> : <p className="text-[10px] text-muted">净值历史不足，指标暂无可靠数据。</p>}
        {swing ? <div className="mt-2 rounded-[15px] bg-bg-elevated p-2"><b className="text-[12px]">{swing.action}</b><p className="mt-0.5 text-[9.5px] leading-[1.45] text-muted">{swing.reason}</p><p className="mt-0.5 text-[9px] text-subtle">做 T 环境 {swing.envLevel}（{swing.env}）{swing.allowT && swing.buyGrid != null && swing.sellGrid != null ? ` · 低吸 ${fmtPrice(swing.buyGrid,4)} / 高抛 ${fmtPrice(swing.sellGrid,4)}` : ""}</p></div> : null}
        {m ? <p className="mt-1.5 text-[9.5px] leading-[1.4] text-muted">{m.combo} · 置信 {m.conf}</p> : null}
      </div> : null}
    </Glass>
  );
}

function Stat({ k, v }: { k: string; v: string }) { return <div className="rounded-[13px] bg-bg-elevated py-1.5"><div className="text-[8px] text-subtle">{k}</div><div className="text-[11px] font-semibold tabular-nums">{v}</div></div>; }
