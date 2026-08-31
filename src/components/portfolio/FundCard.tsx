import { useMemo, useState } from "react";
import { SwingPlan } from "@/components/portfolio/SwingPlan";
import { ValuationTrustRow } from "@/components/valuation/ValuationTrustRow";
import { Tone } from "@/components/ui/Glass";
import { calcSixFactor } from "@/lib/calc/six-factor";
import { calcSwingTrade } from "@/lib/calc/indicators";
import { synthesizeSwing } from "@/lib/calc/swing-synthesis";
import { matchFundSector } from "@/lib/data/sectors";
import { buildValuationDisplaySummary } from "@/lib/data/valuation-display";
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
  const [open, setOpen] = useState(false);
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
  const quoteSourceLabel = quote.mode === "official_today" ? "今日官方净值已发布" : quote.mode === "live_estimate" ? `盘中自算估值 · ${quote.confidence === "high" ? "高" : "中"}置信度` : quote.mode === "latest_official" ? "最近官方净值" : "暂无可靠行情";
  const estimateAudit = fund?.estimateMethod ? `${fund.estimateMethod} · 覆盖 ${fund.estimateCoverage?.toFixed(1) ?? "—"}% · ${fund.estimateValidation || "待验证"}${fund.estimateDeviation != null ? ` · 偏差 ${fund.estimateDeviation.toFixed(2)}个百分点` : ""}` : null;
  const valuationSummary = fund ? buildValuationDisplaySummary({
    valuationStatus: fund.valuationStatus,
    estimateConfidence: fund.estimateConfidence,
    estimateCoverage: fund.estimateCoverage,
    estimateValidation: fund.estimateValidation,
  }) : null;
  const signalTone = synthesis ? (synthesis.score >= 65 ? "up" : synthesis.score <= 40 ? "down" : "flat") : "flat";

  return (
    <article className="glass mb-3 overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-semibold tracking-tight text-fg">{fund?.name || holding.name || holding.code}</div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted"><span>{holding.code}</span><span>·</span><span>{quote.label}</span></div>
        </div>
        <div className="shrink-0 text-right">
          <Tone v={day} className="text-[25px] font-bold leading-none tracking-tight">{fmtPctShort(day)}</Tone>
          <div className="mt-1 text-[10px] text-subtle">{quote.mode === "official_today" ? "官方净值" : quote.mode === "live_estimate" ? "盘中估值" : quote.mode === "latest_official" ? "最近净值" : "涨跌暂无"}</div>
        </div>
      </div>

      <div className="mt-3 rounded-[20px] border border-white/55 bg-white/45 p-3 shadow-sm backdrop-blur-[6px]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] text-muted">当前价格</div>
            <div className="mt-1 text-[22px] font-bold tabular-nums tracking-tight">{fmtPrice(px, 4)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted">持仓市值</div>
            <div className="mt-1 text-[18px] font-semibold tabular-nums">{fmtMoney(value)}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted">
          <span>{quoteSourceLabel}</span>
          <span className="shrink-0">成本 {fmtPrice(holding.cost, 4)} · {holding.shares} 份</span>
        </div>
        {fund?.nav != null || fund?.estimate != null ? (
          <div className="mt-2 rounded-xl bg-bg-elevated/75 px-2.5 py-2 text-[10px] text-muted">
            {fund?.nav != null ? `官方 ${fmtPrice(fund.nav, 4)} · ${fund.navDate || "日期未知"}` : "官方净值暂无"}
            {fund?.estimate != null ? `  ·  自算 ${fmtPrice(fund.estimate, 4)}${fund.estimateTime ? ` · ${fund.estimateTime}` : ""}` : ""}
          </div>
        ) : null}
        {valuationSummary ? (
          <div className="mt-2">
            <ValuationTrustRow summary={{
              modeLabel: valuationSummary.mode,
              coverageLabel: valuationSummary.coverage,
              validationLabel: valuationSummary.validation,
              historyLabel: valuationSummary.history,
            }} />
          </div>
        ) : null}
        {estimateAudit ? <div className="mt-2 text-[10px] text-subtle">估值审计 · {estimateAudit}</div> : null}
        {estimateGap != null ? <div className="mt-1 text-[10px] text-subtle">估值相对最近官方净值 <Tone v={estimateGap}>{fmtPctShort(estimateGap)}</Tone></div> : null}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="持有收益" value={fmtMoney(pnl)} tone={pnl} />
        <Metric label="收益率" value={fmtPctShort(pnlPct)} tone={pnlPct} />
        <Metric label="今日" value={fmtMoney(value != null && day != null ? value * day / 100 : null)} tone={day} />
      </div>

      {synthesis ? (
        <div className="mt-3 rounded-[20px] bg-bg-elevated p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] text-subtle">综合波段</div>
              <div className="mt-0.5 flex items-baseline gap-2"><b className="text-[20px]">{synthesis.score}</b><span className="text-xs font-semibold text-fg">{synthesis.level}</span></div>
            </div>
            <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${signalTone === "up" ? "bg-red-500/10 text-up" : signalTone === "down" ? "bg-emerald-500/10 text-down" : "bg-slate-500/10 text-muted"}`}>{synthesis.confidence}置信</div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80"><div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, synthesis.score))}%` }} /></div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px] text-muted">
            <Metric label="方向" value={`${synthesis.level} · ${synthesis.trend}`} />
            <Metric label="位置" value={synthesis.position} />
            <Metric label="主题" value={sector?.change != null ? fmtPctShort(sector.change) : "未验证"} />
          </div>
        </div>
      ) : null}

      {fund?.metrics ? (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-bg-elevated px-3 py-2.5">
          <div><div className="text-[10px] text-subtle">技术状态</div><div className="mt-0.5 text-sm font-semibold">{fund.metrics.band} · {fund.metrics.trend}</div></div>
          <div className="text-right"><div className="text-[10px] text-subtle">RSI</div><div className="text-sm font-semibold tabular-nums">{fund.metrics.rsi.toFixed(1)}</div></div>
          <div className="text-right"><div className="text-[10px] text-subtle">波段</div><div className="text-sm font-semibold tabular-nums text-accent">{fund.metrics.bandScore}</div></div>
        </div>
      ) : <p className="mt-3 text-[11px] text-muted">净值历史不足 35 个交易日，暂不生成可靠波段信号。</p>}

      <button type="button" className="mt-3 flex w-full items-center justify-between rounded-2xl bg-bg-elevated px-3 py-2.5 text-left text-xs font-semibold text-fg" onClick={() => setOpen((v) => !v)}>
        <span>{open ? "收起详细依据" : "查看详细依据"}</span>
        <span className="text-subtle">{open ? "收起" : "展开"}</span>
      </button>

      {open ? (
        <div className="mt-2 space-y-2 rounded-2xl bg-white/40 p-3 text-[11px] leading-relaxed text-muted">
          <p><b className="text-fg">综合判断：</b>{fund?.metrics?.combo || "暂无可靠波段结论"}</p>
          {swing ? <p><b className="text-fg">波段建议：</b>{swing.reason} · 环境 {swing.envLevel}</p> : null}
          {fund?.metrics ? <p>MACD {fund.metrics.macd.toFixed(4)} · BIAS {fund.metrics.bias.toFixed(2)}% · DIF {fund.metrics.dif.toFixed(4)} · DEA {fund.metrics.dea.toFixed(4)}</p> : null}
          {fund?.metrics?.sigConds.length ? <p>触发条件：{fund.metrics.sigConds.join(" · ")}</p> : null}
          {synthesis?.support.length ? <p><b className="text-fg">支持：</b>{synthesis.support.join(" · ")}</p> : null}
          {synthesis?.risks.length ? <p><b className="text-fg">风险：</b>{synthesis.risks.join(" · ")}</p> : null}
          <div className="text-[10px] text-subtle">{synthesis?.basis || six?.basis || "暂无额外验证依据"}</div>
        </div>
      ) : null}

      <SwingPlan holding={holding} fund={fund} price={px} officialToday={quote.mode === "official_today"} />

      {mapped ? <div className="mt-3 rounded-2xl bg-accent/8 p-3 text-[11px] text-muted"><b className="text-fg">映射板块：{mapped.name}</b>{sector?.change != null ? <span> · 今日 <Tone v={sector.change}>{fmtPctShort(sector.change)}</Tone></span> : " · 暂无板块行情"}{six ? <div className="mt-1">组合判断：{six.advice} · 置信 {six.confidence}% · {six.basis}</div> : null}</div> : null}

      {editing ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input value={shares} onChange={(e) => setShares(e.target.value)} inputMode="decimal" className="h-10 rounded-xl bg-bg-elevated px-3 text-sm ring-1 ring-border" placeholder="份额" />
          <input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" className="h-10 rounded-xl bg-bg-elevated px-3 text-sm ring-1 ring-border" placeholder="成本价" />
          <button type="button" onClick={saveEdit} className="rounded-xl bg-accent py-2 text-sm font-semibold text-accent-fg">保存修改</button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-xl bg-bg-elevated py-2 text-sm font-semibold">取消</button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setEditing(true)} className="flex-1 rounded-xl bg-bg-elevated py-2 text-sm">编辑持仓</button>
          <button type="button" onClick={onRemove} className="flex-1 rounded-xl bg-bg-elevated py-2 text-sm text-up">删除</button>
        </div>
      )}
    </article>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return <div className="rounded-xl bg-white/45 px-1.5 py-2 text-center"><div className="text-[10px] text-subtle">{label}</div>{tone === undefined ? <div className="mt-0.5 text-xs font-semibold text-fg tabular-nums">{value}</div> : <Tone v={tone} className="mt-0.5 block text-xs font-semibold">{value}</Tone>}</div>;
}
