import { Link } from "@tanstack/react-router";
import { Glass } from "@/components/ui/Glass";
import type { SectorQuote } from "@/lib/types";
import { calcSixFactor } from "@/lib/calc/six-factor";

export function TodayAiInsight({ sectors, benchPct }:{ sectors:SectorQuote[]; benchPct:number|null }) {
  const rows=sectors.map(s=>({s,a:calcSixFactor(s,benchPct)})).filter(x=>x.s.change!=null).sort((a,b)=>b.a.position-a.a.position);
  const leading=rows.slice(0,2).map(x=>x.s.name).join("、")||"暂无明确强势板块";
  const risk=rows.filter(x=>x.s.change!=null&&x.s.change<-1.5).map(x=>x.s.name).slice(0,2).join("、")||"暂无明显急跌板块";
  const flowOut=rows.filter(x=>x.s.flow!=null&&x.s.flow<0).length;
  const text=rows.length?`市场当前以结构性轮动为主，${leading}相对占优；${risk}需要防守。板块资金${flowOut}个出现净流出，结论以行情与资金双证据为准。`:"等待可靠行情证据后生成今日观点。";
  return <Glass className="mb-3 overflow-hidden rounded-[22px] border border-slate-700/80 bg-slate-950/90 p-3 text-white shadow-[0_16px_40px_rgba(2,6,23,.22)] backdrop-blur-[26px]">
    <div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-full bg-amber-300/15 text-xl">👑</span><div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">AI 智能研判 <span className="ml-1 rounded-full bg-blue-400/15 px-2 py-0.5 text-[9px] text-blue-200">今日观点</span></div><div className="mt-1 line-clamp-2 text-[10px] leading-[1.45] text-slate-300">{text}</div></div><Link to="/ai" className="shrink-0 rounded-full border border-slate-600/80 px-3 py-1.5 text-[10px] text-slate-200">查看详情 ›</Link></div>
  </Glass>;
}
