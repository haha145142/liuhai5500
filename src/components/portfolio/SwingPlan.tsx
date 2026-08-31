import { Tone } from "@/components/ui/Glass";
import { fmtPrice } from "@/lib/format";
import type { FundQuote, Holding } from "@/lib/types";

type Props = { holding: Holding; fund?: FundQuote; price: number | null; officialToday: boolean };

function clamp(v: number, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }

export function SwingPlan({ holding, fund }: Props) {
  const metrics = fund?.metrics ?? null;
  const positionScore = metrics?.bandScore ?? null;
  const trendScore = metrics?.trendScore ?? null;
  const signalStrength = metrics?.sigStrength ?? null;
  const position = metrics?.bandTone === "high" ? "偏高" : metrics?.bandTone === "low" ? "偏低" : "中性";
  const trend = metrics?.trend ? (metrics.trend.includes("弱") || metrics.trend.includes("下") ? "弱势" : metrics.trend.includes("强") || metrics.trend.includes("上") ? "强势" : metrics.trend) : "数据不足";
  const trendWeak = trend === "弱势";
  const name = fund?.name || holding.name || holding.code;
  const combo = metrics?.combo || (trendWeak ? "还在下跌趋势里，即使便宜也别急着买" : "先看趋势确认，不追涨杀跌");
  const confirmationCount = metrics?.sigConds?.length ?? 0;
  const confirmationTotal = Math.max(4, confirmationCount);

  return (
    <section className="mt-3 overflow-hidden rounded-[28px] border border-white/75 bg-white/50 p-4 shadow-[0_18px_48px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[20px] saturate-150">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-white/72 text-[24px] shadow-sm">📊</div><div><div className="text-[23px] font-semibold tracking-tight text-fg">波段信号 · 趋势{trend}</div><div className="mt-0.5 text-sm text-muted">RSI/BIAS/BOLL/MA/MACD</div></div></div>
        <div className="rounded-full bg-blue-100/75 px-3 py-1.5 text-sm font-semibold text-blue-600">{new Date().toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })} {new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</div>
      </div>

      <SignalCard title={`${name} · 波段信号`} label={position} score={positionScore} description={positionScore == null ? "暂无可靠位置数据" : positionScore <= 45 ? "比正常位置便宜一点" : positionScore >= 70 ? "位置偏高，注意追涨风险" : "位置处于中间区域"} signal={signalStrength} confirmation={`${confirmationCount}/${confirmationTotal} 满足 · ${metrics?.sigConds?.[0] || metrics?.trend || "趋势"}`} toneValue={positionScore == null ? null : positionScore - 50} />

      <div className="mt-3 rounded-[26px] border border-white/80 bg-white/58 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.96)]">
        <div className="text-base text-muted">{name} · 趋势{trend}</div>
        <div className="mt-1 text-[31px] font-bold"><Tone v={trendWeak ? -60 : 60}>{trend}</Tone></div>
        <div className="mt-1 text-base text-muted">评分 {trendScore == null ? "—" : Math.round(trendScore)}/100 · {trendWeak ? "走势较弱，短期向下" : "走势偏强，短期向上"}</div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-gradient-to-r from-red-400 via-blue-400 to-emerald-400"><div className="h-full rounded-full" style={{ width: `${clamp(trendScore ?? (trendWeak ? 24 : 72))}%`, maxWidth: "8px", marginLeft: `calc(${clamp(trendScore ?? (trendWeak ? 24 : 72))}% - 4px)`, background: "rgba(22,34,55,.86)", boxShadow: "0 0 0 3px rgba(255,255,255,.92)" }} /></div>
        <div className="mt-3 inline-flex rounded-full bg-blue-100/70 px-3 py-1.5 text-xs font-semibold text-blue-600">{trendWeak ? "弱势" : "强势"}</div>
      </div>

      <div className="mt-4 text-[17px] leading-relaxed text-fg"><b>组合判断（{name}）：</b><span className="text-muted">{combo}</span></div>
      <div className="mt-4 border-t border-black/[.06] pt-4 text-sm leading-relaxed text-muted">指标明细：RSI {metrics?.rsi?.toFixed(1) ?? "—"} · BIAS {metrics?.bias?.toFixed(2) ?? "—"}% · BOLL {fmtPrice(metrics?.lower ?? null, 4)}~{fmtPrice(metrics?.upper ?? null, 4)} · MACD {fmtPrice(metrics?.macd ?? null, 4)} · MA5 {fmtPrice(metrics?.ma5 ?? null, 4)} · MA20 {fmtPrice(metrics?.ma20 ?? null, 4)} · MA60 {fmtPrice(metrics?.ma60 ?? null, 4)}</div>
    </section>
  );
}

function SignalCard({ title, label, score, description, signal, confirmation, toneValue }: { title: string; label: string; score: number | null; description: string; signal: number | null; confirmation: string; toneValue: number | null }) {
  return <div className="mt-3 rounded-[26px] border border-white/80 bg-white/63 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.96)]">
    <div className="text-base text-muted">{title}</div>
    <div className="mt-1 text-[32px] font-bold"><Tone v={toneValue}>{label}</Tone></div>
    <div className="mt-1 text-base text-muted">评分 {score == null ? "—" : Math.round(score)}/100 · {description}</div>
    <div className="mt-4 h-3 overflow-hidden rounded-full bg-gradient-to-r from-red-400 via-blue-400 to-emerald-400"><div className="h-full rounded-full" style={{ width: `${clamp(score ?? 50)}%`, maxWidth: "8px", marginLeft: `calc(${clamp(score ?? 50)}% - 4px)`, background: "rgba(22,34,55,.86)", boxShadow: "0 0 0 3px rgba(255,255,255,.92)" }} /></div>
    <div className="mt-3 inline-flex rounded-full bg-blue-100/70 px-3 py-1.5 text-xs font-semibold text-blue-600">{label}</div>
    <div className="mt-4 border-t border-black/[.06] pt-4"><div className="flex items-center justify-between text-sm text-muted"><span>信号强度</span><span className="text-2xl font-semibold text-fg">{signal == null ? "—" : `${Math.round(signal)}分`}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/80"><div className="h-full rounded-full bg-slate-400" style={{ width: `${clamp(signal ?? 25)}%` }} /></div><div className="mt-2 text-sm text-muted">确认条件：{confirmation}</div></div>
  </div>;
}
