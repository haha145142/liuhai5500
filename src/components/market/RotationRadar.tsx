import { Link } from "@tanstack/react-router";
import { Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { useApp } from "@/lib/store";
import { SECTOR_RULES } from "@/lib/data/sectors";
import { fmtPctShort } from "@/lib/format";

type Row = { id:string; name:string; change:number|null; flow:number|null; streak:number; score:number; label:string; etfCode?:string; etfName?:string };

function normalize(values:number[], value:number|null) {
  if(value==null || !Number.isFinite(value) || values.length<2) return value==null?0:50;
  const min=Math.min(...values), max=Math.max(...values);
  return max===min?50:((value-min)/(max-min))*100;
}

function buildRows(sectors:ReturnType<typeof useApp.getState>["snapshot"] extends infer S ? NonNullable<S>["sectors"] : never):Row[] {
  const usable=sectors.filter((s)=>s.change!=null || s.flow!=null);
  const changes=usable.map((s)=>s.change).filter((v):v is number=>v!=null && Number.isFinite(v));
  const flows=usable.map((s)=>s.flow).filter((v):v is number=>v!=null && Number.isFinite(v));
  return usable.map((s)=>{
    const rule=SECTOR_RULES.find((r)=>r.id===s.id || r.name===s.name);
    const changeScore=normalize(changes,s.change);
    const flowScore=normalize(flows,s.flow);
    const streakScore=Math.max(0,Math.min(100,50+s.streak*10));
    const parts=[changeScore*(changes.length?0.6:0),flowScore*(flows.length?0.3:0),streakScore*(s.streak!=null?0.1:0)];
    const weight=(changes.length?0.6:0)+(flows.length?0.3:0)+(s.streak!=null?0.1:0);
    const score=Math.round(weight?parts.reduce((a,b)=>a+b,0)/weight:50);
    const label=score>=75?"强势":score>=60?"偏强":score>=40?"中性":score>=25?"偏弱":"弱势";
    return {id:s.id,name:s.name,change:s.change,flow:s.flow,streak:s.streak,score,label,etfCode:rule?.etf?.code,etfName:rule?.etf?.name};
  }).sort((a,b)=>b.score-a.score).slice(0,8);
}

export function RotationRadar() {
  const snapshot=useApp((s)=>s.snapshot);
  const rows=buildRows(snapshot?.sectors||[]);
  return <Glass className="mt-3 overflow-hidden rounded-[22px] p-3"><SectionTitle title="AI 轮动雷达" hint="板块强度 · 资金确认 · 数据推断" />
    {rows.length ? <div className="space-y-1.5">{rows.map((r,i)=><Link key={r.id} to="/market" className="block rounded-[17px] bg-white/55 px-2.5 py-2.5 ring-1 ring-white/75"><div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[9px] font-bold text-accent">{i+1}</span><div className="min-w-0"><div className="truncate text-[10px] font-semibold text-fg">{r.name}</div><div className="mt-0.5 text-[7px] text-subtle">事实：涨幅 {r.change==null?"暂无":fmtPctShort(r.change)} · 资金 {r.flow==null?"暂无":r.flow.toFixed(0)}</div></div></div><span className="shrink-0 rounded-full bg-white/75 px-2 py-1 text-[8px] font-semibold text-fg">{r.score} · {r.label}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80"><div className="h-full rounded-full bg-accent" style={{width:`${r.score}%`}} /></div><div className="mt-1.5 flex items-center justify-between text-[7px] text-subtle"><span>{r.etfCode&&r.etfName?`代表ETF：${r.etfName} ${r.etfCode}`:"暂无可靠代表ETF映射"}</span><span>{r.streak>0?`连续${r.streak}日`:r.streak<0?`连续${Math.abs(r.streak)}日偏弱`:"连续性暂无"}</span></div></Link>)}</div> : <div className="rounded-xl bg-white/50 px-3 py-5 text-center text-[9px] text-muted">暂无可靠板块轮动数据</div>}
    <div className="mt-2 rounded-xl bg-blue-50/45 px-2.5 py-2 text-[8px] leading-[1.45] text-muted">评分是基于当前板块涨跌、资金流和连续性做的排序推断，不把推断当成事实；点击板块可回到市场页继续展开基金池。</div>
  </Glass>;
}
