import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Glass, Tone } from "@/components/ui/Glass";
import { useApp } from "@/lib/store";
import { riskStats } from "@/lib/calc/hidden-sector-regression";
import { fmtPctShort } from "@/lib/format";
export const Route = createFileRoute("/compare")({ component: ComparePage });
type M={label:string;value:(x:{fund:any;stats:any})=>string;tone?:(x:{fund:any;stats:any})=>number|null};
function ComparePage(){
 const portfolio=useApp(s=>s.portfolio),funds=useApp(s=>s.funds);
 const[selected,setSelected]=useState<string[]>(()=>portfolio.slice(0,5).map(x=>x.code));
 const rows=useMemo(()=>selected.map(c=>funds[c]).filter(Boolean),[funds,selected]);
 const data=useMemo(()=>rows.map(f=>({fund:f,stats:riskStats(f.history)})),[rows]);
 const toggle=(c:string)=>setSelected(v=>v.includes(c)?v.filter(x=>x!==c):v.length<5?[...v,c]:v);
 const metrics:M[]=[
  {label:"近1月收益",value:({fund})=>fund.monthPct==null?"—":fmtPctShort(fund.monthPct),tone:({fund})=>fund.monthPct??null},
  {label:"最大回撤",value:({stats})=>stats.maxDrawdownPct==null?"—":fmtPctShort(-stats.maxDrawdownPct)},
  {label:"夏普比率",value:({stats})=>stats.sharpe==null?"—":stats.sharpe.toFixed(2)},
  {label:"年化波动",value:({stats})=>stats.volatilityPct==null?"—":fmtPctShort(stats.volatilityPct)},
  {label:"估值可信度",value:({fund})=>fund.estimateConfidence==="high"?"高":fund.estimateConfidence==="medium"?"中":fund.estimateConfidence==="low"?"低":"—"}
 ];
 return <div className="space-y-3">
  <Glass className="rounded-[24px] p-3"><div className="text-[17px] font-semibold">基金多维对比</div><div className="mt-0.5 text-[9px] text-muted">最多5只 · 同屏比较收益、回撤、夏普、波动和估值可信度</div><div className="mt-2 space-y-1.5">{portfolio.map(h=><button key={h.code} type="button" onClick={()=>toggle(h.code)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[10px] ring-1 ${selected.includes(h.code)?"bg-blue-50 ring-blue-200":"bg-white/60 ring-white/80"}`}><span className="truncate">{funds[h.code]?.name||h.name} <span className="text-muted">{h.code}</span></span><span>{selected.includes(h.code)?"已选":"选择"}</span></button>)}</div></Glass>
  {rows.length?<Glass className="overflow-x-auto rounded-[24px] p-3"><div className="min-w-[660px]"><div className="grid grid-cols-[1.2fr_repeat(5,.8fr)] gap-1 text-[8px] text-muted"><span>指标</span>{rows.map(f=><span key={f.code} className="truncate font-medium text-fg">{f.name||f.code}</span>)}</div>{metrics.map(metric=><div key={metric.label} className="mt-1 grid grid-cols-[1.2fr_repeat(5,.8fr)] gap-1"><span className="rounded-xl bg-white/50 px-2 py-2 text-[8px] text-muted">{metric.label}</span>{data.map(x=><Tone key={x.fund.code} v={metric.tone?.(x)??null} className="rounded-xl bg-white/62 px-2 py-2 text-[8px] font-semibold">{metric.value(x)}</Tone>)}</div>)}<div className="mt-2 rounded-xl bg-blue-50/45 p-2 text-[8px] leading-[1.5] text-muted">相关性与经理换手率只有在公开持仓证据足够时才做定量计算；数据不足时保持空白。</div></div></Glass>:<Glass className="p-6 text-center text-[10px] text-muted">先在“我的持仓”添加基金。</Glass>}
 </div>;
}