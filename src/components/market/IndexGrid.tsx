import { Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { fmtPctShort, fmtPrice } from "@/lib/format";
import type { IndexQuote } from "@/lib/types";

export function IndexGrid({ indices }: { indices: IndexQuote[] }) {
  if (!indices.length) {
    return (
      <Glass>
        <SectionTitle title="主要指数" hint="最近可验证行情" />
        <p className="text-sm text-muted">暂无可靠数据</p>
      </Glass>
    );
  }

  return (
    <section className="home-index-grid" aria-label="主要指数">
      {indices.map((x) => (
        <div key={x.code} className="home-index-card">
          <div className="home-index-topline">
            <span className="text-xs text-muted">{x.name}</span>
            <span className="home-index-dot" aria-hidden="true" />
          </div>
          <div className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums text-fg">{fmtPrice(x.price)}</div>
          <Tone v={x.pct} className="mt-0.5 text-xs font-semibold tabular-nums">
            {fmtPctShort(x.pct)}
          </Tone>
        </div>
      ))}
    </section>
  );
}
