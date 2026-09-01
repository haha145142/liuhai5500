import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Plus, Search, X } from "lucide-react";
import { getFundSectorQuotes, type FundSectorQuote } from "@/lib/data/server";
import { FUND_SECTORS } from "@/lib/data/fund-sectors";
import { fmtPctShort } from "@/lib/format";
import type { FundQuote, Holding } from "@/lib/types";

const KEY = "fund_ai_pro_fund_sector_watch_v5";
const DATA_KEY = "fund_ai_pro_fund_sector_data_v3";
const REQUEST_TIMEOUT_MS = 7_000;

type Prefs = { ids: string[] };

function readPrefs(): Prefs {
  if (typeof window === "undefined") return { ids: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<Prefs> | null;
    const ids = Array.isArray(raw?.ids)
      ? raw.ids.filter((id): id is string => typeof id === "string" && FUND_SECTORS.some((s) => s.id === id))
      : [];
    return { ids };
  } catch {
    return { ids: [] };
  }
}

function readCachedRows(ids: string[]): FundSectorQuote[] {
  if (typeof window === "undefined" || !ids.length) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(DATA_KEY) || "null") as { key?: string; rows?: FundSectorQuote[] } | null;
    return raw?.key === ids.join(",") && Array.isArray(raw.rows) ? raw.rows : [];
  } catch {
    return [];
  }
}

function saveCachedRows(ids: string[], rows: FundSectorQuote[]) {
  if (typeof window === "undefined" || !rows.length) return;
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify({ key: ids.join(","), rows, savedAt: Date.now() }));
  } catch {
    // ignore storage quota errors
  }
}

function tone(v: number | null) {
  return v == null ? "text-muted" : v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted";
}

function toneBg(v: number | null) {
  return v == null ? "bg-bg-elevated" : v > 0 ? "bg-up/8" : v < 0 ? "bg-down/8" : "bg-bg-elevated";
}

function findSector(input: string) {
  const q = input.trim().toLowerCase();
  if (!q) return null;
  return (
    FUND_SECTORS.find((s) => s.id.toLowerCase() === q || s.name.toLowerCase() === q) ||
    FUND_SECTORS.find((s) => s.name.toLowerCase().includes(q)) ||
    FUND_SECTORS.find((s) => q.includes(s.name.toLowerCase()))
  );
}

export function FundSectorWatchV2({ portfolio = [], funds = {} }: { portfolio?: Holding[]; funds?: Record<string, FundQuote> }) {
  void portfolio;
  void funds;
  const [{ ids }, setPrefs] = useState<Prefs>(readPrefs);
  const [rows, setRows] = useState<FundSectorQuote[]>(() => readCachedRows(readPrefs().ids));
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FUND_SECTORS
      .filter((s) => !ids.includes(s.id))
      .filter((s) => !q || `${s.name} ${s.id}`.toLowerCase().includes(q))
      .slice(0, 10);
  }, [ids, query]);

  const visibleRows = useMemo(
    () => ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is FundSectorQuote => !!r),
    [ids, rows],
  );

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ids }));
    } catch {
      // ignore storage errors
    }
  }, [ids]);

  useEffect(() => {
    if (!ids.length) {
      setRows([]);
      setLoading(false);
      setMessage("");
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
          if (attempt < 2) {
            setMessage("行情源响应较慢，正在自动重试…");
            retryTimer = setTimeout(run, 900);
          } else {
            setLoading(false);
            setMessage(rows.length ? "实时刷新暂时受阻，保留上次可靠数据" : "当前没有拿到可靠板块行情");
          }
          return;
        }

        setRows(result.rows);
        saveCachedRows(ids, result.rows);
        setLoading(false);
        setMessage(result.weekend ? "休市 · 显示最近交易日可靠数据" : "行情已更新");
      } catch {
        if (!alive) return;
        if (attempt < 2) {
          setMessage("行情连接波动，正在自动重试…");
          retryTimer = setTimeout(run, 900);
        } else {
          setLoading(false);
          setMessage(rows.length ? "实时刷新暂时受阻，保留上次可靠数据" : "当前没有拿到可靠板块行情");
        }
      } finally {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
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
      setMessage(`没有找到“${raw.trim()}”，可以从下面建议中选择。`);
      return;
    }
    setPrefs((prev) => ({ ids: prev.ids.includes(sector.id) ? prev.ids : [...prev.ids, sector.id] }));
    setAdding(false);
    setQuery("");
    setOpen(sector.id);
    setMessage("");
  };

  const removeSector = (id: string) => {
    setPrefs((prev) => ({ ids: prev.ids.filter((x) => x !== id) }));
    if (open === id) setOpen(null);
  };

  return (
    <section className="mb-3 rounded-[24px] border border-white/70 bg-white/48 p-3 shadow-[0_18px_50px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.94)] backdrop-blur-[24px] saturate-150">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold tracking-tight text-fg">自选板块</h2>
            <span className="rounded-full bg-blue/10 px-2 py-0.5 text-[9px] font-medium text-blue">自己添加</span>
          </div>
          <p className="mt-1 text-[10px] text-subtle">输入板块名称，只看你真正关注的板块今日涨跌</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          aria-label="添加板块"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_6px_18px_rgba(15,23,42,.18)] active:scale-95"
        >
          {adding ? <X size={17} /> : <Plus size={17} />}
        </button>
      </div>

      {adding ? (
        <div className="mt-3 rounded-[18px] border border-white/80 bg-white/72 p-2.5 shadow-[0_8px_24px_rgba(38,78,112,.05)]">
          <div className="flex items-center gap-2 rounded-[14px] border border-slate-200/70 bg-white px-3 py-2.5">
            <Search size={15} className="shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addSector(query);
                if (e.key === "Escape") {
                  setAdding(false);
                  setQuery("");
                }
              }}
              placeholder="例如：半导体、人工智能、银行、军工"
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
            />
            {query ? <button type="button" onClick={() => setQuery("")} className="text-slate-400"><X size={14} /></button> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => addSector(s.name)}
                className="inline-flex items-center gap-1 rounded-full border border-white bg-white px-2.5 py-1.5 text-[10px] font-medium text-slate-700 shadow-sm"
              >
                <span>{s.icon}</span><span>{s.name}</span>
              </button>
            ))}
          </div>
          {query.trim() ? (
            <button type="button" onClick={() => addSector(query)} className="mt-2 w-full rounded-[12px] bg-blue-500 px-3 py-2.5 text-xs font-semibold text-white active:scale-[.99]">
              添加“{query.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}

      {!ids.length ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 flex min-h-[104px] w-full flex-col items-center justify-center rounded-[18px] border border-dashed border-blue/20 bg-white/40 text-center active:bg-white/65"
        >
          <span className="flex size-10 items-center justify-center rounded-2xl bg-blue/10 text-blue"><Plus size={18} /></span>
          <span className="mt-2 text-xs font-semibold text-slate-700">还没有自选板块</span>
          <span className="mt-1 text-[10px] text-slate-400">点右上角＋，输入板块名称即可添加</span>
        </button>
      ) : null}

      {ids.length ? (
        <div className="mt-3 space-y-2">
          {loading && !rows.length ? (
            <div className="rounded-[18px] bg-white/50 px-4 py-7 text-center text-xs text-subtle">正在读取板块行情…</div>
          ) : null}

          {visibleRows.map((row) => {
            const isOpen = open === row.id;
            return (
              <article key={row.id} className={`overflow-hidden rounded-[18px] border border-white/80 ${toneBg(row.pct)} shadow-[0_8px_24px_rgba(38,78,112,.045)]`}>
                <button type="button" onClick={() => setOpen(isOpen ? null : row.id)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-white/40">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-white/76 text-lg shadow-sm">{row.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[14px] font-semibold text-slate-900">{row.name}</span>
                      {row.validation === "cross_checked" ? <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-medium text-emerald-600">多源</span> : null}
                    </span>
                    <span className="mt-0.5 block text-[9px] text-slate-400">{row.marketDate || "数据日未知"} · {row.up}涨 {row.down}跌</span>
                  </span>
                  <span className={`shrink-0 text-[20px] font-bold tabular-nums ${tone(row.pct)}`}>{row.pct == null ? "—" : fmtPctShort(row.pct)}</span>
                  <ChevronRight size={15} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>

                {isOpen ? (
                  <div className="border-t border-white/75 px-3.5 pb-3 pt-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 text-[9px] text-slate-400">
                        <span>{row.source}</span>
                        <span>{row.validCount}/{row.totalCount} 有效</span>
                      </div>
                      <button type="button" onClick={() => removeSector(row.id)} className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 text-[9px] text-slate-500">
                        <X size={11} />移除
                      </button>
                    </div>
                    {row.marketPct != null ? (
                      <div className="mt-2 rounded-[14px] bg-white/65 px-3 py-2.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">板块指数</span>
                          <b className={tone(row.marketPct)}>{fmtPctShort(row.marketPct)}</b>
                        </div>
                        {row.mainFlow != null ? <div className="mt-1 text-[9px] text-slate-400">主力净流入 · {row.mainFlow.toFixed(2)}</div> : null}
                      </div>
                    ) : null}
                    {row.funds.length ? (
                      <div className="mt-2 space-y-1">
                        {row.funds.slice(0, 6).map((fund) => (
                          <div key={fund.code} className="flex items-center gap-2 rounded-xl bg-white/52 px-2.5 py-1.5">
                            <span className="min-w-0 flex-1 truncate text-[9px] text-slate-600">{fund.name}</span>
                            <span className={`text-[10px] font-semibold tabular-nums ${tone(fund.pct)}`}>{fund.pct == null ? "—" : fmtPctShort(fund.pct)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}

          {!loading && ids.length && !visibleRows.length ? (
            <div className="rounded-[18px] bg-white/50 px-4 py-6 text-center text-xs text-subtle">已添加板块，但当前没有可靠行情。</div>
          ) : null}
        </div>
      ) : null}

      {message ? <div className="mt-2 px-1 text-[9px] text-slate-400">{message}</div> : null}
      {ids.length ? (
        <div className="mt-2 flex items-center justify-between px-1 text-[9px] text-slate-400">
          <span>已选 {ids.length} 个板块</span>
          <span className="inline-flex items-center gap-1"><Check size={10} /> 自动保存</span>
        </div>
      ) : null}
    </section>
  );
}
