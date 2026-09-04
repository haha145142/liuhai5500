import { Link } from "@tanstack/react-router";
import { Glass } from "@/components/ui/Glass";
import type { SectorQuote } from "@/lib/types";
import { fmtPctShort } from "@/lib/format";

export function MarketHeatmap({ boards, sectors }: { boards: SectorQuote[]; sectors: SectorQuote[] }) {
  const rows = (boards.length ? boards : sectors).filter(x=>x.change!=null).sort((a,b)=>(b.change??0)-(a.change??0)).slice(0,24);
  return <Glass className="mt-3 rounded-[22px] p-3"><div className="flex items-center justify-between"><div><div className="text-[15px] font-semibold">行业 / 主题涨跌热力图</div><div className="mt-0.5 text-[9px] text-muted">按最近可用行情排列；点击进入轮动雷达与相关基金池</div></div><span className="text-[8px] text-subtle">{rows.length} 项</span></div>{rows.length?<div className="mt-2 grid grid-cols-3 gap-1.5">{rows.map(r=><Link key={`${r.id}-${r.bkCode}`} to="/rotation" onClick={()=>{try{localStorage.setItem("fund_ai_pro_rotation_focus",r.id);}catch{}}} className="rounded-[14px] bg-white/62 p-2 ring-1 ring-white/75 active:scale-[.99]"><div className="truncate text-[9px] font-medium">{r.name}</div><div className={`mt-1 text-[12px] font-bold tabular-nums ${(r.change??0)>=0?"text-red-500":"text-emerald-600"}`}>{fmtPctShort(r.change)}</div></Link>)}</div>:<div className="mt-2 rounded-xl bg-white/55 px-3 py-4 text-center text-[9px] text-muted">等待板块行情</div>}<div className="mt-1.5 text-[7px] text-subtle">涨跌色仅代表市场报价方向，不把板块新闻直接等同于行情。</div></Glass>;
}
