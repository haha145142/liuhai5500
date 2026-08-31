import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { getFundSectorQuotes, type FundSectorQuote } from "@/lib/data/server";
import { DEFAULT_FUND_SECTOR_IDS, FUND_SECTORS } from "@/lib/data/fund-sectors";
import { fmtPctShort } from "@/lib/format";
import type { FundQuote, Holding } from "@/lib/types";

const KEY="fund_ai_pro_fund_sector_watch_v3";
type Prefs={ids:string[]};
function readPrefs():Prefs{if(typeof window==="undefined")return{ids:DEFAULT_FUND_SECTOR_IDS};try{const x=JSON.parse(localStorage.getItem(KEY)||"null") as Partial<Prefs>|null;const ids=Array.isArray(x?.ids)?x.ids.filter((v):v is string=>typeof v==="string"&&FUND_SECTORS.some(s=>s.id===v)):[];return{ids:ids.length?ids:DEFAULT_FUND_SECTOR_IDS};}catch{return{ids:DEFAULT_FUND_SECTOR_IDS};}}
function tone(v:number|null){return v==null?"text-subtle":v>0?"text-up":v<0?"text-down":"text-muted";}

export function FundSectorWatchV2({portfolio=[],funds={}}:{portfolio?:Holding[];funds?:Record<string,FundQuote>}){
  const[{ids},setPrefs]=useState<Prefs>(readPrefs);const[rows,setRows]=useState<FundSectorQuote[]>([]);const[page,setPage]=useState(0);const[open,setOpen]=useState<string|null>(null);const[adding,setAdding]=useState(false);const[loading,setLoading]=useState(true);const[message,setMessage]=useState("");
  const pages=Math.max(1,Math.ceil(rows.length/2));
  const visible=useMemo(()=>rows.slice(page*2,page*2+2),[page,rows]);
  useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify({ids}));}catch{}},[ids]);
  useEffect(()=>{setLoading(true);setOpen(null);void getFundSectorQuotes({data:{ids}}).then(r=>{setRows(r.rows);setMessage(r.weekend?"周末休市 · 沿用最近交易日数据":"");}).catch(()=>setMessage("板块行情暂不可用 · 请稍后刷新")).finally(()=>setLoading(false));},[ids.join(",")]);
  useEffect(()=>{if(page>=pages)setPage(Math.max(0,pages-1));},[page,pages]);
  const remove=(id:string)=>setPrefs(p=>({ids:p.ids.filter(x=>x!==id)}));
  const add=(id:string)=>{setPrefs(p=>({ids:p.ids.includes(id)?p.ids:[...p.ids,id]}));setAdding(false);};
  const available=FUND_SECTORS.filter(s=>!ids.includes(s.id));
  return <section className="mb-3 overflow-hidden rounded-[26px] border border-white/70 bg-white/55 p-3 shadow-[0_14px_40px_rgba(30,76,125,.08)] backdrop-blur-[14px]">
    <div className="flex items-center justify-between gap-3"><div><div className="text-base font-semibold tracking-tight text-fg">自选基金板块</div><div className="text-[10px] text-subtle">一次显示最多 2 个 · 左右切换</div></div><button type="button" onClick={()=>setAdding(v=>!v)} aria-label="添加板块" className="flex size-9 items-center justify-center rounded-full bg-fg text-bg"><Plus size={17}/></button></div>
    {adding?<div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{available.slice(0,24).map(s=><button key={s.id} type="button" onClick={()=>add(s.id)} className="shrink-0 rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-medium ring-1 ring-border">{s.icon} {s.name}</button>)}</div>:null}
    {loading&&!rows.length?<div className="mt-3 rounded-2xl bg-bg-elevated px-3 py-7 text-center text-xs text-subtle">正在读取板块实时数据…</div>:null}
    <div className="mt-3 space-y-2">{visible.map(row=>{const isOpen=open===row.id;return <div key={row.id} className="overflow-hidden rounded-[22px] bg-white/72 ring-1 ring-black/[.035] shadow-[0_8px_24px_rgba(30,76,125,.05)]"><button type="button" onClick={()=>setOpen(isOpen?null:row.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left"><span className="text-xl">{row.icon}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-fg">{row.name}</span><span className="text-[10px] text-subtle">{row.validCount}/{row.totalCount}</span></div><div className="mt-1 text-[10px] text-subtle">{row.up} 涨 · {row.down} 跌{row.leader?` · 领涨 ${row.leader.name}`:""}</div></div><div className={`text-lg font-bold tabular-nums ${tone(row.pct)}`}>{row.pct==null?"—":fmtPctShort(row.pct)}</div><ChevronRight size={16} className={`text-subtle transition ${isOpen?"rotate-90":""}`}/></button>{isOpen?<div className="border-t border-black/[.05] px-4 pb-3 pt-2"><div className="space-y-1">{row.funds.slice(0,8).map(f=><div key={f.code} className="flex items-center gap-2 rounded-xl bg-bg-elevated/70 px-2.5 py-2"><div className="min-w-0 flex-1 truncate text-[10px] text-fg">{f.name}<span className="ml-1 text-[8px] text-subtle">{f.code}</span></div><span className={`text-[10px] font-semibold tabular-nums ${tone(f.pct)}`}>{f.pct==null?"—":fmtPctShort(f.pct)}</span></div>)}</div><div className="mt-2 flex justify-end"><button type="button" onClick={()=>remove(row.id)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[9px] text-subtle hover:bg-black/[.04]"><X size={11}/>移除</button></div></div>:null}</div>})}</div>
    {rows.length>2?<div className="mt-3 flex items-center justify-center gap-2"><button type="button" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} className="flex size-8 items-center justify-center rounded-full bg-white/80 ring-1 ring-border disabled:opacity-30"><ChevronLeft size={15}/></button><span className="text-[10px] font-medium tabular-nums text-subtle">{page+1} / {pages}</span><button type="button" disabled={page===pages-1} onClick={()=>setPage(p=>Math.min(pages-1,p+1))} className="flex size-8 items-center justify-center rounded-full bg-white/80 ring-1 ring-border disabled:opacity-30"><ChevronRight size={15}/></button></div>:null}
    {message?<div className="mt-2 text-[9px] text-subtle">{message}</div>:null}
  </section>;
}
