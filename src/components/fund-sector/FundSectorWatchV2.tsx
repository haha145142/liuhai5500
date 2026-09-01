import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Plus, Search, X } from "lucide-react";
import { getBoardWatchQuotes, searchFundBoards, type BoardCandidate, type BoardWatchQuote } from "@/lib/data/board-watch";
import { fmtPctShort } from "@/lib/format";
import type { FundQuote, Holding } from "@/lib/types";

type Selection = { code: string; name: string; icon: string };
type State = { items: Selection[] };

const KEY = "fund_ai_pro_board_watch_v7";
const LEGACY_KEY = "fund_ai_pro_board_watch_v6";
const LEGACY_DEFAULT_CODES = new Set(["BK0917", "BK1134", "BK1128", "BK1137", "BK1059", "BK1650", "BK1129", "BK0890"]);
const DEFAULT_ITEMS: Selection[] = [];

function normalizeItems(value: unknown): Selection[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is Selection => {
    if (!item || typeof item !== "object") return false;
    const x = item as Partial<Selection>;
    const code = String(x.code ?? "").trim();
    const name = String(x.name ?? "").trim();
    if (!code || !name || seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

function readState(): State {
  if (typeof window === "undefined") return { items: DEFAULT_ITEMS };
  try {
    const current = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<State> | null;
    if (current && Array.isArray(current.items)) return { items: normalizeItems(current.items) };

    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null") as Partial<State> | null;
    const legacyItems = normalizeItems(legacy?.items);
    const isOldDefault = legacyItems.length === LEGACY_DEFAULT_CODES.size && legacyItems.every((item) => LEGACY_DEFAULT_CODES.has(item.code));
    const migrated = isOldDefault ? [] : legacyItems;
    try { localStorage.setItem(KEY, JSON.stringify({ items: migrated })); } catch {}
    return { items: migrated };
  } catch {
    return { items: DEFAULT_ITEMS };
  }
}

function tone(v: number | null) { return v == null ? "text-muted" : v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted"; }
function formatFlow(v: number | null) { if (v == null || !Number.isFinite(v)) return "—"; const yi = v / 1e8; return `${yi >= 0 ? "+" : ""}${yi.toFixed(2)}亿`; }
function flowLabel(v: number | null) { if (v == null || !Number.isFinite(v)) return "暂无"; return v > 0 ? "净流入" : v < 0 ? "净流出" : "基本持平"; }

function fetchBoardQuotesJsonp(codes: string[]): Promise<BoardWatchQuote[]> {
  return new Promise((resolve, reject) => {
    const cb = `__fap_board_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let done = false;
    const finish = (ok: boolean, value?: unknown) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[cb];
      script.remove();
      if (ok) resolve(value as BoardWatchQuote[]); else reject(value instanceof Error ? value : new Error("board-jsonp-failed"));
    };
    const timer = window.setTimeout(() => finish(false, new Error("board-jsonp-timeout")), 7000);
    (window as unknown as Record<string, (payload: unknown) => void>)[cb] = (payload) => {
      const data = payload as { data?: { diff?: Record<string, unknown>[] | Record<string, Record<string, unknown>> } };
      const raw = data?.data?.diff;
      const rows = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
      const wanted = new Set(codes);
      const now = new Date();
      const marketDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const out = rows.filter((r) => wanted.has(String(r.f12 ?? "").trim())).map((r) => ({
        code: String(r.f12 ?? ""), name: String(r.f14 ?? r.f12 ?? ""), icon: "📈",
        pct: Number.isFinite(Number(r.f3)) ? Number(r.f3) : null,
        mainFlow: Number.isFinite(Number(r.f62)) ? Number(r.f62) : null,
        superFlow: Number.isFinite(Number(r.f66)) ? Number(r.f66) : null,
        largeFlow: Number.isFinite(Number(r.f72)) ? Number(r.f72) : null,
        midFlow: Number.isFinite(Number(r.f78)) ? Number(r.f78) : null,
        smallFlow: Number.isFinite(Number(r.f84)) ? Number(r.f84) : null,
        turnover: Number.isFinite(Number(r.f6)) ? Number(r.f6) : null,
        marketDate,
        source: "东方财富浏览器 JSONP 直连",
        validation: Number.isFinite(Number(r.f3)) ? "live" as const : "unavailable" as const,
      }));
      finish(true, out);
    };
    script.async = true;
    script.onerror = () => finish(false, new Error("board-jsonp-error"));
    script.src = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=1200&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2,m:90+t:3&fields=${encodeURIComponent("f12,f14,f3,f62,f66,f72,f78,f84,f6")}&ut=fa5fd1943c7b386f172d6893dbfba10b&cb=${encodeURIComponent(cb)}&_=${Date.now()}`;
    document.head.appendChild(script);
  });
}

export function FundSectorWatchV2(_props?: { portfolio?: Holding[]; funds?: Record<string, FundQuote> }) {
  const [{ items }, setState] = useState<State>(readState);
  const [quotes, setQuotes] = useState<BoardWatchQuote[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<BoardCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const codeList = useMemo(() => items.map((x) => x.code), [items]);
  const quoteMap = useMemo(() => new Map(quotes.map((q) => [q.code, q])), [quotes]);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ items })); } catch {} }, [items]);

  useEffect(() => {
    if (!searchOpen) return;
    const q = query.trim();
    if (!q) { setSuggestions([]); return; }
    let alive = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchFundBoards({ data: { query: q } });
        if (alive) setSuggestions(result.items.filter((x) => !items.some((i) => i.code === x.code)));
      } catch { if (alive) setSuggestions([]); }
      finally { if (alive) setSearching(false); }
    }, 260);
    return () => { alive = false; clearTimeout(timer); };
  }, [query, searchOpen, items]);

  useEffect(() => {
    if (!codeList.length) { setQuotes([]); setLoading(false); setMessage(""); return; }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = async () => {
      setLoading(true);
      try {
        let result: { rows: BoardWatchQuote[]; weekend: boolean } | null = null;
        try {
          const request = getBoardWatchQuotes({ data: { codes: codeList } });
          const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 8_000); });
          result = await Promise.race([request, timeout]);
        } catch { result = null; }
        if (!alive) return;
        if (result?.rows?.length) {
          setQuotes(result.rows);
          setMessage(result.weekend ? "休市 · 沿用最近交易日板块数据" : "实时板块行情已更新");
        } else {
          try {
            const direct = await fetchBoardQuotesJsonp(codeList);
            if (!alive) return;
            setQuotes(direct);
            setMessage(direct.length ? "已切换东方财富浏览器直连" : "板块暂无可靠数据");
          } catch {
            if (alive) setMessage("板块数据源暂时不可用，不伪造涨跌数据");
          }
        }
      } finally {
        if (!alive) return;
        if (timer) clearTimeout(timer);
        setLoading(false);
      }
    };
    void run();
    const refresh = window.setInterval(run, 30_000);
    return () => { alive = false; window.clearInterval(refresh); if (timer) clearTimeout(timer); };
  }, [codeList.join(",")]);

  const add = (item: BoardCandidate) => {
    setState((prev) => ({ items: [...prev.items, { code: item.code, name: item.name, icon: item.icon }] }));
    setSearchOpen(false); setQuery(""); setSuggestions([]); setOpenCode(item.code); setMessage("");
  };
  const remove = (code: string) => { setState((prev) => ({ items: prev.items.filter((x) => x.code !== code) })); if (openCode === code) setOpenCode(null); };

  return (
    <section className="mb-3 overflow-hidden rounded-[24px] border border-white/70 bg-white/42 p-3 shadow-[0_18px_50px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.94)] backdrop-blur-[24px] saturate-150">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><h2 className="text-[16px] font-semibold tracking-tight text-fg">自选板块</h2>{items.length ? <span className="rounded-full bg-blue/10 px-2 py-0.5 text-[9px] font-medium text-blue">已选{items.length}</span> : null}</div>
          <p className="mt-1 text-[10px] text-subtle">自己搜索并添加想看的板块；默认不预置，添加后每30秒刷新。</p>
        </div>
        <button type="button" onClick={() => setSearchOpen((v) => !v)} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_6px_18px_rgba(15,23,42,.18)] active:scale-95" aria-label="添加板块">{searchOpen ? <X size={17} /> : <Plus size={17} />}</button>
      </div>
      {searchOpen ? <div className="mt-3 rounded-[18px] border border-white/80 bg-white/75 p-2.5 shadow-[0_8px_24px_rgba(38,78,112,.05)]"><div className="flex items-center gap-2 rounded-[14px] border border-slate-200/75 bg-white px-3 py-2.5"><Search size={15} className="shrink-0 text-slate-400" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入：半导体、机器人、银行、光伏……" className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400" />{searching ? <span className="text-[9px] text-slate-400">搜索中</span> : null}</div><div className="mt-2 max-h-52 space-y-1 overflow-y-auto">{suggestions.map((item) => <button key={item.code} type="button" onClick={() => add(item)} className="flex w-full items-center gap-2 rounded-[12px] bg-white px-3 py-2.5 text-left shadow-sm active:bg-blue-50"><span className="flex size-7 items-center justify-center rounded-xl bg-blue/10 text-sm">{item.icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-slate-800">{item.name}</span><span className="block text-[9px] text-slate-400">{item.code} · {item.type === "industry" ? "行业" : "概念"}</span></span><Plus size={14} className="text-blue" /></button>)}{query.trim() && !searching && !suggestions.length ? <div className="px-2 py-4 text-center text-[10px] text-slate-400">没有匹配到东方财富板块</div> : null}</div></div> : null}
      {items.length ? <div className="mt-3 grid grid-cols-2 gap-2">{items.map((item) => { const q = quoteMap.get(item.code); const open = openCode === item.code; return <article key={item.code} className="overflow-hidden rounded-[18px] border border-white/80 bg-white/58 shadow-[0_8px_24px_rgba(38,78,112,.045)]"><button type="button" onClick={() => setOpenCode(open ? null : item.code)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left active:bg-white/55"><span className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-white/78 text-base shadow-sm">{item.icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold text-slate-900">{item.name}</span><span className="mt-0.5 block text-[8px] text-slate-400">{item.code} · {q?.marketDate || "等待行情"}</span></span><span className={`shrink-0 text-[18px] font-bold tabular-nums ${tone(q?.pct ?? null)}`}>{q?.pct == null ? "—" : fmtPctShort(q.pct)}</span><ChevronRight size={13} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} /></button>{open ? <div className="border-t border-white/75 px-3 pb-3 pt-2.5"><div className="grid grid-cols-2 gap-2"><div className="rounded-[14px] bg-white/66 px-3 py-2"><div className="text-[9px] text-slate-400">板块涨跌</div><div className={`mt-1 text-[15px] font-bold ${tone(q?.pct ?? null)}`}>{q?.pct == null ? "暂无可靠数据" : fmtPctShort(q.pct)}</div></div><div className="rounded-[14px] bg-white/66 px-3 py-2"><div className="text-[9px] text-slate-400">主力净流向</div><div className={`mt-1 text-[15px] font-bold ${tone(q?.mainFlow ?? null)}`}>{formatFlow(q?.mainFlow ?? null)}</div><div className={`mt-0.5 text-[9px] ${tone(q?.mainFlow ?? null)}`}>{flowLabel(q?.mainFlow ?? null)}</div></div></div><div className="mt-2 rounded-[14px] bg-slate-50/75 px-3 py-2.5 ring-1 ring-white/70"><div className="flex items-center justify-between"><span className="text-[9px] font-medium text-slate-400">资金分档</span><span className="text-[9px] text-slate-400">东财板块资金口径</span></div><div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]"><FlowRow label="超大单" value={q?.superFlow ?? null} /><FlowRow label="大单" value={q?.largeFlow ?? null} /><FlowRow label="中单" value={q?.midFlow ?? null} /><FlowRow label="小单" value={q?.smallFlow ?? null} /></div></div><div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-slate-400"><span className="truncate">{q?.source || (loading ? "正在更新行情…" : "当前暂无可靠行情")}</span><button type="button" onClick={() => remove(item.code)} className="rounded-full bg-white/75 px-2.5 py-1 text-slate-500"><X size={10} className="mr-1 inline"/>移除</button></div></div> : null}</article>; })}</div> : <div className="mt-3 rounded-[18px] border border-dashed border-slate-300/70 bg-white/35 px-3 py-4 text-center text-[10px] text-slate-400">还没有自选板块，点右上角 + 搜索并添加。</div>}
      {message ? <div className="mt-2 px-1 text-[9px] text-slate-400">{message}</div> : null}
      {items.length ? <div className="mt-2 flex items-center justify-between px-1 text-[9px] text-slate-400"><span>已选 {items.length} 个板块</span><span className="inline-flex items-center gap-1"><Check size={10}/> 自动保存 · 30秒刷新</span></div> : null}
    </section>
  );
}

function FlowRow({ label, value }: { label: string; value: number | null }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-slate-500">{label}</span><span className={`font-medium tabular-nums ${tone(value)}`}>{formatFlow(value)}</span></div>;
}
