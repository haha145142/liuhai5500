import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FundCard } from "@/components/portfolio/FundCard";
import { EmptyNote, Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { matchFundSector } from "@/lib/data/sectors";
import { searchFund } from "@/lib/data/server";
import { fmtMoney, fmtPctShort } from "@/lib/format";
import { useApp } from "@/lib/store";
import { isTradeTime } from "@/lib/market-hours";
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
  if (!fund) return null;
  const points = fund.historyPoints;
  if (!points.length) return null;
  const idx = points.length - 1 - tradingDaysAgo;
  return idx >= 0 ? points[idx]?.nav ?? null : null;
}

function currentPrice(fund: FundQuote | undefined) {
  if (!fund) return null;
  return isTradeTime() ? (fund.estimate ?? fund.nav ?? null) : (fund.nav ?? fund.estimate ?? null);
}

function periodPct(fund: FundQuote | undefined, days: number) {
  const now = fund?.nav ?? fund?.estimate ?? null;
  const base = navAt(fund, days);
  return now != null && base ? ((now - base) / base) * 100 : null;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseDate(s: string) {
  const [y, m, d] = s.split(/[-/]/).map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
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
    const p = funds[h.code]?.historyPoints.find((x) => x.date === dateKey);
    if (p?.changePct != null) {
      pnl += h.shares * p.nav * (p.changePct / 100);
      found = true;
    }
  }
  return found ? pnl : null;
}

function PortfolioPage() {
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  const snapshot = useApp((s) => s.snapshot);
  const addHolding = useApp((s) => s.addHolding);
  const updateHolding = useApp((s) => s.updateHolding);
  const removeHolding = useApp((s) => s.removeHolding);
  const [code, setCode] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const [hint, setHint] = useState("");
  const [hits, setHits] = useState<{ code: string; name: string; type: string }[]>([]);
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
  const live = isTradeTime();
  const summary = useMemo(() => {
    let costSum = 0;
    let total = 0;
    let pnl = 0;
    let dayPnl = 0;
    let missing = false;
    for (const h of portfolio) {
      const f = funds[h.code];
      const px = currentPrice(f);
      const costVal = h.cost * h.shares;
      costSum += costVal;
      if (px == null) { missing = true; continue; }
      total += px * h.shares;
      pnl += (px - h.cost) * h.shares;
      if (f) dayPnl += px * h.shares * ((live ? (f.estimatePct ?? f.dayPct) : (f.dayPct ?? f.estimatePct)) || 0) / 100;
    }
    const healthBase = portfolio.filter((h) => (funds[h.code]?.metrics?.bandScore ?? 50) <= 45).length;
    const health = portfolio.length ? Math.max(20, Math.min(95, 88 - healthBase * 12 - (missing ? 8 : 0))) : null;
    return { costSum, total, pnl, dayPnl, missing, health, healthBase };
  }, [funds, live, portfolio]);

  const periodSummary = useMemo(() => {
    return [
      ["1周", 5], ["1月", 20], ["3月", 60], ["6月", 120], ["1年", 250],
    ].map(([label, days]) => {
      let amount = 0;
      let baseValue = 0;
      let found = false;
      for (const h of portfolio) {
        const f = funds[h.code];
        const now = f?.nav ?? f?.estimate ?? null;
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

  const onSearch = async (q: string) => {
    setCode(q);
    if (q.trim().length < 2) { setHits([]); return; }
    setHits(await searchFund({ data: { q } }));
  };

  const add = () => {
    if (!/^\d{6}$/.test(code) || Number(shares) <= 0 || Number(cost) <= 0) {
      setHint("请输入 6 位基金代码、份额和成本价");
      return;
    }
    const name = hits.find((h) => h.code === code)?.name || code;
    addHolding({ code, name, shares: Number(shares), cost: Number(cost) });
    setCode(""); setShares(""); setCost(""); setHits([]);
    setHint("已保存，正在读取官方净值与盘中估值…");
  };

  const addAlert = () => {
    const pct = Number(alertPct);
    if (!/^\d{6}$/.test(alertCode) || !Number.isFinite(pct) || pct <= 0) return;
    setAlerts((cur) => [...cur.filter((x) => !(x.code === alertCode && x.kind === alertKind)), { code: alertCode, kind: alertKind, targetPct: pct }]);
    setAlertCode(""); setAlertPct("");
  };

  return (
    <div>
      <Glass>
        <SectionTitle title="我的持仓" hint={`${portfolio.length} 只`} right={<span className="text-xs text-muted">{live ? "盘中估值" : "收盘官方净值"}</span>} />
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-muted">整体盈亏</div>
            <Tone v={summary.missing ? null : summary.pnl} className="text-4xl font-semibold">{summary.missing ? "—" : fmtMoney(summary.pnl)}</Tone>
            <Tone v={summary.missing || !summary.costSum ? null : (summary.pnl / summary.costSum) * 100} className="mt-1 block text-lg font-semibold">
              {summary.missing || !summary.costSum ? "" : fmtPctShort((summary.pnl / summary.costSum) * 100)}
            </Tone>
          </div>
          <div className="text-right text-xs text-muted">
            {live ? "盘中交叉校验" : "官方净值口径"}<br />
            总资产 {summary.missing ? "—" : fmtMoney(summary.total)}<br />
            成本 {fmtMoney(summary.costSum)}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-bg-elevated p-3">
            <div className="text-[11px] text-subtle">{live ? "今日实时收益" : "最近交易日收益"}</div>
            <Tone v={summary.dayPnl} className="mt-1 block text-xl font-semibold">{fmtMoney(summary.dayPnl)}</Tone>
            <div className="text-[10px] text-muted">数据源自动随交易时段切换</div>
          </div>
          <div className="rounded-2xl bg-bg-elevated p-3">
            <div className="text-[11px] text-subtle">组合健康度</div>
            <div className="mt-1 text-xl font-semibold">{summary.health == null ? "—" : summary.health}</div>
            <div className="text-[10px] text-muted">{summary.healthBase} 只处于偏高/高位区</div>
          </div>
        </div>
      </Glass>

      <Glass>
        <SectionTitle title="最近收益" hint="按当前持仓回算" />
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
          <b className="text-fg">总收益：</b>{summary.missing ? "部分基金尚无可用净值" : `${fmtMoney(summary.pnl)} · ${summary.costSum ? fmtPctShort((summary.pnl / summary.costSum) * 100) : "—"}`}
          <span className="ml-2">盘中使用估值，收盘后自动切回官方净值。</span>
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
          <button type="button" onClick={() => addHolding({ code: "110022", name: "易方达消费行业", shares: 1000, cost: 3.2 })} className="w-full rounded-2xl bg-accent py-2.5 text-sm font-semibold text-accent-fg">
            载入 1 只示例持仓
          </button>
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
        <p className="mt-2 text-[10px] text-muted">收益日历按历史官方净值与当前持仓份额估算，仅作为回顾，不代表当时实际持仓。</p>
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

      <Glass>
        <SectionTitle title="添加基金" />
        <div className="space-y-2">
          <input value={code} onChange={(e) => void onSearch(e.target.value)} placeholder="6 位基金代码或名称" className="h-11 w-full rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border" />
          {hits.length ? <div className="overflow-hidden rounded-2xl ring-1 ring-border">{hits.map((h) => <button key={h.code} type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-bg-elevated" onClick={() => { setCode(h.code); setHits([]); }}><span>{h.name}</span><span className="text-xs text-muted">{h.code}</span></button>)}</div> : null}
          <div className="grid grid-cols-2 gap-2"><input value={shares} onChange={(e) => setShares(e.target.value)} placeholder="份额" inputMode="decimal" className="h-11 rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border" /><input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="成本价" inputMode="decimal" className="h-11 rounded-2xl bg-bg-elevated px-3 text-sm ring-1 ring-border" /></div>
          <button type="button" onClick={add} className="h-11 w-full rounded-2xl bg-fg text-sm font-semibold text-bg">保存持仓</button>
          {hint ? <p className="text-xs text-muted">{hint}</p> : null}
        </div>
      </Glass>
    </div>
  );
}
