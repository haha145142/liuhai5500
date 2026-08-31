import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { getFundSectorQuotes, type FundSectorQuote } from "@/lib/data/server";
import { DEFAULT_FUND_SECTOR_IDS, FUND_SECTORS } from "@/lib/data/fund-sectors";
import { fmtPctShort } from "@/lib/format";
import type { FundQuote, Holding } from "@/lib/types";

const KEY = "fund_ai_pro_fund_sector_watch_v3";
const DATA_KEY = "fund_ai_pro_fund_sector_data_v1";
type Prefs = { ids: string[] };

function readPrefs(): Prefs {
  if (typeof window === "undefined") return { ids: DEFAULT_FUND_SECTOR_IDS };
  try {
    const x = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<Prefs> | null;
    const ids = Array.isArray(x?.ids)
      ? x.ids.filter((v): v is string => typeof v === "string" && FUND_SECTORS.some((s) => s.id === v))
      : [];
    return { ids: ids.length ? ids : DEFAULT_FUND_SECTOR_IDS };
  } catch {
    return { ids: DEFAULT_FUND_SECTOR_IDS };
  }
}

function readCachedRows(ids: string[]): FundSectorQuote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(DATA_KEY) || "null") as {
      key?: string;
      rows?: FundSectorQuote[];
    } | null;
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
    // Storage is optional; live network data remains the source of truth.
  }
}

function tone(v: number | null) {
  return v == null ? "text-subtle" : v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted";
}

function validationLabel(v: FundSectorQuote["validation"]) {
  return v === "cross_checked"
    ? "多源核验"
    : v === "single_source"
      ? "单源可用"
      : v === "cached_latest_trading_day"
        ? "最近交易日"
        : "刷新中";
}

export function FundSectorWatchV2({ portfolio = [], funds = {} }: { portfolio?: Holding[]; funds?: Record<string, FundQuote> }) {
  const [{ ids }, setPrefs] = useState<Prefs>(readPrefs);
  const [rows, setRows] = useState<FundSectorQuote[]>(() => readCachedRows(readPrefs().ids));
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(rows.length === 0);
  const [message, setMessage] = useState(rows.length ? "已恢复上次真实数据 · 正在后台刷新" : "正在多源读取板块行情…");

  const pages = Math.max(1, Math.ceil(rows.length / 2));
  const visible = useMemo(() => rows.slice(page * 2, page * 2 + 2), [page, rows]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ids }));
    } catch {
      // Preferences are non-critical.
    }
  }, [ids]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const run = async () => {
      attempt += 1;
      setLoading((current) => current && rows.length === 0);
      try {
        const result = await getFundSectorQuotes({ data: { ids } });
        if (!alive) return;
        setRows(result.rows);
        saveCachedRows(ids, result.rows);
        setMessage(
          result.weekend
            ? "休市 · 沿用最近交易日数据，后台持续校验"
            : result.rows.length
              ? "数据已更新 · 多源后台校验中"
              : "正在重新连接行情源…",
        );
        setLoading(false);
      } catch {
        if (!alive) return;
        if (attempt < 3) {
          setMessage(`行情源连接波动 · 第 ${attempt}/3 次重试`);
          timer = setTimeout(run, attempt * 1200);
          return;
        }
        setLoading(false);
        setMessage(rows.length ? "实时刷新暂时受阻 · 已继续显示上次真实数据" : "行情源暂时波动 · 正在等待下一次自动刷新");
      }
    };

    setOpen(null);
    void run();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [ids.join(",")]);

  useEffect(() => {
    if (page >= pages) setPage(Math.max(0, pages - 1));
  }, [page, pages]);

  const remove = (id: string) => setPrefs((p) => ({ ids: p.ids.filter((x) => x !== id) }));
  const add = (id: string) => {
    setPrefs((p) => ({ ids: p.ids.includes(id) ? p.ids : [...p.ids, id] }));
    setAdding(false);
  };
  const available = FUND_SECTORS.filter((s) => !ids.includes(s.id));

  return (
    <section className="mb-3 overflow-hidden rounded-[28px] border border-white/75 bg-white/48 p-3 shadow-[0_18px_48px_rgba(38,78,112,.085),inset_0_1px_0_rgba(255,255,255,.92)] backdrop-blur-[20px] saturate-150">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold tracking-tight text-fg">自选基金板块</div>
          <div className="mt-0.5 text-[10px] text-subtle">数据统一随交易时段切换</div>
        </div>
        <button type="button" onClick={() => setAdding((v) => !v)} aria-label="添加板块" className="flex size-9 items-center justify-center rounded-full bg-fg text-bg shadow-sm transition active:scale-95"><Plus size={17} /></button>
      </div>
      {adding ? <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{available.slice(0, 24).map((s) => <button key={s.id} type="button" onClick={() => add(s.id)} className="shrink-0 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-[10px] font-medium shadow-sm">{s.icon} {s.name}</button>)}</div> : null}
      {loading && !rows.length ? <div className="mt-3 rounded-2xl border border-white/70 bg-white/45 px-3 py-7 text-center text-xs text-subtle"><div className="mx-auto mb-2 size-5 animate-pulse rounded-full bg-accent/20" />正在多源读取板块行情…</div> : null}
      <div className="mt-3 space-y-2">{visible.map((row) => { const isOpen = open === row.id; return <div key={row.id} className="overflow-hidden rounded-[24px] border border-white/70 bg-white/62 shadow-[0_10px_28px_rgba(30,76,125,.055),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[14px]"><button type="button" onClick={() => setOpen(isOpen ? null : row.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left"><span className="flex size-9 items-center justify-center rounded-2xl bg-white/70 text-xl shadow-sm">{row.icon}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-fg">{row.name}</span><span className="rounded-full bg-fg/[.045] px-1.5 py-0.5 text-[9px] text-subtle">{validationLabel(row.validation)}</span></div><div className="mt-1 text-[10px] text-subtle">{row.up} 涨 · {row.down} 跌 · {row.validCount}/{row.totalCount} 有效{row.leader ? ` · 领涨 ${row.leader.name}` : ""}</div></div><div className="text-right"><div className={`text-lg font-bold tabular-nums ${tone(row.pct)}`}>{row.pct == null ? "—" : fmtPctShort(row.pct)}</div><div className="mt-0.5 text-[8px] text-subtle">{row.marketDate || "日期未知"}</div></div><ChevronRight size={16} className={`text-subtle transition ${isOpen ? "rotate-90" : ""}`} /></button>{isOpen ? <div className="border-t border-black/[.05] px-4 pb-3 pt-2"><div className="mb-2 flex items-center justify-between text-[9px] text-subtle"><span>{row.source}</span><span>{row.validCount}/{row.totalCount} 有效</span></div><div className="space-y-1">{row.funds.slice(0, 8).map((f) => <div key={f.code} className="flex items-center gap-2 rounded-xl border border-white/60 bg-bg-elevated/65 px-2.5 py-2"><div className="min-w-0 flex-1 truncate text-[10px] text-fg">{f.name}<span className="ml-1 text-[8px] text-subtle">{f.code}</span></div><span className="text-[8px] text-subtle">{f.validation === "cross_checked" ? "核验" : f.validation === "single_source" ? "单源" : "—"}</span><span className={`text-[10px] font-semibold tabular-nums ${tone(f.pct)}`}>{f.pct == null ? "—" : fmtPctShort(f.pct)}</span></div>)}</div><div className="mt-2 flex justify-end"><button type="button" onClick={() => remove(row.id)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[9px] text-subtle hover:bg-black/[.04]"><X size={11} />移除</button></div></div> : null}</div>; })}</div>
      {rows.length > 2 ? <div className="mt-3 flex items-center justify-center gap-2"><button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="flex size-8 items-center justify-center rounded-full bg-white/72 ring-1 ring-white/80 shadow-sm disabled:opacity-30"><ChevronLeft size={15} /></button><span className="text-[10px] font-medium tabular-nums text-subtle">{page + 1} / {pages}</span><button type="button" disabled={page === pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} className="flex size-8 items-center justify-center rounded-full bg-white/72 ring-1 ring-white/80 shadow-sm disabled:opacity-30"><ChevronRight size={15} /></button></div> : null}
      {message ? <div className="mt-2 rounded-xl bg-white/30 px-2.5 py-1.5 text-[9px] text-subtle">{message}</div> : null}
    </section>
  );
}
