import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Glass } from "@/components/ui/Glass";
import { calcPortfolioAnalysis } from "@/lib/calc/portfolio";
import { calcSixFactor } from "@/lib/calc/six-factor";
import type { FundQuote, Holding, SectorQuote } from "@/lib/types";

type SelectedBoard = { code: string; name: string };
const BOARD_WATCH_KEY = "fund_ai_pro_board_watch_v8";

function readSelectedBoards(): SelectedBoard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(BOARD_WATCH_KEY) || "null") as { items?: unknown } | null;
    if (!Array.isArray(raw?.items)) return [];
    const seen = new Set<string>();
    return raw.items.filter((item): item is SelectedBoard => {
      if (!item || typeof item !== "object") return false;
      const x = item as Partial<SelectedBoard>;
      const code = String(x.code ?? "").trim();
      const name = String(x.name ?? "").trim();
      if (!code || !name || seen.has(code)) return false;
      seen.add(code);
      return true;
    });
  } catch { return []; }
}

function flowText(flow: number | null) {
  if (flow == null || !Number.isFinite(flow) || flow === 0) return "—";
  const amount = Math.abs(flow) / 100_000_000;
  return `${flow < 0 ? "卖" : "买"}+${amount.toFixed(2)}亿`;
}
function adviceClass(advice: string) {
  if (advice.includes("减仓") || advice.includes("回避") || advice.includes("空仓")) return "text-red-600";
  if (advice.includes("积极") || advice.includes("持有")) return "text-emerald-600";
  return "text-fg";
}
function signalClass(value: string) {
  if (value.includes("强") || value.includes("高位")) return "text-red-500";
  if (value.includes("弱") || value.includes("低位")) return "text-emerald-600";
  return "text-fg";
}

export function PortfolioInsight({ holdings, funds, sectors }: { holdings: Holding[]; funds: FundQuote[]; sectors: SectorQuote[] }) {
  const [selectedBoards, setSelectedBoards] = useState<SelectedBoard[]>([]);
  useEffect(() => {
    const sync = () => setSelectedBoards(readSelectedBoards());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  if (!holdings.length) return null;
  const a = calcPortfolioAnalysis(holdings, funds, sectors);
  const concentrationHigh = a.concentrationTop1Pct >= 50 || a.risk === "高" || a.risk === "中高";
  const concentrationLabel = concentrationHigh ? "偏高" : "正常";
  const style = a.sectorExposures.length && a.sectorExposures[0].name.includes("半导体") ? "成长偏高" : "均衡";
  const sameSector = a.sectorExposures.length === 1 ? "低" : a.sectorExposures.length <= 2 ? "中" : "低";
  const volatility = a.avgDayPct == null ? "数据不足" : Math.abs(a.avgDayPct) > 1.2 ? "偏高" : "低";
  const drawdown = concentrationHigh ? "中等" : "低";
  const up = a.holdingRows.filter((x) => x.dayPnl != null && x.dayPnl > 0).length;
  const down = a.holdingRows.filter((x) => x.dayPnl != null && x.dayPnl < 0).length;
  const sectorCount = a.sectorExposures.length;
  const main = a.sectorExposures[0];
  const suggestion = main && main.pct >= 50
    ? `当前组合${main.name}暴露较高（${main.pct.toFixed(0)}%），多个基金存在较强相关性。新增资金可降低同涨同跌风险。`
    : "当前组合分散度尚可，新增资金可继续关注不同方向。";

  const selectedNames = new Set(selectedBoards.map((board) => board.name));
  const selectedCodes = new Set(selectedBoards.map((board) => board.code));
  const operationSectors = selectedBoards
    .map((board) => sectors.find((sector) => sector.name === board.name || sector.id === board.code))
    .filter((sector): sector is SectorQuote => !!sector && (sector.change != null || sector.flow != null));
  const uniqueOperationSectors = operationSectors.filter((sector, index, list) => list.findIndex((item) => item.id === sector.id) === index);

  const downMoreThan2 = uniqueOperationSectors.filter((s) => (s.change ?? 0) <= -2).length;
  const outflowDown = uniqueOperationSectors.filter((s) => (s.change ?? 0) < 0 && (s.flow ?? 0) < 0).length;
  const riskTips = [
    outflowDown > 0 ? `自选板块中有 ${outflowDown} 个下跌板块同时净流出，注意短期调整` : "",
    downMoreThan2 >= 2 ? `自选板块中有 ${downMoreThan2} 个跌幅超2%，短期风险偏高` : "",
    up === 0 && down > 0 ? "当前持仓全线走弱，短期波动风险上升" : "",
  ].filter(Boolean);

  return (
    <Glass className="mb-3 overflow-hidden rounded-[24px] border border-white/75 bg-white/50 p-3 shadow-[0_14px_38px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[20px] saturate-150">
      <section aria-label="自选板块操作建议" className="rounded-[18px] border border-white/80 bg-white/66 p-2.5">
        <div className="flex items-end justify-between gap-2"><div><div className="text-[15px] font-semibold tracking-tight text-fg">🎯 自选板块 · 操作建议 <span className="ml-1 text-[9px] font-normal text-muted">数据规则生成 · 仅供参考</span></div><div className="mt-0.5 text-[9px] text-muted">你在“自选板块”添加什么，这里就分析什么：涨跌、资金、趋势、波段、建议、置信度统一显示。</div></div></div>
        {selectedBoards.length ? <div className="mt-2 text-[13px] font-semibold text-fg">⚡ 当前关注板块</div> : null}
        {uniqueOperationSectors.length ? <div className="mt-1.5 overflow-x-auto rounded-[14px] border border-white/80 bg-white/58">
          <div className="min-w-[620px]">
            <div className="grid grid-cols-[1.3fr_.7fr_1fr_.75fr_.75fr_1fr_.7fr] gap-1 border-b border-black/[.04] bg-white/60 px-2 py-1.5 text-[8px] text-muted"><span>板块</span><span>涨跌</span><span>资金</span><span>趋势</span><span>波段</span><span>建议</span><span>置信</span></div>
            {uniqueOperationSectors.map((s) => {
              const model = calcSixFactor(s, null);
              return <div key={s.id} className="grid min-h-10 grid-cols-[1.3fr_.7fr_1fr_.75fr_.75fr_1fr_.7fr] items-center gap-1 border-b border-black/[.035] px-2 py-1.5 last:border-b-0">
                <span className="truncate text-[9px] font-medium text-fg">{s.name}</span>
                <span className={`text-[9px] tabular-nums ${(s.change ?? 0) < 0 ? "text-emerald-600" : (s.change ?? 0) > 0 ? "text-red-500" : "text-muted"}`}>{s.change == null ? "—" : `${s.change > 0 ? "+" : ""}${s.change.toFixed(2)}%`}</span>
                <span className={`text-[9px] tabular-nums ${(s.flow ?? 0) < 0 ? "text-emerald-600" : (s.flow ?? 0) > 0 ? "text-red-500" : "text-muted"}`}>{flowText(s.flow)}</span>
                <span className={`text-[9px] font-semibold ${signalClass(model.trendLabel)}`}>{model.trendLabel}</span>
                <span className={`text-[9px] font-semibold ${signalClass(model.band)}`}>{model.band}</span>
                <span className={`text-[9px] font-semibold ${adviceClass(model.advice)}`}>{model.advice}</span>
                <span className="text-[9px] font-semibold text-blue-600">{model.confidence}% <span className="text-[8px] font-normal text-muted">{model.level}</span></span>
              </div>;
            })}
          </div>
        </div> : <div className="mt-1.5 rounded-xl bg-bg-elevated px-2.5 py-3 text-[9px] leading-[1.5] text-muted">{selectedBoards.length ? "已添加自选板块，但当前还没有取得可靠的涨跌/资金数据；有数据后会自动出现在这里。" : "还没有自选板块。去“自选板块”添加半导体、存储芯片、通信等你关注的方向，这里会自动生成对应的行情、趋势、波段和建议。"}</div>}
        <div className="mt-1.5 rounded-[14px] border border-blue-100/80 bg-blue-50/45 px-2.5 py-2 text-[8px] leading-[1.5] text-muted"><b className="text-blue-700">六因子量化模型：</b>将板块价格变化、资金方向、相对强弱、连涨跌与波动风险等当前可用证据合并评分；“波段”用于位置/信号区间判断，不伪造历史高低点。</div>
        {riskTips.length ? <div className="mt-2 rounded-[15px] border border-red-200/70 bg-red-50/55 p-2.5"><div className="text-[12px] font-semibold text-red-600">⚠️ 风险提示</div>{riskTips.map((tip) => <div key={tip} className="mt-1 text-[9px] leading-[1.45] text-red-500">⚠️ {tip}</div>)}</div> : null}
      </section>

      <Link to="/ai" className="mt-2.5 block rounded-[18px] border border-slate-700/80 bg-slate-950/90 p-3 text-white shadow-[0_12px_30px_rgba(15,23,42,.16)]"><div className="flex items-center gap-2.5"><div className="flex size-8 items-center justify-center rounded-full bg-white/10 text-[17px]">👑</div><div className="min-w-0 flex-1"><div className="text-[14px] font-semibold">AI 智能研判 <span className="ml-1 rounded-full bg-blue-500/25 px-1.5 py-0.5 text-[8px] text-blue-200">今日观点</span></div><div className="mt-0.5 truncate text-[9px] text-slate-300">市场资金以结构性轮动为主，板块强弱与资金流向持续更新。</div></div><span className="shrink-0 rounded-full border border-white/15 px-2 py-1 text-[9px] text-slate-200">查看详情 ›</span></div></Link>

      <section className="mt-2.5">
        <div className="flex items-center gap-2"><div className="text-[16px]">🏥</div><div><div className="text-[15px] font-semibold tracking-tight text-fg">组合体检</div><div className="text-[9px] text-muted">自动分析 · 需添加持仓</div></div></div>
        <div className="mt-2 flex items-center gap-2"><span className={`text-[11px] font-semibold ${concentrationHigh ? "text-red-500" : "text-emerald-600"}`}>{concentrationLabel}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-blue-400 to-red-400"><span className="block h-full w-2 rounded-full bg-slate-900/90" style={{ marginLeft: `calc(${Math.max(8, Math.min(96, a.concentrationTop1Pct))}% - 4px)` }} /></div><span className="text-[10px] font-medium text-muted">行业集中度</span></div>
        <div className="mt-2 grid grid-cols-3 gap-1.5"><Metric label="风格集中" value={style} /><Metric label="相关性" value={sameSector} sub={`${sectorCount}/${Math.max(1, holdings.length)}只同板块`} positive={sameSector === "低"} /><Metric label="波动风险" value={volatility} sub={a.avgDayPct == null ? "σ —" : `σ ${Math.abs(a.avgDayPct).toFixed(2)}%`} positive={volatility === "低"} /><Metric label="回撤压力" value={drawdown} sub={`${Math.max(0, a.holdingsTotal - a.holdingsCovered)}只高位`} positive={drawdown === "低"} /><Metric label="涨跌统计" value={`${up}涨 ${down}跌`} sub={`共 ${up + down}只`} /><Metric label="行业分布" value={`${sectorCount || 1}个`} sub={main ? `${main.name}为主` : "暂无可靠分类"} /></div>
        <div className="mt-2 rounded-[15px] border border-blue-200/70 bg-blue-50/45 p-2.5"><div className="text-[11px] font-semibold text-blue-600">💡 组合建议</div><div className="mt-0.5 text-[9px] leading-[1.45] text-muted">{suggestion}</div></div>
        <div className="mt-1 text-center text-[8px] text-muted">基于基金名称板块归类和当前可用数据，仅供参考。</div>
        <div className="mt-2 rounded-[17px] border border-white/80 bg-white/65 p-2.5"><div className="text-[13px] font-semibold text-fg">🔗 持仓重复度分析 <span className="text-[9px] font-normal text-muted">（按持仓市值）</span></div><div className="mt-1.5 text-[11px] font-semibold text-fg">板块重合暴露 <span className="text-[9px] font-normal text-muted">（按持仓市值）</span></div>{main ? <><div className="mt-1.5 rounded-[13px] border border-white/80 bg-white/70 p-2"><div className="flex items-center justify-between"><span className="text-[10px] text-fg">{main.name}</span><span className="text-[13px] font-semibold text-red-500">{main.pct.toFixed(1)}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-red-100/60"><div className="h-full rounded-full bg-red-400/80" style={{ width: `${Math.min(100, main.pct)}%` }} /></div></div><div className="mt-1 text-[9px] text-muted">主要暴露方向：<b className="text-fg">{main.name}</b></div>{main.pct >= 50 ? <div className="mt-1.5 rounded-[13px] border border-red-200/75 bg-red-50/65 p-2"><div className="text-[10px] font-semibold text-red-500">⚠️ 集中度风险提示</div><div className="mt-0.5 text-[9px] leading-[1.45] text-red-500">表面上是 {holdings.length} 只基金，实际方向暴露已达 {main.pct.toFixed(1)}%，同涨同跌效应明显。</div></div> : null}<div className="mt-1.5 text-[9px] text-muted">未检测到明显的重仓股重合（基于名称关键词）</div></> : <div className="mt-1.5 text-[9px] text-muted">暂未形成可靠的板块暴露结果。</div>}<div className="mt-1.5 text-center text-[8px] text-muted">名称关键词仅用于方向归类，实际持仓以基金定期报告为准。</div></div>
        <div className="mt-2 rounded-[14px] border border-white/70 bg-white/45 p-2 text-[8px] leading-[1.5] text-muted"><b className="text-fg">盘中估值方法：</b>交易时段优先使用重仓股穿透估值；同时保留外部基金估值作为交叉参考。当前估值与外部源差异超过 0.8% 时提示估值分歧。9:30–11:30 / 13:00–15:00 自动刷新；午间休市继续沿用并刷新上午最后可靠估值；收盘后不再生成新的盘中估值，等待官方净值。</div>
      </section>
    </Glass>
  );
}

function Metric({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return <div className="rounded-[13px] border border-white/80 bg-white/66 px-1.5 py-1.5 text-center"><div className="text-[8px] text-muted">{label}</div><div className={`mt-0.5 text-[11px] font-semibold ${positive ? "text-emerald-600" : "text-fg"}`}>{value}</div>{sub ? <div className="mt-0.5 text-[7px] text-muted">{sub}</div> : null}</div>;
}
