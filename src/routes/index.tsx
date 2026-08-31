import { createFileRoute, Link } from "@tanstack/react-router";
import { Cockpit } from "@/components/market/Cockpit";
import { IndexGrid } from "@/components/market/IndexGrid";
import { PortfolioInsight } from "@/components/portfolio/PortfolioInsight";
import { FundSectorWatchV2 } from "@/components/fund-sector/FundSectorWatchV2";
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
  const marketMode = snapshot?.validation === "cross_checked" ? "双源核验" : snapshot?.validation === "cached_latest_trading_day" ? "最近交易日" : snapshot?.validation === "single_source" ? "单源可用" : "等待可靠行情";
  const marketDate = snapshot?.marketDate || (isWeekend() ? tradingDateLabel() : "今日");
  const missingCount = snapshot?.indices.filter((x) => x.pct == null).length ?? 0;
  const statusText = isWeekend() ? `周末休市 · 沿用最近交易日数据${missingCount ? ` · ${missingCount} 项指数暂缺可靠值` : ""}` : (missingCount ? `${missingCount} 项指数暂缺可靠值` : "指数数据正常");

  return <div className="home-page">
    {analysis ? <Glass tight className="home-hero mb-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="home-overline">我的组合</div><div className="mt-1 home-value tabular-nums">{fmtMoney(analysis.marketValue)}</div><div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1"><Tone v={analysis.dayPnl} className="home-day-pnl font-bold tabular-nums">{analysis.dayPnl == null ? "今日盈亏暂无可靠数据" : `${analysis.dayPnl >= 0 ? "今日盈利 " : "今日亏损 "}${fmtMoney(Math.abs(analysis.dayPnl))}`}</Tone>{analysis.dayPct != null ? <span className="home-day-pct tabular-nums">{fmtPctShort(analysis.dayPct)}</span> : null}</div></div><Link to="/portfolio" className="home-hero-action">持仓</Link></div><div className="mt-4 grid grid-cols-2 gap-2"><MiniImpact label="主要贡献" row={analysis.topContributor} /><MiniImpact label="主要拖累" row={analysis.topDrag} /></div><div className="mt-3 flex items-center justify-between gap-3 home-meta-row"><span>累计收益 {analysis.pnlPct == null ? "暂无可靠数据" : fmtPctShort(analysis.pnlPct)}</span><span>覆盖 {analysis.holdingsCovered}/{analysis.holdingsTotal}</span></div></Glass> : <Glass tight className="home-hero mb-3"><div className="flex items-end justify-between gap-3"><div><div className="home-overline">我的组合</div><div className="mt-1 home-value tabular-nums">—</div><div className="mt-1 text-xs text-subtle">添加基金后，持仓数据会在这里汇总。</div></div><Link to="/portfolio" className="home-hero-action">添加基金</Link></div></Glass>}
    <div className="home-section-heading"><div><div className="text-base font-semibold tracking-tight text-fg">组合判断</div><div className="text-[10px] text-subtle">收益 · 风险 · 板块</div></div></div>
    <PortfolioInsight holdings={portfolio} funds={Object.values(funds)} sectors={snapshot?.sectors || []} />
    <FundSectorWatchV2 portfolio={portfolio} funds={funds} />
    {snapshot ? <Glass tight className="home-market-strip mb-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-[11px] font-medium text-muted">市场状态</div><div className="mt-0.5 truncate text-sm font-semibold">{isWeekend() ? "休市 · 最近交易日" : "交易日 · 后台更新"}</div></div><span className="home-status-pill">{marketMode}</span></div><div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-subtle"><span>数据日 {marketDate}</span><span>{statusText}</span></div></Glass> : null}
    <div className="home-section-heading"><div><div className="text-base font-semibold tracking-tight text-fg">大盘</div><div className="text-[10px] text-subtle">最近可验证行情</div></div><Link to="/market" className="home-section-link">查看全部</Link></div>
    {snapshot ? <IndexGrid indices={snapshot.indices} /> : <Glass tight><EmptyNote>行情正在后台刷新，首屏不会阻塞。</EmptyNote></Glass>}
    {snapshot ? <Cockpit snap={snapshot} news={news?.items || []} /> : <Glass tight><EmptyNote>市场判断将在数据返回后局部更新。</EmptyNote></Glass>}
  </div>;
}

function MiniImpact({ label, row }: { label: string; row: ReturnType<typeof calcPortfolioAnalysis>["topContributor"] }) {
  if (!row) return <div className="rounded-2xl bg-bg-elevated px-3 py-2.5 text-[10px] text-subtle">{label} · 暂无可靠数据</div>;
  return <div className="home-impact rounded-2xl bg-bg-elevated px-3 py-2.5"><div className="text-[10px] text-subtle">{label}</div><div className="mt-1 truncate text-xs font-semibold">{row.name}</div><Tone v={row.dayPnl} className="mt-0.5 block text-sm font-bold tabular-nums">{fmtMoney(row.dayPnl)}</Tone></div>;
}
