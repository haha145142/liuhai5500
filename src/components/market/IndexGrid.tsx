import { useMemo, useState } from "react";
import { Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { fmtPctShort, fmtPrice } from "@/lib/format";
import type { IndexQuote } from "@/lib/types";

export function IndexGrid({ indices }: { indices: IndexQuote[] }) {
  const [page, setPage] = useState(0);
  const pages = useMemo(() => {
    const out: IndexQuote[][] = [];
    for (let i = 0; i < indices.length; i += 2) out.push(indices.slice(i, i + 2));
    return out;
  }, [indices]);
  const current = pages[Math.min(page, Math.max(0, pages.length - 1))] || [];

  if (!indices.length) {
    return (
      <Glass>
        <SectionTitle title="四大指数" hint="实时" />
        <p className="text-sm text-muted">暂无可靠数据</p>
      </Glass>
    );
  }

  return (
    <section className="mb-3 rounded-[24px] border border-white/65 bg-white/45 p-3 shadow-[0_10px_26px_rgb(20_60_110_/_0.045)] backdrop-blur-[10px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold text-fg">四大指数</div>
          <div className="text-[9px] text-subtle">一次只看两个 · 左右翻页</div>
        </div>
        {pages.length > 1 ? (
          <div className="flex items-center gap-1.5" aria-label="指数分页">
            {pages.map((_, i) => (
              <button key={i} type="button" onClick={() => setPage(i)} aria-label={`第 ${i + 1} 页`} className={`h-1.5 rounded-full transition-all ${i === page ? "w-5 bg-accent" : "w-1.5 bg-slate-300/80"}`} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {current.map((x) => (
          <div key={x.code} className="glass-tight p-3">
            <div className="text-xs text-muted">{x.name}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-fg">{fmtPrice(x.price)}</div>
            <Tone v={x.pct} className="text-sm font-semibold">
              {fmtPctShort(x.pct)}
            </Tone>
          </div>
        ))}
      </div>
    </section>
  );
}
