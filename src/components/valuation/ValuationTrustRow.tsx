import type { ValuationStatusSummary } from "../../lib/data/valuation-status-summary";

export function ValuationTrustRow({ summary }: { summary: ValuationStatusSummary }) {
  const items = [summary.modeLabel, summary.coverageLabel, summary.validationLabel, summary.historyLabel].filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5 whitespace-nowrap">
          {item}
        </span>
      ))}
    </div>
  );
}
