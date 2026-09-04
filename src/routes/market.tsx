import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { IndexGrid } from "@/components/market/IndexGrid";
import { IndexValuationLights } from "@/components/market/IndexValuationLights";
import { MarketPanorama } from "@/components/market/MarketPanorama";
import { FundSectorWatchV2 } from "@/components/fund-sector/FundSectorWatchV2";
import { OperationAdvice } from "@/components/market/OperationAdvice";
import { EmptyNote, Glass, Tone } from "@/components/ui/Glass";
import { fmtPctShort } from "@/lib/format";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/market")({ component: MarketPage });

type FoldKey = "advice" | "valuation" | "money" | "global";

function MarketPage() {
  const snapshot = useApp((s) => s.snapshot);
  const benchPct = snapshot?.indices[0]?.pct ?? null;
  const [open, setOpen] = useState<Record<FoldKey, boolean>>({
    advice: false,
    valuation: false,
    money: false,
    global: false,
  });

  const toggle = (key: FoldKey) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return <div className="market-page">
    <FundSectorWatchV2 />

    <FoldSection title="操作建议" subtitle="根据自选板块、大盘与可验证资金数据生成" open={open.advice} onToggle={() => toggle("advice")}>
      <OperationAdvice sectors={snapshot?.sectors || []} benchPct={benchPct} />
    </FoldSection>

    {snapshot ? <IndexGrid indices={snapshot.indices} /> : <EmptyNote>指数后台更新中，先看你关注的基金板块。</EmptyNote>}

    <FoldSection title="指数估值红绿灯" subtitle="PE / PB 历史分位，点击查看详细估值" open={open.valuation} onToggle={() => toggle("valuation")}>
      <IndexValuationLights />
    </FoldSection>

    <FoldSection title="资金雷达" subtitle="今天钱往哪儿跑 · 谁在买卖" open={open.money} onToggle={() => toggle("money")}>
      <MarketPanorama />
    </FoldSection>

    <FoldSection title="外围市场" subtitle="主要海外指数表现" open={open.global} onToggle={() => toggle("global")}>
      <Glass className="market-data-card" noPadding>
        {snapshot?.global?.length ? <div className="grid grid-cols-2 gap-2">{snapshot.global.map((g) => <div key={g.name} className="rounded-2xl bg-bg-elevated p-3"><div className="text-xs text-muted">{g.name}</div><Tone v={g.pct} className="text-base font-semibold">{g.pct == null ? "暂无可靠数据" : fmtPctShort(g.pct)}</Tone></div>)}</div> : <p className="text-sm text-muted">外围数据源暂不可用</p>}
      </Glass>
    </FoldSection>

    <div className="px-1 pb-2 text-[10px] text-subtle">{snapshot ? `市场日期 ${snapshot.marketDate || "未知"} · ${snapshot.sources.map((s) => `${s.name}${s.status === "ok" ? "✓" : "×"}`).join(" · ")}` : "市场数据后台加载中"}</div>
  </div>;
}

function FoldSection({ title, subtitle, open, onToggle, children }: { title: string; subtitle: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return <section className="mt-3 overflow-hidden rounded-[24px] border border-white/75 bg-white/44 shadow-[0_16px_44px_rgba(38,78,112,.055),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[22px] saturate-150">
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-white/40" aria-expanded={open}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2><span className="rounded-full bg-white/66 px-2 py-0.5 text-[8px] text-muted ring-1 ring-white/75">{open ? "详情" : "摘要"}</span></div>
        <div className="mt-0.5 truncate text-[9px] text-subtle">{subtitle}</div>
      </div>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/72 text-slate-500 shadow-sm ring-1 ring-white/80">{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
    </button>
    {open ? <div className="border-t border-white/65 px-2 pb-2">{children}</div> : null}
  </section>;
}
