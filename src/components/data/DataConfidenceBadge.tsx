import { cn } from "@/lib/cn";
import { confidenceLabel, type DataConfidence } from "@/lib/data/data-confidence";

const tones: Record<DataConfidence, string> = {
  verified: "bg-emerald-500/10 text-emerald-700",
  single_source: "bg-amber-500/10 text-amber-700",
  degraded_cache: "bg-fg/5 text-muted",
  unavailable: "bg-fg/5 text-muted",
};

export function DataConfidenceBadge({ value, className }: { value: DataConfidence; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none", tones[value], className)}>
      {confidenceLabel(value)}
    </span>
  );
}
