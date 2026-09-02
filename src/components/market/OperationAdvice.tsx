import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { calcSixFactor } from "@/lib/calc/six-factor";
import { fmtPctShort } from "@/lib/format";
import type { SectorQuote } from "@/lib/types";
import { SECTOR_RULES } from "@/lib/data/sectors";

const WATCH_KEY = "fund_ai_pro_board_watch_v8";

type WatchItem = { code: string; name: string };

function tone(v:number|null){ return v==null?"text-muted":v>0?"text-up":v<0?"text-down":"text-muted"; }
function flow(v:number|null){ return v==null?"—":`${v>=0?"+":""}${(v/1e8).toFixed(2)}亿`; }
function confidenceTone(v:number){ return v>=75 ? "bg-blue-50 text-blue-600" : v>=60 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"; }
function readWatchedCodes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(WATCH_KEY) || "null") as { items?: WatchItem[] } | null;
    return Array.isArray(raw?.items) ? raw.items.map((x) => String(x?.code ?? "").trim()).filter(Boolean) : [];
  } catch { return []; }
}

export function OperationAdvice({ sectors, benchPct }:{ sectors:SectorQuote[]; benchPct:number|null }) {
  const [watchedCodes, setWatchedCodes] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setWatchedCodes(readWatchedCodes());
    sync();
    const timer = window.setInterval(sync, 500);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => { window.clearInterval(timer); window.removeEventListener("storage", onStorage); };
  }, []);

  const selectedIds = useMemo(() => new Set(
    watchedCodes
      .map((code) => SECTOR_RULES.find((rule) => rule.bkCode === code)?.id)
      .filter((id): id is string => Boolean(id)),
  ), [watchedCodes]);

  const selectedMode = selectedIds.size > 0;
  const rows = useMemo(() => {
    const source = selectedMode ? sectors.filter((s) => selectedIds.has(s.id)) : sectors;
    return source
      .map((s)=>({s,a:calcSixFactor(s,benchPct)}))
      .filter(x=>x.s.available||x.s.change!=null)
      .sort((a,b)=>b.a.position-a.a.position);
  }, [benchPct, selectedIds, selectedMode, sectors]);

  const avg=rows.length?rows.reduce((sum,x)=>sum+x.a.position,0)/rows.length:null;
  const positive=rows.filter(x=>x.s.change!=null&&x.s.change>0).length;
  const negative=rows.filter(x=>x.s.change!=null&&x.s.change<0).length;
  const sharpDown=rows.filter(x=>x.s.change!=null&&x.s.change<-2).length;
  const outflow=rows.filter(x=>x.s.flow!=null&&x.s.flow<-1e8).length;
  const position=avg==null?"数据不足":avg>=68?"偏高":avg>=55?"中性偏多":avg>=42?"中性":"偏低";
  const top=rows.filter(x=>x.a.position>=60).slice(0,4).map(x=>x.s.name).join("、")||"暂无明确强势板块";
  const selectedLabel = selectedMode ? `跟随自选 · ${rows.length} 个板块` : "全市场板块 · 可随自选切换";

  return <section className="mb-3 overflow-hidden rounded-[24px] border border-white/75 bg-white/48 p-3 shadow-[0_14px_38px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[20px] saturate-150">
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0"><div className="text-[16px] font-semibold tracking-tight text-fg">🎯 操作建议 <span className="text-[10px] font-normal text-muted">仅供参考</span></div><div className="mt-0.5 text-[9px] text-muted">六因子规则合成 · 价格、资金、相对强弱、波动、趋势与波段共同约束</div></div>
      <Link to="/ai" className="shrink-0 text-[9px] text-blue-600">AI复核 →</Link>
    </div>

    <div className="mt-2 rounded-[16px] bg-white/62 p-2.5">
      <div className="flex items-center justify-between gap-2"><div className="text-[12px] font-semibold text-fg">⚡ 短期策略</div><span className="rounded-full bg-white/75 px-2 py-1 text-[8px] text-slate-500">{selectedLabel}</span></div>
      <div className="mt-2 overflow-x-auto rounded-[13px] ring-1 ring-white/80">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-[1.05fr_.65fr_.85fr_.55fr_.7fr_1fr_.7fr] gap-1 bg-white/70 px-2 py-1.5 text-[8px] font-semibold text-muted">
            <span>板块</span><span>涨跌</span><span>资金</span><span>趋势</span><span>波段</span><span>建议</span><span>置信</span>
          </div>
          {rows.slice(0,10).map(({s,a})=><div key={s.id} className="grid grid-cols-[1.05fr_.65fr_.85fr_.55fr_.7fr_1fr_.7fr] items-center gap-1 border-t border-white/70 bg-white/48 px-2 py-2 text-[9px]">
            <span className="truncate font-medium text-fg">{s.name}</span>
            <span className={`tabular-nums ${tone(s.change)}`}>{s.change==null?"—":fmtPctShort(s.change)}</span>
            <span className={`tabular-nums ${tone(s.flow)}`}>{flow(s.flow)}</span>
            <span className="text-slate-700">{a.trendLabel}</span>
            <span className="text-slate-700">{a.band}</span>
            <span className={a.advice.includes("减")||a.advice.includes("空仓")?"font-semibold text-down":"font-medium text-slate-700"}>{a.advice}</span>
            <span className="inline-flex w-fit flex-col items-center gap-0.5"><span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${confidenceTone(a.confidence)}`}>{a.confidence}%</span><span className="text-[8px] text-slate-400">{a.level}</span></span>
          </div>)}
          {!rows.length ? <div className="px-3 py-4 text-center text-[9px] text-slate-400">没有可靠板块数据，暂不生成方向性建议。</div> : null}
        </div>
      </div>
    </div>

    <div className="mt-2.5 grid grid-cols-2 gap-2">
      <div className="rounded-[16px] bg-white/58 p-2.5"><div className="text-[10px] font-semibold text-fg">🏗️ 中长期布局</div><div className="mt-1 text-[9px] leading-[1.45] text-muted">强势观察：<b className="text-fg">{top}</b>。趋势确认与估值安全边际优先，不追单日急涨。</div></div>
      <div className="rounded-[16px] bg-white/58 p-2.5"><div className="text-[10px] font-semibold text-fg">📊 整体仓位</div><div className="mt-1 text-[9px] leading-[1.45] text-muted">当前参考：<b className="text-fg">{position}</b>{avg!=null?` · 综合位置 ${avg.toFixed(0)}/100`:""}。结合组合集中度与板块信号，不自动交易。</div></div>
    </div>

    <div className="mt-2.5 rounded-[16px] border border-amber-200/70 bg-amber-50/58 p-2.5"><div className="text-[11px] font-semibold text-amber-700">⚠️ 风险提示</div><div className="mt-0.5 text-[9px] leading-[1.5] text-muted">{sharpDown} 个板块单日跌幅超过 2%，{outflow} 个板块主力净流出明显；今日统计 {positive} 涨 / {negative} 跌。资金、趋势或相对强弱证据不足时，只给观察建议。</div></div>
  </section>;
}
