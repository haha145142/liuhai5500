import { useEffect, useMemo, useState } from "react";
import { Glass, SectionTitle } from "@/components/ui/Glass";
import { useApp } from "@/lib/store";
import { alertKindLabel, evaluateFundAlerts, loadAlertEvents, loadAlertRules, saveAlertRules, type AlertKind, type AlertRule } from "@/lib/alerts";

export function SmartAlerts() {
  const funds = useApp((s) => s.funds);
  const portfolio = useApp((s) => s.portfolio);
  const [rules, setRules] = useState<AlertRule[]>(() => loadAlertRules());
  const [events, setEvents] = useState(() => loadAlertEvents());
  const [code, setCode] = useState("*");
  const [kind, setKind] = useState<AlertKind>("fund_up");
  const [threshold, setThreshold] = useState("3");
  const codes = useMemo(() => [...new Set(portfolio.map((h) => h.code))], [portfolio]);

  const check = () => {
    const created = evaluateFundAlerts(funds);
    if (created.length) setEvents(loadAlertEvents());
    return created.length;
  };

  useEffect(() => {
    const timer = window.setInterval(() => { if (Object.keys(funds).length) setEvents(loadAlertEvents()); evaluateFundAlerts(funds); }, 30_000);
    return () => window.clearInterval(timer);
  }, [funds]);

  const add = () => {
    const value = Number(threshold);
    if (!Number.isFinite(value) || value <= 0 || !/^\d{6}$/.test(code)) return;
    const rule: AlertRule = { id: `${code}-${kind}-${value}-${Date.now()}`, code, kind, threshold: value, enabled: true };
    const next = [rule, ...rules].slice(0, 30);
    setRules(next); saveAlertRules(next); setEvents(loadAlertEvents());
  };

  const toggle = (id: string) => { const next = rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r); setRules(next); saveAlertRules(next); };
  const remove = (id: string) => { const next = rules.filter((r) => r.id !== id); setRules(next); saveAlertRules(next); };

  return <Glass><SectionTitle title="智能提醒" hint="本机保存 · 30秒检查 · 1小时冷却" />
    <div className="rounded-2xl bg-bg-elevated px-3 py-3">
      <div className="grid grid-cols-3 gap-1.5">
        <select value={code} onChange={(e) => setCode(e.target.value)} className="h-10 rounded-xl bg-white/70 px-2 text-[10px] outline-none ring-1 ring-border"><option value="*">选择基金</option>{codes.map((x) => <option key={x} value={x}>{x}</option>)}</select>
        <select value={kind} onChange={(e) => setKind(e.target.value as AlertKind)} className="h-10 rounded-xl bg-white/70 px-2 text-[10px] outline-none ring-1 ring-border"><option value="fund_up">涨幅 ≥</option><option value="fund_down">跌幅 ≤</option><option value="drawdown">回撤 ≥</option></select>
        <input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="decimal" className="h-10 rounded-xl bg-white/70 px-2 text-[10px] outline-none ring-1 ring-border" placeholder="阈值 %" />
      </div>
      <button type="button" onClick={add} disabled={!/^\d{6}$/.test(code)} className="mt-2 h-10 w-full rounded-xl bg-accent text-xs font-semibold text-accent-fg disabled:opacity-50">添加提醒规则</button>
      <button type="button" onClick={() => { const count = check(); setEvents(loadAlertEvents()); if (!count) window.dispatchEvent(new CustomEvent("fap-alert-check")); }} className="mt-1.5 h-9 w-full rounded-xl bg-white/75 text-[10px] font-semibold text-fg ring-1 ring-white/90">立即检查</button>
    </div>
    <div className="mt-2 space-y-1.5">{rules.length ? rules.map((r) => <div key={r.id} className="flex items-center gap-2 rounded-xl bg-white/55 px-2.5 py-2 text-[9px]"><span className={`size-2 rounded-full ${r.enabled ? "bg-emerald-500" : "bg-slate-300"}`} /><span className="min-w-0 flex-1 truncate">{r.code} · {alertKindLabel[r.kind]} {r.threshold.toFixed(1)}%</span><button type="button" onClick={() => toggle(r.id)} className="rounded-lg bg-white/75 px-2 py-1">{r.enabled ? "停用" : "启用"}</button><button type="button" onClick={() => remove(r.id)} className="rounded-lg bg-white/75 px-2 py-1">删除</button></div>) : <div className="rounded-xl bg-white/45 px-3 py-3 text-[9px] text-muted">还没有提醒规则。</div>}</div>
    {events.length ? <div className="mt-2 rounded-xl bg-amber-50/65 px-2.5 py-2"><div className="text-[9px] font-semibold text-fg">最近触发</div><div className="mt-1 space-y-1">{events.slice(0,5).map((e) => <div key={e.id} className="text-[8px] leading-[1.4] text-muted">{new Date(e.triggeredAt).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})} · {e.message}</div>)}</div></div> : null}
    <p className="mt-2 text-[8px] leading-relaxed text-subtle">涨跌提醒使用当前基金日涨跌；回撤提醒使用当前缓存历史净值计算最大回撤。没有可靠行情时不会凭空触发。浏览器关闭后不会发送系统推送。</p>
  </Glass>;
}
