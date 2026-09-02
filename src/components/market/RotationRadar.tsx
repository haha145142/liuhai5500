import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Plus } from "lucide-react";
import { Glass, SectionTitle } from "@/components/ui/Glass";
import { useApp } from "@/lib/store";
import { SECTOR_RULES } from "@/lib/data/sectors";
import { getSectorFunds, type SectorFundRow } from "@/lib/data/sector-funds";
import { fmtPctShort } from "@/lib/format";
import type { SectorQuote } from "@/lib/types";

type Row = { id:string; name:string; bkCode:string; change:number|null; flow:number|null; streak:number; score:number; label:string; etfCode?:string; etfName?:string };
const CANDIDATE_KEY = "fund_ai_pro_fund_candidates_v1";

function normalize(values:number[], value:number|null) {
  if(value==null || !Number.isFinite(value) || values.length<2) return value==null?0:50;
  const min=Math.min(...values), max=Math.max(...values);
  return max===min?50:((value-min)/(max-min))*100;
}

function buildRows(sectors:SectorQuote[]):Row[] {
  const usable=sectors.filter((s)=>s.change!=null || s.flow!=null);
  const changes=usable.map((s)=>s.change).filter((v):v is number=>v!=null && Number.isFinite(v));
  const flows=usable.map((s)=>s.flow).filter((v):v is number=>v!=null && Number.isFinite(v));
  return usable.map((s)=>{
    const rule=SECTOR_RULES.find((r)=>r.id===s.id || r.name===s.name);
    const changeScore=normalize(changes,s.change);
    const flowScore=normalize(flows,s.flow);
    const streakScore=Math.max(0,Math.min(100,50+s.streak*10));
    const parts=[changeScore*(changes.length?0.6:0),flowScore*(flows.length?0.3:0),streakScore*0.1];
    const weight=(changes.length?0.6:0)+(flows.length?0.3:0)+0.1;
    const score=Math.round(weight?parts.reduce((a,b)=>a+b,0)/weight:50);
    const label=score>=75?"强势":score>=60?"偏强":score>=40?"中性":score>=25?"偏弱":"弱势";
    return {id:s.id,name:s.name,bkCode:s.bkCode,change:s.change,flow:s.flow,streak:s.streak,score,label,etfCode:rule?.etf?.code,etfName:rule?.etf?.name};
  }).sort((a,b)=>b.score-a.score).slice(0,8);
}

function fundTrend(row:SectorFundRow) {
  const reason=row.matchReason;
  const trend=reason.match(/趋势[^·]*/)?.[0]?.trim();
  const band=reason.match(/波段[^·]*/)?.[0]?.trim();
  return { trend:trend||"趋势数据不足", band:band||"波段数据不足" };
}

function fundType(type:string) {
  return /ETF|指数|LOF/i.test(type) ? "ETF/指数" : "主动基金";
}

function loadCandidateCodes() {
  if(typeof window === "undefined") return new Set<string>();
  try { const rows=JSON.parse(localStorage.getItem(CANDIDATE_KEY)||"[]"); return new Set(Array.isArray(rows)?rows.map((x)=>String(x?.code||"")).filter((x)=>/^\d{6}$/.test(x)):[]); } catch { return new Set<string>(); }
}

function saveCandidateCodes(codes:Set<string>) {
  try { localStorage.setItem(CANDIDATE_KEY, JSON.stringify([...codes].map((code)=>({code})))); } catch {}
}

export function RotationRadar() {
  const snapshot=useApp((s)=>s.snapshot);
  const rows=useMemo(()=>buildRows(snapshot?.sectors||[]),[snapshot]);
  const [selectedId,setSelectedId]=useState<string>("");
  const [fundRows,setFundRows]=useState<SectorFundRow[]>([]);
  const [loadingFunds,setLoadingFunds]=useState(false);
  const [candidateCodes,setCandidateCodes]=useState<Set<string>>(loadCandidateCodes);

  const selected=rows.find((r)=>r.id===selectedId)??rows[0];
  useEffect(()=>{ if(!selected){setFundRows([]);return;} let live=true; setLoadingFunds(true); void getSectorFunds({data:{code:selected.bkCode}}).then((next)=>{if(live)setFundRows(next.slice(0,6));}).catch(()=>{if(live)setFundRows([]);}).finally(()=>{if(live)setLoadingFunds(false);}); return()=>{live=false;}; },[selected?.id,selected?.bkCode]);
  const toggleCandidate=(code:string)=>setCandidateCodes((prev)=>{const next=new Set(prev);if(next.has(code))next.delete(code);else next.add(code);saveCandidateCodes(next);return next;});

  return <div className="space-y-3">
    <Glass className="overflow-hidden rounded-[22px] p-3"><SectionTitle title="AI 轮动雷达" hint="板块强度 · 资金确认 · 数据推断" />
      {rows.length ? <div className="space-y-1.5">{rows.map((r,i)=><button key={r.id} type="button" onClick={()=>setSelectedId(r.id)} className={`block w-full rounded-[17px] px-2.5 py-2.5 text-left ring-1 transition ${selected?.id===r.id?"bg-accent/10 ring-accent/25":"bg-white/55 ring-white/75"}`}><div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[9px] font-bold text-accent">{i+1}</span><div className="min-w-0"><div className="truncate text-[10px] font-semibold text-fg">{r.name}</div><div className="mt-0.5 text-[7px] text-subtle">事实：涨幅 {r.change==null?"暂无":fmtPctShort(r.change)} · 资金 {r.flow==null?"暂无":r.flow.toFixed(0)}</div></div></div><span className="shrink-0 rounded-full bg-white/75 px-2 py-1 text-[8px] font-semibold text-fg">{r.score} · {r.label}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80"><div className="h-full rounded-full bg-accent" style={{width:`${r.score}%`}} /></div><div className="mt-1.5 flex items-center justify-between gap-2 text-[7px] text-subtle"><span>{r.etfCode&&r.etfName?`代表ETF：${r.etfName} ${r.etfCode}`:"暂无可靠代表ETF映射"}</span><span>{r.streak>0?`连续${r.streak}日`:r.streak<0?`连续${Math.abs(r.streak)}日偏弱`:"连续性暂无"}</span></div></button>)}</div> : <div className="rounded-xl bg-white/50 px-3 py-5 text-center text-[9px] text-muted">暂无可靠板块轮动数据</div>}
      <div className="mt-2 rounded-xl bg-blue-50/45 px-2.5 py-2 text-[8px] leading-[1.45] text-muted">评分是基于当前板块涨跌、资金流和连续性做的排序推断，不把推断当成事实；选中板块后会在本页继续展开真实基金池。</div>
    </Glass>

    {selected?<Glass className="overflow-hidden rounded-[22px] p-3"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="text-xs font-semibold text-fg">{selected.name} · 关联基金池</div><div className="mt-0.5 text-[8px] text-subtle">真实排行数据优先 · 无数据则回退代表ETF</div></div><Link to="/market" className="shrink-0 rounded-xl bg-white/70 px-2 py-1 text-[8px] font-semibold text-accent ring-1 ring-white/90">去市场页</Link></div>
      {loadingFunds?<div className="mt-2 rounded-xl bg-white/50 px-3 py-4 text-center text-[9px] text-muted">正在读取相关基金…</div>:fundRows.length?<div className="mt-2 space-y-1.5">{fundRows.map((f)=><article key={f.code} className="rounded-[17px] bg-white/55 px-2.5 py-2.5 ring-1 ring-white/75"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-[10px] font-semibold text-fg">{f.name}</div><div className="mt-0.5 text-[7px] text-subtle">{f.code} · {fundType(f.type)}</div></div><span className="shrink-0 rounded-full bg-accent/10 px-2 py-1 text-[8px] font-semibold text-accent">{f.day==null?"暂无":fmtPctShort(f.day)}</span></div><div className="mt-1.5 grid grid-cols-3 gap-1 text-center text-[7px] text-muted"><span>1月 {f.month==null?"—":fmtPctShort(f.month)}</span><span>1年 {f.oneYear==null?"—":fmtPctShort(f.oneYear)}</span><span>{fundTrend(f).trend}</span></div><div className="mt-1 flex items-center justify-between gap-2 text-[7px] text-subtle"><span>{fundTrend(f).band}</span><span>{f.valuationTrust?`估值可信 ${f.valuationTrust.score}/100`:"估值可信度暂缺"}</span></div><button type="button" onClick={()=>toggleCandidate(f.code)} className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-xl bg-white/70 px-2 py-1.5 text-[8px] font-semibold text-accent ring-1 ring-white/90">{candidateCodes.has(f.code)?<Check size={11}/>:<Plus size={11}/>} {candidateCodes.has(f.code)?"已加入候选":"加入候选"}</button></article>)}</div>:<div className="mt-2 rounded-xl bg-white/50 px-3 py-4 text-center text-[9px] text-muted">暂无可靠关联基金数据</div>}
    </Glass>:null}
  </div>;
}
