import { useEffect, useMemo, useState } from "react";
import { Tone } from "@/components/ui/Glass";
import { fmtMoney, fmtPctShort, fmtPrice } from "@/lib/format";
import type { FundQuote, Holding } from "@/lib/types";

type Props = { holding: Holding; fund?: FundQuote; price: number | null; officialToday: boolean };
type State = { base: number; lastAction: number | null; lastKind: string | null };
const KEY = "fund_ai_pro_swing_plan_v1";

function load(code: string, fallback: number): State {
  if (typeof window === "undefined") return { base: fallback, lastAction: null, lastKind: null };
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}");
    const x = all?.[code];
    return x?.base > 0 ? x : { base: fallback, lastAction: null, lastKind: null };
  } catch { return { base: fallback, lastAction: null, lastKind: null }; }
}
function save(code: string, state: State) {
  try { const all = JSON.parse(localStorage.getItem(KEY) || "{}"); all[code] = state; localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
}
function daysSince(ts: number | null) { return ts == null ? null : Math.max(0, Math.floor((Date.now() - ts) / 86400000)); }
function ma(values: number[], n: number) { return values.length >= n ? values.slice(-n).reduce((a,b)=>a+b,0)/n : null; }

export function SwingPlan({ holding, fund, price, officialToday }: Props) {
  const [state, setState] = useState<State>(() => load(holding.code, holding.cost));
  useEffect(() => { setState(load(holding.code, holding.cost)); }, [holding.code, holding.cost]);
  useEffect(() => { save(holding.code, state); }, [holding.code, state]);

  const base = state.base > 0 ? state.base : holding.cost;
  const current = price ?? fund?.nav ?? fund?.estimate ?? null;
  const change = current != null ? ((current-base)/base)*100 : null;
  const points = fund?.historyPoints?.map(x=>x.nav).filter(x=>Number.isFinite(x)) ?? [];
  const ma20w = ma(points, 100);
  const prev20w = points.length >= 120 ? ma(points.slice(0,-20),100) : null;
  const trend = ma20w == null ? "数据不足" : prev20w == null ? "待确认" : ma20w > prev20w ? "向上" : ma20w < prev20w ? "向下" : "走平";
  const inRange = trend === "走平" || trend === "待确认";
  const grid = change == null ? "—" : change >= 20 ? "+20% 附近" : change >= 15 ? "+15% 档" : change >= 10 ? "+10% 档" : change <= -20 ? "-20% 以下" : change <= -15 ? "-15% 档" : change <= -10 ? "-10% 档" : "基准区间";
  const swingValue = current != null ? current * holding.shares * 0.20 : null;
  const stepValue = swingValue != null ? swingValue / 3 : null;
  const eligible = state.lastAction == null || (daysSince(state.lastAction) ?? 0) >= 30;
  const holdEligible = state.lastAction == null || (daysSince(state.lastAction) ?? 0) >= 7;

  const action = useMemo(() => {
    if (current == null || change == null) return { kind:"等待数据", text:"净值/估值不足，暂不下结论" };
    if (officialToday) return { kind:"持有/等下一档", text:"今日官方净值已发布，按官方净值判断，不再用估值决策" };
    if (!inRange) return { kind:"持有", text: trend === "向上" ? "20周趋势向上，避免卖飞；只在明确大涨档位减波段仓" : "20周趋势向下，停止补仓，先评估基金是否变差" };
    if (change >= 20) return { kind:"卖出", text:"波段仓接近 +20% 档：可清掉剩余波段仓，底仓不动" };
    if (change >= 15) return { kind:"卖出", text:"波段仓进入 +15% 档：卖出波段仓 1/3" };
    if (change >= 10) return { kind:"卖出", text:"波段仓进入 +10% 档：卖出波段仓 1/3" };
    if (change <= -20) return { kind:"停止补仓", text:"跌幅达到 -20%：停止补仓，先评估基金基本面/趋势" };
    if (change <= -15) return { kind:"买入", text:"进入 -15% 档：若闲置资金充足，可买回/补入波段仓 1/3" };
    if (change <= -10) return { kind:"买入", text:"进入 -10% 档：若闲置资金充足，可买入波段仓 1/3" };
    return { kind:"持有", text:"处于网格中间，不追涨杀跌，等待 10%~15% 大波段" };
  }, [current, change, officialToday, inRange, trend]);

  const mark = () => setState({ ...state, lastAction: Date.now(), lastKind: action.kind });
  const reset = () => setState({ base: current ?? holding.cost, lastAction: null, lastKind: null });
  const warning = change != null && change <= -25 ? "已触发 -25% 风控线：无条件停止补仓。" : trend === "向下" ? "趋势风控：20周均线向下，不按网格机械补仓。" : !eligible ? `距离上次操作 ${daysSince(state.lastAction)} 天，未满30天，建议继续等待。` : !holdEligible ? "距上次操作不足7天，不建议产生新的赎回动作。" : "";

  return <section className="mt-3 rounded-2xl bg-white/65 p-3 ring-1 ring-white/70">
    <div className="flex items-start justify-between gap-2">
      <div><b className="text-sm">💰 大波段做T · 卖出提示</b><div className="mt-0.5 text-[10px] text-muted">场外基金专用 · 底仓80% + 波段仓20% · 网格10%/15%/20%</div></div>
      <span className="rounded-full bg-bg-elevated px-2 py-1 text-[10px] font-semibold">{action.kind}</span>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
      <Metric label="净值 vs 基准" value={change==null?"—":fmtPctShort(change)} tone={change} />
      <Metric label="当前网格" value={grid} />
      <Metric label="20周趋势" value={trend} />
      <Metric label="波段仓建议" value={stepValue==null?"—":fmtMoney(stepValue)+" /批"} />
    </div>
    <div className="mt-3 rounded-xl bg-bg-elevated p-3 text-xs">
      <div className="font-semibold">现在：{action.text}</div>
      <div className="mt-1 text-[11px] text-muted">建议金额按当前持仓市值的20%作为波段仓，再拆成3批；不是让你一次梭哈。</div>
    </div>
    <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] text-center">
      <Rule label="+10%" text="卖 1/3"/><Rule label="+15%" text="再卖 1/3"/><Rule label="+20%" text="清波段仓"/>
      <Rule label="-10%" text="买 1/3"/><Rule label="-15%" text="再买 1/3"/><Rule label="-20%" text="停补评估"/>
    </div>
    <div className="mt-2 text-[11px] text-muted">上次操作：{state.lastAction==null?"暂无":`${daysSince(state.lastAction)} 天前 · ${state.lastKind||"操作"}`} · 基准价 {fmtPrice(base,4)}{ma20w!=null?` · 20周均线 ${fmtPrice(ma20w,4)}`:""}</div>
    {warning ? <div className="mt-2 rounded-xl bg-bg-elevated p-2 text-[11px] font-semibold">⚠️ {warning}</div> : null}
    <div className="mt-2 flex gap-2">
      <button type="button" onClick={mark} disabled={action.kind==="持有"||action.kind==="等待数据"||action.kind==="持有/等下一档"} className="flex-1 rounded-xl bg-accent py-2 text-xs font-semibold text-accent-fg disabled:opacity-40">记录本次操作</button>
      <button type="button" onClick={reset} className="rounded-xl bg-bg-elevated px-3 py-2 text-xs">重设基准</button>
    </div>
    <div className="mt-2 text-[10px] leading-relaxed text-muted">仅作规则化辅助，不代表保证收益；场外基金按确认日/赎回费规则执行，实际成交净值以基金公司确认结果为准。</div>
  </section>;
}
function Rule({label,text}:{label:string;text:string}){return <div className="rounded-xl bg-white/60 p-2"><div>{label}</div><b>{text}</b></div>}
function Metric({label,value,tone}:{label:string;value:string;tone?:number|null}){return <div className="rounded-xl bg-white/55 p-2 text-center"><div className="text-[10px] text-subtle">{label}</div>{tone===undefined?<div className="mt-0.5 font-semibold tabular-nums">{value}</div>:<Tone v={tone} className="mt-0.5 block font-semibold">{value}</Tone>}</div>}
