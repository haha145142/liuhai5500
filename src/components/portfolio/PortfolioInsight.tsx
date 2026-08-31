import { Glass } from "@/components/ui/Glass";
import { calcPortfolioAnalysis } from "@/lib/calc/portfolio";
import type { FundQuote, Holding, SectorQuote } from "@/lib/types";

export function PortfolioInsight({ holdings, funds, sectors }: { holdings: Holding[]; funds: FundQuote[]; sectors: SectorQuote[] }) {
  if (!holdings.length) return null;
  const a = calcPortfolioAnalysis(holdings, funds, sectors);
  const concentrationHigh = a.concentrationTop1Pct >= 50 || a.risk === "高" || a.risk === "中高";
  const concentrationLabel = concentrationHigh ? "偏高" : "正常";
  const style = a.sectorExposures.length && a.sectorExposures[0].name.includes("半导体") ? "成长偏高" : "均衡";
  const sameSector = a.sectorExposures.length === 1 ? "低" : a.sectorExposures.length <= 2 ? "中" : "低";
  const volatility = a.avgDayPct == null ? "数据不足" : Math.abs(a.avgDayPct) > 1.2 ? "偏高" : "低";
  const drawdown = concentrationHigh ? "中" : "低";
  const up = a.holdingRows.filter((x) => x.dayPct != null && x.dayPct > 0).length;
  const down = a.holdingRows.filter((x) => x.dayPct != null && x.dayPct < 0).length;
  const sectorCount = a.sectorExposures.length;
  const main = a.sectorExposures[0];
  const suggestion = main && main.pct >= 50
    ? `当前组合科技成长暴露较高（${main.name}占比${main.pct.toFixed(0)}%），多个基金存在较强相关性。新增资金可以考虑降低同涨同跌风险。`
    : "当前组合分散度尚可，新增资金可以考虑继续降低同涨同跌风险。";

  return (
    <Glass className="mb-3 overflow-hidden rounded-[28px] border border-white/75 bg-white/50 p-4 shadow-[0_18px_48px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[20px] saturate-150">
      <div className="flex items-center gap-3"><div className="text-[22px]">🏥</div><div><div className="text-[22px] font-semibold tracking-tight text-fg">组合体检</div><div className="text-sm text-muted">自动分析 · 需添加持仓</div></div></div>
      <div className="mt-3 flex items-center gap-3"><span className={`text-lg font-semibold ${concentrationHigh ? "text-red-500" : "text-emerald-600"}`}>{concentrationLabel}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-blue-400 to-red-400"><div className="h-full rounded-full bg-slate-900/80" style={{ width: `${Math.max(8, Math.min(96, a.concentrationTop1Pct))}%`, maxWidth: "10px", marginLeft: `calc(${Math.max(8, Math.min(96, a.concentrationTop1Pct))}% - 5px)` }} /></div><span className="text-lg font-semibold text-fg">行业集中度</span></div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="风格集中" value={style} />
        <Metric label="相关性" value={sameSector} sub={`${sectorCount}/${Math.max(1, holdings.length)}只同板块`} positive={sameSector === "低"} />
        <Metric label="波动风险" value={volatility} sub={a.avgDayPct == null ? "σ —" : `σ ${Math.abs(a.avgDayPct).toFixed(2)}%`} positive={volatility === "低"} />
        <Metric label="回撤压力" value={drawdown} sub={`${Math.max(0, a.holdingsTotal - a.holdingsCovered)}只高位`} positive={drawdown === "低"} />
        <Metric label="涨跌统计" value={`${up}涨 ${down}跌`} sub={`共 ${up + down}只`} />
        <Metric label="行业分布" value={`${sectorCount || 1}个`} sub={main ? `${main.name}为主` : "暂无可靠分类"} />
      </div>
      <div className="mt-3 rounded-[24px] border border-blue-200/80 bg-blue-50/50 p-4"><div className="text-lg font-semibold text-blue-600">💡 组合建议</div><div className="mt-1 text-[15px] leading-relaxed text-muted">{suggestion}</div></div>
      <div className="mt-2 text-center text-[11px] text-muted">基于基金名称板块归类和实时数据估算，仅供参考。</div>
      <div className="mt-3 rounded-[24px] border border-white/80 bg-white/65 p-4"><div className="text-[18px] font-semibold text-fg">🔗 持仓重复度分析 <span className="text-sm font-normal text-muted">（按持仓市值）</span></div><div className="mt-3 text-base font-semibold">板块重合暴露 <span className="font-normal text-muted">（按持仓市值）</span></div>{main ? <><div className="mt-2 rounded-[20px] border border-white/80 bg-white/70 p-3"><div className="flex items-center justify-between"><span className="text-base">{main.name}</span><span className="text-lg font-semibold text-red-500">{main.pct.toFixed(1)}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-red-100/60"><div className="h-full rounded-full bg-red-400/80" style={{ width: `${Math.min(100, main.pct)}%` }} /></div></div><div className="mt-2 text-sm text-muted">主要暴露方向：<b className="text-fg">{main.name}</b></div>{main.pct >= 50 ? <div className="mt-3 rounded-[20px] border border-red-200/80 bg-red-50/70 p-3"><div className="font-semibold text-red-500">⚠️ 集中度风险提示</div><div className="mt-1 text-sm leading-relaxed text-red-500">表面上是 {holdings.length} 只基金，实际方向暴露已达 {main.pct.toFixed(1)}%，同涨同跌效应明显，注意集中度风险。</div></div> : null}<div className="mt-3 text-sm text-muted">未检测到明显的重仓股重合（基于名称关键词）</div></> : <div className="mt-3 text-sm text-muted">暂未形成可靠的板块暴露结果。</div>}<div className="mt-3 text-center text-[11px] text-muted">基于基金名称关键词规则匹配，仅供参考，实际持仓以基金定期报告为准。</div></div>
    </Glass>
  );
}

function Metric({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return <div className="rounded-[22px] border border-white/80 bg-white/66 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.96)]"><div className="text-[13px] text-muted">{label}</div><div className={`mt-1 text-[19px] font-bold ${positive ? "text-emerald-600" : "text-fg"}`}>{value}</div>{sub ? <div className="mt-1 text-[11px] text-muted">{sub}</div> : null}</div>;
}
