import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { getFundSectorQuotes, type FundSectorQuote } from "@/lib/data/server";
import { FUND_SECTORS } from "@/lib/data/fund-sectors";
import { fmtPctShort } from "@/lib/format";
import type { FundQuote, Holding } from "@/lib/types";

const KEY = "fund_ai_pro_fund_sector_watch_v4";
const DATA_KEY = "fund_ai_pro_fund_sector_data_v2";
const REQUEST_TIMEOUT_MS = 8_000;
type Prefs = { ids: string[] };

function readPrefs(): Prefs {
  if (typeof window === "undefined") return { ids: [] };
  try {
    const x = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<Prefs> | null;
    const ids = Array.isArray(x?.ids)
      ? x.ids.filter((v): v is string => typeof v === "string" && FUND_SECTORS.some((s) => s.id === v))
      : [];
    return { ids };
  } catch {
    return { ids: [] };
  }
}

function readCachedRows(ids: string[]): FundSectorQuote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(DATA_KEY) || "null") as { key?: string; rows?: FundSectorQuote[] } | null;
    return raw?.key === ids.join(",") && Array.isArray(raw.rows) ? raw.rows : [];
  } catch {
    return [];
  }
}

function saveCachedRows(ids: string[], rows: FundSectorQuote[]) {
  if (typeof window === "undefined" || !rows.length) return;
  try { localStorage.setItem(DATA_KEY, JSON.stringify({ key: ids.join(","), rows, savedAt: Date.now() })); } catch {}
}

function tone(v: number | null) {
  return v == null ? "text-subtle" : v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted";
}

function findSector(input: string) {
  const q = input.trim().toLowerCase();
  if (!q) return null;
  return FUND_SECTORS.find((s) => s.id.toLowerCase() === q || s.name.toLowerCase() === q)
    || FUND_SECTORS.find((s) => s.name.toLowerCase().includes(q));
}

export function FundSectorWatchV2({ portfolio = [], funds = {} }: { portfolio?: Holding[]; funds?: Record<string, FundQuote> }) {
  const [{ ids }, setPrefs] = useState<Prefs>(readPrefs);
  const [rows, setRows] = useState<FundSectorQuote[]>(() => readCachedRows(readPrefs().ids));
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const visibleCount = 3;
  const pages = Math.max(1, Math.ceil(ids.length / visibleCount));

  const visibleIds = useMemo(() => ids.slice(page * visibleCount, page * visibleCount + visibleCount), [ids, page]);
  const visibleRows = useMemo(() => visibleIds.map((id) => rows.find((r) => r.id === id)).filter((r): r is FundSectorQuote => !!r), [visibleIds, rows]);
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FUND_SECTORS.filter((s) => !ids.includes(s.id) && (!q || `${s.name} ${s.id}`.toLowerCase().includes(q))).slice(0, 12);
  }, [ids, query]);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ ids })); } catch {}
  }, [ids]);

  useEffect(() => {
    if (page >= pages) setPage(Math.max(0, pages - 1));
  }, [page, pages]);

  useEffect(() => {
    if (!ids.length) {
      setRows([]);
      setLoading(false);
      setMessage("请选择你要看的板块");
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const run = async () => {
      attempt += 1;
      setLoading(true);
      try {
        const request = getFundSectorQuotes({ data: { ids } });
        const timeout = new Promise<"timeout">((resolve) => {
          timer = setTimeout(() => resolve("timeout"), REQUEST_TIMEOUT_MS);
        });
        const result = await Promise.race([request, timeout]);
        if (!alive) return;
        if (result === "timeout") {
          if (attempt < 3) {
            setMessage(`板块行情源响应较慢 · 正在第 ${attempt}/3 次重试`);
            retryTimer = setTimeout(run, attempt * 1000);
          } else {
            setLoading(false);
            setMessage(rows.length ? "实时刷新暂时受阻 · 保留上次真实数据" : "板块行情暂时不可用");
          }
          return;
        }
        setRows(result.rows);
        saveCachedRows(ids, result.rows);
        setLoading(false);
        setMessage(result.weekend ? "休市 · 显示最近交易日数据" : result.rows.length ? "今日板块行情已更新" : "暂无可靠板块行情");
      } catch {
        if (!alive) return;
        if (attempt < 3) {
          setMessage(`板块行情连接波动 · 正在第 ${attempt}/3 次重试`);
          retryTimer = setTimeout(run, attempt * 1200);
        } else {
          setLoading(false);
          setMessage(rows.length ? "实时刷新暂时受阻 · 保留上次真实数据" : "板块行情暂时不可用");
        }
      } finally {
        if (timer) { clearTimeout(timer); timer = null; }
      }
    };

    void run();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [ids.join(",")]);

  const addSector = (raw: string) => {
    const sector = findSector(raw);
    if (!sector) {
      setMessage(`没有找到“${raw.trim()}”。请输入已有板块名称。`);
      return;
    }
    setPrefs((p) => ({ ids: p.ids.includes(sector.id) ? p.ids : [...p.ids, sector.id] }));
    setPage(0);
    setAdding(false);
    setQuery("");
    setMessage("");
  };

  const removeSector = (id: string) => {
    setPrefs((p) => ({ ids: p.ids.filter((x) => x !== id) }));
    if (open === id) setOpen(null);
  };

  const jumpAdd = () => {
    setAdding(true);
    setTimeout(() => document.getElementById("fund-sector-watch-input")?.focus(), 0);
  };

  return (
    <section className="mb-3 overflow-hidden rounded-[26px] border border-white/75 bg-white/45 p-3 shadow-[0_18px_48px_rgba(38,78,112,.075),inset_0_1px_0_rgba(255,255,255,.92)] backdrop-blur-[20px] saturate-150">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-tight text-fg">自选基金板块</div>
          <div className="mt-0.5 text-[10px] text-subtle">自己输入板块名称 · 只显示你选择的板块今日涨跌</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {ids.length > visibleCount ? <>
            <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="flex size-8 items-center justify-center rounded-full bg-white/70 ring-1 ring-white disabled:opacity-30"><ChevronLeft size={15}/></button>
            <button type="button" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page === pages - 1} className="flex size-8 items-center justify-center rounded-full bg-white/70 ring-1 ring-white disabled:opacity-30"><ChevronRight size={15}/></button>
          </> : null}
          <button type="button" onClick={jumpAdd} aria-label="添加板块" className="flex size-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm"><Plus size={16}/></button>
        </div>
      </div>

      {adding ? <div className="mt-2 rounded-[18px] border border-white/80 bg-white/60 p-2.5">
        <div className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/80 px-2.5 py-2">
          <Search size={14} className="text-subtle"/>
          <input id="fund-sector-watch-input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSector(query); if (e.key === "Escape") { setAdding(false); setQuery(""); } }} placeholder="输入板块名称，如：半导体芯片" className="min-w-0 flex-1 bg-transparent text-xs outline-none"/>
          <button type="button" onClick={() => { setAdding(false); setQuery(""); }} className="text-slate-400"><X size={14}/></button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">{suggestions.map((s) => <button key={s.id} type="button" onClick={() => addSector(s.name)} className="rounded-full border border-white/80 bg-white/80 px-2.5 py-1.5 text-[10px] font-medium text-slate-700">{s.icon} {s.name}</button>)}</div>
        {query.trim() ? <button type="button" onClick={() => addSector(query)} className="mt-2 w-full rounded-xl bg-blue-500 px-3 py-2 text-xs font-semibold text-white">添加“{query.trim()}”</button> : null}
      </div> : null}

      {!ids.length ? <button type="button" onClick={jumpAdd} className="mt-3 flex min-h-[88px] w-full flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300/70 bg-white/30 text-center"><Plus size={19} className="text-blue-500"/><span className="mt-1 text-xs font-medium text-slate-600">还没有自选板块</span><span className="mt-0.5 text-[10px] text-slate-400">点右上角“＋”后输入板块名称</span></button> : null}

      {ids.length ? <div className="mt-3 space-y-2">
        {loading && !rows.length ? <div className="rounded-[20px] bg-white/45 px-4 py-6 text-center text-xs text-subtle">正在读取你选择的板块行情…</div> : null}
        {visibleRows.map((row) => {
          const isOpen = open === row.id;
          return <article key={row.id} className="overflow-hidden rounded-[20px] border border-white/80 bg-white/[.62] shadow-[0_10px_30px_rgba(38,78,112,.06)]">
            <button type="button" onClick={() => setOpen(isOpen ? null : row.id)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-lg">{row.icon}</span>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-[14px] font-semibold text-slate-900">{row.name}</span><span className="text-[9px] text-slate-400">{row.up} 涨 · {row.down} 跌</span></span><span className="mt-0.5 block text-[9px] text-slate-400">{row.source} · {row.marketDate || "暂无可靠数据日"}</span></span>
              <span className={`shrink-0 text-[18px] font-bold tabular-nums ${tone(row.pct)}`}>{row.pct == null ? "—" : fmtPctShort(row.pct)}</span>
              <ChevronRight size={15} className={`shrink-0 text-slate-400 transition ${isOpen ? "rotate-90" : ""}`}/>
            </button>
            {isOpen ? <div className="border-t border-white/75 px-3.5 pb-3 pt-2"><div className="flex items-center justify-between text-[9px] text-slate-400"><span>{row.validCount}/{row.totalCount} 有效</span><button type="button" onClick={(e) => { e.stopPropagation(); removeSector(row.id); }} className="inline-flex items-center gap-1 rounded-full px-2 py-1"><X size={11}/>移除</button></div><div className="mt-2 space-y-1">{row.funds.slice(0, 8).map((fund) => <div key={fund.code} className="flex items-center gap-2 rounded-xl bg-white/50 px-2.5 py-1.5"><span className="min-w-0 flex-1 truncate text-[9px] text-slate-600">{fund.name}</span><span className={`text-[10px] font-semibold tabular-nums ${tone(fund.pct)}`}>{fund.pct == null ? "—" : fmtPctShort(fund.pct)}</span></div>)}</div></div> : null}
          </article>;
        })}
      </div> : null}

      {ids.length > visibleCount ? <div className="mt-2 text-center text-[9px] text-slate-400">第 {page + 1} / {pages} 页</div> : null}
      {message ? <div className="mt-2 px-1 text-[9px] text-slate-400">{message}</div> : null}
    </section>
  );
}
