import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Glass, Tone } from "@/components/ui/Glass";
import { useApp } from "@/lib/store";
import { riskStats } from "@/lib/calc/hidden-sector-regression";
import { fmtPctShort } from "@/lib/format";
import { getMarketPhase } from "@/lib/market-hours";

export const Route = createFileRoute("/compare")({ component: ComparePage });

type FundRow = { code: string; name: string; nav: number; points: { date: string; nav: number; changePct: number | null }[] };

type Metric = {
  label: string;
  value: (x: { fund: any; stats: ReturnType<typeof riskStats> }) => string;
  tone?: (x: { fund: any; stats: ReturnType<typeof riskStats> }) => number | null;
};

function ComparePage() {
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  const [selected, setSelected] = useState<string[]>(() => portfolio.slice(0, 5).map((x) => x.code));
  const [stressPct, setStressPct] = useState(-5);
  const [dcaAmount, setDcaAmount] = useState(1000);
  const rows = useMemo(() => selected.map((c) => funds[c]).filter(Boolean), [funds, selected]);
  const data = useMemo(() => rows.map((f) => ({ fund: f, stats: riskStats(f.history) })), [rows]);
  const toggle = (c: string) => setSelected((v) => v.includes(c) ? v.filter((x) => x !== c) : v.length < 5 ? [...v, c] : v);
  const active = funds[selected[0]];
  const phase = getMarketPhase();
  const timing = phase === "weekend" ? "周末休市" : phase === "postclose" ? "已收盘 · 等待官方净值" : phase === "preopen" ? "开盘前" : "盘中可估算";

  const metrics: Metric[] = [
    { label: "近1月收益", value: ({ fund }) => fund.monthPct == null ? "—" : fmtPctShort(fund.monthPct), tone: ({ fund }) => fund.monthPct ?? null },
    { label: "最大回撤", value: ({ stats }) => stats.maxDrawdownPct == null ? "—" : fmtPctShort(-stats.maxDrawdownPct), tone: ({ stats }) => stats.maxDrawdownPct == null ? null : -Math.abs(stats.maxDrawdownPct) },
    { label: "夏普比率", value: ({ stats }) => stats.sharpe == null ? "—" : stats.sharpe.toFixed(2) },
    { label: "年化波动", value: ({ stats }) => stats.volatilityPct == null ? "—" : fmtPctShort(stats.volatilityPct) },
    { label: "估值可信度", value: ({ fund }) => fund.estimateConfidence === "high" ? "高" : fund.estimateConfidence === "medium" ? "中" : fund.estimateConfidence === "low" ? "低" : "—" },
  ];

  const stress = useMemo(() => {
    if (!active) return null;
    const impact = stressPct / 100;
    const nav = active.nav;
    const loss = nav == null ? null : nav * impact;
    return { nav, loss, next: nav == null ? null : nav * (1 + impact) };
  }, [active, stressPct]);

  const dca = useMemo(() => backtestDca(active, dcaAmount), [active, dcaAmount]);

  return (
    <div className="space-y-3 pb-3">
      <TimingCard timing={timing} phase={phase} />
      <StressCard stressPct={stressPct} setStressPct={setStressPct} fund={active} stress={stress} />

      <Glass className="rounded-[25px] p-3">
        <div className="text-[17px] font-semibold tracking-tight text-fg">基金对比</div>
        <div className="mt-0.5 text-[10px] text-muted">最多选择5只 · 收益 / 回撤 / 夏普 / 波动 / 估值可信度</div>
        <div className="mt-2 space-y-1.5">{portfolio.map((h) => <button key={h.code} type="button" onClick={() => toggle(h.code)} className={`flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-[10px] ring-1 ${selected.includes(h.code) ? "bg-blue-50 ring-blue-200" : "bg-white/60 ring-white/80"}`}><span className="truncate font-medium">{funds[h.code]?.name || h.name} <span className="font-normal text-muted">{h.code}</span></span><span className="shrink-0 text-blue-600">{selected.includes(h.code) ? "已选" : "选择"}</span></button>)}</div>
      </Glass>

      {rows.length ? <Glass className="overflow-hidden rounded-[25px] p-3">
        <div className="overflow-x-auto pb-1"><div className="min-w-[660px]">
          <div className="grid grid-cols-[1.2fr_repeat(5,.8fr)] gap-1 text-[8px] text-muted"><span>指标</span>{rows.map((f) => <span key={f.code} className="truncate font-medium text-fg">{f.name || f.code}</span>)}</div>
          {metrics.map((metric) => <div key={metric.label} className="mt-1 grid grid-cols-[1.2fr_repeat(5,.8fr)] gap-1"><span className="rounded-xl bg-white/50 px-2 py-2 text-[8px] text-muted">{metric.label}</span>{data.map((x) => <Tone key={x.fund.code} v={metric.tone?.(x) ?? null} className="rounded-xl bg-white/62 px-2 py-2 text-[8px] font-semibold">{metric.value(x)}</Tone>)}</div>)}
          <CompareMiniChart rows={rows.slice(0, 2) as any} />
          <div className="mt-2 rounded-[14px] bg-blue-50/45 p-2.5 text-[8px] leading-[1.5] text-muted">相关性、持仓重叠和经理风格只有在公开证据足够时才做定量计算；数据不足时保持空白。</div>
        </div></div>
      </Glass> : <Glass className="p-6 text-center text-[10px] text-muted">先在“我的持仓”添加基金。</Glass>}

      <DcaCard fund={active} amount={dcaAmount} setAmount={setDcaAmount} result={dca} />
    </div>
  );
}

function TimingCard({ timing, phase }: { timing: string; phase: ReturnType<typeof getMarketPhase> }) {
  const title = phase === "weekend" ? "今日窗口已关闭" : "申赎时机";
  const note = phase === "afternoon" ? "开放式基金通常以15:00为当日申购赎回截止点；盘中看到的是估算净值，实际成交净值以规则确认值为准。" : "A股交易时段用于观察盘中行情；15:00后以官方净值确认作为当日成交参考。";
  return <Glass className="rounded-[25px] p-3"><div className="text-[17px] font-semibold text-fg">{title}</div><div className="mt-1 text-[11px] leading-[1.5] text-muted">{note}</div><div className="mt-2 grid grid-cols-2 gap-2"><div className="rounded-[17px] bg-bg-elevated px-3 py-2.5"><div className="text-[10px] text-subtle">当前阶段</div><div className="mt-0.5 text-[15px] font-bold text-fg">{timing}</div></div><div className="rounded-[17px] bg-bg-elevated px-3 py-2.5"><div className="text-[10px] text-subtle">今天成交参考</div><div className="mt-0.5 text-[15px] font-bold text-emerald-700">{phase === "postclose" || phase === "weekend" ? "官方净值 / 下一交易日" : "估算仅供参考"}</div></div></div><div className="mt-2 text-[9px] text-subtle">不根据时间窗口直接生成买卖指令。</div></Glass>;
}

function StressCard({ stressPct, setStressPct, fund, stress }: { stressPct:number; setStressPct:(n:number)=>void; fund:any; stress:{nav:number|null;loss:number|null;next:number|null}|null }) {
  const values = [-8, -5, -3, 3, 5];
  return <Glass className="rounded-[25px] p-3"><div className="text-[17px] font-semibold text-fg">压力测试</div><div className="mt-0.5 text-[10px] text-muted">假设标的权益市场整体变化，按当前可用净值线性估算，不代表真实未来路径。</div><div className="mt-2 flex gap-1.5 overflow-x-auto">{values.map((v) => <button key={v} type="button" onClick={() => setStressPct(v)} className={`shrink-0 rounded-[14px] border px-3 py-2 text-[11px] font-semibold ${stressPct === v ? "bg-blue-600 text-white" : "bg-white/60 text-fg"}`}>{v > 0 ? "+" : ""}{v}%</button>)}</div>{fund && stress ? <div className="mt-3"><div className={`text-[32px] font-bold tracking-tight ${stress.loss != null && stress.loss < 0 ? "text-emerald-700" : "text-red-500"}`}>{stress.loss == null ? "—" : formatMoney(stress.loss)}</div><div className="mt-2 space-y-1.5">{[fund].map((f) => <div key={f.code} className="flex items-center justify-between rounded-xl bg-bg-elevated px-3 py-2 text-[10px]"><span className="truncate">{f.name || f.code}</span><span className="font-semibold">{stress.next == null ? "—" : stress.next.toFixed(4)}</span></div>)}</div></div> : <div className="mt-3 rounded-xl bg-bg-elevated px-3 py-3 text-center text-[10px] text-muted">选择一只持仓基金后进行测试。</div>}</Glass>;
}

function DcaCard({ fund, amount, setAmount, result }: { fund:any; amount:number; setAmount:(n:number)=>void; result:{invested:number;value:number;returnPct:number;periods:number}|null }) {
  return <Glass className="rounded-[25px] p-3"><div className="text-[17px] font-semibold text-fg">定投回测</div><div className="mt-0.5 text-[10px] text-muted">按固定金额、近60个交易日官方净值历史回测；回测不等于未来收益。</div><div className="mt-2 flex gap-2"><select value={fund?.code || ""} className="min-w-0 flex-1 rounded-[14px] border border-white/80 bg-white/70 px-3 py-2 text-[11px]" readOnly><option>{fund?.name || "暂无持仓"}</option></select><input aria-label="定投金额" value={amount} onChange={(e) => { const n = Number(e.target.value.replace(/[^0-9.]/g, "")); if (Number.isFinite(n)) setAmount(Math.max(1, n)); }} inputMode="decimal" className="w-[110px] rounded-[14px] border border-white/80 bg-white/70 px-3 py-2 text-[11px]" /></div>{result ? <div className="mt-2 grid grid-cols-2 gap-2"><Stat label="投入" value={formatMoney(result.invested)} /><Stat label="现值" value={formatMoney(result.value)} /><Stat label="收益" value={formatMoney(result.value - result.invested)} /><Stat label="收益率" value={fmtPctShort(result.returnPct)} /></div> : <div className="mt-2 rounded-xl bg-bg-elevated px-3 py-3 text-center text-[10px] text-muted">历史净值不足60个交易日时保持空白。</div>}<div className="mt-2 text-[9px] text-subtle">共 {result?.periods ?? 0} 期 · 仅使用历史官方净值。</div></Glass>;
}

function CompareMiniChart({ rows }: { rows: FundRow[] }) {
  if (rows.length < 2) return null;
  const series = rows.map((fund) => { const points = fund.historyPoints ?? []; const sample = points.slice(-30); if (!sample.length) return { fund, path: "" }; const base = sample[0].nav || 1; const values = sample.map((p) => (p.nav / base) * 100); const min = Math.min(...values), max = Math.max(...values); const path = values.map((v, i) => { const x = 4 + (i * 292) / Math.max(1, values.length - 1); const y = 82 - ((v - min) / Math.max(0.0001, max - min)) * 64; return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`; }).join(" "); return { fund, path }; });
  return <div className="mt-3 rounded-[17px] bg-white/45 p-2.5"><div className="text-[10px] font-semibold text-fg">近30个交易日相对净值（起点=100）</div><svg viewBox="0 0 300 90" className="mt-2 h-24 w-full" role="img" aria-label="基金相对净值对比图"><path d="M4 82H296" stroke="currentColor" strokeOpacity=".12" /><path d="M4 18H296" stroke="currentColor" strokeOpacity=".07" />{series.map((s, i) => <path key={s.fund.code} d={s.path} fill="none" stroke="currentColor" strokeOpacity={i === 0 ? 0.78 : 0.42} strokeWidth={i === 0 ? 2.2 : 1.7} />)}</svg><div className="flex gap-3 text-[9px] text-muted">{series.map((s) => <span key={s.fund.code}>{s.fund.name || s.fund.code}</span>)}</div></div>;
}

function backtestDca(fund:any, amount:number) {
  const points = (fund?.historyPoints ?? []).slice(-60);
  if (points.length < 12) return null;
  let invested = 0, shares = 0, count = 0;
  for (let i = 0; i < points.length; i += 5) { const p = points[i]; if (!p || !Number.isFinite(p.nav) || p.nav <= 0) continue; invested += amount; shares += amount / p.nav; count += 1; }
  if (!invested || !shares) return null;
  const last = points[points.length - 1]?.nav;
  if (!Number.isFinite(last)) return null;
  const value = shares * last;
  return { invested, value, returnPct: ((value / invested) - 1) * 100, periods: count };
}
function formatMoney(value:number|null|undefined){return value==null||!Number.isFinite(value)?"—":value.toLocaleString("zh-CN",{maximumFractionDigits:0});}
function Stat({label,value}:{label:string;value:string}){return <div className="rounded-[16px] bg-bg-elevated px-3 py-2.5"><div className="text-[9px] text-subtle">{label}</div><div className="mt-0.5 text-[15px] font-bold tabular-nums text-fg">{value}</div></div>;}
