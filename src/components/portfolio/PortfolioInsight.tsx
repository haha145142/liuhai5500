import { Glass } from "@/components/ui/Glass";
import { fmtMoney, fmtPctShort } from "@/lib/format";
import { calcPortfolioAnalysis } from "@/lib/calc/portfolio";
import type { FundQuote, Holding, SectorQuote } from "@/lib/types";

export function PortfolioInsight({ holdings, funds, sectors }: { holdings: Holding[]; funds: FundQuote[]; sectors: SectorQuote[] }) {
  if (!holdings.length) return null;
  const a = calcPortfolioAnalysis(holdings, funds, sectors);
  const concentration = a.concentrationTop1Pct >= 70 ? "偏高" : a.concentrationTop1Pct >= 35 ? "中等" : "较低";
  const correlation = a.sectorExposures.length <= 1 ? "数据不足" : a.sectorExposures.length <= 3 ? "中" : "低";
  const volatility = a.avgDayPct == null ? "数据不足" : Math.abs(a.avgDayPct) >= 2 ? "高" : Math.abs(a.avgDayPct) >= 1 ? "中" : "低";
  const drawdown = a.trend === "偏弱" ? "偏高" : a.trend === "震荡" ? "中" : a.trend === "偏强" ? "低" : "数据不足";
  const up = a.holdingRows.filter(x => x.dayPct != null && x.dayPct > 0).length;
  const down = a.holdingRows.filter(x => x.dayPct != null && x.dayPct < 0).length;
  const mainSector = a.sectorExposures[0];
  const recommendation = concentration === "偏高" || a.risk === "高"
    ? `当前组合集中度较高（${mainSector ? `${mainSector.name} ${mainSector.pct.toFixed(1)}%` : `${a.concentrationTop1Pct.toFixed(1)}%`}），建议新增资金优先降低同方向暴露。`
    : a.trend === "偏弱"
      ? "组合当前趋势偏弱，新增资金以分散和控制回撤为主，不追涨补仓。"
      : "当前组合没有明显失控项，新增资金优先考虑分散同涨同跌风险。";

  return (
    <Glass tight className="mb-3 mt-3 overflow-hidden !rounded-[28px] !border-white/75 !bg-white/50 !p-4 shadow-[0_18px_48px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[20px] saturate-150">
      <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-2xl bg-white/72 text-xl shadow-sm ring-1 ring-white/80">🏥</div><div className="min-w-0"><div className="text-[22px] font-semibold tracking-tight text-fg">组合体检</div><div className="text-sm text-muted">自动分析 · 需添加持仓</div></div></div>
      <div className="mt-4 flex items-center gap-3"><span className={`text-base font-semibold ${concentration === "偏高" ? "text-red-500" : "text-emerald-600"}`}>{concentration}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-red-400"><div className="h-full rounded-full bg-slate-900/80" style={{width:`${Math.max(8,Math.min(95,a.concentrationTop1Pct))}%`,maxWidth:"10px"}} /></div><span className="text-base font-semibold text-fg">行业集中度</span></div>

      <div className="mt-4 grid grid-cols-3 gap-2">{[
        ["风格集中", concentration === "偏高" ? "成长偏高" : concentration === "中等" ? "中等" : "较低", ""],
        ["相关性", correlation, a.sectorExposures.length ? `${a.sectorExposures.length}个板块` : ""],
        ["波动风险", volatility, a.avgDayPct == null ? "σ —" : `σ ${Math.abs(a.avgDayPct).toFixed(2)}%`],
        ["回撤压力", drawdown, `${a.holdingsCovered}只覆盖`],
        ["涨跌统计", `${up}涨 ${down}跌`, `共 ${up+down}只`],
        ["行业分布", `${a.sectorExposures.length}个`, mainSector ? `${mainSector.name}为主` : "暂无"]
      ].map(([label,value,sub])=><div key={label} className="rounded-[22px] border border-white/80 bg-white/64 px-3 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.96)]"><div className="text-sm text-muted">{label}</div><div className={`mt-1 text-lg font-semibold ${["相关性","波动风险","回撤压力"].includes(label) && value === "低" ? "text-emerald-600" : ""}`}>{value}</div><div className="mt-1 text-xs text-muted">{sub}</div></div>)}
      </div>

      <div className="mt-4 rounded-[24px] border border-blue-200/70 bg-blue-50/55 p-4"><div className="text-lg font-semibold text-blue-600">💡 组合建议</div><div className="mt-2 text-sm leading-relaxed text-muted">{recommendation}</div></div>
      <div className="mt-2 text-center text-[11px] text-muted">基于基金名称板块归类和实时数据估算，仅供参考。</div>

      <div className="mt-4 rounded-[24px] border border-white/80 bg-white/62 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.96)]"><div className="text-base font-semibold text-fg">🔗 持仓重复度分析</div><div className="mt-3 text-sm font-semibold text-fg">板块重合暴露 <span className="font-normal text-muted">（按持仓市值）</span></div>{mainSector ? <><div className="mt-3 rounded-2xl border border-white/80 bg-white/65 p-3"><div className="flex items-center justify-between text-base"><span>{mainSector.name}</span><span className="font-semibold text-red-500">{mainSector.pct.toFixed(1)}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-red-100"><div className="h-full rounded-full bg-red-400" style={{width:`${Math.min(100,mainSector.pct)}%`}} /></div></div><div className="mt-3 text-sm text-muted">主要暴露方向：<b className="text-fg">{mainSector.name}</b></div>{a.concentrationTop1Pct >= 70 ? <div className="mt-3 rounded-[22px] border border-red-200 bg-red-50/70 p-4 text-sm leading-relaxed"><div className="font-semibold text-red-500">⚠️ 集中度风险提示</div><div className="mt-1 text-red-600">表面上是 {holdings.length} 只基金，实际方向暴露较集中，涨跌联动会明显，注意集中度风险。</div></div> : null}<div className="mt-3 text-sm text-muted">{a.notes.length ? a.notes.join(" ") : "未检测到明显的重复暴露风险。"}</div></> : <div className="mt-3 rounded-2xl bg-bg-elevated/70 p-4 text-sm text-muted">暂未形成可靠的板块暴露结果。</div>}<div className="mt-3 text-center text-[11px] text-muted">基于基金名称关键词规则匹配，仅供参考，实际持仓以基金定期报告为准。</div></div>
    </Glass>
  );
}
