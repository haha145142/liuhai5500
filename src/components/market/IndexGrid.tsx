import { Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { fmtPctShort, fmtPrice } from "@/lib/format";
import type { IndexQuote } from "@/lib/types";

export function IndexGrid({ indices }: { indices: IndexQuote[] }) {
  if (!indices.length) {
    return (
      <Glass>
        <SectionTitle title="四大指数" hint="实时" />
        <p className="text-sm text-muted">暂无可靠数据</p>
      </Glass>
    );
  }
  return (
    <div className="mb-3 grid grid-cols-2 gap-2">
      {indices.map((x) => (
        <div key={x.code} className="glass-tight p-3">
          <div className="text-xs text-muted">{x.name}</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-fg">{fmtPrice(x.price)}</div>
          <Tone v={x.pct} className="text-sm font-semibold">
            {fmtPctShort(x.pct)}
          </Tone>
        </div>
      ))}
    </div>
  );
}
