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
import { getSnapshot } from "@/lib/data/server";
import { getLatestTradingMarketData } from "@/lib/data/market-fallback";
import type { Snapshot } from "@/lib/types";

export const Route = createFileRoute("/market")({
  loader: async () => {
    const [snapshotResult, fallbackResult] = await Promise.allSettled([getSnapshot(), getLatestTradingMarketData()]);
    const snapshot = snapshotResult.status === "fulfilled" ? snapshotResult.value : null;
    const fallback = fallbackResult.status === "fulfilled" ? fallbackResult.value : null;
    if (!snapshot && !fallback) return null;
    const base = snapshot ?? { indices: [], sectors: [], boards: [], flow: null, global: [], sources: [], fetchedAt: Date.now(), marketDate: fallback?.marketDate ?? null };
    const fallbackIndices = new Map((fallback?.indices ?? []).map((x) => [x.code, x]));
    const fallbackSectors = new Map((fallback?.sectors ?? []).map((x) => [x.id, x]));
    const indices = base.indices.map((x) => {
      const fb = fallbackIndices.get(x.code);
      return { ...x, price: x.price ?? fb?.price ?? null, pct: x.pct ?? fb?.pct ?? null, change: x.change ?? fb?.change ?? null };
    });
    const sectors = base.sectors.map((x) => {
      const fb = fallbackSectors.get(x.id);
      return { ...x, change: x.change ?? fb?.change ?? null, available: x.change != null || fb?.change != null };
    });
    return { ...base, indices, sectors, marketDate: base.marketDate || fallback?.marketDate || null } satisfies Snapshot;
  },
  component: MarketPage,
});

type FoldKey = "advice" | "valuation" | "money" | "global";

function MarketPage() {
  const initial = Route.useLoaderData();
  const storeSnapshot = useApp((s) => s.snapshot);
  const snapshot = initial ?? storeSnapshot;
  const benchPct = snapshot?.indices[0]?.pct ?? null;
  const [open, setOpen] = useState<Record<FoldKey, boolean>>({ advice: false, valuation: false, money: false, global: false });
  const toggle = (key: FoldKey) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return <div className="market-page">
    <FundSectorWatchV2 />
    <FoldSection title="操作建议" subtitle={benchPct == null ? "根据自选板块与最近交易日行情生成" : `大盘 ${fmtPctShort(benchPct)} · 根据可验证数据生成`} open={open.advice} onToggle={() => toggle("advice")}><OperationAdvice sectors={snapshot?.sectors || []} benchPct={benchPct} /></FoldSection>
    {snapshot?.indices?.length ? <IndexGrid indices={snapshot.indices} /> : <EmptyNote>行情正在连接，请点击右上角刷新。</EmptyNote>}
    <FoldSection title="指数估值红绿灯" subtitle="PE / PB 历史分位，点击查看详细估值" open={open.valuation} onToggle={() => toggle("valuation")}><IndexValuationLights /></FoldSection>
    <FoldSection title="资金雷达" subtitle={snapshot?.flow ? `主力净流入 ${formatMoney(snapshot.flow.main)}` : "资金快照加载中"} open={open.money} onToggle={() => toggle("money")}><MarketPanorama /></FoldSection>
    <FoldSection title="外围市场" subtitle={globalSummary(snapshot?.global)} open={open.global} onToggle={() => toggle("global")}>
      <div className="rounded-[18px] bg-white/52 p-2 ring-1 ring-white/70">
        {snapshot?.global?.filter((g) => g.price != null || g.pct != null).length ? <div className="grid grid-cols-2 gap-2">{snapshot.global.filter((g) => g.price != null || g.pct != null).map((g) => <div key={g.name} className="rounded-2xl bg-bg-elevated p-3"><div className="text-xs text-muted">{g.name}</div><Tone v={g.pct} className="text-base font-semibold">{g.pct == null ? "—" : fmtPctShort(g.pct)}</Tone></div>)}</div> : <p className="text-sm text-muted">等待可验证外围行情</p>}
      </div>
    </FoldSection>
    <div className="px-1 pb-2 text-[10px] text-subtle">{snapshot ? `市场日期 ${snapshot.marketDate || "最近交易日"} · ${snapshot.sources.map((s) => `${s.name}${s.status === "ok" ? "✓" : "×"}`).join(" · ")}` : "行情数据连接中"}</div>
  </div>;
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value / 1e8).toFixed(2)}亿`;
}
function globalSummary(global: Snapshot["global"] | undefined) {
  const usable = global?.filter((g) => g.price != null || g.pct != null) ?? [];
  return usable.length ? `${usable.length} 项已更新` : "海外行情待连接";
}

function FoldSection({ title, subtitle, open, onToggle, children }: { title: string; subtitle: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return <section className="mt-3 overflow-hidden rounded-[24px] border border-white/75 bg-white/44 shadow-[0_16px_44px_rgba(38,78,112,.055),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[22px] saturate-150">
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-white/40" aria-expanded={open}>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2><span className="rounded-full bg-white/66 px-2 py-0.5 text-[8px] text-muted ring-1 ring-white/75">{open ? "详情" : "数据"}</span></div><div className="mt-0.5 truncate text-[9px] text-subtle">{subtitle}</div></div>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/72 text-slate-500 shadow-sm ring-1 ring-white/80">{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
    </button>
    {open ? <div className="border-t border-white/65 px-2 pb-2">{children}</div> : null}
  </section>;
}
