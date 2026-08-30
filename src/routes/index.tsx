import { createFileRoute, Link } from "@tanstack/react-router";
import { Launcher } from "@/components/home/Launcher";
import { Cockpit } from "@/components/market/Cockpit";
import { IndexGrid } from "@/components/market/IndexGrid";
import { PortfolioInsight } from "@/components/portfolio/PortfolioInsight";
import { Glass, EmptyNote, Tone } from "@/components/ui/Glass";
import { useApp } from "@/lib/store";
import { calcPortfolioAnalysis } from "@/lib/calc/portfolio";
import { fmtMoney, fmtPctShort } from "@/lib/format";
import { isWeekend } from "@/lib/market-hours";
import { tradingDateLabel } from "@/lib/data/trading-day";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const snapshot = useApp((s) => s.snapshot);
  const news = useApp((s) => s.news);
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  const analysis = portfolio.length ? calcPortfolioAnalysis(portfolio, Object.values(funds), snapshot?.sectors || []) : null;

  const marketMode = snapshot?.validation === "cross_checked"
    ? "双源核验"
    : snapshot?.validation === "cached_latest_trading_day"
      ? "最近交易日数据"
      : snapshot?.validation === "single_source"
        ? "单源可用"
        : "等待行情";
  const marketDate = snapshot?.marketDate || (isWeekend() ? tradingDateLabel() : "今日");
  const missingCount = snapshot?.indices.filter((x) => x.pct == null).length ?? 0;
  const statusText = isWeekend()
    ? `周末沿用最近完成交易日数据；下一个交易日恢复更新。${missingCount ? ` 当前 ${missingCount} 项指数缺少可验证涨跌幅。` : ""}`
    : (missingCount ? `${missingCount} 项指数暂缺可靠值。` : "当前指数数据完整。");

  return (
    <div>
      <Launcher />
      {analysis ? (
        <Glass tight className="mb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs text-muted">组合资产</div>
              <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{fmtMoney(analysis.marketValue)}</div>
              <div className="mt-1 flex items-center gap-2">
                <Tone v={analysis.dayPnl} className="text-sm font-bold">{analysis.dayPnl == null ? "今日盈亏暂无可靠数据" : `今日 ${fmtMoney(analysis.dayPnl)}`}</Tone>
                <span className="text-[10px] text-subtle">{analysis.dayPct == null ? "" : fmtPctShort(analysis.dayPct)}</span>
              </div>
              <div className="mt-2 text-[10px] text-subtle">累计收益 {analysis.pnlPct == null ? "暂无可靠数据" : fmtPctShort(analysis.pnlPct)} · 数据覆盖 {analysis.holdingsCovered}/{analysis.holdingsTotal}</div>
            </div>
            <Link to="/portfolio" className="rounded-full bg-bg-elevated px-3 py-1.5 text-xs font-semibold text-accent">查看持仓</Link>
          </div>
          {(analysis.topContributor || analysis.topDrag) ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniImpact label="主要贡献" row={analysis.topContributor} />
              <MiniImpact label="主要拖累" row={analysis.topDrag} />
            </div>
          ) : null}
        </Glass>
      ) : (
        <Glass tight className="mb-2 flex items-end justify-between">
          <div><div className="text-xs text-muted">组合资产</div><div className="mt-1 text-2xl font-semibold tabular-nums">—</div><div className="mt-1 text-xs text-subtle">尚未添加持仓</div></div>
          <Link to="/portfolio" className="text-xs font-semibold text-accent">添加基金</Link>
        </Glass>
      )}

      <PortfolioInsight holdings={portfolio} funds={Object.values(funds)} sectors={snapshot?.sectors || []} />

      {snapshot ? (
        <Glass tight className="mb-2 mt-2">
          <div className="flex items-center justify-between gap-3 text-[11px] text-muted">
            <span>{isWeekend() ? "周末休市" : "市场数据"} · 数据日 {marketDate}</span>
            <span className="rounded-full bg-bg-elevated px-2 py-0.5 font-semibold text-accent">{marketMode}</span>
          </div>
          <p className="mt-1 text-[10px] text-subtle">{statusText}</p>
        </Glass>
      ) : null}

      {snapshot ? <IndexGrid indices={snapshot.indices} /> : <EmptyNote>行情正在后台刷新，界面不阻塞。</EmptyNote>}
      {snapshot ? <Cockpit snap={snapshot} news={news?.items || []} /> : <EmptyNote>市场判断正在后台生成，不影响页面使用。</EmptyNote>}
    </div>
  );
}

function MiniImpact({ label, row }: { label: string; row: ReturnType<typeof calcPortfolioAnalysis>["topContributor"] }) {
  if (!row) return <div className="rounded-2xl bg-bg-elevated px-3 py-2.5 text-[10px] text-subtle">{label} · 暂无可靠数据</div>;
  return <div className="rounded-2xl bg-bg-elevated px-3 py-2.5"><div className="text-[10px] text-subtle">{label}</div><div className="mt-1 truncate text-xs font-semibold">{row.name}</div><Tone v={row.dayPnl} className="mt-0.5 block text-sm font-bold tabular-nums">{fmtMoney(row.dayPnl)}</Tone></div>;
}
