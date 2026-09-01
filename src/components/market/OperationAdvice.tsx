import { Link } from "@tanstack/react-router";
import { calcSixFactor } from "@/lib/calc/six-factor";
import { fmtPctShort } from "@/lib/format";
import type { SectorQuote } from "@/lib/types";
import { Glass } from "@/components/ui/Glass";

function tone(v:number|null){ return v==null?"text-muted":v>0?"text-up":v<0?"text-down":"text-muted"; }
function flow(v:number|null){ return v==null?"—":`${v>=0?"+":""}${(v/1e8).toFixed(2)}亿`; }

export function OperationAdvice({ sectors, benchPct }:{ sectors:SectorQuote[]; benchPct:number|null }) {
  const rows=sectors.map(s=>({s,a:calcSixFactor(s,benchPct)})).filter(x=>x.s.available||x.s.change!=null).sort((a,b)=>b.a.position-a.a.position);
  const avg=rows.length?rows.reduce((sum,x)=>sum+x.a.position,0)/rows.length:null;
  const positive=rows.filter(x=>x.s.change!=null&&x.s.change>0).length;
  const negative=rows.filter(x=>x.s.change!=null&&x.s.change<0).length;
  const sharpDown=rows.filter(x=>x.s.change!=null&&x.s.change<-2).length;
  const outflow=rows.filter(x=>x.s.flow!=null&&x.s.flow<-1e8).length;
  const position=avg==null?"数据不足":avg>=68?"偏高":avg>=55?"中性偏多":avg>=42?"中性":"偏低";
  const top=rows.filter(x=>x.a.position>=60).slice(0,4).map(x=>x.s.name).join("、")||"暂无明确强势板块";
  return <section className="mb-3 overflow-hidden rounded-[24px] border border-white/75 bg-white/48 p-3 shadow-[0_14px_38px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[20px] saturate-150">
    <div className="flex items-end justify-between"><div><div className="text-[16px] font-semibold tracking-tight text-fg">🎯 操作建议 <span className="text-[10px] font-normal text-muted">仅供参考</span></div><div className="mt-0.5 text-[9px] text-muted">六因子证据合成 · 不把单一涨跌当成买卖信号</div></div><Link to="/ai" className="text-[9px] text-blue-600">AI复核 →</Link></div>
    <div className="mt-2.5 rounded-[16px] bg-white/62 p-2.5">
      <div className="text-[12px] font-semibold text-fg">⚡ 短期策略（逐板块）</div>
      <div className="mt-2 overflow-hidden rounded-[13px] ring-1 ring-white/80">
        <div className="grid grid-cols-[1.1fr_.7fr_.85fr_.9fr] gap-1 bg-white/70 px-2 py-1.5 text-[8px] font-semibold text-muted"><span>板块</span><span>涨跌</span><span>板块资金</span><span>建议</span></div>
        {rows.slice(0,10).map(({s,a})=><div key={s.id} className="grid grid-cols-[1.1fr_.7fr_.85fr_.9fr] items-center gap-1 border-t border-white/70 bg-white/48 px-2 py-1.5 text-[9px]"><span className="truncate text-fg">{s.name}</span><span className={`tabular-nums ${tone(s.change)}`}>{s.change==null?"—":fmtPctShort(s.change)}</span><span className={`tabular-nums ${tone(s.flow)}`}>{flow(s.flow)}</span><span className={a.advice.includes("减")||a.advice.includes("空仓")?"font-semibold text-down":"text-fg"}>{a.advice}</span></div>)}
      </div>
    </div>
    <div className="mt-2.5 grid grid-cols-2 gap-2">
      <div className="rounded-[16px] bg-white/58 p-2.5"><div className="text-[10px] font-semibold text-fg">🏗️ 中长期布局</div><div className="mt-1 text-[9px] leading-[1.45] text-muted">强势观察：<b className="text-fg">{top}</b>。以趋势确认和估值安全边际为主，不追单日急涨。</div></div>
      <div className="rounded-[16px] bg-white/58 p-2.5"><div className="text-[10px] font-semibold text-fg">📊 整体仓位</div><div className="mt-1 text-[9px] leading-[1.45] text-muted">当前参考：<b className="text-fg">{position}</b>{avg!=null?` · 综合位置 ${avg.toFixed(0)}/100`:""}。以组合集中度与趋势共同决定，不自动交易。</div></div>
    </div>
    <div className="mt-2.5 rounded-[16px] border border-amber-200/70 bg-amber-50/58 p-2.5"><div className="text-[11px] font-semibold text-amber-700">⚠️ 风险提示</div><div className="mt-0.5 text-[9px] leading-[1.5] text-muted">{sharpDown} 个板块单日跌幅超过 2%，{outflow} 个板块主力净流出明显；今日统计 {positive} 涨 / {negative} 跌。资金、价格或相对强弱证据不足时，系统只给观察建议。</div></div>
  </section>;
}
