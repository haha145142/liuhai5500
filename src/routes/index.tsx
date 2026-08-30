import { createFileRoute, Link } from "@tanstack/react-router";
import { Launcher } from "@/components/home/Launcher";
import { Cockpit } from "@/components/market/Cockpit";
import { IndexGrid } from "@/components/market/IndexGrid";
import { Glass, EmptyNote, Tone } from "@/components/ui/Glass";
import { useApp } from "@/lib/store";
import { fmtMoney, fmtPctShort } from "@/lib/format";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const snapshot = useApp((s) => s.snapshot);
  const news = useApp((s) => s.news);
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);

  let total: number | null = 0;
  let pnl: number | null = 0;
  let cost = 0;
  for (const h of portfolio) {
    const f = funds[h.code];
    const px = f?.estimate ?? f?.nav;
    cost += h.cost * h.shares;
    if (px == null) {
      total = null;
      pnl = null;
      break;
    }
    total = (total || 0) + px * h.shares;
    pnl = (pnl || 0) + (px - h.cost) * h.shares;
  }
  if (!portfolio.length) {
    total = 0;
    pnl = 0;
  }

  return (
    <div>
      <Launcher />
      <Glass tight className="flex items-end justify-between">
        <div>
          <div className="text-xs text-muted">组合资产</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{fmtMoney(total)}</div>
          <Tone v={pnl} className="text-sm font-semibold">
            {portfolio.length ? fmtPctShort(cost && pnl != null ? (pnl / cost) * 100 : null) : "尚未添加持仓"}
          </Tone>
        </div>
        <Link to="/portfolio" className="text-xs font-semibold text-accent">
          查看持仓
        </Link>
      </Glass>
      {snapshot ? <IndexGrid indices={snapshot.indices} /> : <EmptyNote>正在接入指数…</EmptyNote>}
      {snapshot ? (
        <Cockpit snap={snapshot} news={news?.items || []} />
      ) : (
        <EmptyNote>正在生成今日判断…</EmptyNote>
      )}
    </div>
  );
}
