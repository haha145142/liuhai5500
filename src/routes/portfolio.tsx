import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FundCard } from "@/components/portfolio/FundCard";
import { EmptyNote, Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { matchFundSector } from "@/lib/data/sectors";
import { fmtMoney, fmtPctShort } from "@/lib/format";
import { useApp } from "@/lib/store";
import { calcPortfolioPeriodReturn, calcDailyPortfolioPnl } from "@/lib/calc/portfolio-periods";
import { calcPortfolioReturn, calcHoldingReturn } from "@/lib/calc/portfolio-returns";
import type { FundQuote, Holding } from "@/lib/types";

export const Route = createFileRoute("/portfolio")({ component: PortfolioPage });

type AlertRule = { code: string; kind: "止盈" | "止损"; targetPct: number };
const ALERT_KEY = "fund_ai_pro_alerts_v1";

function readAlerts(): AlertRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(ALERT_KEY) || "[]");
    return Array.isArray(raw) ? (raw as AlertRule[]) : [];
  } catch {
    return [];
  }
}

function currentPrice(fund: FundQuote | undefined) {
  return calcHoldingReturn({ code: fund?.code || "", name: fund?.name || "", shares: 1, cost: 1 }, fund).price;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthCells(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function PortfolioPage() {
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  const snapshot = useApp((s) => s.snapshot);
  const updateHolding = useApp((s) => s.updateHolding);
  const removeHolding = useApp((s) => s.removeHolding);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [alertCode, setAlertCode] = useState("");
  const [alertKind, setAlertKind] = useState<AlertRule["kind"]>("止盈");
  const [alertPct, setAlertPct] = useState("");
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());

  useEffect(() => setAlerts(readAlerts()), []);
  useEffect(() => {
    try { localStorage.setItem(ALERT_KEY, JSON.stringify(alerts)); } catch { /* local only */ }
  }, [alerts]);

  const bench = snapshot?.indices[0]?.pct ?? null;
  const summary = useMemo(() => calcPortfolioReturn(portfolio, funds), [funds, portfolio]);

  const periodSummary = useMemo(() => {
    const week = calcPortfolioPeriodReturn("week", portfolio, funds);
    const month = calcPortfolioPeriodReturn("month", portfolio, funds);
    const year = calcPortfolioPeriodReturn("year", portfolio, funds);
    return [
      { ...week, label: "本周" },
      { ...month, label: "本月" },
      { ...year, label: "今年" },
    ];
  }, [funds, portfolio]);

  const calendar = useMemo(() => {
    const cells = monthCells(calendarCursor);
    const activeMonth = monthKey(calendarCursor);
    return cells.map((date) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const daily = calcDailyPortfolioPnl(key, portfolio, funds);
      return { date, key, inMonth: monthKey(date) === activeMonth, pnl: daily.amount, coveredFunds: daily.coveredFunds, totalFunds: daily.totalFunds };
    });
  }, [calendarCursor, funds, portfolio]);

  const addAlert = () => {
    const pct = Number(alertPct);
    if (!/^\d{6}$/.test(alertCode) || !Number.isFinite(pct) || pct <= 0) return;
    setAlerts((cur) => [...cur.filter((x) => !(x.code === alertCode && x.kind === alertKind)), { code: alertCode, kind: alertKind, targetPct: pct }]);
    setAlertCode(""); setAlertPct("");
  };

  return (
    <div>
      <Glass>
        <SectionTitle title="我的持仓" hint={`${portfolio.length} 只`} right={<span className="text-xs text-muted">收益口径统一</span>} />
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-muted">整体盈亏 {summary.totalCount > summary.pricedCount ? `(已知 ${summary.pricedCount}/${summary.totalCount} 只)` : ""}</div>
            <Tone v={summary.pricedCount ? summary.holdingPnl : null} className="text-4xl font-semibold">{summary.pricedCount ? fmtMoney(summary.holdingPnl) : "—"}</Tone>
            <Tone v={summary.holdingPnlPct} className="mt-1 block text-lg font-semibold">{summary.holdingPnlPct == null ? "—" : fmtPctShort(summary.holdingPnlPct)}</Tone>
          </div>
          <div className="text-right text-xs text-muted">
            已知持仓市值 {summary.pricedCount ? fmtMoney(summary.marketValue) : "—"}<br />
            总成本 {fmtMoney(summary.costValue)}<br />
            今日收益 {summary.todayPnl == null ? "—" : fmtMoney(summary.todayPnl)}
          </div>
        </div>
        {summary.totalCount > summary.pricedCount ? <div className="mt-2 rounded-xl bg-amber-50/70 px-3 py-2 text-[10px] text-muted">还有 {summary.totalCount - summary.pricedCount} 只基金暂未取得可靠行情；组合只汇总已有可靠价格的数据，不用假数据补齐。</div> : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-bg-elevated p-3">
            <div className="text-[11px] text-subtle">今日收益</div>
            <Tone v={summary.todayPnl} className="mt-1 block text-xl font-semibold">{summary.todayPnl == null ? "—" : fmtMoney(summary.todayPnl)}</Tone>
            <div className="text-[10px] text-muted">盘中估值 / 官方净值统一口径</div>
          </div>
          <div className="rounded-2xl bg-bg-elevated p-3">
            <div className="text-[11px] text-subtle">数据覆盖</div>
            <div className="mt-1 text-xl font-semibold">{summary.totalCount ? `${summary.pricedCount}/${summary.totalCount}` : "—"}</div>
            <div className="text-[10px] text-muted">只统计有可靠当前价格的持仓</div>
          </div>
        </div>
      </Glass>

      <Glass>
        <SectionTitle title="组合阶段收益" hint="组合合计 · 单基金收益在下方独立展示" />
        <div className="grid grid-cols-3 gap-2">
          {periodSummary.map((p) => (
            <div key={p.id} className="rounded-2xl bg-bg-elevated p-2.5 text-center">
              <div className="text-[10px] text-muted">{p.label}</div>
              <Tone v={p.amount} className="mt-1 block text-sm font-semibold">{fmtMoney(p.amount)}</Tone>
              <Tone v={p.pct} className="text-[10px]">{fmtPctShort(p.pct)}</Tone>
              <div className="mt-1 text-[9px] text-subtle">{p.eligibleCount}/{p.pricedCount} 只有周期基准</div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl bg-accent/8 p-3 text-xs text-muted">
          <b className="text-fg">组合总收益：</b>{summary.pricedCount ? `${fmtMoney(summary.holdingPnl)} · ${fmtPctShort(summary.holdingPnlPct)}` : "暂无可靠行情"}
          <span className="ml-2">上方只展示组合合计；下面每张基金卡只计算该基金自己的收益。</span>
        </div>
      </Glass>

      {portfolio.length ? portfolio.map((h) => {
        const fname = funds[h.code]?.name || h.name;
        const rule = matchFundSector(fname);
        const sector = rule ? snapshot?.sectors.find((s) => s.id === rule.id) : undefined;
        return (
          <FundCard
            key={h.code}
            holding={h}
            fund={funds[h.code]}
            sector={sector}
            benchPct={bench}
            onUpdate={(patch) => updateHolding(h.code, patch)}
            onRemove={() => removeHolding(h.code)}
          />
        );
      }) : (
        <Glass>
          <EmptyNote>还没有持仓。添加基金后会自动拉取官方净值、盘中估值和历史指标。</EmptyNote>
          <div className="text-xs text-muted">上方“添加基金”入口可直接录入。</div>
        </Glass>
      )}

      <Glass>
        <SectionTitle title="收益日历" hint={`${calendarCursor.getFullYear()}/${String(calendarCursor.getMonth() + 1).padStart(2, "0")}`} />
        <div className="flex items-center justify-between rounded-2xl bg-bg-elevated px-3 py-2">
          <button type="button" onClick={() => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1))} className="size-9 rounded-full bg-white/70 text-lg">‹</button>
          <b>{calendarCursor.getFullYear()}年{calendarCursor.getMonth() + 1}月</b>
          <button type="button" onClick={() => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1))} className="size-9 rounded-full bg-white/70 text-lg">›</button>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] text-muted">
          {['日','一','二','三','四','五','六'].map((d) => <div key={d} className="py-1">{d}</div>)}
          {calendar.map((c) => (
            <div key={c.key} className={`min-h-12 rounded-xl p-1 ${c.inMonth ? "bg-bg-elevated" : "opacity-30"}`}>
              <div className="text-xs">{c.date.getDate()}</div>
              <Tone v={c.pnl} className="mt-1 block text-[10px] font-semibold">{c.pnl == null ? "—" : fmtMoney(c.pnl)}</Tone>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted">收益日历只使用历史官方净值回算，不把盘中估值混入历史日期；仅用于回顾，不代表当时实际持仓变化。</p>
      </Glass>

      <Glass>
        <SectionTitle title="止盈 / 止损提醒" hint="本地阈值 · 触发不离场" />
        <div className="grid grid-cols-3 gap-2">
          <input value={alertCode} onChange={(e) => setAlertCode(e.target.value)} placeholder="基金代码" inputMode="numeric" className="h-11 rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border" />
          <select value={alertKind} onChange={(e) => setAlertKind(e.target.value as AlertRule["kind"])} className="h-11 rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border"><option>止盈</option><option>止损</option></select>
          <input value={alertPct} onChange={(e) => setAlertPct(e.target.value)} placeholder="收益率 %" inputMode="decimal" className="h-11 rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border" />
        </div>
        <button type="button" onClick={addAlert} className="mt-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg">添加提醒</button>
        {alerts.length ? (
          <div className="mt-3 space-y-2">
            {alerts.map((a) => {
              const h = portfolio.find((x) => x.code === a.code);
              const f = funds[a.code];
              const ret = h ? calcHoldingReturn(h, f) : null;
              const gain = ret?.holdingPnlPct ?? null;
              const triggered = gain != null && (a.kind === "止盈" ? gain >= a.targetPct : gain <= -a.targetPct);
              return <div key={`${a.code}-${a.kind}`} className="flex items-center justify-between rounded-2xl bg-bg-elevated p-3 text-xs"><span>{a.code} · {a.kind} {a.targetPct}%</span><span className={triggered ? "font-semibold text-up" : "text-muted"}>{gain == null ? "等待净值" : triggered ? "已触发" : `当前 ${fmtPctShort(gain)}`}</span></div>;
            })}
          </div>
        ) : <EmptyNote>暂无提醒。添加一只基金并设置目标收益率即可。</EmptyNote>}
      </Glass>
    </div>
  );
}
