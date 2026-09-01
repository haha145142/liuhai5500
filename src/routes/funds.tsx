import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { EmptyNote, Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { getFundRank } from "@/lib/data/server";
import { getCalculatedFund } from "@/lib/data/live-valuation";
import { getFundRiskMetrics } from "@/lib/data/fund-risk";
import { fmtPctShort, fmtPrice } from "@/lib/format";
import { useApp } from "@/lib/store";
import type { FundQuote, RankRow } from "@/lib/types";

export const Route = createFileRoute("/funds")({ component: FundsPage });

const TABS = [
  { id: "r", label: "日涨幅", sc: "rzf" },
  { id: "z", label: "近1周", sc: "zzf" },
  { id: "6y", label: "近6月", sc: "6yzf" },
  { id: "1n", label: "近1年", sc: "1nzf" },
] as const;
const RANK_CACHE_PREFIX = "fund_ai_pro_rank_cache_v2_";
const RANK_TIMEOUT_MS = 7_000;
const JSONP_TIMEOUT_MS = 5_000;
const MAX_COMPARE = 4;

type RankCache = { savedAt: number; rows: RankRow[]; source: string };
type RankDataWindow = Window & { rankData?: { datas?: string[] } };
type CompareFund = {
  row: RankRow;
  quote: FundQuote | null;
  drawdown: number | null;
  volatility: number | null;
  sharpe: number | null;
};

function readRankCache(tab: string): RankCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = JSON.parse(localStorage.getItem(`${RANK_CACHE_PREFIX}${tab}`) || "null") as RankCache | null;
    return raw && Array.isArray(raw.rows) && raw.rows.length ? raw : null;
  } catch {
    return null;
  }
}

function writeRankCache(tab: string, value: RankCache) {
  try { localStorage.setItem(`${RANK_CACHE_PREFIX}${tab}`, JSON.stringify(value)); } catch {}
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error("rank-timeout")), ms);
    promise.then((value) => { window.clearTimeout(id); resolve(value); }, (error) => { window.clearTimeout(id); reject(error); });
  });
}

function parseRankRows(datas: string[] | undefined): RankRow[] {
  return (datas || []).map((line) => {
    const a = String(line).split(",");
    return {
      code: a[0] || "",
      name: a[1] || "",
      nav: Number.isFinite(Number(a[4])) ? Number(a[4]) : null,
      day: Number.isFinite(Number(a[6])) ? Number(a[6]) : null,
      week: Number.isFinite(Number(a[7])) ? Number(a[7]) : null,
      month: Number.isFinite(Number(a[8])) ? Number(a[8]) : null,
      sixMonth: Number.isFinite(Number(a[10])) ? Number(a[10]) : null,
      oneYear: Number.isFinite(Number(a[11])) ? Number(a[11]) : null,
      ytd: Number.isFinite(Number(a[14])) ? Number(a[14]) : null,
    };
  }).filter((x) => /^\d{6}$/.test(x.code) && !!x.name);
}

function fetchEastmoneyRankJsonp(tab: string): Promise<RankRow[]> {
  const config = TABS.find((x) => x.id === tab) || TABS[0];
  return new Promise((resolve, reject) => {
    const old = (window as RankDataWindow).rankData;
    const url = `https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=${config.sc}&st=desc&pi=1&pn=80&dx=1&_=${Date.now()}`;
    let done = false;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => finish(false, new Error("rank-jsonp-timeout")), JSONP_TIMEOUT_MS);
    const finish = (ok: boolean, value?: unknown) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      (window as RankDataWindow).rankData = old;
      script.remove();
      if (ok) resolve(value as RankRow[]); else reject(value instanceof Error ? value : new Error("rank-jsonp-failed"));
    };
    script.src = url;
    script.async = true;
    script.onload = () => finish(true, parseRankRows((window as RankDataWindow).rankData?.datas));
    script.onerror = () => finish(false, new Error("rank-jsonp-error"));
    document.head.appendChild(script);
  });
}

function calcStats(history: number[]) {
  const prices = history.filter((v) => Number.isFinite(v) && v > 0);
  if (prices.length < 3) return { volatility: null, sharpe: null };
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i += 1) returns.push(prices[i] / prices[i - 1] - 1);
  const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
  const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / returns.length;
  const dailyVol = Math.sqrt(Math.max(0, variance));
  const volatility = Number.isFinite(dailyVol) ? dailyVol * Math.sqrt(252) * 100 : null;
  const sharpe = dailyVol > 0 ? (mean / dailyVol) * Math.sqrt(252) : null;
  return { volatility, sharpe };
}

function calcDrawdown(history: number[]) {
  const prices = history.filter((v) => Number.isFinite(v) && v > 0);
  let peak = 0;
  let max = 0;
  for (const price of prices) {
    peak = Math.max(peak, price);
    if (peak > 0) max = Math.min(max, price / peak - 1);
  }
  return prices.length > 1 ? max * 100 : null;
}

function bestCodes(funds: CompareFund[], getter: (fund: CompareFund) => number | null, better: "high" | "low") {
  const values = funds.map(getter).filter((v): v is number => v != null && Number.isFinite(v));
  if (!values.length) return new Set<string>();
  const target = better === "high" ? Math.max(...values) : Math.min(...values);
  return new Set(funds.filter((fund) => getter(fund) === target).map((fund) => fund.row.code));
}

function ComparePanel({ selectedRows, onRemove, onClear }: { selectedRows: RankRow[]; onRemove: (code: string) => void; onClear: () => void }) {
  const [funds, setFunds] = useState<CompareFund[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!selectedRows.length) { setFunds([]); return; }
    setLoading(true);
    Promise.all(selectedRows.map(async (row): Promise<CompareFund> => {
      try {
        const [quote, risk] = await Promise.all([
          getCalculatedFund({ data: { code: row.code } }),
          getFundRiskMetrics({ data: { codes: [row.code] } }),
        ]);
        const drawdown = risk[0]?.maxDrawdown1Y ?? calcDrawdown(quote.history);
        const stats = calcStats(quote.history);
        return { row, quote, drawdown, volatility: stats.volatility, sharpe: stats.sharpe };
      } catch {
        return { row, quote: null, drawdown: null, volatility: null, sharpe: null };
      }
    })).then((next) => { if (alive) setFunds(next); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [selectedRows]);

  const bestReturn = useMemo(() => bestCodes(funds, (f) => f.row.oneYear ?? null, "high"), [funds]);
  const bestDrawdown = useMemo(() => bestCodes(funds, (f) => f.drawdown, "high"), [funds]);
  const bestVol = useMemo(() => bestCodes(funds, (f) => f.volatility, "low"), [funds]);
  const bestSharpe = useMemo(() => bestCodes(funds, (f) => f.sharpe, "high"), [funds]);
  if (!selectedRows.length) return null;

  return <Glass className="mt-3 overflow-hidden rounded-[22px] p-3">
    <div className="flex items-center justify-between gap-2"><div><div className="text-[15px] font-semibold text-fg">四基金 PK</div><div className="mt-0.5 text-[9px] text-muted">最多 4 只 · 数据不足不补伪值</div></div><button type="button" onClick={onClear} className="rounded-full bg-white/70 px-2.5 py-1 text-[9px] text-muted">清空</button></div>
    <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{selectedRows.map((row) => <button key={row.code} type="button" onClick={() => onRemove(row.code)} className="shrink-0 rounded-full bg-blue-500/10 px-2.5 py-1 text-[9px] font-medium text-blue-700">{row.name} ×</button>)}</div>
    {loading ? <div className="mt-2 rounded-xl bg-white/55 px-3 py-3 text-center text-[9px] text-muted">正在加载选中基金的收益 / 回撤 / 波动数据…</div> : <div className="mt-2 overflow-x-auto overscroll-x-contain"><div className="min-w-[640px] rounded-[16px] bg-white/45 ring-1 ring-white/70">
      <div className="grid" style={{ gridTemplateColumns: `120px repeat(${funds.length}, minmax(130px,1fr))` }}>{funds.map((fund) => <div key={fund.row.code} className="border-b border-white/70 px-2.5 py-2"><div className="truncate text-[10px] font-semibold text-fg">{fund.row.name}</div><div className="mt-0.5 text-[8px] text-muted">{fund.row.code}</div></div>)}</div>
      <CompareRow label="近1年" funds={funds} getter={(f) => f.row.oneYear ?? null} suffix="%" best={bestReturn} />
      <CompareRow label="近1月" funds={funds} getter={(f) => f.row.month} suffix="%" />
      <CompareRow label="最大回撤" funds={funds} getter={(f) => f.drawdown} suffix="%" best={bestDrawdown} />
      <CompareRow label="年化波动" funds={funds} getter={(f) => f.volatility} suffix="%" best={bestVol} />
      <CompareRow label="夏普" funds={funds} getter={(f) => f.sharpe} decimals={2} best={bestSharpe} />
      <CompareRow label="趋势" funds={funds} getter={(f) => f.quote?.metrics?.trendScore ?? null} display={(f) => f.quote?.metrics?.trend || "暂无"} best={bestCodes(funds, (f) => f.quote?.metrics?.trendScore ?? null, "high")} />
      <CompareRow label="波段" funds={funds} getter={() => null} display={(f) => f.quote?.metrics?.band || "暂无"} />
    </div></div>}
    <div className="mt-2 text-[8px] leading-[1.5] text-subtle">标记“当前相对占优”：收益看高、回撤和波动看低、夏普与趋势分数看高。夏普按历史日收益的年化近似计算，仅用于相对比较。</div>
  </Glass>;
}

function CompareRow({ label, funds, getter, suffix = "", decimals = 2, best, display }: { label: string; funds: CompareFund[]; getter: (fund: CompareFund) => number | null; suffix?: string; decimals?: number; best?: Set<string>; display?: (fund: CompareFund) => string }) {
  return <div className="grid border-t border-white/65" style={{ gridTemplateColumns: `120px repeat(${funds.length}, minmax(130px,1fr))` }}><div className="px-2.5 py-2 text-[9px] text-muted">{label}</div>{funds.map((fund) => { const value = getter(fund); return <div key={fund.row.code} className={`px-2.5 py-2 text-[9px] ${best?.has(fund.row.code) ? "bg-emerald-50/65 font-semibold text-emerald-700" : "text-fg"}`}>{display ? display(fund) : value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(decimals)}${suffix}`}{best?.has(fund.row.code) ? <span className="ml-1 inline-flex items-center rounded-full bg-emerald-100/80 px-1 py-0.5 text-[7px]"><Check size={8} className="mr-0.5"/>优</span> : null}</div>; })}</div>;
}

function FundsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("r");
  const [rows, setRows] = useState<RankRow[]>(() => readRankCache("r")?.rows || []);
  const [source, setSource] = useState(() => readRankCache("r")?.source || "—");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const watchlist = useApp((s) => s.watchlist);
  const toggleWatch = useApp((s) => s.toggleWatch);
  const addHolding = useApp((s) => s.addHolding);

  useEffect(() => {
    let live = true;
    const cached = readRankCache(tab);
    setRows(cached?.rows || []);
    setSource(cached?.source ? `${cached.source} · 本地缓存` : "数据源连接中");
    setLoading(!cached?.rows?.length);
    setRefreshing(!!cached?.rows?.length);
    const apply = (nextRows: RankRow[], nextSource: string) => {
      if (!live || !nextRows.length) return;
      setRows(nextRows); setSource(nextSource); writeRankCache(tab, { savedAt: Date.now(), rows: nextRows, source: nextSource });
    };
    void withTimeout(getFundRank({ data: { sort: tab } }), RANK_TIMEOUT_MS).then(async (r) => {
      if (!live) return;
      if (r.rows.length) { apply(r.rows, r.source); return; }
      try { apply(await fetchEastmoneyRankJsonp(tab), "东方财富浏览器 JSONP"); } catch { if (!cached?.rows?.length) { setRows([]); setSource("排行数据源暂不可用"); } }
    }).catch(async () => {
      if (!live) return;
      try { apply(await fetchEastmoneyRankJsonp(tab), "东方财富浏览器 JSONP"); } catch { if (!cached?.rows?.length) { setRows([]); setSource("排行数据源超时 · 已停止等待"); } }
    }).finally(() => { if (live) { setLoading(false); setRefreshing(false); } });
    return () => { live = false; };
  }, [tab]);

  const selectedRows = useMemo(() => selectedCodes.map((code) => rows.find((row) => row.code === code)).filter((row): row is RankRow => !!row), [rows, selectedCodes]);
  const toggleCompare = (row: RankRow) => setSelectedCodes((prev) => prev.includes(row.code) ? prev.filter((code) => code !== row.code) : prev.length >= MAX_COMPARE ? prev : [...prev, row.code]);

  return <div className="funds-page">
    <Glass>
      <SectionTitle title="基金排行" hint={source} />
      <div className="flex gap-1">{TABS.map((t) => <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`flex-1 rounded-xl py-2 text-xs font-semibold ${tab === t.id ? "bg-accent text-accent-fg" : "bg-bg-elevated text-muted"}`}>{t.label}</button>)}</div>
      {refreshing ? <div className="mt-2 text-[10px] text-muted">后台刷新中 · 先显示本地最近数据</div> : null}
      {selectedCodes.length ? <div className="mt-2 flex items-center justify-between gap-2 rounded-[14px] bg-blue-50/55 px-2.5 py-2 text-[9px] text-blue-700"><span>已选 {selectedCodes.length}/{MAX_COMPARE} · 可直接进入四基金 PK</span><button type="button" onClick={() => setSelectedCodes([])} className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[8px]">清空</button></div> : null}
    </Glass>
    <ComparePanel selectedRows={selectedRows} onRemove={(code) => setSelectedCodes((prev) => prev.filter((x) => x !== code))} onClear={() => setSelectedCodes([])} />
    {loading ? <EmptyNote>正在读取排行… 网络主源最多等待 7 秒，失败会切换浏览器直连。</EmptyNote> : null}
    {!loading && !rows.length ? <EmptyNote>暂无可靠排行数据，当前数据源不可用。</EmptyNote> : null}
    {rows.map((r, i) => {
      const addable = r.nav != null && Number.isFinite(r.nav) && r.nav > 0;
      const displayValue = tab === "z" ? r.week : tab === "1n" ? r.oneYear : tab === "6y" ? r.sixMonth : r.day;
      const selected = selectedCodes.includes(r.code);
      return <article key={r.code} className={`glass-tight mb-2 flex items-center gap-2 p-3 ${selected ? "ring-1 ring-blue-300/70" : ""}`}>
        <div className="w-6 text-xs font-semibold text-subtle">{i + 1}</div>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{r.name}</div><div className="text-[11px] text-muted">{r.code} · 净值 {fmtPrice(r.nav, 4)}</div></div>
        <Tone v={displayValue} className="text-sm font-semibold">{fmtPctShort(displayValue)}</Tone>
        <button type="button" onClick={() => toggleCompare(r)} disabled={!selected && selectedCodes.length >= MAX_COMPARE} className={`rounded-full px-2 py-1 text-[9px] font-semibold ${selected ? "bg-blue-500 text-white" : "bg-blue-50 text-blue-700 disabled:opacity-35"}`} aria-label={`比较${r.name}`}>{selected ? "已选" : "PK"}</button>
        <button type="button" onClick={() => toggleWatch(r.code)} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${watchlist.includes(r.code) ? "bg-accent text-accent-fg" : "bg-bg-elevated text-muted"}`}>{watchlist.includes(r.code) ? "已关注" : "关注"}</button>
        <button type="button" disabled={!addable} className="text-[10px] font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-40" onClick={() => { if (addable) addHolding({ code: r.code, name: r.name, shares: 100, cost: r.nav as number }); }}>{addable ? "加入" : "无可靠净值"}</button>
      </article>;
    })}
  </div>;
}
