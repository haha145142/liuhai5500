import { createFileRoute, Link } from "@tanstack/react-router";
import { Launcher } from "@/components/home/Launcher";
import { Cockpit } from "@/components/market/Cockpit";
import { IndexGrid } from "@/components/market/IndexGrid";
import { PortfolioInsight } from "@/components/portfolio/PortfolioInsight";
import { Glass, EmptyNote, Tone } from "@/components/ui/Glass";
import { useApp } from "@/lib/store";
import { fmtMoney, fmtPctShort } from "@/lib/format";
import { isTradeTime, isWeekend } from "@/lib/market-hours";
import { tradingDateLabel } from "@/lib/data/trading-day";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const snapshot = useApp((s) => s.snapshot);
  const news = useApp((s) => s.news);
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  const live = isTradeTime();

  let total: number | null = 0;
  let pnl: number | null = 0;
  let cost = 0;
  for (const h of portfolio) {
    const f = funds[h.code];
    const px = live && f?.valuationStatus === "estimate" && f.estimate != null
      ? f.estimate
      : f?.nav ?? null;
    cost += h.cost * h.shares;
    if (px == null) {
      total = null;
      pnl = null;
      continue;
    }
    total = (total || 0) + px * h.shares;
    pnl = (pnl || 0) + (px - h.cost) * h.shares;
  }
  if (!portfolio.length) {
    total = 0;
    pnl = 0;
  }

  const marketMode = snapshot?.validation === "cross_checked"
    ? "双源核验"
    : snapshot?.validation === "cached_latest_trading_day"
      ? "最近交易日数据"
      : snapshot?.validation === "single_source"
        ? "单源可用"
        : "等待行情";
  const marketDate = snapshot?.marketDate || (isWeekend() ? tradingDateLabel() : "今日");
  const missingCount = snapshot?.indices.filter((x) => x.pct == null).length ?? 0;

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
          {portfolio.length ? <div className="mt-1 text-[10px] text-subtle">口径：{live ? "已验证盘中估值" : "最近官方净值"}</div> : null}
        </div>
        <Link to="/portfolio" className="text-xs font-semibold text-accent">
          查看持仓
        </Link>
      </Glass>

      <PortfolioInsight holdings={portfolio} funds={Object.values(funds)} sectors={snapshot?.sectors || []} />

      {snapshot ? (
        <Glass tight className="mb-2 mt-2">
          <div className="flex items-center justify-between gap-3 text-[11px] text-muted">
            <span>{isWeekend() ? "周末休市" : "市场数据"} · 数据日 {marketDate}</span>
            <span className="rounded-full bg-bg-elevated px-2 py-0.5 font-semibold text-accent">{marketMode}</span>
          </div>
          <p className="mt-1 text-[10px] text-subtle">
            {isWeekend()
              ? `周末沿用最近完成交易日数据；下一个交易日恢复更新。${missingCount ? ` 当前 ${missingCount} 项指数缺少可验证涨跌幅。` : ""}`
              : `多源校验后显示；${missingCount ? `${missingCount} 项指数暂缺可靠值。` : "当前指数数据完整。`}`
            }
          </p>
        </Glass>
      ) : null}

      {snapshot ? <IndexGrid indices={snapshot.indices} /> : <EmptyNote>行情正在后台刷新，界面不阻塞。</EmptyNote>}
      {snapshot ? (
        <Cockpit snap={snapshot} news={news?.items || []} />
      ) : (
        <EmptyNote>市场判断正在后台生成，不影响页面使用。</EmptyNote>
      )}
    </div>
  );
}
