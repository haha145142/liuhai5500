import { createFileRoute } from "@tanstack/react-router";
import { Glass } from "@/components/ui/Glass";
import { DeepFundIntelligence } from "@/components/portfolio/DeepFundIntelligence";
import { PortfolioInsight } from "@/components/portfolio/PortfolioInsight";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/lookthrough")({ component: LookthroughPage });

function LookthroughPage() {
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  const snapshot = useApp((s) => s.snapshot);

  if (!portfolio.length) {
    return <Glass className="rounded-[26px] p-5 text-center"><div className="text-[18px] font-semibold text-fg">穿透</div><div className="mt-1 text-[11px] text-muted">添加持仓后，这里会展开行业暴露、收益贡献、持仓重叠与基金→基金→股票穿透。</div></Glass>;
  }

  return (
    <div className="space-y-3 pb-3">
      <Glass className="rounded-[26px] p-3">
        <div className="text-[18px] font-semibold tracking-tight text-fg">穿透</div>
        <div className="mt-0.5 text-[10px] text-muted">从组合到行业，再到个股与海外底层；缺少可靠数据时保持空白，不用猜测补齐。</div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <div className="rounded-[16px] bg-bg-elevated px-2.5 py-2"><div className="text-[9px] text-subtle">持仓基金</div><div className="mt-0.5 text-[17px] font-bold text-fg">{portfolio.length}</div></div>
          <div className="rounded-[16px] bg-bg-elevated px-2.5 py-2"><div className="text-[9px] text-subtle">行情日期</div><div className="mt-0.5 truncate text-[12px] font-semibold text-fg">{snapshot?.marketDate || "—"}</div></div>
          <div className="rounded-[16px] bg-bg-elevated px-2.5 py-2"><div className="text-[9px] text-subtle">估值状态</div><div className="mt-0.5 text-[12px] font-semibold text-fg">{snapshot?.validation === "cross_checked" ? "双源核验" : snapshot?.validation === "single_source" ? "单源可用" : "待确认"}</div></div>
        </div>
      </Glass>
      <DeepFundIntelligence holdings={portfolio} funds={funds} />
      <PortfolioInsight holdings={portfolio} funds={Object.values(funds)} sectors={snapshot?.sectors || []} />
    </div>
  );
}
