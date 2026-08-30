import { useMemo, useState } from "react";
import { SwingPlan } from "@/components/portfolio/SwingPlan";
import { Tone } from "@/components/ui/Glass";
import { calcSixFactor } from "@/lib/calc/six-factor";
import { calcSwingTrade } from "@/lib/calc/indicators";
import { synthesizeSwing } from "@/lib/calc/swing-synthesis";
import { matchFundSector } from "@/lib/data/sectors";
import { selectFundDisplayQuote } from "@/lib/data/quote-mode";
import { fmtMoney, fmtPctShort, fmtPrice } from "@/lib/format";
import type { FundQuote, Holding, SectorQuote } from "@/lib/types";

function periodReturn(fund: FundQuote | undefined, tradingDays: number, current: number | null) {
  if (!fund || current == null || fund.history.length <= tradingDays) return null;
  const base = fund.history[fund.history.length - 1 - tradingDays];
  return base ? ((current - base) / base) * 100 : null;
}

export function FundCard({ holding, fund, sector, benchPct, onRemove, onUpdate }: {
  holding: Holding; fund?: FundQuote; sector?: SectorQuote; benchPct: number | null; onRemove: () => void; onUpdate: (patch: Partial<Holding>) => void;
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [shares, setShares] = useState(String(holding.shares));
  const [cost, setCost] = useState(String(holding.cost));
  const quote = selectFundDisplayQuote(fund);
  const px = quote.price;
  const day = quote.pct;
  const value = px != null ? px * holding.shares : null;
  const costVal = holding.cost * holding.shares;
  const pnl = value != null ? value - costVal : null;
  const pnlPct = value != null && costVal ? (pnl! / costVal) * 100 : null;
  const mapped = matchFundSector(fund?.name || holding.name || holding.code);
  const six = sector && sector.available ? calcSixFactor(sector, benchPct) : null;
  const swing = calcSwingTrade(fund?.metrics ?? null, holding.cost, px);
  const synthesis = synthesizeSwing(fund?.metrics ?? null, sector ?? null);
  const estimateGap = fund?.estimate != null && fund.nav ? ((fund.estimate - fund.nav) / fund.nav) * 100 : null;
  const periods = useMemo(() => [["1周", 5], ["1月", 20], ["3月", 60], ["6月", 120], ["1年", 250]] as const, []);
  const saveEdit = () => { const s = Number(shares); const c = Number(cost); if (s > 0 && c > 0) { onUpdate({ shares: s, cost: c }); setEditing(false); } };
  const quoteSourceLabel = quote.mode === "official_today" ? "今日官方净值已发布，采用正式净值" : quote.mode === "live_estimate" ? `官方今日净值尚未发布，使用盘中自算估值${quote.confidence !== "high" ? "（中置信度）" : "（高置信度）"}` : quote.mode === "latest_official" ? "非交易时段采用最近官方净值" : "没有可靠行情，仅保留本地持仓计算";
  const estimateAudit = fund?.estimateMethod ? `${fund.estimateMethod} · 覆盖 ${fund.estimateCoverage?.toFixed(1) ?? "—"}% · 验证 ${fund.estimateValidation || "待验证"}${fund.estimateDeviation != null ? ` · 偏差 ${fund.estimateDeviation.toFixed(2)}个百分点` : ""}` : null;
  return (
    <article className="glass mb-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><div className="text-lg font-semibold text-fg">{fund?.name || holding.name || holding.code} <span className="text-xs font-normal text-muted">{holding.code}</span></div><div className="mt-1 text-xs text-muted">{quote.label} · {fund?.source || "等待数据"}</div></div>
        <div className="text-right"><Tone v={day} className="text-2xl font-semibold">{fmtPctShort(day)}</Tone><div className="text-[10px] text-muted">{quote.mode === "official_today" ? "官方净值涨跌" : quote.mode === "live_estimate" ? "盘中自算估值涨跌" : quote.mode === "latest_official" ? "最近官方净值涨跌" : "暂无可靠涨跌"}</div></div>
      </div>
      <div className="mt-4 rounded-2xl bg-white/60 p-3 ring-1 ring-white/70"><div className="grid grid-cols-2 gap-3"><div><div className="text-xs text-muted">当前价格</div><div className="mt-1 text-xl font-semibold tabular-nums">{fmtPrice(px, 4)}</div></div><div className="text-right"><div className="text-xs text-muted">持仓市值</div><div className="mt-1 text-xl font-semibold tabular-nums">{fmtMoney(value)}</div></div></div><div className="mt-2 text-[11px] text-muted">{fund?.nav != null ? `官方净值 ${fmtPrice(fund.nav, 4)} · ${fund.navDate || "日期未知"}` : "官方净值暂无"}{fund?.estimate != null ? ` · 自算盘中 ${fmtPrice(fund.estimate, 4)}${fund.estimateTime ? ` · ${fund.estimateTime}` : ""}` : ""}</div><div className="mt-1 text-[11px] font-semibold text-fg">口径：{quoteSourceLabel}</div>{estimateAudit ? <div className="mt-1 text-[11px] text-muted">估值审计：{estimateAudit}</div> : null}{estimateGap != null ? <div className="mt-1 text-[11px] text-muted">估值校验：相对最近官方净值 <Tone v={estimateGap}>{fmtPctShort(estimateGap)}</Tone></div> : null}</div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] text-muted"><Metric label="持仓金额" value={fmtMoney(value)} /><Metric label="持有收益" value={fmtMoney(pnl)} tone={pnl} /><Metric label="收益率" value={fmtPctShort(pnlPct)} tone={pnlPct} /><Metric label="成本" value={fmtPrice(holding.cost, 4)} /></div>
      <div className="mt-3 rounded-2xl bg-bg-elevated p-3"><div className="flex items-center justify-between"><b className="text-sm">最近收益</b><span className="text-[10px] text-muted">按基金净值历史回算</span></div><div className="mt-2 grid grid-cols-5 gap-1.5">{periods.map(([label, days]) => { const r = periodReturn(fund, days, fund?.nav ?? null); return <div key={label} className="rounded-xl bg-white/60 px-1 py-2 text-center"><div className="text-[10px] text-muted">{label}</div><Tone v={r} className="mt-0.5 block text-xs font-semibold">{fmtPctShort(r)}</Tone></div>; })}</div>{fund?.history.length ? <div className="mt-2 text-[11px] text-muted">最近一周 <Tone v={periodReturn(fund, 5, fund.nav)}>{fmtPctShort(periodReturn(fund, 5, fund.nav))}</Tone> · 最近一月 <Tone v={periodReturn(fund, 20, fund.nav)}>{fmtPctShort(periodReturn(fund, 20, fund.nav))}</Tone></div> : null}</div>
      {synthesis ? <div className="mt-3 rounded-2xl bg-bg-elevated p-3"><div className="flex items-center justify-between"><b className="text-sm">综合波段信号</b><div className="flex items-center gap-2"><span className="text-xs font-semibold text-accent">{synthesis.score}/100</span><span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold">{synthesis.confidence}置信</span></div></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-accent" style={{ width: `${synthesis.score}%` }} /></div><div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]"><Metric label="方向" value={`${synthesis.level} · ${synthesis.trend}`} /><Metric label="位置" value={synthesis.position} /><Metric label="主题" value={sector?.change != null ? fmtPctShort(sector.change) : "未验证"} /></div>{synthesis.support.length ? <div className="mt-2 text-[11px] text-muted">支持：{synthesis.support.join(" · ")}</div> : null}{synthesis.risks.length ? <div className="mt-1 text-[11px] text-muted">风险：{synthesis.risks.join(" · ")}</div> : null}<div className="mt-1 text-[10px] text-subtle">{synthesis.basis}</div></div> : null}
      {fund?.metrics ? <div className="mt-3 rounded-2xl bg-bg-elevated p-3"><div className="flex items-center justify-between"><b className="text-sm">波段信号 · {fund.metrics.band}</b><span className="text-xs font-semibold text-accent">{fund.metrics.bandScore}/100</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-accent" style={{ width: `${fund.metrics.bandScore}%` }} /></div><div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]"><Metric label="趋势" value={`${fund.metrics.trend} ${fund.metrics.trendScore}`} /><Metric label="RSI" value={fund.metrics.rsi.toFixed(1)} /><Metric label="信号强度" value={`${fund.metrics.sigStrength}`} /></div><div className="mt-2 flex flex-wrap gap-1.5"><Tag>{fund.metrics.band}</Tag><Tag>{fund.metrics.trend}</Tag><Tag>{`RSI ${fund.metrics.rsi.toFixed(0)}`}</Tag><Tag>{`BOLL ${fmtPrice(fund.metrics.lower, 4)} / ${fmtPrice(fund.metrics.upper, 4)}`}</Tag>{swing ? <Tag>{swing.action}</Tag> : null}</div></div> : <p className="mt-3 text-xs text-muted">净值历史不足 35 个交易日，暂不生成可靠波段信号。</p>}
      <SwingPlan holding={holding} fund={fund} price={px} officialToday={quote.mode === "official_today"} />
      {mapped ? <div className="mt-3 rounded-2xl bg-accent/8 p-3 text-xs text-muted"><b className="text-fg">映射板块：{mapped.name}</b>{sector?.change != null ? <span> · 今日 <Tone v={sector.change}>{fmtPctShort(sector.change)}</Tone></span> : " · 暂无板块行情"}{six ? <div className="mt-1">组合判断：{six.advice} · 置信 {six.confidence}% · {six.basis}</div> : null}</div> : null}
      <button type="button" className="mt-3 w-full rounded-2xl bg-bg-elevated py-2 text-sm font-semibold text-fg" onClick={() => setOpen((v) => !v)}>{open ? "收起原因与指标" : "为什么涨跌 / 波段建议"}</button>
      {open ? <div className="mt-3 space-y-2 rounded-2xl bg-white/55 p-3 text-xs leading-relaxed text-muted"><p><b className="text-fg">综合判断：</b>{fund?.metrics?.combo || "暂无可靠波段结论"}</p>{swing ? <p><b className="text-fg">波段建议：</b>{swing.reason} · 环境 {swing.envLevel}</p> : null}{fund?.metrics ? <p>MACD {fund.metrics.macd.toFixed(4)} · BIAS {fund.metrics.bias.toFixed(2)}% · DIF {fund.metrics.dif.toFixed(4)} · DEA {fund.metrics.dea.toFixed(4)}</p> : null}{fund?.metrics?.sigConds.length ? <p>触发条件：{fund.metrics.sigConds.join(" · ")}</p> : null}</div> : null}
      {editing ? <div className="mt-3 grid grid-cols-2 gap-2"><input value={shares} onChange={(e) => setShares(e.target.value)} inputMode="decimal" className="h-10 rounded-xl bg-bg-elevated px-3 text-sm ring-1 ring-border" placeholder="份额" /><input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" className="h-10 rounded-xl bg-bg-elevated px-3 text-sm ring-1 ring-border" placeholder="成本价" /><button type="button" onClick={saveEdit} className="rounded-xl bg-accent py-2 text-sm font-semibold text-accent-fg">保存修改</button><button type="button" onClick={() => setEditing(false)} className="rounded-xl bg-bg-elevated py-2 text-sm font-semibold">取消</button></div> : <div className="mt-3 flex gap-2"><button type="button" onClick={() => setEditing(true)} className="flex-1 rounded-xl bg-bg-elevated py-2 text-sm">编辑</button><button type="button" onClick={onRemove} className="flex-1 rounded-xl bg-bg-elevated py-2 text-sm text-up">删除</button></div>}
    </article>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: number | null }) { return <div className="rounded-xl bg-white/55 px-1.5 py-2 text-center"><div className="text-[10px] text-subtle">{label}</div>{tone === undefined ? <div className="mt-0.5 text-xs font-semibold text-fg tabular-nums">{value}</div> : <Tone v={tone} className="mt-0.5 block text-xs font-semibold">{value}</Tone>}</div>; }
function Tag({ children }: { children: string }) { return <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-fg ring-1 ring-white/70">{children}</span>; }
