import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { getFund } from "@/lib/data/server";
import { getMultiSourceQuote } from "@/lib/data/multi-source-quotes";
import { fmtPctShort } from "@/lib/format";
import { isChinaTradingSession } from "@/lib/data/market-session";
import { Tone } from "@/components/ui/Glass";
import type { FundQuote, Holding, SectorQuote } from "@/lib/types";
import type { CrossCheckedHolding } from "@/lib/data/live-quote-cross-check-v2";

type Sample = { ts: number; fundPct: number; fundNav?: number; benchPct?: number };
type Props = { holding: Holding; fund?: FundQuote; sector?: SectorQuote; benchPct: number | null };
const STORAGE = "fund_ai_pro_intraday_curve_v1";
const ESTIMATE_STORAGE = "fund_ai_pro_estimate_close_v1";
const MAX_SAMPLES = 700;
function todayKey(ts:number){const d=new Date(ts+8*60*60*1000);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;}
function readSamples(code:string):Sample[]{if(typeof window==="undefined")return[];try{const all=JSON.parse(localStorage.getItem(STORAGE)||"{}") as Record<string,Sample[]>;return Array.isArray(all[code])?all[code].filter(x=>x&&Number.isFinite(x.ts)&&Number.isFinite(x.fundPct)).slice(-MAX_SAMPLES):[];}catch{return[];}}
function saveSamples(code:string,samples:Sample[]){try{const all=JSON.parse(localStorage.getItem(STORAGE)||"{}") as Record<string,Sample[]>;all[code]=samples.slice(-MAX_SAMPLES);localStorage.setItem(STORAGE,JSON.stringify(all));}catch{}}
function saveEstimate(code:string,s:Sample){try{const all=JSON.parse(localStorage.getItem(ESTIMATE_STORAGE)||"{}");all[code]={...s};localStorage.setItem(ESTIMATE_STORAGE,JSON.stringify(all));}catch{}}
function readEstimate(code:string):Sample|null{try{const all=JSON.parse(localStorage.getItem(ESTIMATE_STORAGE)||"{}");const x=all?.[code];return x&&Number.isFinite(x.ts)?x:null;}catch{return null;}}
function pathFor(values:number[], width=320, height=90){if(values.length<2)return "";const min=Math.min(...values),max=Math.max(...values),range=Math.max(0.01,max-min);return values.map((v,i)=>`${i?"L":"M"}${(i/(values.length-1))*width},${height-8-((v-min)/range)*(height-16)}`).join(" ");}

export function FundIntelligenceStrip({holding,fund,sector,benchPct}:Props){
  const [open,setOpen]=useState(false);
  const [samples,setSamples]=useState<Sample[]>(() => readSamples(holding.code));
  const [liveFund,setLiveFund]=useState<FundQuote|undefined>(fund);
  const [liveBench,setLiveBench]=useState<number|null>(benchPct);
  const [refreshing,setRefreshing]=useState(false);
  const holdings=(liveFund as FundQuote & {liveHoldings?:CrossCheckedHolding[]}|undefined)?.liveHoldings??[];

  const refresh=async()=>{setRefreshing(true);try{const [next,bench]=await Promise.all([getFund({data:{code:holding.code}}),getMultiSourceQuote("000300")]);setLiveFund(next);setLiveBench(bench.pct);if(isChinaTradingSession()){const pct=next.estimatePct??next.dayPct;if(pct!=null&&Number.isFinite(pct)){const s={ts:Date.now(),fundPct:pct,fundNav:next.estimate??undefined,benchPct:bench.pct??undefined};const nextSamples=[...readSamples(holding.code),s].filter(x=>todayKey(x.ts)===todayKey(Date.now())).slice(-MAX_SAMPLES);saveSamples(holding.code,nextSamples);setSamples(nextSamples);if(next.estimate!=null)saveEstimate(holding.code,s);}}}catch{}finally{setRefreshing(false);}};
  useEffect(()=>{setLiveFund(fund);setLiveBench(benchPct);if(!open)return;void refresh();const id=window.setInterval(()=>void refresh(),30_000);return()=>window.clearInterval(id);},[open,holding.code]);

  const latest=liveFund??fund;
  const curve=samples.length?samples:[];
  const fundPath=pathFor(curve.map(x=>x.fundPct));
  const benchPath=pathFor(curve.map(x=>x.benchPct??0));
  const closeEstimate=readEstimate(holding.code);
  const deviation=latest?.officialNavPublished&&closeEstimate?.fundNav!=null&&latest.nav!=null&&latest.nav>0&&todayKey(closeEstimate.ts)===todayKey(Date.now())?((closeEstimate.fundNav-latest.nav)/latest.nav)*100:null;
  const estimateOfficialAlert=deviation!=null&&Math.abs(deviation)>=1;
  const top=useMemo(()=>holdings.filter(h=>h.pct!=null).slice().sort((a,b)=>((b.weight*(b.pct??0))-(a.weight*(a.pct??0)))).slice(0,10),[holdings]);
  const topContribution=holdings.filter(h=>h.pct!=null).reduce((s,h)=>s+(h.weight/100)*(h.pct??0),0);
  const sectorGap=sector?.change!=null&&latest?.dayPct!=null?latest.dayPct-sector.change:null;
  const rebalanceClue=latest&&latest.estimateDeviation!=null&&latest.estimateDeviation>=0.8?"估值路线存在明显偏差，结合公开持仓继续观察可能的调仓。":top.length&&Math.abs(topContribution-(latest.estimatePct??latest.dayPct??topContribution))>0.8?"前十大重仓股推演与基金整体估值存在持续差异，可能存在未披露仓位变化。":"目前没有足够证据确认调仓，仅保留观察线索。";

  return <section className="mt-2 overflow-hidden rounded-[18px] border border-white/80 bg-white/55 ring-1 ring-white/70">
    <button type="button" onClick={()=>setOpen(v=>!v)} className="flex w-full items-center justify-between gap-2 px-2.5 py-2.5 text-left"><div><div className="text-[11px] font-semibold text-fg">穿透与估值智能面板</div><div className="mt-0.5 text-[8px] text-muted">盘中曲线 · 沪深300对比 · 前十大 · 调仓线索 · 官方偏差</div></div><span className="flex size-7 items-center justify-center rounded-full bg-white/75 text-slate-500 ring-1 ring-white/90">{open?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</span></button>
    {open?<div className="border-t border-black/[.04] px-2.5 pb-2.5 pt-2">
      <div className="grid grid-cols-3 gap-1.5"><div className="rounded-xl bg-white/64 p-2"><div className="text-[8px] text-muted">估值可信度</div><b className="text-[12px]">{latest?.estimateConfidence==="high"?"高":latest?.estimateConfidence==="medium"?"中":latest?.estimateConfidence==="low"?"低":"—"}</b></div><div className="rounded-xl bg-white/64 p-2"><div className="text-[8px] text-muted">估算覆盖</div><b className="text-[12px]">{latest?.estimateCoverage==null?"—":`${latest.estimateCoverage.toFixed(0)}%`}</b></div><div className="rounded-xl bg-white/64 p-2"><div className="text-[8px] text-muted">路线分歧</div><b className="text-[12px]">{latest?.estimateRouteSpreadPct==null?"—":`${latest.estimateRouteSpreadPct.toFixed(2)}%`}</b></div></div>
      <div className="mt-2 rounded-[15px] bg-white/64 p-2"><div className="flex items-center justify-between"><div className="text-[10px] font-semibold">9:30–15:00 盘中估算曲线</div><button type="button" onClick={e=>{e.stopPropagation();void refresh();}} className="flex size-7 items-center justify-center rounded-full bg-white/75 ring-1 ring-white/90" aria-label="刷新穿透数据"><RefreshCw className={refreshing?"animate-spin":""} size={12}/></button></div><div className="mt-1 flex items-center gap-2 text-[8px] text-muted"><span>估算 {curve.length} 个本机采样点</span><span>·</span><span>沪深300 {liveBench==null?"—":fmtPctShort(liveBench)}</span></div><div className="mt-1.5 overflow-hidden rounded-xl bg-slate-50/70"><svg viewBox="0 0 320 90" className="h-24 w-full" role="img" aria-label="基金盘中估算与沪深300对比曲线"><path d={fundPath||"M0,45 L320,45"} fill="none" stroke="currentColor" strokeWidth="2.2" className="text-blue-500"/><path d={benchPath||"M0,45 L320,45"} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" className="text-slate-400"/></svg></div><div className="mt-1 text-[7px] leading-[1.4] text-subtle">曲线为页面打开期间的30秒采样，不虚构“每秒成交净值”。</div></div>
      <div className="mt-2 rounded-[15px] bg-white/64 p-2"><div className="flex items-center justify-between"><div className="text-[10px] font-semibold">官方净值验证</div>{deviation!=null?<Tone v={deviation} className="text-[11px] font-bold">估算→官方偏差 {fmtPctShort(deviation)}</Tone>:<span className="text-[8px] text-muted">收盘后自动比对</span>}</div>{estimateOfficialAlert?<div className="mt-1 rounded-xl bg-red-50/70 px-2 py-1 text-[8px] text-red-600">偏差超过1%，已进入异常观察。</div>:<div className="mt-1 text-[8px] leading-[1.45] text-muted">公开估算与官方净值一旦同时存在，就按实际净值计算偏差，不用推测数字。</div>}</div>
      <div className="mt-2 rounded-[15px] bg-white/64 p-2"><div className="flex items-center justify-between"><div className="text-[10px] font-semibold">前十大重仓实时驱动</div><span className="text-[8px] text-muted">可用 {top.length}/10</span></div>{top.length?<div className="mt-1.5 space-y-1">{top.map((h,i)=><div key={h.code} className="flex items-center gap-2 text-[8px]"><span className="w-3 text-slate-400">{i+1}</span><span className="min-w-0 flex-1 truncate">{h.name||h.code}</span><span className="text-slate-400">{h.weight.toFixed(1)}%</span><Tone v={h.pct} className="w-[48px] text-right font-semibold">{h.pct==null?"—":fmtPctShort(h.pct)}</Tone><span className="w-[58px] text-right text-[7px] text-muted">贡献 {(h.weight/100)*(h.pct??0)>=0?"+":""}{((h.weight/100)*(h.pct??0)).toFixed(2)}%</span></div>)}</div>:<div className="mt-1 text-[8px] text-muted">当前没有可验证的前十大实时个股行情；继续保留官方持仓，不自行补造。</div>}<div className="mt-1.5 text-[8px] text-muted">前十大合计推演贡献 {top.length?fmtPctShort(topContribution):"—"}。这是持仓贡献推演，不等同基金最终净值。</div></div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2"><div className="rounded-[15px] bg-white/64 p-2"><div className="text-[10px] font-semibold">主题/行业贡献代理</div><div className="mt-1 text-[8px] leading-[1.45] text-muted">基金行业归因目前以公开基金名称→主题映射为代理，不冒充完整底层行业回归。{sector?.change!=null?` 当前${sector.name} ${fmtPctShort(sector.change)}，基金日涨跌 ${fmtPctShort(latest?.dayPct??null)}。${sectorGap!=null?`相差 ${sectorGap>=0?"+":""}${sectorGap.toFixed(2)}个百分点。`:""}`:"暂无可靠主题板块行情。"}</div></div><div className="rounded-[15px] bg-white/64 p-2"><div className="text-[10px] font-semibold">动态调仓线索</div><div className="mt-1 text-[8px] leading-[1.45] text-muted">{rebalanceClue}</div><div className="mt-1 text-[7px] text-subtle">线索≠确认；只有连续偏差与后续官方披露才能确认。</div></div></div>
    </div>:null}
  </section>;
}
