import { useEffect, useMemo, useState } from "react";
import { Tone } from "@/components/ui/Glass";
import { calcSixFactor } from "@/lib/calc/six-factor";
import { calcSwingTrade } from "@/lib/calc/indicators";
import { synthesizeSwing } from "@/lib/calc/swing-synthesis";
import { calcHoldingReturn } from "@/lib/calc/portfolio-returns";
import { calcFundPeriodReturn, type FundPeriodId } from "@/lib/calc/portfolio-periods";
import { inferHoldingEntryDate } from "@/lib/calc/holding-entry-date";
import { matchFundSector } from "@/lib/data/sectors";
import { fmtMoney, fmtPctShort, fmtPrice } from "@/lib/format";
import type { FundQuote, Holding, SectorQuote } from "@/lib/types";

type Period = FundPeriodId;

function formatEstimateTime(value: string | null | undefined) {
  if (!value) return "当前";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value.slice(0, 16)
    : date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function todayAdvice(synthesis: ReturnType<typeof synthesizeSwing>) {
  if (!synthesis) return { label: "观望", reason: "暂无足够的价格指标生成可靠建议" };
  if (synthesis.position === "高位" && synthesis.trend !== "向下") return { label: "不追高", reason: synthesis.risks[0] || `当前位置偏高 · 趋势${synthesis.trend}` };
  if (synthesis.position === "低位" && synthesis.trend === "向上") return { label: "分批加仓", reason: synthesis.support[0] || "低位且趋势向上" };
  if (synthesis.level === "偏弱" || synthesis.trend === "向下") return { label: "观望", reason: synthesis.risks[0] || `趋势${synthesis.trend} · 综合${synthesis.level}` };
  if (synthesis.trend === "震荡") return { label: "做T", reason: synthesis.support[0] || synthesis.risks[0] || "短线震荡，适合控制节奏" };
  return { label: "观望", reason: synthesis.support[0] || `趋势${synthesis.trend} · 位置${synthesis.position}` };
}

function valuationConfidence(fund?: FundQuote) {
  if (!fund || fund.estimate == null || fund.valuationStatus !== "estimate") return null;
  const routes = fund.estimateRoutes ?? [];
  const values = routes.map((r) => r.pct).filter((v): v is number => v != null && Number.isFinite(v));
  const routeScore = Math.min(30, (values.length / 3) * 30);
  const spread = fund.estimateRouteSpreadPct;
  const consistencyScore = spread == null ? 0 : Math.max(0, Math.min(25, (1 - Math.min(spread, 2) / 2) * 25));
  const coverage = typeof fund.estimateCoverage === "number" ? Math.max(0, Math.min(100, fund.estimateCoverage)) : null;
  const coverageScore = coverage == null ? 0 : (coverage / 100) * 20;
  const usable = fund.usableWeight ?? 0;
  const checked = fund.crossCheckedWeightPct ?? 0;
  const crossScore = usable > 0 ? Math.max(0, Math.min(15, (checked / usable) * 15)) : routes[0]?.source?.includes("双源") ? 15 : 0;
  const ageSec = fund.estimateTime ? Math.max(0, (Date.now() - new Date(fund.estimateTime).getTime()) / 1000) : Infinity;
  const freshnessScore = ageSec <= 30 ? 10 : ageSec <= 60 ? 8 : ageSec <= 120 ? 5 : ageSec <= 300 ? 2 : 0;
  const score = Math.round(Math.max(0, Math.min(100, routeScore + consistencyScore + coverageScore + crossScore + freshnessScore)));
  return {
    score,
    label: score >= 80 ? "高" : score >= 60 ? "中" : "低",
    routeScore: Math.round(routeScore),
    consistencyScore: Math.round(consistencyScore),
    coverageScore: Math.round(coverageScore),
    crossScore: Math.round(crossScore),
    freshnessScore,
  };
}

export function FundCard({
  holding,
  fund,
  sector,
  benchPct,
  totalMarketValue,
  onRemove,
  onUpdate,
  expandedOverride = null,
}: {
  holding: Holding;
  fund?: FundQuote;
  sector?: SectorQuote;
  benchPct: number | null;
  totalMarketValue: number;
  onRemove: () => void;
  onUpdate: (patch: Partial<Holding>) => void;
  expandedOverride?: boolean | null;
}) {
  const [period, setPeriod] = useState<Period>("week");
  const [expanded, setExpanded] = useState(true);
  const [whyOpen, setWhyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [shares, setShares] = useState(String(holding.shares));
  const [cost, setCost] = useState(String(holding.cost));

  useEffect(() => {
    if (expandedOverride != null) setExpanded(expandedOverride);
  }, [expandedOverride]);

  useEffect(() => {
    setShares(String(holding.shares));
    setCost(String(holding.cost));
  }, [holding.cost, holding.shares]);

  const name = fund?.name || holding.name || holding.code;
  const ret = calcHoldingReturn(holding, fund);
  const useEstimate = ret.quoteMode === "live_estimate";
  const px = ret.price;
  const mapped = matchFundSector(name);
  const six = sector?.available ? calcSixFactor(sector, benchPct) : null;
  const swing = calcSwingTrade(fund?.metrics ?? null, holding.cost, px ?? 0);
  const synthesis = synthesizeSwing(fund?.metrics ?? null, sector ?? null);
  const advice = todayAdvice(synthesis);
  const selected = useMemo(() => calcFundPeriodReturn(period, holding, fund), [fund, holding, period]);
  const selectedLabel = period === "week" ? "近1周收益" : period === "month" ? "近1月收益" : period === "quarter" ? "近3月收益" : period === "half" ? "近6月收益" : "近1年收益";
  const holdingPct = ret.marketValue != null && totalMarketValue > 0 ? (ret.marketValue / totalMarketValue) * 100 : null;
  const trend = fund?.metrics?.trend ?? "—";
  const score = fund?.metrics?.trendScore ?? null;
  const useOfficial = fund?.officialNavPublished === true && fund.valuationStatus === "official_nav";
  const quoteDate = useEstimate ? formatEstimateTime(fund?.estimateTime) : fund?.navDate || "";
  const statusText = useEstimate
    ? `盘中实时估值 · ${quoteDate}`
    : useOfficial
      ? `今日官方净值 · ${quoteDate || "已发布"}`
      : fund?.nav != null
        ? `最近官方净值 · ${quoteDate || "未知日期"}`
        : "暂无可靠净值";
  const estimateDisagreement = fund?.estimateRouteWarning != null || (fund?.estimateDeviation != null && fund.estimateDeviation > 0.8);
  const confidence = valuationConfidence(fund);
  const referenceNav = fund?.nav ?? null;
  const referenceDate = fund?.navDate ?? null;
  const entryEstimate = inferHoldingEntryDate(fund?.historyPoints, holding.cost);
  const entryDate = holding.purchaseDate || entryEstimate.date;
  const entryDays = entryDate ? Math.max(0, Math.floor((Date.now() - new Date(`${entryDate}T00:00:00+08:00`).getTime()) / 86_400_000)) : entryEstimate.days;
  const entrySource = holding.purchaseDate ? holding.purchaseDateSource === "manual" ? "手动" : "已保存估算" : entryEstimate.date ? "按历史净值匹配" : null;

  const saveEdit = () => {
    const nextShares = Number(shares);
    const nextCost = Number(cost);
    if (nextShares > 0 && nextCost > 0) {
      const nextEntry = inferHoldingEntryDate(fund?.historyPoints, nextCost);
      onUpdate({
        shares: nextShares,
        cost: nextCost,
        purchaseDate: nextEntry.date ?? null,
        purchaseDateSource: nextEntry.date ? "estimated" : null,
      });
      setEditing(false);
    }
  };

  return (
    <article className="fund-card-v9 mb-2 overflow-hidden rounded-[21px] border border-white/78 bg-white/60 p-3 shadow-[0_10px_28px_rgba(38,78,112,.06),inset_0_1px_0_rgba(255,255,255,.98)] backdrop-blur-[16px] saturate-150">
      <button type="button" onClick={() => { setExpanded((v) => !v); setWhyOpen(false); }} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold leading-[1.25] tracking-tight text-fg">{name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-muted"><span>{holding.code}</span><span>·</span><span>{statusText}</span></div>
          </div>
          <div className="shrink-0 text-right">
            <Tone v={ret.todayPnlPct} className="text-[20px] font-bold leading-none">{ret.todayPnlPct == null ? "—" : fmtPctShort(ret.todayPnlPct)}</Tone>
            <div className="mt-0.5 text-[8px] text-muted">{useEstimate ? "盘中" : useOfficial ? "官方" : ret.quoteMode === "latest_official" ? "最近净值" : "待更新"}</div>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "linear-gradient(90deg,#ef5350 0%,#ffca28 25%,#42a5f5 58%,#26a69a 100%)" }}>
            {score != null ? <span className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-slate-700 bg-white shadow" style={{ left: `calc(${Math.max(0, Math.min(100, score))}% - 6px)` }} /> : null}
          </div>
          <span className="shrink-0 text-[9px] font-semibold text-muted">{trend} {score ?? "—"}</span>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[9px] text-muted">
          <span>持仓 {fmtMoney(ret.marketValue)}</span>
          <Tone v={ret.holdingPnl}>持有 {ret.holdingPnl == null ? "—" : fmtMoney(ret.holdingPnl)}</Tone>
          <Tone v={ret.holdingPnlPct}>收益率 {ret.holdingPnlPct == null ? "—" : fmtPctShort(ret.holdingPnlPct)}</Tone>
        </div>
        {entryDate ? <div className="mt-1.5 flex items-center justify-between rounded-xl bg-blue-50/55 px-2 py-1 text-[8px] text-slate-500"><span>买入日约 {entryDate}{entrySource ? ` · ${entrySource}` : ""}</span><b className="text-blue-700">持有 {entryDays ?? "—"} 天</b></div> : null}
        {estimateDisagreement ? <div className="mt-1.5 rounded-xl bg-red-50/70 px-2 py-1 text-[8px] leading-[1.4] text-red-500">三路估值分歧超过阈值，当前盘中估值仅供参考{fund?.estimateRouteSpreadPct != null ? ` · 分歧 ${fund.estimateRouteSpreadPct.toFixed(2)}%` : ""}</div> : null}
        <div className="mt-1.5 flex items-center justify-between text-[8px] text-subtle"><span>{expanded ? "收起详情" : "点击查看详情"}</span><span className="inline-flex size-6 items-center justify-center rounded-full bg-white/70 text-[14px] text-slate-500 shadow-sm ring-1 ring-white/90">{expanded ? "⌃" : "⌄"}</span></div>
      </button>

      {expanded ? (
        <div className="mt-2.5 border-t border-black/[.045] pt-2.5">
          <div className="rounded-[16px] bg-white/58 px-2.5 py-2">
            <div className="grid grid-cols-4 gap-1 text-[8px] text-muted"><span>持仓金额</span><span>持有收益</span><span>今日收益</span><span>昨日收益</span></div>
            <div className="mt-0.5 grid grid-cols-4 gap-1">
              <b className="text-[10px] tabular-nums">{fmtMoney(ret.marketValue)}</b>
              <Tone v={ret.holdingPnl} className="text-[10px] font-semibold tabular-nums">{fmtMoney(ret.holdingPnl)}</Tone>
              <Tone v={ret.todayPnl} className="text-[10px] font-semibold tabular-nums">{ret.todayPnl == null ? "—" : fmtMoney(ret.todayPnl)}</Tone>
              <Tone v={ret.previousOfficialNav != null && px != null ? (px - ret.previousOfficialNav) * holding.shares : null} className="text-[10px] font-semibold tabular-nums">{ret.previousOfficialNav != null && px != null ? fmtMoney((px - ret.previousOfficialNav) * holding.shares) : "—"}</Tone>
            </div>
          </div>

          <div className="mt-1.5 rounded-[16px] bg-white/54 px-2.5 py-2">
            <div className="flex items-center justify-between"><span className="text-[8px] text-muted">持仓成本 {fmtMoney(ret.costValue)}</span><b className="text-[15px] tabular-nums">{fmtMoney(ret.marketValue)}</b></div>
            <div className="mt-0.5 text-[8px] text-muted">持仓占比 <span className="float-right text-[10px] font-semibold text-fg">{holdingPct == null ? "—" : `${holdingPct.toFixed(1)}%`}</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200/80"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, holdingPct ?? 0))}%` }} /></div>
            <div className="mt-0.5 text-[8px] text-muted">持有收益率 <Tone v={ret.holdingPnlPct}>{fmtPctShort(ret.holdingPnlPct)}</Tone></div>
          </div>

          <div className="mt-1.5 rounded-[16px] bg-blue-50/45 px-2.5 py-2 ring-1 ring-blue-100/60">
            <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-semibold text-fg">净值基准</span><span className="text-[8px] text-muted">{referenceDate || "日期未知"}</span></div>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <div className="rounded-[12px] bg-white/72 px-2 py-1.5"><div className="text-[8px] text-muted">参考净值</div><div className="mt-0.5 text-[13px] font-bold tabular-nums text-fg">{referenceNav == null ? "—" : fmtPrice(referenceNav, 4)}</div></div>
              <div className="rounded-[12px] bg-white/72 px-2 py-1.5"><div className="text-[8px] text-muted">当前计价</div><div className="mt-0.5 text-[13px] font-bold tabular-nums text-fg">{px == null ? "—" : fmtPrice(px, 4)}</div></div>
            </div>
            <div className="mt-1 text-[8px] leading-[1.4] text-muted">盘中：参考净值为最近官方净值，当前计价为实时估值；收盘并确认官方净值后，当前计价自动切换为官方净值。</div>
          </div>

          {synthesis ? (
            <div className="mt-1.5 rounded-[16px] bg-blue-50/46 px-2.5 py-2 ring-1 ring-blue-100/60">
              <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-semibold text-fg">今天建议</span><span className="rounded-full bg-white/72 px-2 py-0.5 text-[9px] font-semibold text-blue-700">{advice.label}</span></div>
              <div className="mt-1 text-[8px] leading-[1.45] text-muted">{advice.reason} · 趋势{synthesis.trend} · 位置{synthesis.position} · 置信{synthesis.confidence}</div>
            </div>
          ) : <div className="mt-1.5 rounded-[16px] bg-white/50 px-2.5 py-2 text-[8px] text-muted">今天建议：观望 · 暂无足够指标</div>}

          {confidence ? (
            <div className="mt-1.5 rounded-[16px] bg-white/58 px-2.5 py-2 ring-1 ring-white/80">
              <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-semibold text-fg">估值可信度</span><span className="rounded-full bg-blue-50/90 px-2 py-0.5 text-[9px] font-bold text-blue-700">{confidence.score}/100 · {confidence.label}</span></div>
              <div className="mt-1.5 grid grid-cols-4 gap-1 text-[8px] text-muted"><span>路线 {confidence.routeScore}/30</span><span>一致 {confidence.consistencyScore}/25</span><span>覆盖 {confidence.coverageScore}/20</span><span>核验 {confidence.crossScore}/15</span></div>
              <div className="mt-1 text-[8px] text-muted">新鲜度 {confidence.freshnessScore}/10 · 基于当前三路估值数量、路线分歧、覆盖、核验和估值时间。</div>
            </div>
          ) : null}

          {fund?.estimateRoutes?.length ? (
            <div className="mt-1.5 rounded-[16px] bg-slate-50/72 px-2.5 py-2">
              <div className="flex items-center justify-between"><span className="text-[9px] font-semibold text-fg">盘中实时估值（三路）</span><span className="text-[8px] text-muted">30秒刷新 · 收盘切官方</span></div>
              <div className="mt-1.5 space-y-1">{fund.estimateRoutes.map((route) => <div key={route.label} className="flex items-center justify-between gap-2 text-[8px]"><span className="truncate text-muted">{route.label}</span><Tone v={route.pct} className="font-semibold">{route.pct == null ? "—" : fmtPctShort(route.pct)}</Tone></div>)}</div>
              <div className="mt-1 text-[8px] leading-[1.4] text-muted">{fund.estimateRouteWarning ? `⚠️ ${fund.estimateRouteWarning}` : "三路取中位数作为最终参考估值。"}</div>
            </div>
          ) : null}

          <div className="mt-1.5 grid grid-cols-5 gap-1 rounded-[16px] bg-white/54 p-0.5 ring-1 ring-white/70">
            {([['week', '1周'], ['month', '1月'], ['quarter', '3月'], ['half', '6月'], ['year', '1年']] as const).map(([id, label]) => <button key={id} type="button" onClick={(e) => { e.stopPropagation(); setPeriod(id); }} className={`rounded-[12px] py-1.5 text-[9px] font-medium ${period === id ? "bg-blue-500 text-white" : "bg-white/76 text-muted"}`}>{label}</button>)}
          </div>

          <div className="mt-1.5 rounded-[16px] bg-white/54 px-2.5 py-2">
            <div className="flex items-end justify-between gap-2"><div><div className="text-[8px] text-muted">{selectedLabel}</div><Tone v={selected.amount} className="mt-0.5 block text-[18px] font-bold leading-none">{selected.amount == null ? "—" : fmtMoney(selected.amount)}</Tone></div><Tone v={selected.pct} className="text-[11px] font-semibold">{selected.pct == null ? "—" : fmtPctShort(selected.pct)}</Tone></div>
            <div className="mt-1 text-[8px] leading-[1.45] text-muted">{fund?.metrics?.band ? `${fund.metrics.band} · ` : ""}{fund?.metrics?.trend ? `趋势${fund.metrics.trend} · ` : ""}{fund?.metrics?.combo || swing?.reason || "暂无可靠波段结论"}</div>
          </div>

          <button type="button" className="mt-1.5 flex w-full items-center justify-between rounded-[15px] bg-white/60 px-2.5 py-2 text-left text-[10px] font-medium text-fg" onClick={(e) => { e.stopPropagation(); setWhyOpen((v) => !v); }}><span>📊 为什么{(ret.todayPnlPct ?? 0) >= 0 ? "涨" : "跌"}？</span><span className="text-[8px] text-muted">{whyOpen ? "收起" : "展开"}</span></button>
          {whyOpen ? <div className="mt-1.5 rounded-[15px] bg-white/54 p-2.5 text-[8px] leading-[1.5] text-muted"><b className="text-fg">指标：</b>{fund?.metrics ? `RSI ${fmtPrice(fund.metrics.rsi, 1)} · BIAS ${fmtPctShort(fund.metrics.bias)} · MACD ${fmtPrice(fund.metrics.macd, 4)} · MA20 ${fmtPrice(fund.metrics.ma20, 4)} · MA60 ${fmtPrice(fund.metrics.ma60, 4)}` : "暂无可靠指标数据"}{mapped ? <div className="mt-0.5"><b className="text-fg">关联板块：</b>{mapped.name}{sector?.change != null ? ` · 今日 ${fmtPctShort(sector.change)}` : ""}</div> : null}{six ? <div className="mt-0.5">组合判断：{six.advice} · 置信 {six.confidence}%</div> : null}</div> : null}

          <div className="mt-1.5 flex gap-1.5"><button type="button" onClick={(e) => { e.stopPropagation(); setEditing((v) => !v); }} className="flex-1 rounded-[14px] bg-white/70 py-2 text-[9px] text-muted">{editing ? "取消编辑" : "编辑持仓"}</button><button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="flex-1 rounded-[14px] bg-red-50/70 py-2 text-[9px] text-red-500">删除</button></div>
          {editing ? <div className="mt-1.5 grid grid-cols-2 gap-1.5"><label className="text-[8px] text-muted">份额<input value={shares} onChange={(e) => setShares(e.target.value)} className="mt-0.5 w-full rounded-xl border border-white/80 bg-white/80 px-2 py-1.5 text-[10px] outline-none" /></label><label className="text-[8px] text-muted">成本<input value={cost} onChange={(e) => setCost(e.target.value)} className="mt-0.5 w-full rounded-xl border border-white/80 bg-white/80 px-2 py-1.5 text-[10px] outline-none" /></label><button type="button" onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="col-span-2 rounded-[14px] bg-blue-500 py-2 text-[9px] font-semibold text-white">保存修改</button></div> : null}
        </div>
      ) : null}
    </article>
  );
}
