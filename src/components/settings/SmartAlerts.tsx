import { useEffect, useMemo, useState } from "react";
import { Glass, SectionTitle } from "@/components/ui/Glass";
import { useApp } from "@/lib/store";
import { alertKindLabel, evaluateFundAlerts, loadAlertEvents, loadAlertRules, notifyAlertEvents, saveAlertRules, type AlertKind, type AlertRule } from "@/lib/alerts";

const ALERT_CHECK_MS = 180_000;

type NotificationState = NotificationPermission | "unsupported";

export function SmartAlerts() {
  const funds = useApp((s) => s.funds);
  const portfolio = useApp((s) => s.portfolio);
  const snapshot = useApp((s) => s.snapshot);
  const [rules, setRules] = useState<AlertRule[]>(() => loadAlertRules());
  const [events, setEvents] = useState(() => loadAlertEvents());
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<AlertKind>("fund_up");
  const [threshold, setThreshold] = useState("3");
  const [notificationState, setNotificationState] = useState<NotificationState>("unsupported");
  const fundsCodes = useMemo(() => [...new Set(portfolio.map((h) => h.code))], [portfolio]);
  const sectorCodes = useMemo(() => [...new Map((snapshot?.sectors || []).map((s) => [s.bkCode, s.name])).entries()], [snapshot?.sectors]);
  const isSectorRule = kind === "sector_change";
  const kindNeedsFund = kind !== "sector_change";

  const refreshAlerts = () => {
    const created = evaluateFundAlerts(funds, snapshot?.sectors || []);
    if (created.length) notifyAlertEvents(created);
    setEvents(loadAlertEvents());
  };

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setNotificationState("unsupported");
      return;
    }
    setNotificationState(Notification.permission);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(refreshAlerts, ALERT_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [funds, snapshot?.sectors]);

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") { setNotificationState("unsupported"); return; }
    try { setNotificationState(await Notification.requestPermission()); } catch { setNotificationState(Notification.permission); }
  };

  const add = () => {
    const value = Number(threshold);
    const validTarget = kindNeedsFund ? fundsCodes.includes(code) : sectorCodes.some(([x]) => `sector:${x}` === code);
    if (!Number.isFinite(value) || value <= 0 || !validTarget) return;
    const rule: AlertRule = { id: `${code}-${kind}-${value}-${Date.now()}`, code, kind, threshold: value, enabled: true };
    const next = [rule, ...rules].slice(0, 30);
    setRules(next); saveAlertRules(next); refreshAlerts();
  };

  const toggle = (id: string) => { const next = rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r); setRules(next); saveAlertRules(next); };
  const remove = (id: string) => { const next = rules.filter((r) => r.id !== id); setRules(next); saveAlertRules(next); };

  return <Glass><SectionTitle title="智能提醒" hint="本机保存 · 3分钟检查 · 1小时冷却" />
    <div className="rounded-2xl bg-bg-elevated px-3 py-3">
      <div className="grid grid-cols-3 gap-1.5">
        <select value={code} onChange={(e) => setCode(e.target.value)} aria-label="提醒对象" className="h-10 rounded-xl bg-white/70 px-2 text-[10px] outline-none ring-1 ring-border">
          <option value="">选择{isSectorRule ? "板块" : "基金"}</option>
          {kindNeedsFund ? fundsCodes.map((x) => <option key={x} value={x}>{x}</option>) : sectorCodes.map(([x, name]) => <option key={x} value={`sector:${x}`}>{name}</option>)}
        </select>
        <select value={kind} onChange={(e) => { const next = e.target.value as AlertKind; setKind(next); setCode(""); }} aria-label="提醒类型" className="h-10 rounded-xl bg-white/70 px-2 text-[10px] outline-none ring-1 ring-border">
          <option value="fund_up">涨幅 ≥</option><option value="fund_down">跌幅 ≤</option><option value="drawdown">回撤 ≥</option><option value="valuation_range">估值区间 ±</option><option value="sector_change">板块强弱变化 ±</option>
        </select>
        <input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="decimal" aria-label="提醒阈值" className="h-10 rounded-xl bg-white/70 px-2 text-[10px] outline-none ring-1 ring-border" placeholder={isSectorRule ? "变化百分点" : "阈值 %"} />
      </div>
      <button type="button" onClick={add} disabled={kindNeedsFund ? !fundsCodes.includes(code) : !code.startsWith("sector:")} className="mt-2 h-10 w-full rounded-xl bg-accent text-xs font-semibold text-accent-fg disabled:opacity-50">添加提醒规则</button>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => void enableNotifications()} disabled={notificationState === "granted" || notificationState === "unsupported"} className="h-9 rounded-xl bg-white/75 text-[10px] font-semibold text-fg ring-1 ring-white/90 disabled:opacity-50">{notificationState === "granted" ? "系统提醒已开启" : notificationState === "denied" ? "系统提醒已拒绝" : notificationState === "unsupported" ? "当前浏览器不支持" : "开启系统提醒"}</button>
        <button type="button" onClick={refreshAlerts} className="h-9 rounded-xl bg-white/75 text-[10px] font-semibold text-fg ring-1 ring-white/90">立即检查</button>
      </div>
    </div>
    <div className="mt-2 space-y-1.5">{rules.length ? rules.map((r) => <div key={r.id} className="flex items-center gap-2 rounded-xl bg-white/55 px-2.5 py-2 text-[9px]"><span className={`size-2 rounded-full ${r.enabled ? "bg-emerald-500" : "bg-slate-300"}`} /><span className="min-w-0 flex-1 truncate">{r.code.replace(/^sector:/, "")} · {alertKindLabel[r.kind]} {r.threshold.toFixed(1)}{r.kind === "sector_change" ? " 个百分点" : "%"}</span><button type="button" onClick={() => toggle(r.id)} className="rounded-lg bg-white/75 px-2 py-1">{r.enabled ? "停用" : "启用"}</button><button type="button" onClick={() => remove(r.id)} className="rounded-lg bg-white/75 px-2 py-1">删除</button></div>) : <div className="rounded-xl bg-white/45 px-3 py-3 text-[9px] text-muted">还没有提醒规则。</div>}</div>
    {events.length ? <div className="mt-2 rounded-xl bg-amber-50/65 px-2.5 py-2"><div className="text-[9px] font-semibold text-fg">最近触发</div><div className="mt-1 space-y-1">{events.slice(0,5).map((e) => <div key={e.id} className="text-[8px] leading-[1.4] text-muted">{new Date(e.triggeredAt).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Shanghai"})} · {e.message}</div>)}</div></div> : null}
    <p className="mt-2 text-[8px] leading-relaxed text-subtle">涨跌提醒使用当前基金日涨跌；回撤使用历史净值最大回撤；估值提醒使用盘中估值区间/估值涨跌；板块提醒比较两次可靠板块快照的涨跌幅变化。浏览器保持页面打开时可触发系统通知；没有可靠行情时不会凭空触发。</p>
  </Glass>;
}
