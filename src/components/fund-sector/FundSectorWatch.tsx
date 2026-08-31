import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { getFundSectorQuotes, type FundSectorQuote } from "@/lib/data/server";
import { FUND_SECTORS, DEFAULT_FUND_SECTOR_IDS } from "@/lib/data/fund-sectors";
import { enrichFundSectorMembers, quoteForEnrichedHolding } from "@/lib/data/fund-sector-membership";
import { fmtPctShort } from "@/lib/format";
import type { FundQuote, Holding } from "@/lib/types";

const KEY = "fund_ai_pro_fund_sector_watch_v2";
type StoredPrefs = { ids: string[]; pinned: string[] };

function readPrefs(): StoredPrefs {
  if (typeof window === "undefined") return { ids: DEFAULT_FUND_SECTOR_IDS, pinned: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<StoredPrefs> | null;
    if (Array.isArray(raw?.ids)) return { ids: raw.ids.filter((x): x is string => typeof x === "string"), pinned: Array.isArray(raw.pinned) ? raw.pinned.filter((x): x is string => typeof x === "string") : [] };
  } catch {}
  return { ids: DEFAULT_FUND_SECTOR_IDS, pinned: [] };
}
function tone(pct: number | null) { return pct == null ? "text-subtle" : pct > 0 ? "text-up" : pct < 0 ? "text-down" : "text-muted"; }

export function FundSectorWatch({ portfolio = [], funds = {} }: { portfolio?: Holding[]; funds?: Record<string, FundQuote> }) {
  const [{ ids, pinned }, setPrefs] = useState<StoredPrefs>(readPrefs);
  const [rows, setRows] = useState<FundSectorQuote[]>([]);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const pageSize = 2;

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FUND_SECTORS.filter((s) => !ids.includes(s.id) && (!q || `${s.name} ${s.id}`.toLowerCase().includes(q)));
  }, [ids, query]);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ ids, pinned } satisfies StoredPrefs)); } catch {}
  }, [ids, pinned]);

  const orderedIds = useMemo(() => {
    const rest = ids.filter((id) => !pinned.includes(id));
    return [...pinned.filter((id) => ids.includes(id)), ...rest];
  }, [ids, pinned]);
  const pageIds = orderedIds.slice(page * pageSize, page * pageSize + pageSize);
  const pageCount = Math.max(1, Math.ceil(orderedIds.length / pageSize));

  useEffect(() => {
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  useEffect(() => {
    if (!pageIds.length) { setRows([]); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    void getFundSectorQuotes({ data: { ids: pageIds } })
      .then((res) => { if (alive) { setRows(res.rows); setMessage(res.weekend ? "周末休市 · 沿用最近交易日数据" : ""); } })
      .catch(() => { if (alive) setMessage("实时行情暂不可用 · 请稍后重试"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [pageIds.join(",")]);

  const addSector = (id: string) => { setPrefs((cur) => ({ ...cur, ids: cur.ids.includes(id) ? cur.ids : [...cur.ids, id] })); setAdding(false); setQuery(""); };
  const removeSector = (id: string) => { setPrefs((cur) => ({ ids: cur.ids.filter((x) => x !== id), pinned: cur.pinned.filter((x) => x !== id) })); setOpenId(null); };
  const togglePin = (id: string) => { setPrefs((cur) => cur.pinned.includes(id) ? { ...cur, pinned: cur.pinned.filter((x) => x !== id) } : { ...cur, pinned: [id, ...cur.pinned.filter((x) => x !== id)] }); setPage(0); };

  return (
    <section className="mb-4 rounded-[28px] border border-white/80 bg-white/[.46] p-3 shadow-[0_18px_60px_rgba(66,93,122,.09)] backdrop-blur-[26px]">
      <div className="flex items-center justify-between gap-3 px-1">
        <div><div className="text-[15px] font-semibold tracking-tight text-fg">自选板块</div><div className="mt-0.5 text-[10px] text-subtle">每次只看 2 个主题 · 数据不足明确显示</div></div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="上一页" className="flex size-8 items-center justify-center rounded-full border border-white/80 bg-white/55 text-slate-500 disabled:opacity-30"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} aria-label="下一页" className="flex size-8 items-center justify-center rounded-full border border-white/80 bg-white/55 text-slate-500 disabled:opacity-30"><ChevronRight size={16} /></button>
          <button type="button" onClick={() => setAdding((v) => !v)} aria-label="管理板块" className="flex size-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm"><Plus size={16} /></button>
        </div>
      </div>

      {adding ? <div className="mt-2 rounded-[20px] border border-white/80 bg-white/55 p-2.5 backdrop-blur-xl"><div className="mb-2 flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-2.5 py-2"><Search size={14} className="text-subtle"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索板块" className="min-w-0 flex-1 bg-transparent text-xs outline-none"/></div><div className="flex max-h-44 flex-wrap gap-1.5 overflow-auto">{available.slice(0, 40).map((s) => <button key={s.id} type="button" onClick={() => addSector(s.id)} className="rounded-full border border-white/80 bg-white/75 px-2.5 py-1.5 text-[10px] font-medium text-slate-700">{s.icon} {s.name}</button>)}</div></div> : null}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {loading && !rows.length ? <div className="min-h-[138px] rounded-[24px] border border-white/80 bg-white/48 p-4 shadow-[0_10px_30px_rgba(66,93,122,.06)] backdrop-blur-xl"><div className="h-4 w-28 animate-pulse rounded bg-slate-200/70"/><div className="mt-5 h-8 w-20 animate-pulse rounded bg-slate-200/70"/></div> : null}
        {rows.map((row) => {
          const open = openId === row.id;
          const def = FUND_SECTORS.find((s) => s.id === row.id);
          const heldCodes = new Set(portfolio.map((h) => h.code));
          const held = row.funds.filter((f) => heldCodes.has(f.code));
          const dynamic = def ? enrichFundSectorMembers(def, row.funds, portfolio).map((m) => { const h = portfolio.find((x) => x.code === m.code); return h ? { ...quoteForEnrichedHolding(h, funds), validation: "single_source" as const, source: "持仓基金行情" } : null; }).filter((x): x is NonNullable<typeof x> => !!x) : [];
          const merged = [...row.funds, ...dynamic.filter((f) => !row.funds.some((x) => x.code === f.code))];
          const visibleFunds = open ? merged.slice(0, 6) : [];
          return <article key={row.id} className="overflow-hidden rounded-[24px] border border-white/85 bg-white/[.58] shadow-[0_14px_40px_rgba(66,93,122,.09)] backdrop-blur-[24px]">
            <button type="button" onClick={() => setOpenId((cur) => cur === row.id ? null : row.id)} className="w-full px-4 py-4 text-left active:scale-[.995]">
              <div className="flex items-start gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/90 bg-white/72 text-xl shadow-sm">{row.icon}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-[14px] font-semibold text-slate-900">{row.name}</span><span className="text-[9px] text-slate-400">{row.validCount}/{row.totalCount}</span></div><div className="mt-1 text-[10px] text-slate-500">{row.up} 涨 · {row.down} 跌{held.length ? ` · 持有 ${held.length}` : ""}</div></div><div className={`text-lg font-bold tabular-nums ${tone(row.pct)}`}>{row.pct == null ? "—" : fmtPctShort(row.pct)}</div></div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200/70"><div className="h-full rounded-full bg-slate-400/35" style={{ width: `${Math.min(100, Math.max(0, row.validCount / Math.max(1, row.totalCount) * 100))}%` }}/></div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-slate-400"><span>{row.source}</span><span>{row.marketDate || "暂无数据日"}</span></div>
            </button>
            {open ? <div className="border-t border-white/75 px-4 pb-4 pt-3"><div className="space-y-1.5">{visibleFunds.map((fund) => <div key={fund.code} className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/48 px-2.5 py-2"><div className="min-w-0 flex-1"><div className="truncate text-[10px] font-medium text-slate-700">{fund.name}</div><div className="text-[9px] text-slate-400">{fund.code}</div></div><span className={`text-[11px] font-semibold tabular-nums ${tone(fund.pct)}`}>{fund.pct == null ? "—" : fmtPctShort(fund.pct)}</span></div>)}</div><div className="mt-3 flex items-center justify-between"><span className="text-[9px] text-slate-400">{held.length ? `持仓 ${held.length} 只优先展示` : "点击卡片收起"}</span><button type="button" onClick={(e) => { e.stopPropagation(); removeSector(row.id); }} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] text-slate-400"><X size={12}/>移除</button></div></div> : null}
          </article>;
        })}
      </div>

      {orderedIds.length > pageSize ? <div className="mt-3 flex items-center justify-center gap-1.5">{Array.from({ length: pageCount }).map((_, i) => <button key={i} type="button" aria-label={`第 ${i + 1} 页`} onClick={() => setPage(i)} className={`h-1.5 rounded-full transition-all ${i === page ? "w-5 bg-slate-700" : "w-1.5 bg-slate-300"}`}/>)}</div> : null}
      {message ? <div className="mt-2 px-1 text-[9px] text-slate-400">{message}</div> : null}
    </section>
  );
}
