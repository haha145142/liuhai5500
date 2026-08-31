import { cn } from "@/lib/cn";
import type { ValuationDisplayStatus } from "@/lib/data/valuation-status";

const META: Record<ValuationDisplayStatus, { label: string; tone: string }> = {
  official_nav: { label: "官方净值", tone: "bg-accent/10 text-accent" },
  estimated_cross_checked: { label: "盘中估值 · 已校验", tone: "bg-emerald-500/10 text-emerald-700" },
  estimated_single_source: { label: "盘中估值 · 部分校验", tone: "bg-amber-500/10 text-amber-700" },
  estimated_low_coverage: { label: "盘中估值 · 低覆盖", tone: "bg-amber-500/10 text-amber-700" },
  waiting_official_nav: { label: "等待官方净值", tone: "bg-fg/5 text-muted" },
  unavailable: { label: "暂无可靠行情", tone: "bg-fg/5 text-muted" },
};

export function ValuationBadge({ status, className }: { status: ValuationDisplayStatus; className?: string }) {
  const meta = META[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none", meta.tone, className)}>
      {meta.label}
    </span>
  );
}
