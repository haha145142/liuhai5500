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
import { getGlobalMarketFallback } from "@/lib/data/global-market-fallback";
import { getChinaMacroOverview, type ChinaMacro } from "@/lib/data/china-macro";
import type { Snapshot } from "@/lib/types";

export const Route = createFileRoute("/market")({
  loader: async () => {
    const [snapshotResult, fallbackResult, globalResult, macroResult] = await Promise.allSettled([
      getSnapshot(),
      getLatestTradingMarketData(),
      getGlobalMarketFallback(),
      getChinaMacroOverview(),
    ]);
    const snapshot = snapshotResult.status === "fulfilled" ? snapshotResult.value : null;
    const fallback = fallbackResult.status === "fulfilled" ? fallbackResult.value : null;
    const globalFallback = globalResult.status === "fulfilled" ? globalResult.value : [];
    const macro = macroResult.status === "fulfilled" ? macroResult.value : null;
    if (!snapshot && !fallback) return { snapshot: null, macro };
    const base = snapshot ?? {
      indices: [], sectors: [], boards: [], flow: null, global: [], sources: [], fetchedAt: Date.now(),
      marketDate: fallback?.marketDate ?? null,
    };
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
    const globalByName = new Map(globalFallback.map((x) => [x.name, x]));
    const global = base.global.map((x) => {
      const fb = globalByName.get(x.name);
      return { ...x, price: x.price ?? fb?.price ?? null, pct: x.pct ?? fb?.pct ?? null };
    });
    const extraGlobal = globalFallback.filter((x) => !global.some((g) => g.name === x.name));
    return { snapshot: { ...base, indices, sectors, global: [...global, ...extraGlobal], marketDate: base.marketDate || fallback?.marketDate || null } satisfies Snapshot, macro };
  },
  component: MarketPage,
});

type FoldKey = "heat" | "money" | "valuation" | "global";

function MarketPage() {
  const initial = Route.useLoaderData();
  const storeSnapshot = useApp((s) => s.snapshot);
  const snapshot = initial?.snapshot ?? storeSnapshot;
  const macro = initial?.macro as ChinaMacro | null | undefined;
  const benchPct = snapshot?.indices[0]?.pct ?? null;
  const [open, setOpen] = useState<Record<FoldKey, boolean>>({ heat: true, money: true, valuation: false, global: true });
  const toggle = (key: FoldKey) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  const sectors = (snapshot?.sectors || []).filter((x) => x.change != null).sort((a, b) => (b.change ?? 0) - (a.change ?? 0));
  const inflow = sectors.filter((x) => (x.flow ?? 0) > 0).slice(0, 5);
  const outflow = sectors.filter((x) => (x.flow ?? 0) < 0).sort((a, b) => (a.flow ?? 0) - (b.flow ?? 0)).slice(0, 5);

  return <div className="market-page space-y-3">
    <Glass className="rounded-[26px] p-3">
      <div className="text-[18px] font-semibold tracking-tight text-fg">市场</div>
      <div className="mt-0.5 text-[10px] text-muted">核心指数 · 行业热力 · 股债关系 · 资金方向</div>
      {snapshot?.indices?.length ? <div className="mt-3"><IndexGrid indices={snapshot.indices} /></div> : <EmptyNote>正在读取最近交易日行情…</EmptyNote>}
    </Glass>

    <Glass className="rounded-[26px] p-3">
      <div className="text-[16px] font-semibold text-fg">股债跷跷板</div>
      <div className="mt-0.5 text-[9px] text-muted">用沪深300与10年国债收益率观察风险偏好，不直接生成买卖指令。</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Metric label="沪深300" value={benchPct == null ? "—" : fmtPctShort(benchPct)} tone={benchPct}/>
        <Metric label="10年国债" value={macro?.bond10y == null ? "—" : `${macro.bond10y.toFixed(3)}%`}/>
      </div>
      <div className="mt-2 rounded-[16px] bg-bg-elevated px-3 py-2.5">
        <div className="flex items-center justify-between text-[10px]"><span>股债性价差</span><Tone v={macro?.stockBondSpread ?? null} className="font-semibold">{macro?.stockBondSpread == null ? "—" : fmtPctShort(macro.stockBondSpread)}</Tone></div>
        <div className="mt-1 text-[8px] leading-[1.4] text-subtle">仅表示股票盈利收益率与10年国债收益率的静态差值。</div>
      </div>
    </Glass>

    <FoldSection title="行业热力" subtitle="点击色块查看板块资金与操作建议" open={open.heat} onToggle={() => toggle("heat")}>
      <div className="grid grid-cols-4 gap-1.5">{sectors.slice(0, 24).map((s) => <div key={s.id} className={`rounded-[14px] p-2 ${heatClass(s.change)}`}><div className="truncate text-[8px] text-fg">{s.name}</div><Tone v={s.change} className="mt-1 text-[11px] font-bold">{fmtPctShort(s.change)}</Tone></div>)}</div>
      {!sectors.length ? <div className="rounded-[14px] bg-white/62 px-3 py-4 text-center text-[9px] text-subtle">暂无可靠行业涨跌数据</div> : null}
    </FoldSection>

    <FundSectorWatchV2 />
    <OperationAdvice sectors={snapshot?.sectors || []} benchPct={benchPct} />

    <FoldSection title="板块资金与建议" subtitle={snapshot?.flow ? `市场主力净流入 ${formatMoney(snapshot.flow.main)} · 数据可用范围以源状态为准` : "等待资金快照"} open={open.money} onToggle={() => toggle("money")}>
      <MarketPanorama />
      <div className="mt-2 grid grid-cols-2 gap-2"><FlowColumn title="流入前列" items={inflow} /><FlowColumn title="流出前列" items={outflow} /></div>
    </FoldSection>

    <FoldSection title="指数估值红绿灯" subtitle="PE / PB / ROE 与历史估值分位" open={open.valuation} onToggle={() => toggle("valuation")}><IndexValuationLights /></FoldSection>

    <FoldSection title="外围市场" subtitle={globalSummary(snapshot?.global)} open={open.global} onToggle={() => toggle("global")}>
      <div className="grid grid-cols-2 gap-2">{(snapshot?.global ?? []).map((g) => <div key={g.name} className="rounded-[17px] bg-bg-elevated p-2.5"><div className="text-[9px] text-muted">{g.name}</div><div className="mt-0.5 text-[13px] font-semibold tabular-nums text-fg">{g.price == null ? "—" : g.price.toFixed(g.price >= 1000 ? 2 : 4)}</div><Tone v={g.pct} className="mt-0.5 text-[12px] font-semibold">{g.pct == null ? "—" : fmtPctShort(g.pct)}</Tone></div>)}</div>
      {!snapshot?.global?.some((g) => g.price != null || g.pct != null) ? <div className="rounded-[17px] bg-white/55 px-3 py-4 text-center text-[9px] text-subtle">外围行情暂不可用，不显示旧数据冒充当前值。</div> : null}
    </FoldSection>
    <div className="px-1 pb-2 text-[9px] text-subtle">{snapshot ? `市场日期 ${snapshot.marketDate || "最近交易日"} · ${snapshot.sources.map((s) => `${s.name}${s.status === "ok" ? "✓" : "×"}`).join(" · ")}` : "行情数据连接中"}</div>
  </div>;
}

function heatClass(value: number | null) {
  if (value == null) return "bg-white/62";
  if (value >= 1.5) return "bg-red-200/85";
  if (value >= 0.5) return "bg-red-100/80";
  if (value <= -2.5) return "bg-emerald-200/85";
  if (value <= -1) return "bg-emerald-100/80";
  return "bg-slate-100/80";
}
function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value / 1e8).toFixed(2)}亿`;
}
function globalSummary(global: Snapshot["global"] | undefined) {
  const usable = global?.filter((g) => g.price != null || g.pct != null) ?? [];
  return usable.length ? `${usable.length}/${global?.length ?? 0} 项已更新` : "外围行情连接中";
}
function Metric({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return <div className="rounded-[16px] bg-bg-elevated p-2.5"><div className="text-[9px] text-muted">{label}</div><Tone v={tone ?? null} className="mt-0.5 text-[15px] font-bold">{value}</Tone></div>;
}
function FlowColumn({ title, items }: { title: string; items: Snapshot["sectors"] }) {
  return <div className="rounded-[18px] bg-white/55 p-2.5"><div className="text-[12px] font-semibold text-fg">{title}</div><div className="mt-2 space-y-1.5">{items.length ? items.map((s) => <div key={s.id} className="flex items-center justify-between gap-2 text-[9px]"><span className="truncate">{s.name}</span><Tone v={s.flow} className="shrink-0 font-semibold">{s.flow == null ? "—" : `${s.flow > 0 ? "+" : ""}${(s.flow / 1e8).toFixed(2)}亿`}</Tone></div>) : <span className="text-[9px] text-subtle">暂无可靠资金数据</span>}</div></div>;
}
function FoldSection({ title, subtitle, open, onToggle, children }: { title: string; subtitle: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return <section className="overflow-hidden rounded-[24px] border border-white/75 bg-white/44 shadow-[0_16px_44px_rgba(38,78,112,.055),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[22px] saturate-150">
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-white/40" aria-expanded={open}>
      <div className="min-w-0 flex-1"><h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2><div className="mt-0.5 truncate text-[9px] text-subtle">{subtitle}</div></div>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/72 text-slate-500 shadow-sm ring-1 ring-white/80">{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
    </button>
    {open ? <div className="border-t border-white/65 px-2 pb-2">{children}</div> : null}
  </section>;
}
