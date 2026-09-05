import { Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { fmtPctShort, fmtPrice } from "@/lib/format";
import type { IndexQuote } from "@/lib/types";

const A_SHARE_INDEX_CODES = ["000001", "399001", "000300", "000905", "399006", "000688"] as const;
const A_SHARE_INDEX_RANK = new Map(A_SHARE_INDEX_CODES.map((code, index) => [code, index]));

function selectAShareIndices(indices: IndexQuote[]) {
  return indices
    .filter((x) => A_SHARE_INDEX_RANK.has(x.code))
    .sort((a, b) => (A_SHARE_INDEX_RANK.get(a.code) ?? 999) - (A_SHARE_INDEX_RANK.get(b.code) ?? 999));
}

export function IndexGrid({ indices }: { indices: IndexQuote[] }) {
  const aShareIndices = selectAShareIndices(indices);

  if (!aShareIndices.length) {
    return (
      <Glass>
        <SectionTitle title="A股主要指数" hint="最近可验证行情" />
        <p className="text-sm text-muted">暂无可靠 A 股指数数据</p>
      </Glass>
    );
  }

  return (
    <section className="home-index-grid" aria-label="A股主要指数">
      {aShareIndices.map((x) => (
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
