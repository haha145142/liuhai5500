import { createFileRoute } from "@tanstack/react-router";
import { IndexGrid } from "@/components/market/IndexGrid";
import { MarketPanorama } from "@/components/market/MarketPanorama";
import { FundSectorWatchV2 } from "@/components/fund-sector/FundSectorWatchV2";
import { OperationAdvice } from "@/components/market/OperationAdvice";
import { TodayAiInsight } from "@/components/market/TodayAiInsight";
import { EmptyNote, Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { fmtPctShort } from "@/lib/format";
import { useApp } from "@/lib/store";

export const Route=createFileRoute("/market")({component:MarketPage});
function MarketPage(){
  const snapshot=useApp(s=>s.snapshot); const portfolio=useApp(s=>s.portfolio); const funds=useApp(s=>s.funds);
  const benchPct=snapshot?.indices[0]?.pct??null;
  return <div className="market-page">
    <FundSectorWatchV2 portfolio={portfolio} funds={funds}/>
    <OperationAdvice sectors={snapshot?.sectors||[]} benchPct={benchPct}/>
    <TodayAiInsight sectors={snapshot?.sectors||[]} benchPct={benchPct}/>
    {snapshot?<IndexGrid indices={snapshot.indices}/>:<EmptyNote>指数后台更新中，先看你关注的基金板块。</EmptyNote>}
    <MarketPanorama/>
    <Glass className="market-data-card"><SectionTitle title="外围市场"/>{snapshot?.global?.length?<div className="grid grid-cols-2 gap-2">{snapshot.global.map(g=><div key={g.name} className="rounded-2xl bg-bg-elevated p-3"><div className="text-xs text-muted">{g.name}</div><Tone v={g.pct} className="text-base font-semibold">{g.pct==null?"暂无可靠数据":fmtPctShort(g.pct)}</Tone></div>)}</div>:<p className="text-sm text-muted">外围数据源暂不可用</p>}</Glass>
    <div className="px-1 pb-2 text-[10px] text-subtle">{snapshot?`市场日期 ${snapshot.marketDate||"未知"} · ${snapshot.sources.map(s=>`${s.name}${s.status==="ok"?"✓":"×"}`).join(" · ")}`:"市场数据后台加载中"}</div>
  </div>;
}
