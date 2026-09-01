import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, CircleDollarSign, ChevronRight, ListPlus, Repeat2, RotateCcw, Sparkles, X } from "lucide-react";
import { FundSectorWatchV2 } from "@/components/fund-sector/FundSectorWatchV2";
import { Glass, Tone } from "@/components/ui/Glass";
import { useApp } from "@/lib/store";
import { calcPortfolioReturn } from "@/lib/calc/portfolio-returns";
import { fmtMoney, fmtPctShort } from "@/lib/format";

const SERVICES = [
  ["/funds","基金排行","🏆"],["/market","行情中心","📈"],["/band","波段信号","🌈"],["/ai","AI证据链","✨"],["/news","市场资讯","📰"],["/portfolio","收益日历","🗓️"],["/portfolio","交易记录","📋"],["/portfolio","止盈止损","🎯"],["/portfolio","持仓分析","🔎"],["/portfolio","估值中心","💹"],["/settings","风险设置","🛡️"],["/settings","账户服务","⚙️"]
] as const;

export function HomeDashboardV2() {
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  const snapshot = useApp((s) => s.snapshot);
  const [open, setOpen] = useState(false);
  const summary = portfolio.length ? calcPortfolioReturn(portfolio, funds) : null;
  return <div className="home-dashboard-v2 pb-4">
    <Glass tight className="rounded-[28px] bg-white/55 p-4 shadow-[0_18px_50px_rgba(38,78,112,.10),inset_0_1px_0_rgba(255,255,255,.96)] backdrop-blur-[30px]">
      <div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-[11px] text-slate-500"><span>总资产</span><Bell className="size-3.5"/></div><div className="mt-1 text-[30px] font-bold tracking-tight text-slate-950 tabular-nums">{summary?.marketValue == null ? "—" : fmtMoney(summary.marketValue)}</div></div><span className="rounded-full bg-white/70 px-2 py-1 text-[9px] text-slate-500">{portfolio.length ? `持仓 ${portfolio.length}只` : "尚未建仓"}</span></div>
      <div className="mt-4 grid grid-cols-2 gap-2.5"><Metric label="最新日收益" value={summary?.todayPnl == null ? "—" : fmtMoney(summary.todayPnl)} tone={summary?.todayPnl ?? null}/><Metric label="持有收益率" value={summary?.holdingPnlPct == null ? "—" : fmtPctShort(summary.holdingPnlPct)} tone={summary?.holdingPnlPct ?? null}/></div>
      <div className="mt-3 flex justify-between border-t border-white/70 pt-3 text-[9px] text-slate-400"><span>{snapshot?.marketDate || "等待行情日期"}</span><span>数据实时校验</span></div>
    </Glass>
    <div className="mt-3 grid grid-cols-4 gap-2.5"><Action label="买入" icon={<CircleDollarSign/>}/><Action label="定投" icon={<ListPlus/>}/><Action label="转换" icon={<Repeat2/>}/><Action label="赎回" icon={<RotateCcw/>}/></div>
    <section className="mt-4"><div className="mb-2 flex items-end justify-between"><div><div className="text-[16px] font-semibold text-slate-950">自选 / 持仓</div><div className="text-[10px] text-slate-400">基金实时状态 · 紧凑浏览</div></div><Link to="/portfolio" className="text-[10px] font-medium text-blue-600">管理</Link></div>{portfolio.length ? <Glass tight className="overflow-hidden p-0"><div className="divide-y divide-white/70">{portfolio.map((h)=>{const f=funds[h.code]; const r=f?calcPortfolioReturn([h],{[h.code]:f}):null; return <Link key={h.code} to="/portfolio" className="flex items-center gap-3 px-3.5 py-3 active:bg-white/45"><span className="flex size-9 items-center justify-center rounded-[14px] bg-white/70 shadow-sm">📈</span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold text-slate-900">{f?.name||h.name}</span><span className="mt-0.5 block text-[9px] text-slate-400">{h.code} · 净值 {f?.nav==null?"—":f.nav.toFixed(4)}</span></span><Tone v={r?.todayPnlPct??null} className="text-[15px] font-bold tabular-nums">{r?.todayPnlPct==null?"—":fmtPctShort(r.todayPnlPct)}</Tone><ChevronRight className="size-3.5 text-slate-300"/></Link>})}</div></Glass>:<Glass tight className="border-dashed text-center"><div className="py-4 text-[11px] text-slate-500">还没有持仓</div><Link to="/portfolio" className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3.5 py-2 text-[10px] text-white">添加基金<ChevronRight className="size-3"/></Link></Glass>}</section>
    <section className="mt-3"><FundSectorWatchV2 portfolio={portfolio} funds={funds}/></section>
    <button type="button" onClick={()=>setOpen(true)} className="mt-1 flex w-full items-center justify-between rounded-[22px] border border-white/75 bg-white/62 px-4 py-3.5 shadow-[0_12px_32px_rgba(38,78,112,.10)] backdrop-blur-[26px]" aria-label="打开全部服务"><span className="flex items-center gap-2.5"><span className="flex size-9 items-center justify-center rounded-full bg-slate-900 text-white"><Sparkles className="size-4"/></span><span><span className="block text-[13px] font-semibold text-slate-900">全部服务</span><span className="block text-[9px] text-slate-400">低频功能集中收纳</span></span></span><ChevronRight className="size-4 text-slate-400"/></button>
    {open?<div className="fixed inset-0 z-[7000] flex items-end bg-slate-950/24 backdrop-blur-[4px]" role="dialog" aria-modal="true" onClick={()=>setOpen(false)}><div className="w-full rounded-t-[30px] bg-white/80 px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 backdrop-blur-[32px]" onClick={(e)=>e.stopPropagation()}><div className="flex items-center justify-between"><div><div className="text-[18px] font-semibold text-slate-950">全部服务</div><div className="text-[10px] text-slate-400">3×4 宫格，首页不堆菜单</div></div><button type="button" onClick={()=>setOpen(false)} aria-label="关闭全部服务" className="flex size-9 items-center justify-center rounded-full bg-white/70"><X className="size-4"/></button></div><div className="mt-4 grid grid-cols-3 gap-2.5">{SERVICES.map(([to,title,icon])=><Link key={`${to}-${title}`} to={to} onClick={()=>setOpen(false)} className="rounded-[18px] bg-white/62 px-2 py-3 text-center ring-1 ring-white/80"><span className="mx-auto flex size-10 items-center justify-center rounded-[14px] bg-white/72 text-lg shadow-sm">{icon}</span><span className="mt-2 block truncate text-[10px] font-semibold text-slate-800">{title}</span></Link>)}</div></div></div>:null}
  </div>
}
function Metric({label,value,tone}:{label:string;value:string;tone:number|null}){return <div className="rounded-[18px] bg-white/54 px-3 py-2.5 ring-1 ring-white/75"><div className="text-[9px] text-slate-400">{label}</div><Tone v={tone} className="mt-1 block text-[16px] font-bold tabular-nums">{value}</Tone></div>}
function Action({label,icon}:{label:string;icon:ReactNode}){return <Link to="/portfolio" className="flex min-h-[72px] flex-col items-center justify-center rounded-[20px] border border-white/75 bg-white/62 text-slate-700 shadow-[0_10px_26px_rgba(38,78,112,.08)] backdrop-blur-[24px] active:scale-[0.97]"><span className="flex size-9 items-center justify-center rounded-full bg-white/78 shadow-sm">{icon}</span><span className="mt-1.5 text-[11px] font-semibold">{label}</span></Link>}
