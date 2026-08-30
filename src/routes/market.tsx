import { createFileRoute } from "@tanstack/react-router";
import { IndexGrid } from "@/components/market/IndexGrid";
import { FundSectorWatch } from "@/components/market/FundSectorWatch";
import { EmptyNote, Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { fmtPctShort, fmtYi } from "@/lib/format";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/market")({ component: MarketPage });

function MarketPage() {
  const snapshot = useApp((s) => s.snapshot);
  const flow = snapshot?.flow ?? null;

  return (
    <div className="market-page">
      <FundSectorWatch />

      {snapshot ? <IndexGrid indices={snapshot.indices} /> : <EmptyNote>指数后台更新中，先看你关注的基金板块。</EmptyNote>}

      <Glass className="market-data-card">
        <SectionTitle title="全市场资金" hint={snapshot?.sources.find((s) => s.name === "资金")?.note || "真实订单规模口径"} />
        {flow ? (
          <div className="grid grid-cols-2 gap-2">
            <FlowCell label="主力净流入" v={flow.main} />
            <FlowCell label="超大单" v={flow.super} />
            <FlowCell label="大单" v={flow.large} />
            <FlowCell label="中单" v={flow.mid} />
            <FlowCell label="小单" v={flow.small} />
            <div className="rounded-2xl bg-bg-elevated p-3"><div className="text-[11px] text-subtle">样本只数</div><div className="text-lg font-semibold tabular-nums">{flow.count}</div></div>
          </div>
        ) : <p className="text-sm text-muted">资金数据暂不可用，不用它猜“散户在买卖”。</p>}
        <p className="mt-2 text-[10px] leading-relaxed text-subtle">说明：小单只是订单规模分类，不等同于散户；主力口径用超大单 + 大单做内部一致性检查。</p>
      </Glass>

      <Glass className="market-data-card">
        <SectionTitle title="外围市场" />
        {snapshot?.global?.length ? <div className="grid grid-cols-2 gap-2">{snapshot.global.map((g) => <div key={g.name} className="rounded-2xl bg-bg-elevated p-3"><div className="text-xs text-muted">{g.name}</div><Tone v={g.pct} className="text-base font-semibold">{g.pct == null ? "暂无可靠数据" : fmtPctShort(g.pct)}</Tone></div>)}</div> : <p className="text-sm text-muted">外围数据源暂不可用</p>}
      </Glass>

      <div className="px-1 pb-2 text-[10px] text-subtle">{snapshot ? `市场日期 ${snapshot.marketDate || "未知"} · ${snapshot.sources.map((s) => `${s.name}${s.status === "ok" ? "✓" : "×"}`).join(" · ")}` : "市场数据后台加载中"}</div>
    </div>
  );
}

function FlowCell({ label, v }: { label: string; v: number }) {
  return <div className="rounded-2xl bg-bg-elevated p-3"><div className="text-[11px] text-subtle">{label}</div><Tone v={v} className="text-lg font-semibold">{fmtYi(v)}</Tone></div>;
}
