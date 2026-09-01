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
    ? `当前组合${main.name}暴露较高（${main.pct.toFixed(0)}%），多个基金存在较强相关性。新增资金可考虑降低同涨同跌风险。`
    : "当前组合分散度尚可，新增资金可考虑继续降低同涨同跌风险。";

  return (
    <Glass className="mb-3 overflow-hidden rounded-[24px] border border-white/75 bg-white/50 p-3 shadow-[0_14px_38px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[20px] saturate-150">
      <div className="flex items-center gap-2"><div className="text-[18px]">🏥</div><div><div className="text-[16px] font-semibold tracking-tight text-fg">组合自检</div><div className="text-[10px] text-muted">自动分析 · 基于当前持仓</div></div></div>
      <div className="mt-2.5 flex items-center gap-2"><span className={`text-[12px] font-semibold ${concentrationHigh ? "text-red-500" : "text-emerald-600"}`}>{concentrationLabel}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-blue-400 to-red-400"><div className="h-full rounded-full bg-slate-900/80" style={{ width: `${Math.max(8, Math.min(96, a.concentrationTop1Pct))}%`, maxWidth: "7px", marginLeft: `calc(${Math.max(8, Math.min(96, a.concentrationTop1Pct))}% - 3.5px)` }} /></div><span className="text-[12px] font-medium text-muted">行业集中度</span></div>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        <Metric label="风格集中" value={style} />
        <Metric label="相关性" value={sameSector} sub={`${sectorCount}/${Math.max(1, holdings.length)}只同板块`} positive={sameSector === "低"} />
        <Metric label="波动风险" value={volatility} sub={a.avgDayPct == null ? "σ —" : `σ ${Math.abs(a.avgDayPct).toFixed(2)}%`} positive={volatility === "低"} />
        <Metric label="回撤压力" value={drawdown} sub={`${Math.max(0, a.holdingsTotal - a.holdingsCovered)}只高位`} positive={drawdown === "低"} />
        <Metric label="涨跌统计" value={`${up}涨 ${down}跌`} sub={`共 ${up + down}只`} />
        <Metric label="行业分布" value={`${sectorCount || 1}个`} sub={main ? `${main.name}为主` : "暂无可靠分类"} />
      </div>
      <div className="mt-2.5 rounded-[16px] border border-blue-200/70 bg-blue-50/45 p-2.5"><div className="text-[12px] font-semibold text-blue-600">💡 组合建议</div><div className="mt-0.5 text-[10px] leading-[1.45] text-muted">{suggestion}</div></div>
      <div className="mt-1.5 text-center text-[9px] text-muted">基于基金名称板块归类和当前可用数据，仅供参考。</div>
      <div className="mt-2.5 rounded-[18px] border border-white/80 bg-white/65 p-2.5">
        <div className="text-[14px] font-semibold text-fg">🔗 持仓重复度分析 <span className="text-[10px] font-normal text-muted">（按持仓市值）</span></div>
        <div className="mt-2 text-[12px] font-semibold text-fg">板块重合暴露 <span className="text-[10px] font-normal text-muted">（按持仓市值）</span></div>
        {main ? <>
          <div className="mt-1.5 rounded-[14px] border border-white/80 bg-white/70 p-2.5"><div className="flex items-center justify-between"><span className="text-[12px] text-fg">{main.name}</span><span className="text-[15px] font-semibold text-red-500">{main.pct.toFixed(1)}%</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-red-100/60"><div className="h-full rounded-full bg-red-400/80" style={{ width: `${Math.min(100, main.pct)}%` }} /></div></div>
          <div className="mt-1.5 text-[10px] text-muted">主要暴露方向：<b className="text-fg">{main.name}</b></div>
          {main.pct >= 50 ? <div className="mt-2 rounded-[14px] border border-red-200/75 bg-red-50/65 p-2.5"><div className="text-[11px] font-semibold text-red-500">⚠️ 集中度风险提示</div><div className="mt-0.5 text-[10px] leading-[1.45] text-red-500">表面上是 {holdings.length} 只基金，实际方向暴露已达 {main.pct.toFixed(1)}%，同涨同跌效应明显。</div></div> : null}
          <div className="mt-2 text-[10px] text-muted">未检测到明显的重仓股重合（基于名称关键词）</div>
        </> : <div className="mt-2 text-[10px] text-muted">暂未形成可靠的板块暴露结果。</div>}
        <div className="mt-2 text-center text-[9px] text-muted">名称关键词仅用于方向归类，实际持仓以基金定期报告为准。</div>
      </div>
    </Glass>
  );
}

function Metric({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return <div className="rounded-[14px] border border-white/80 bg-white/66 px-2 py-2 text-center"><div className="text-[9px] text-muted">{label}</div><div className={`mt-0.5 text-[14px] font-semibold ${positive ? "text-emerald-600" : "text-fg"}`}>{value}</div>{sub ? <div className="mt-0.5 text-[8px] text-muted">{sub}</div> : null}</div>;
}
