import { Link } from "@tanstack/react-router";
import { Glass } from "@/components/ui/Glass";
import { calcPortfolioAnalysis } from "@/lib/calc/portfolio";
import type { FundQuote, Holding, SectorQuote } from "@/lib/types";

function flowText(flow: number | null) {
  if (flow == null || !Number.isFinite(flow) || flow === 0) return "—";
  const amount = Math.abs(flow) / 100_000_000;
  return `${flow < 0 ? "卖" : "买"}+${amount.toFixed(2)}亿`;
}

function boardAdvice(change: number | null, flow: number | null) {
  if (change == null || flow == null) return "数据不足";
  if (change <= -2 && flow < 0) return "考虑减仓";
  if (change < 0 && flow < 0) return "持仓观察";
  if (change > 0 && flow > 0) return "偏多观察";
  return "持仓观察";
}

function adviceClass(advice: string) {
  if (advice === "考虑减仓") return "text-red-600";
  if (advice === "偏多观察") return "text-emerald-600";
  return "text-fg";
}

export function PortfolioInsight({ holdings, funds, sectors }: { holdings: Holding[]; funds: FundQuote[]; sectors: SectorQuote[] }) {
  if (!holdings.length) return null;
  const a = calcPortfolioAnalysis(holdings, funds, sectors);
  const concentrationHigh = a.concentrationTop1Pct >= 50 || a.risk === "高" || a.risk === "中高";
  const concentrationLabel = concentrationHigh ? "偏高" : "正常";
  const style = a.sectorExposures.length && a.sectorExposures[0].name.includes("半导体") ? "成长偏高" : "均衡";
  const sameSector = a.sectorExposures.length === 1 ? "低" : a.sectorExposures.length <= 2 ? "中" : "低";
  const volatility = a.avgDayPct == null ? "数据不足" : Math.abs(a.avgDayPct) > 1.2 ? "偏高" : "低";
  const drawdown = concentrationHigh ? "中等" : "低";
  const up = a.holdingRows.filter((x) => x.dayPct != null && x.dayPct > 0).length;
  const down = a.holdingRows.filter((x) => x.dayPct != null && x.dayPct < 0).length;
  const sectorCount = a.sectorExposures.length;
  const main = a.sectorExposures[0];
  const suggestion = main && main.pct >= 50
    ? `当前组合${main.name}暴露较高（${main.pct.toFixed(0)}%），多个基金存在较强相关性。新增资金可降低同涨同跌风险。`
    : "当前组合分散度尚可，新增资金可继续关注不同方向。";

  const operationSectors = sectors
    .filter((s) => s.change != null || s.flow != null)
    .sort((x, y) => {
      const xs = Math.abs(x.change ?? 0) + Math.min(Math.abs(x.flow ?? 0) / 10_000_000_000, 1) * 0.2;
      const ys = Math.abs(y.change ?? 0) + Math.min(Math.abs(y.flow ?? 0) / 10_000_000_000, 1) * 0.2;
      return ys - xs;
    })
    .slice(0, 8);
  const downMoreThan2 = sectors.filter((s) => (s.change ?? 0) <= -2).length;
  const outflowDown = sectors.filter((s) => (s.change ?? 0) < 0 && (s.flow ?? 0) < 0).length;
  const riskTips = [
    outflowDown > 0 ? `主力持续流出（${outflowDown}个下跌板块同时净流出），注意短期调整` : "",
    downMoreThan2 >= 4 ? `${sectors.length || 0}板块中${downMoreThan2}个跌幅超2%，系统性风险偏高` : "",
    up === 0 && down > 0 ? "当前持仓全线走弱，短期波动风险上升" : "",
  ].filter(Boolean);

  return (
    <Glass className="mb-3 overflow-hidden rounded-[24px] border border-white/75 bg-white/50 p-3 shadow-[0_14px_38px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[20px] saturate-150">
      <section aria-label="操作建议" className="rounded-[18px] border border-white/80 bg-white/66 p-2.5">
        <div className="text-[15px] font-semibold tracking-tight text-fg">🎯 操作建议 <span className="ml-1 text-[9px] font-normal text-muted">仅供参考</span></div>
        <div className="mt-2 text-[13px] font-semibold text-fg">⚡ 短期策略（逐板块）</div>
        {operationSectors.length ? <div className="mt-1.5 overflow-hidden rounded-[14px] border border-white/80 bg-white/58">
          <div className="grid grid-cols-[1.4fr_.65fr_1fr_.9fr] gap-1 border-b border-black/[.04] bg-white/60 px-2 py-1.5 text-[8px] text-muted"><span>板块</span><span>涨跌</span><span>板块资金</span><span>建议</span></div>
          {operationSectors.map((s) => { const advice = boardAdvice(s.change, s.flow); return <div key={s.id} className="grid grid-cols-[1.4fr_.65fr_1fr_.9fr] items-center gap-1 border-b border-black/[.035] px-2 py-1.5 last:border-b-0"><span className="truncate text-[9px] font-medium text-fg">{s.name}</span><span className={`text-[9px] tabular-nums ${(s.change ?? 0) < 0 ? "text-emerald-600" : (s.change ?? 0) > 0 ? "text-red-500" : "text-muted"}`}>{s.change == null ? "—" : `${s.change > 0 ? "+" : ""}${s.change.toFixed(2)}%`}</span><span className={`text-[9px] tabular-nums ${(s.flow ?? 0) < 0 ? "text-emerald-600" : "text-red-500"}`}>{flowText(s.flow)}</span><span className={`text-[9px] font-semibold ${adviceClass(advice)}`}>{advice}</span></div>; })}
        </div> : <div className="mt-1.5 rounded-xl bg-bg-elevated px-2.5 py-2 text-[9px] text-muted">等待板块资金与涨跌数据。</div>}

        <div className="mt-2.5 rounded-[15px] bg-white/58 px-2.5 py-2">
          <div className="text-[13px] font-semibold text-fg">🏗 中长期布局</div>
          <div className="mt-1 text-[9px] leading-[1.45] text-muted">{main ? `当前主要配置方向为${main.name}（约 ${main.pct.toFixed(1)}%），中长期新增资金优先考虑降低单一方向集中度。` : "当前暂无可靠行业暴露结果。"}</div>
          <div className="mt-1 text-[8px] text-muted">💡 配置 DeepSeek Key 后开启 AI 一句话点评（页面底部）</div>
        </div>

        <div className="mt-2 rounded-[15px] bg-white/58 px-2.5 py-2">
          <div className="text-[13px] font-semibold text-fg">📊 整体仓位</div>
          <div className="mt-1 text-[9px] leading-[1.45] text-muted">当前持仓 {holdings.length} 只，最大板块暴露 {main ? `${main.pct.toFixed(1)}%` : "—"}。{concentrationHigh ? "建议新增资金优先补低相关方向。" : "仓位结构暂未出现明显单一方向挤压。"}</div>
          <div className="mt-1 text-[8px] text-muted">💡 配置 DeepSeek Key 后开启 AI 一句话点评（页面底部）</div>
        </div>

        {riskTips.length ? <div className="mt-2 rounded-[15px] border border-red-200/70 bg-red-50/55 p-2.5"><div className="text-[12px] font-semibold text-red-600">⚠️ 风险提示</div>{riskTips.map((tip) => <div key={tip} className="mt-1 text-[9px] leading-[1.45] text-red-500">⚠️ {tip}</div>)}</div> : null}
      </section>

      <Link to="/ai" className="mt-2.5 block rounded-[18px] border border-slate-700/80 bg-slate-950/90 p-3 text-white shadow-[0_12px_30px_rgba(15,23,42,.16)]">
        <div className="flex items-center gap-2.5"><div className="flex size-8 items-center justify-center rounded-full bg-white/10 text-[17px]">👑</div><div className="min-w-0 flex-1"><div className="text-[14px] font-semibold">AI 智能研判 <span className="ml-1 rounded-full bg-blue-500/25 px-1.5 py-0.5 text-[8px] text-blue-200">今日观点</span></div><div className="mt-0.5 truncate text-[9px] text-slate-300">市场资金以结构性轮动为主，板块强弱与资金流向持续更新。</div></div><span className="shrink-0 rounded-full border border-white/15 px-2 py-1 text-[9px] text-slate-200">查看详情 ›</span></div>
      </Link>

      <section className="mt-2.5">
        <div className="flex items-center gap-2"><div className="text-[16px]">🏥</div><div><div className="text-[15px] font-semibold tracking-tight text-fg">组合体检</div><div className="text-[9px] text-muted">自动分析 · 需添加持仓</div></div></div>
        <div className="mt-2 flex items-center gap-2"><span className={`text-[11px] font-semibold ${concentrationHigh ? "text-red-500" : "text-emerald-600"}`}>{concentrationLabel}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-blue-400 to-red-400"><span className="block h-full w-2 rounded-full bg-slate-900/90" style={{ marginLeft: `calc(${Math.max(8, Math.min(96, a.concentrationTop1Pct))}% - 4px)` }} /></div><span className="text-[10px] font-medium text-muted">行业集中度</span></div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <Metric label="风格集中" value={style} />
          <Metric label="相关性" value={sameSector} sub={`${sectorCount}/${Math.max(1, holdings.length)}只同板块`} positive={sameSector === "低"} />
          <Metric label="波动风险" value={volatility} sub={a.avgDayPct == null ? "σ —" : `σ ${Math.abs(a.avgDayPct).toFixed(2)}%`} positive={volatility === "低"} />
          <Metric label="回撤压力" value={drawdown} sub={`${Math.max(0, a.holdingsTotal - a.holdingsCovered)}只高位`} positive={drawdown === "低"} />
          <Metric label="涨跌统计" value={`${up}涨 ${down}跌`} sub={`共 ${up + down}只`} />
          <Metric label="行业分布" value={`${sectorCount || 1}个`} sub={main ? `${main.name}为主` : "暂无可靠分类"} />
        </div>
        <div className="mt-2 rounded-[15px] border border-blue-200/70 bg-blue-50/45 p-2.5"><div className="text-[11px] font-semibold text-blue-600">💡 组合建议</div><div className="mt-0.5 text-[9px] leading-[1.45] text-muted">{suggestion}</div></div>
        <div className="mt-1 text-center text-[8px] text-muted">基于基金名称板块归类和当前可用数据，仅供参考。</div>

        <div className="mt-2 rounded-[17px] border border-white/80 bg-white/65 p-2.5">
          <div className="text-[13px] font-semibold text-fg">🔗 持仓重复度分析 <span className="text-[9px] font-normal text-muted">（按持仓市值）</span></div>
          <div className="mt-1.5 text-[11px] font-semibold text-fg">板块重合暴露 <span className="text-[9px] font-normal text-muted">（按持仓市值）</span></div>
          {main ? <>
            <div className="mt-1.5 rounded-[13px] border border-white/80 bg-white/70 p-2"><div className="flex items-center justify-between"><span className="text-[10px] text-fg">{main.name}</span><span className="text-[13px] font-semibold text-red-500">{main.pct.toFixed(1)}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-red-100/60"><div className="h-full rounded-full bg-red-400/80" style={{ width: `${Math.min(100, main.pct)}%` }} /></div></div>
            <div className="mt-1 text-[9px] text-muted">主要暴露方向：<b className="text-fg">{main.name}</b></div>
            {main.pct >= 50 ? <div className="mt-1.5 rounded-[13px] border border-red-200/75 bg-red-50/65 p-2"><div className="text-[10px] font-semibold text-red-500">⚠️ 集中度风险提示</div><div className="mt-0.5 text-[9px] leading-[1.45] text-red-500">表面上是 {holdings.length} 只基金，实际方向暴露已达 {main.pct.toFixed(1)}%，同涨同跌效应明显。</div></div> : null}
            <div className="mt-1.5 text-[9px] text-muted">未检测到明显的重仓股重合（基于名称关键词）</div>
          </> : <div className="mt-1.5 text-[9px] text-muted">暂未形成可靠的板块暴露结果。</div>}
          <div className="mt-1.5 text-center text-[8px] text-muted">名称关键词仅用于方向归类，实际持仓以基金定期报告为准。</div>
        </div>

        <div className="mt-2 rounded-[14px] border border-white/70 bg-white/45 p-2 text-[8px] leading-[1.5] text-muted">
          <b className="text-fg">盘中估值方法：</b>交易时段优先使用重仓股穿透估值；同时保留外部基金估值作为交叉参考。当前估值与外部源差异超过 0.8% 时提示估值分歧。9:30–11:30 / 13:00–15:00 自动刷新；收盘后不再生成新的盘中估值，等待官方净值。
        </div>
      </section>
    </Glass>
  );
}

function Metric({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return <div className="rounded-[13px] border border-white/80 bg-white/66 px-1.5 py-1.5 text-center"><div className="text-[8px] text-muted">{label}</div><div className={`mt-0.5 text-[11px] font-semibold ${positive ? "text-emerald-600" : "text-fg"}`}>{value}</div>{sub ? <div className="mt-0.5 text-[7px] text-muted">{sub}</div> : null}</div>;
}
