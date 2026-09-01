import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { getFundSectorQuotes, type FundSectorQuote } from "@/lib/data/server";
import { FUND_SECTORS } from "@/lib/data/fund-sectors";
import { enrichFundSectorMembers, quoteForEnrichedHolding } from "@/lib/data/fund-sector-membership";
import { fmtPctShort } from "@/lib/format";
import type { FundQuote, Holding } from "@/lib/types";

// 用户自己选择的板块。升级 key 后清掉旧版默认板块，避免旧配置把页面塞满。
const KEY = "fund_ai_pro_fund_sector_watch_v3";
type StoredPrefs = { ids: string[]; pinned: string[] };

function readPrefs(): StoredPrefs {
  if (typeof window === "undefined") return { ids: [], pinned: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<StoredPrefs> | null;
    if (Array.isArray(raw?.ids)) {
      const validIds = raw.ids.filter((id): id is string => typeof id === "string" && FUND_SECTORS.some((s) => s.id === id));
      const validPinned = Array.isArray(raw.pinned)
        ? raw.pinned.filter((id): id is string => typeof id === "string" && validIds.includes(id))
        : [];
      return { ids: validIds, pinned: validPinned };
    }
  } catch {}
  return { ids: [], pinned: [] };
}

function tone(pct: number | null) {
  return pct == null ? "text-subtle" : pct > 0 ? "text-up" : pct < 0 ? "text-down" : "text-muted";
}

function findSector(input: string) {
  const q = input.trim().toLowerCase();
  if (!q) return null;
  return FUND_SECTORS.find((s) => s.id.toLowerCase() === q || s.name.toLowerCase() === q)
    || FUND_SECTORS.find((s) => s.name.toLowerCase().includes(q));
}

export function FundSectorWatch({ portfolio = [], funds = {} }: { portfolio?: Holding[]; funds?: Record<string, FundQuote> }) {
  const [{ ids, pinned }, setPrefs] = useState<StoredPrefs>(readPrefs);
  const [rows, setRows] = useState<FundSectorQuote[]>([]);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const pageSize = 2;

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FUND_SECTORS.filter((s) => !ids.includes(s.id) && (!q || `${s.name} ${s.id}`.toLowerCase().includes(q))).slice(0, 10);
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
    if (!pageIds.length) {
      setRows([]);
      setLoading(false);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => { if (alive) setLoading(false); }, 7000);
    setLoading(true);
    setMessage("");
    void getFundSectorQuotes({ data: { ids: pageIds } })
      .then((res) => {
        if (!alive) return;
        setRows(res.rows);
        setMessage(res.weekend ? "周末休市 · 沿用最近交易日数据" : "");
      })
      .catch(() => {
        if (alive) {
          setRows([]);
          setMessage("今日板块行情暂不可用");
        }
      })
      .finally(() => {
        if (alive) {
          window.clearTimeout(timer);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [pageIds.join(",")]);

  const addSector = (raw: string) => {
    const sector = findSector(raw);
    if (!sector) {
      setMessage(`没有找到“${raw.trim()}”。请输入已有板块名称，例如“半导体芯片”“人工智能”“银行”。`);
      return;
    }
    setPrefs((cur) => ({ ...cur, ids: cur.ids.includes(sector.id) ? cur.ids : [...cur.ids, sector.id] }));
    setPage(0);
    setAdding(false);
    setQuery("");
    setMessage("");
  };

  const removeSector = (id: string) => {
    setPrefs((cur) => ({ ids: cur.ids.filter((x) => x !== id), pinned: cur.pinned.filter((x) => x !== id) }));
    if (openId === id) setOpenId(null);
  };

  const togglePin = (id: string) => {
    setPrefs((cur) => cur.pinned.includes(id)
      ? { ...cur, pinned: cur.pinned.filter((x) => x !== id) }
      : { ...cur, pinned: [id, ...cur.pinned.filter((x) => x !== id)] });
    setPage(0);
  };

  const jumpAdd = () => {
    setAdding(true);
    setTimeout(() => document.getElementById("fund-sector-add-input")?.focus(), 0);
  };

  return (
    <section className="mb-4 rounded-[28px] border border-white/80 bg-white/[.46] p-3 shadow-[0_18px_60px_rgba(66,93,122,.09)] backdrop-blur-[26px]">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-tight text-fg">自选基金板块</div>
          <div className="mt-0.5 text-[10px] text-subtle">自己输入板块名称添加 · 只显示你选择的板块今日涨跌</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {orderedIds.length > pageSize ? <>
            <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="上一页" className="flex size-8 items-center justify-center rounded-full border border-white/80 bg-white/55 text-slate-500 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} aria-label="下一页" className="flex size-8 items-center justify-center rounded-full border border-white/80 bg-white/55 text-slate-500 disabled:opacity-30"><ChevronRight size={16} /></button>
          </> : null}
          <button type="button" onClick={jumpAdd} aria-label="添加板块" className="flex size-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm"><Plus size={16} /></button>
        </div>
      </div>

      {adding ? (
        <div className="mt-2 rounded-[20px] border border-white/80 bg-white/55 p-2.5 backdrop-blur-xl">
          <div className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-2.5 py-2">
            <Search size={14} className="text-subtle" />
            <input
              id="fund-sector-add-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addSector(query); if (e.key === "Escape") { setAdding(false); setQuery(""); } }}
              placeholder="输入板块名称，例如：半导体芯片"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
            <button type="button" onClick={() => { setAdding(false); setQuery(""); }} className="rounded-full p-1 text-slate-400"><X size={14} /></button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => <button key={s.id} type="button" onClick={() => addSector(s.name)} className="rounded-full border border-white/80 bg-white/75 px-2.5 py-1.5 text-[10px] font-medium text-slate-700">{s.icon} {s.name}</button>)}
          </div>
          {query.trim() ? <button type="button" onClick={() => addSector(query)} className="mt-2 w-full rounded-xl bg-blue-500 px-3 py-2 text-xs font-semibold text-white">添加“{query.trim()}”</button> : null}
        </div>
      ) : null}

      {!orderedIds.length ? (
        <button type="button" onClick={jumpAdd} className="mt-3 flex min-h-[92px] w-full flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-300/70 bg-white/35 text-center">
          <Plus size={20} className="text-blue-500" />
          <span className="mt-1 text-xs font-medium text-slate-600">还没有自选板块</span>
          <span className="mt-0.5 text-[10px] text-slate-400">点右上角“＋”，输入你要看的板块名称</span>
        </button>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {loading && !rows.length ? <div className="min-h-[104px] rounded-[22px] border border-white/80 bg-white/48 p-4 shadow-[0_10px_30px_rgba(66,93,122,.06)] backdrop-blur-xl"><div className="h-4 w-24 animate-pulse rounded bg-slate-200/70"/><div className="mt-4 h-7 w-20 animate-pulse rounded bg-slate-200/70"/></div> : null}
          {rows.map((row) => {
            const open = openId === row.id;
            const def = FUND_SECTORS.find((s) => s.id === row.id);
            const heldCodes = new Set(portfolio.map((h) => h.code));
            const held = row.funds.filter((f) => heldCodes.has(f.code));
            const dynamic = def
              ? enrichFundSectorMembers(def, row.funds, portfolio)
                .map((m) => {
                  const h = portfolio.find((x) => x.code === m.code);
                  return h ? { ...quoteForEnrichedHolding(h, funds), validation: "single_source" as const, source: "持仓基金行情" } : null;
                })
                .filter((x): x is NonNullable<typeof x> => !!x)
              : [];
            const merged = [...row.funds, ...dynamic.filter((f) => !row.funds.some((x) => x.code === f.code))];
            const visibleFunds = open ? merged.slice(0, 6) : [];
            return (
              <article key={row.id} className="overflow-hidden rounded-[22px] border border-white/85 bg-white/[.62] shadow-[0_12px_34px_rgba(66,93,122,.08)] backdrop-blur-[24px]">
                <button type="button" onClick={() => setOpenId((cur) => cur === row.id ? null : row.id)} className="w-full px-3.5 py-3.5 text-left active:scale-[.995]">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/90 bg-white/72 text-lg shadow-sm">{row.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold text-slate-900">{row.name}</span>
                        <span className="rounded-full bg-slate-100/80 px-1.5 py-0.5 text-[9px] text-slate-400">{row.validCount}/{row.totalCount}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">{row.up} 涨 · {row.down} 跌{held.length ? ` · 持有 ${held.length}` : ""}</div>
                    </div>
                    <div className={`shrink-0 text-xl font-bold tabular-nums ${tone(row.pct)}`}>{row.pct == null ? "—" : fmtPctShort(row.pct)}</div>
                  </div>
                </button>
                {open ? (
                  <div className="border-t border-white/75 px-3.5 pb-3.5 pt-2.5">
                    <div className="space-y-1.5">{visibleFunds.map((fund) => <div key={fund.code} className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/48 px-2.5 py-2"><div className="min-w-0 flex-1"><div className="truncate text-[10px] font-medium text-slate-700">{fund.name}</div><div className="text-[9px] text-slate-400">{fund.code}</div></div><span className={`text-[11px] font-semibold tabular-nums ${tone(fund.pct)}`}>{fund.pct == null ? "—" : fmtPctShort(fund.pct)}</span></div>)}</div>
                    <div className="mt-2.5 flex items-center justify-between"><button type="button" onClick={(e) => { e.stopPropagation(); togglePin(row.id); }} className="rounded-full px-2 py-1 text-[9px] text-slate-400">{pinned.includes(row.id) ? "取消置顶" : "置顶"}</button><button type="button" onClick={(e) => { e.stopPropagation(); removeSector(row.id); }} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] text-slate-400"><X size={12} />移除</button></div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {orderedIds.length > pageSize ? <div className="mt-2.5 flex items-center justify-center gap-1.5">{Array.from({ length: pageCount }).map((_, i) => <button key={i} type="button" aria-label={`第 ${i + 1} 页`} onClick={() => setPage(i)} className={`h-1.5 rounded-full transition-all ${i === page ? "w-5 bg-slate-700" : "w-1.5 bg-slate-300"}`} />)}</div> : null}
      {message ? <div className="mt-2 px-1 text-[10px] text-slate-400">{message}</div> : null}
    </section>
  );
}
