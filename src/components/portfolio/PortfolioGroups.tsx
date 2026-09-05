import { useEffect, useMemo, useState } from "react";
import { FolderPlus, Settings2, X } from "lucide-react";
import { Glass, Tone } from "@/components/ui/Glass";
import { calcPortfolioReturn, type PortfolioReturn } from "@/lib/calc/portfolio-returns";
import { fmtMoney, fmtPctShort } from "@/lib/format";
import type { FundQuote, Holding } from "@/lib/types";

type Props = { holdings: Holding[]; funds: Record<string, FundQuote>; onFilter: (codes: Set<string> | null) => void };
type Saved = { groups: string[]; assignments: Record<string,string> };
const KEY = "fund_ai_pro_portfolio_groups_v1";
const DEFAULT_GROUPS = ["稳健组合", "定投组合", "观察清单"];
function read(): Saved { if (typeof window === "undefined") return { groups: DEFAULT_GROUPS, assignments: {} }; try { const raw=JSON.parse(localStorage.getItem(KEY)||"null") as Partial<Saved>|null; const groups=Array.isArray(raw?.groups)?raw!.groups.map(String).filter(Boolean):DEFAULT_GROUPS; const assignments=raw?.assignments&&typeof raw.assignments==="object"?raw.assignments as Record<string,string>:{}; return { groups:[...new Set([...DEFAULT_GROUPS,...groups])], assignments }; } catch { return { groups: DEFAULT_GROUPS, assignments: {} }; } }
function write(value: Saved){ try{localStorage.setItem(KEY,JSON.stringify(value));}catch{} }
function groupReturn(codes:Set<string>|null, holdings:Holding[], funds:Record<string,FundQuote>): PortfolioReturn | null { const rows=codes?holdings.filter(h=>codes.has(h.code)):holdings; return rows.length?calcPortfolioReturn(rows,funds):null; }
export function PortfolioGroups({ holdings, funds, onFilter }: Props){
  const [saved,setSaved]=useState<Saved>(read);
  const [active,setActive]=useState("全部");
  const [manage,setManage]=useState(false);
  const [newGroup,setNewGroup]=useState("");
  useEffect(()=>write(saved),[saved]);
  const counts=useMemo(()=>{const m:Record<string,number>={}; for(const h of holdings){const g=saved.assignments[h.code]||"未分组";m[g]=(m[g]||0)+1;} return m;},[holdings,saved]);
  const codes=active==="全部"?null:new Set(holdings.filter(h=>(saved.assignments[h.code]||"未分组")===active).map(h=>h.code));
  const summary=useMemo(()=>groupReturn(codes,holdings,funds),[codes,holdings,funds]);
  useEffect(()=>onFilter(codes),[active,saved,holdings]);
  const choose=(g:string)=>{setActive(g); const next=g==="全部"?null:new Set(holdings.filter(h=>(saved.assignments[h.code]||"未分组")===g).map(h=>h.code)); onFilter(next);};
  const addGroup=()=>{const g=newGroup.trim(); if(!g||saved.groups.includes(g))return; setSaved(s=>({...s,groups:[...s.groups,g]}));setNewGroup("");};
  const assign=(code:string,g:string)=>setSaved(s=>({...s,assignments:{...s.assignments,[code]:g}}));
  const removeGroup=(g:string)=>{setSaved(s=>({groups:s.groups.filter(x=>x!==g),assignments:Object.fromEntries(Object.entries(s.assignments).map(([code,val])=>[code,val===g?"未分组":val]))}));if(active===g)choose("全部");};
  return <>
    <Glass className="mb-3 overflow-hidden rounded-[22px] p-3">
      <div className="flex items-center justify-between gap-2"><div><div className="text-[15px] font-semibold text-fg">投资组合</div><div className="mt-0.5 text-[9px] text-muted">按组合查看当日收益、暴露与持仓</div></div><button type="button" onClick={()=>setManage(true)} className="flex size-8 items-center justify-center rounded-full bg-white/75 text-slate-500 ring-1 ring-white/85" aria-label="管理分组"><Settings2 size={15}/></button></div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">{["全部",...saved.groups,"未分组"].map(g=><button key={g} type="button" onClick={()=>choose(g)} className={`shrink-0 rounded-full px-3 py-1.5 text-[9px] font-semibold ${active===g?"bg-blue-500 text-white":"bg-white/70 text-slate-500 ring-1 ring-white/80"}`}>{g}<span className="ml-1 opacity-70">{g==="全部"?holdings.length:counts[g]||0}</span></button>)}</div>
      {summary?<div className="mt-2 grid grid-cols-3 gap-1.5"><div className="rounded-xl bg-white/62 p-2"><div className="text-[8px] text-muted">组合收益</div><Tone v={summary.holdingPnl} className="mt-0.5 text-[14px] font-bold">{fmtMoney(summary.holdingPnl)}</Tone></div><div className="rounded-xl bg-white/62 p-2"><div className="text-[8px] text-muted">今日</div><Tone v={summary.todayPnl} className="mt-0.5 text-[14px] font-bold">{summary.todayPnl==null?"—":fmtMoney(summary.todayPnl)}</Tone></div><div className="rounded-xl bg-white/62 p-2"><div className="text-[8px] text-muted">今日幅度</div><Tone v={summary.todayPnlPct} className="mt-0.5 text-[14px] font-bold">{summary.todayPnlPct==null?"—":fmtPctShort(summary.todayPnlPct)}</Tone></div></div>:null}
    </Glass>
    {manage?<div className="fixed inset-0 z-[7000] flex items-end bg-slate-950/20 backdrop-blur-sm" onClick={()=>setManage(false)}><div className="w-full max-h-[82vh] overflow-y-auto rounded-t-[28px] bg-white/90 p-4 shadow-[0_-20px_70px_rgba(22,42,64,.2)]" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between"><div className="text-[16px] font-semibold">管理投资组合</div><button type="button" onClick={()=>setManage(false)} className="flex size-8 items-center justify-center rounded-full bg-slate-100"><X size={15}/></button></div><div className="mt-3 flex gap-2"><input value={newGroup} onChange={e=>setNewGroup(e.target.value)} placeholder="新建组合，如每周定投" className="h-10 min-w-0 flex-1 rounded-xl bg-slate-50 px-3 text-[11px] outline-none"/><button type="button" onClick={addGroup} className="flex h-10 items-center gap-1 rounded-xl bg-slate-900 px-3 text-[10px] font-semibold text-white"><FolderPlus size={14}/>新建</button></div><div className="mt-3 space-y-2">{[...holdings].map(h=><div key={h.code} className="flex items-center gap-2 rounded-[16px] bg-slate-50 px-2.5 py-2"><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold">{funds[h.code]?.name||h.name}</div><div className="text-[8px] text-slate-400">{h.code}</div></div><select value={saved.assignments[h.code]||"未分组"} onChange={e=>assign(h.code,e.target.value)} className="h-9 w-[112px] rounded-xl bg-white px-2 text-[9px] outline-none ring-1 ring-slate-200"><option>未分组</option>{saved.groups.map(g=><option key={g}>{g}</option>)}</select></div>)}</div><div className="mt-3 flex flex-wrap gap-1.5">{saved.groups.map(g=><button key={g} type="button" onClick={()=>removeGroup(g)} className="rounded-full bg-rose-50 px-2.5 py-1 text-[8px] text-rose-600">删除 {g}</button>)}</div><div className="mt-3 text-[8px] leading-relaxed text-slate-400">分组仅保存在本机。组合收益沿用统一持仓估值口径；未取得可靠行情的基金不强行填数。</div></div></div>:null}
  </>;
}
