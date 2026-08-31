import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FundCard } from "@/components/portfolio/FundCard";
import { EmptyNote, Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { matchFundSector } from "@/lib/data/sectors";
import { fmtMoney, fmtPctShort } from "@/lib/format";
import { useApp } from "@/lib/store";
import { selectFundDisplayQuote } from "@/lib/data/quote-mode";
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

function navAt(fund: FundQuote | undefined, tradingDaysAgo: number) {
  if (!fund || !Number.isInteger(tradingDaysAgo) || tradingDaysAgo < 0) return null;
  const points = [...fund.historyPoints].filter((p) => p.nav > 0 && p.date).sort((a, b) => a.date.localeCompare(b.date));
  const idx = points.length - 1 - tradingDaysAgo;
  return idx >= 0 ? points[idx]?.nav ?? null : null;
}

function previousOfficialNav(fund: FundQuote | undefined, mode: ReturnType<typeof selectFundDisplayQuote>["mode"]) {
  if (!fund?.historyPoints.length) return null;
  const points = [...fund.historyPoints].filter((p) => p.nav > 0 && p.date).sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 1) return null;
  if (mode === "live_estimate") return points.at(-1)?.nav ?? null;
  if (mode === "official_today" || mode === "latest_official") return points.at(-2)?.nav ?? null;
  return null;
}

function currentPrice(fund: FundQuote | undefined) {
  return selectFundDisplayQuote(fund).price;
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

function dailyPortfolioPnl(dateKey: string, portfolio: Holding[], funds: Record<string, FundQuote>) {
  let pnl = 0;
  let found = false;
  for (const h of portfolio) {
    const points = [...(funds[h.code]?.historyPoints || [])].sort((a, b) => a.date.localeCompare(b.date));
    const i = points.findIndex((x) => x.date === dateKey);
    if (i <= 0) continue;
    const current = points[i]?.nav;
    const previous = points[i - 1]?.nav;
    if (current != null && previous != null && current > 0 && previous > 0) {
      pnl += h.shares * (current - previous);
      found = true;
    }
  }
  return found ? pnl : null;
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
  const summary = useMemo(() => {
    let costSum = 0;
    let total = 0;
    let pnl = 0;
    let dayPnl = 0;
    let knownCount = 0;
    for (const h of portfolio) {
      const f = funds[h.code];
      const quote = selectFundDisplayQuote(f);
      const px = quote.price;
      const costVal = h.cost * h.shares;
      costSum += costVal;
      if (px == null) continue;
      knownCount += 1;
      total += px * h.shares;
      pnl += (px - h.cost) * h.shares;
      const previous = previousOfficialNav(f, quote.mode);
      if (previous != null) dayPnl += (px - previous) * h.shares;
    }
    const missingCount = Math.max(0, portfolio.length - knownCount);
    const healthBase = portfolio.filter((h) => (funds[h.code]?.metrics?.bandScore ?? 50) <= 45).length;
    const health = portfolio.length ? Math.max(20, Math.min(95, 88 - healthBase * 12 - (missingCount ? 8 : 0))) : null;
    return { costSum, total, pnl, dayPnl, knownCount, missingCount, health, healthBase };
  }, [funds, portfolio]);

  const periodSummary = useMemo(() => {
    return [
      ["本周", 5], ["本月", 20], ["近3月", 60], ["近6月", 120], ["今年/1年", 250],
    ].map(([label, days]) => {
      let amount = 0;
      let baseValue = 0;
      let found = false;
      for (const h of portfolio) {
        const f = funds[h.code];
        const now = currentPrice(f);
        const base = navAt(f, Number(days));
        if (now != null && base != null) {
          amount += (now - base) * h.shares;
          baseValue += base * h.shares;
          found = true;
        }
      }
      return { label: String(label), amount: found ? amount : null, pct: found && baseValue ? (amount / baseValue) * 100 : null };
    });
  }, [funds, portfolio]);

  const calendar = useMemo(() => {
    const cells = monthCells(calendarCursor);
    const activeMonth = monthKey(calendarCursor);
    return cells.map((date) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { date, key, inMonth: monthKey(date) === activeMonth, pnl: dailyPortfolioPnl(key, portfolio, funds) };
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
        <SectionTitle title="我的持仓" hint={`${portfolio.length} 只`} right={<span className="text-xs text-muted">当前统一数据口径</span>} />
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-muted">整体盈亏 {summary.missingCount ? `(已知 ${summary.knownCount}/${portfolio.length} 只)` : ""}</div>
            <Tone v={summary.knownCount ? summary.pnl : null} className="text-4xl font-semibold">{summary.knownCount ? fmtMoney(summary.pnl) : "—"}</Tone>
            <Tone v={summary.costSum && summary.knownCount ? (summary.pnl / costValueForKnown(portfolio, funds)) * 100 : null} className="mt-1 block text-lg font-semibold">
              {summary.knownCount ? fmtPctShort((summary.pnl / Math.max(1, costValueForKnown(portfolio, funds))) * 100) : ""}
            </Tone>
          </div>
          <div className="text-right text-xs text-muted">
            组合口径统一<br />
            已知持仓市值 {summary.knownCount ? fmtMoney(summary.total) : "—"}<br />
            总成本 {fmtMoney(summary.costSum)}
          </div>
        </div>
        {summary.missingCount ? <div className="mt-2 rounded-xl bg-amber-50/70 px-3 py-2 text-[10px] text-muted">还有 {summary.missingCount} 只基金暂未取得可靠行情；以上组合数字只汇总已取得可靠数据，不用假数据补齐。</div> : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-bg-elevated p-3">
            <div className="text-[11px] text-subtle">今日收益</div>
            <Tone v={summary.knownCount ? summary.dayPnl : null} className="mt-1 block text-xl font-semibold">{summary.knownCount ? fmtMoney(summary.dayPnl) : "—"}</Tone>
            <div className="text-[10px] text-muted">盘中 → 上午收盘 → 下午实时 → 官方净值</div>
          </div>
          <div className="rounded-2xl bg-bg-elevated p-3">
            <div className="text-[11px] text-subtle">组合健康度</div>
            <div className="mt-1 text-xl font-semibold">{summary.health == null ? "—" : summary.health}</div>
            <div className="text-[10px] text-muted">{summary.healthBase} 只处于偏高/高位区</div>
          </div>
        </div>
      </Glass>

      <Glass>
        <SectionTitle title="组合阶段收益" hint="组合合计 · 单基金收益在下方独立展示" />
        <div className="grid grid-cols-5 gap-1.5">
          {periodSummary.map((p) => (
            <div key={p.label} className="rounded-2xl bg-bg-elevated p-2 text-center">
              <div className="text-[10px] text-muted">{p.label}</div>
              <Tone v={p.amount} className="mt-1 block text-sm font-semibold">{fmtMoney(p.amount)}</Tone>
              <Tone v={p.pct} className="text-[10px]">{fmtPctShort(p.pct)}</Tone>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl bg-accent/8 p-3 text-xs text-muted">
          <b className="text-fg">组合总收益：</b>{summary.knownCount ? `${fmtMoney(summary.pnl)} · ${fmtPctShort((summary.pnl / Math.max(1, costValueForKnown(portfolio, funds))) * 100)}` : "暂无可靠行情"}
          <span className="ml-2">以上是全部已取得可靠数据的基金合计；下面每张基金卡只计算该基金自己的收益。</span>
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
        <p className="mt-2 text-[10px] text-muted">收益日历按历史官方净值与当前持仓份额回算，仅作为回顾，不代表当时实际持仓。</p>
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
              const px = currentPrice(f);
              const gain = h && px != null && h.cost ? ((px - h.cost) / h.cost) * 100 : null;
              const triggered = gain != null && (a.kind === "止盈" ? gain >= a.targetPct : gain <= -a.targetPct);
              return <div key={`${a.code}-${a.kind}`} className="flex items-center justify-between rounded-2xl bg-bg-elevated p-3 text-xs"><span>{a.code} · {a.kind} {a.targetPct}%</span><span className={triggered ? "font-semibold text-up" : "text-muted"}>{gain == null ? "等待净值" : triggered ? "已触发" : `当前 ${fmtPctShort(gain)}`}</span></div>;
            })}
          </div>
        ) : <EmptyNote>暂无提醒。添加一只基金并设置目标收益率即可。</EmptyNote>}
      </Glass>
    </div>
  );
}

function costValueForKnown(portfolio: Holding[], funds: Record<string, FundQuote>) {
  return portfolio.reduce((sum, h) => funds[h.code] && currentPrice(funds[h.code]) != null ? sum + h.cost * h.shares : sum, 0);
}
