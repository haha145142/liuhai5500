import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Loader2, Plus, Search, X } from "lucide-react";
import { getBoardWatchQuotes, searchFundBoards, type BoardCandidate, type BoardWatchQuote } from "@/lib/data/board-watch";
import { getSectorFunds, type SectorFundRow } from "@/lib/data/sector-funds";
import { SECTOR_RULES } from "@/lib/data/sectors";
import { fmtPctShort, fmtPrice } from "@/lib/format";

type Selection = { code: string; name: string; icon: string };
type State = { items: Selection[] };

const KEY = "fund_ai_pro_board_watch_v8";
const PREVIOUS_KEY = "fund_ai_pro_board_watch_v7";
const LEGACY_KEY = "fund_ai_pro_board_watch_v6";
const LEGACY_DEFAULT_CODES = new Set(["BK0917", "BK1134", "BK1128", "BK1137", "BK1059", "BK1650", "BK1129", "BK0890"]);

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
  if (typeof window === "undefined") return { items: [] };
  try {
    for (const key of [KEY, PREVIOUS_KEY, LEGACY_KEY]) {
      const raw = JSON.parse(localStorage.getItem(key) || "null") as Partial<State> | null;
      const found = normalizeItems(raw?.items);
      if (!found.length) continue;
      const legacyDefault = key === LEGACY_KEY && found.length === LEGACY_DEFAULT_CODES.size && found.every((x) => LEGACY_DEFAULT_CODES.has(x.code));
      const items = legacyDefault ? [] : found;
      if (key !== KEY) {
        try { localStorage.setItem(KEY, JSON.stringify({ items })); } catch {}
      }
      return { items };
    }
  } catch {}
  return { items: [] };
}

function tone(v: number | null) {
  return v == null ? "text-muted" : v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted";
}
function formatFlow(v: number | null) {
  if (v == null || !Number.isFinite(v)) return "—";
  const yi = v / 1e8;
  return `${yi >= 0 ? "+" : ""}${yi.toFixed(2)}亿`;
}

function iconForRule(id: string) {
  return id === "semi" ? "🔬" : id === "ai" ? "🤖" : id === "gold" ? "🥇" : id === "robot" ? "🦾" : "📈";
}

function localCandidates(query: string): BoardCandidate[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SECTOR_RULES.map((rule) => {
    const hay = [rule.name, ...rule.searchKeys].map((x) => x.toLowerCase());
    const score = hay.some((x) => x === q) ? 100 : hay.some((x) => x.startsWith(q)) ? 90 : hay.some((x) => x.includes(q)) ? 70 : 0;
    if (!score) return null;
    return { code: rule.bkCode, name: rule.name, icon: iconForRule(rule.id), type: rule.prefer, _score: score } as BoardCandidate & { _score: number };
  }).filter((x): x is BoardCandidate & { _score: number } => !!x).sort((a, b) => b._score - a._score).map(({ _score: _ignore, ...item }) => item);
}

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
        marketDate, source: "东方财富浏览器 JSONP 直连", validation: Number.isFinite(Number(r.f3)) ? "live" as const : "unavailable" as const,
      }));
      finish(true, out);
    };
    script.async = true;
    script.onerror = () => finish(false, new Error("board-jsonp-error"));
    script.src = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=1200&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2,m:90+t:3&fields=${encodeURIComponent("f12,f14,f3,f62,f66,f72,f78,f84,f6")}&ut=fa5fd1943c7b386f172d6893dbfba10b&cb=${encodeURIComponent(cb)}&_=${Date.now()}`;
    document.head.appendChild(script);
  });
}

function FundRow({ row, index }: { row: SectorFundRow; index: number }) {
  return <div className="rounded-[15px] bg-white/72 px-3 py-2.5 ring-1 ring-white/70">
    <div className="flex items-center gap-2.5">
      <div className="w-5 shrink-0 text-center text-[10px] font-semibold text-slate-400">{index + 1}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-semibold text-slate-800">{row.name}</div>
        <div className="mt-0.5 truncate text-[8px] text-slate-400">{row.code} · {row.type || "基金"} · {row.matchReason}</div>
      </div>
      <div className="shrink-0 text-right"><div className={`text-[14px] font-bold tabular-nums ${tone(row.day)}`}>{fmtPctShort(row.day)}</div><div className="mt-0.5 text-[8px] text-slate-400">净值 {fmtPrice(row.nav, 4)}</div></div>
    </div>
    <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[8px]">
      <Period label="周" value={row.week} />
      <Period label="月" value={row.month} />
      <Period label="3月" value={row.threeMonth} />
      <Period label="6月" value={row.sixMonth} />
      <Period label="1年" value={row.oneYear} />
    </div>
  </div>;
}

function Period({ label, value }: { label: string; value: number | null }) {
  return <div className="rounded-lg bg-white/58 px-1 py-1"><div className="text-slate-400">{label}</div><div className={`mt-0.5 font-medium tabular-nums ${tone(value)}`}>{fmtPctShort(value)}</div></div>;
}

export function FundSectorWatchV2() {
  const [{ items }, setState] = useState<State>(readState);
  const [quotes, setQuotes] = useState<BoardWatchQuote[]>([]);
  const [sectorFunds, setSectorFunds] = useState<Record<string, SectorFundRow[]>>({});
  const [sectorLoading, setSectorLoading] = useState<Record<string, boolean>>({});
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
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const local = localCandidates(q);
        let remote: BoardCandidate[] = [];
        try { remote = (await searchFundBoards({ data: { query: q } })).items || []; } catch {}
        const merged = [...local, ...remote].filter((item, index, list) => list.findIndex((x) => x.code === item.code) === index && !items.some((x) => x.code === item.code));
        if (alive) setSuggestions(merged.slice(0, 20));
      } finally { if (alive) setSearching(false); }
    }, 180);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [query, searchOpen, items]);

  useEffect(() => {
    if (!codeList.length) { setQuotes([]); setLoading(false); setMessage(""); return; }
    let alive = true;
    const run = async () => {
      setLoading(true);
      try {
        let result: { rows: BoardWatchQuote[]; weekend: boolean } | null = null;
        try {
          const request = getBoardWatchQuotes({ data: { codes: codeList } });
          const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000));
          result = await Promise.race([request, timeout]);
        } catch { result = null; }
        if (!alive) return;
        if (result?.rows?.length) { setQuotes(result.rows); setMessage(result.weekend ? "休市 · 沿用最近交易日板块数据" : "实时板块行情已更新"); }
        else {
          try { const direct = await fetchBoardQuotesJsonp(codeList); if (alive) { setQuotes(direct); setMessage(direct.length ? "已切换东方财富浏览器直连" : "板块暂无可靠数据"); } }
          catch { if (alive) setMessage("板块数据源暂时不可用，不伪造涨跌数据"); }
        }
      } finally { if (alive) setLoading(false); }
    };
    void run();
    const refresh = window.setInterval(run, 30_000);
    return () => { alive = false; window.clearInterval(refresh); };
  }, [codeList.join(",")]);

  const loadSectorFunds = async (code: string) => {
    if (sectorLoading[code] || sectorFunds[code]) return;
    setSectorLoading((prev) => ({ ...prev, [code]: true }));
    try {
      const rows = await getSectorFunds(code);
      setSectorFunds((prev) => ({ ...prev, [code]: rows }));
    } finally {
      setSectorLoading((prev) => ({ ...prev, [code]: false }));
    }
  };

  const add = (item: BoardCandidate) => {
    setState((prev) => ({ items: [...prev.items, { code: item.code, name: item.name, icon: item.icon }] }));
    setSearchOpen(false); setQuery(""); setSuggestions([]); setOpenCode(item.code); setMessage("");
    void loadSectorFunds(item.code);
  };
  const toggle = (code: string) => {
    const next = openCode === code ? null : code;
    setOpenCode(next);
    if (next) void loadSectorFunds(next);
  };
  const remove = (code: string) => { setState((prev) => ({ items: prev.items.filter((x) => x.code !== code) })); if (openCode === code) setOpenCode(null); };

  return <section className="mb-3 overflow-hidden rounded-[24px] border border-white/70 bg-white/42 p-3 shadow-[0_18px_50px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.94)] backdrop-blur-[24px] saturate-150">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="text-[16px] font-semibold tracking-tight text-fg">自选板块</h2>{items.length ? <span className="rounded-full bg-blue/10 px-2 py-0.5 text-[9px] font-medium text-blue">已选{items.length}</span> : null}</div><p className="mt-1 text-[10px] text-subtle">添加板块后，自动拉取该板块相关基金池；可直接比较日、周、月、3月、6月、1年表现。</p></div>
      <button type="button" onClick={() => setSearchOpen((v) => !v)} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_6px_18px_rgba(15,23,42,.18)] active:scale-95" aria-label="添加板块">{searchOpen ? <X size={17} /> : <Plus size={17} />}</button>
    </div>

    {searchOpen ? <div className="mt-3 rounded-[18px] border border-white/80 bg-white/75 p-2.5 shadow-[0_8px_24px_rgba(38,78,112,.05)]"><div className="flex items-center gap-2 rounded-[14px] border border-slate-200/75 bg-white px-3 py-2.5"><Search size={15} className="shrink-0 text-slate-400" /><input aria-label="板块搜索" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入：半导体、机器人、银行、光伏……" className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400" />{searching ? <span className="text-[9px] text-slate-400">搜索中</span> : null}</div><div className="mt-2 max-h-52 space-y-1 overflow-y-auto">{suggestions.map((item) => <button key={item.code} type="button" onClick={() => add(item)} className="flex w-full items-center gap-2 rounded-[12px] bg-white px-3 py-2.5 text-left shadow-sm active:bg-blue-50"><span className="flex size-7 items-center justify-center rounded-xl bg-blue/10 text-sm">{item.icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-slate-800">{item.name}</span><span className="block text-[9px] text-slate-400">{item.code} · {item.type === "industry" ? "行业" : "概念"}</span></span><Plus size={14} className="text-blue" /></button>)}{query.trim() && !searching && !suggestions.length ? <div className="px-2 py-4 text-center text-[10px] text-slate-400">没有匹配到板块</div> : null}</div></div> : null}

    {items.length ? <div className="mt-3 space-y-2.5">{items.map((item) => {
      const q = quoteMap.get(item.code);
      const open = openCode === item.code;
      const rows = sectorFunds[item.code] || [];
      const waiting = !!sectorLoading[item.code];
      return <article key={item.code} className="overflow-hidden rounded-[20px] border border-white/80 bg-white/60 shadow-[0_8px_24px_rgba(38,78,112,.045)]">
        <button type="button" onClick={() => toggle(item.code)} className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left active:bg-white/55">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-white/78 text-base shadow-sm">{item.icon}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-slate-900">{item.name}</span><span className="mt-0.5 block text-[8px] text-slate-400">{item.code} · {q?.marketDate || "等待行情"} · {rows.length ? `相关基金 ${rows.length} 只` : waiting ? "正在读取基金池" : "点击展开查看相关基金"}</span></span>
          <span className={`shrink-0 text-[19px] font-bold tabular-nums ${tone(q?.pct ?? null)}`}>{q?.pct == null ? "—" : fmtPctShort(q.pct)}</span>
          <ChevronRight size={13} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>

        {open ? <div className="border-t border-white/75 px-3.5 pb-3.5 pt-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[15px] bg-white/68 px-3 py-2.5"><div className="text-[9px] text-slate-400">整个板块今日</div><div className={`mt-1 text-[19px] font-bold tabular-nums ${tone(q?.pct ?? null)}`}>{q?.pct == null ? "暂无可靠数据" : fmtPctShort(q.pct)}</div><div className="mt-0.5 text-[8px] text-slate-400">东方财富板块实时口径</div></div>
            <div className="rounded-[15px] bg-white/68 px-3 py-2.5"><div className="text-[9px] text-slate-400">主力净流向</div><div className={`mt-1 text-[15px] font-bold tabular-nums ${tone(q?.mainFlow ?? null)}`}>{formatFlow(q?.mainFlow ?? null)}</div><div className="mt-0.5 text-[8px] text-slate-400">东方财富资金口径</div></div>
          </div>

          <div className="mt-2.5 rounded-[16px] bg-white/54 p-2.5 ring-1 ring-white/70">
            <div className="flex items-center justify-between"><div><span className="text-[10px] font-semibold text-slate-700">本板块相关基金</span><span className="ml-2 text-[8px] text-slate-400">全市场候选池</span></div><span className="text-[8px] text-slate-400">按相关度 + 近期表现排序</span></div>
            {waiting && !rows.length ? <div className="flex items-center justify-center gap-2 py-6 text-[9px] text-slate-400"><Loader2 className="size-3 animate-spin" />正在读取相关基金</div> : null}
            {!waiting && !rows.length ? <div className="rounded-[13px] bg-white/62 px-3 py-4 text-center text-[9px] text-slate-400">当前没有取到可靠的全市场基金候选数据。</div> : null}
            {rows.length ? <div className="mt-2 space-y-1.5">{rows.map((row, index) => <FundRow key={row.code} row={row} index={index} />)}</div> : null}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-slate-400"><span className="truncate">{q?.source || (loading ? "正在更新板块行情…" : "当前暂无可靠板块行情")}</span><button type="button" onClick={() => remove(item.code)} className="rounded-full bg-white/75 px-2.5 py-1 text-slate-500"><X size={10} className="mr-1 inline"/>移除板块</button></div>
        </div> : null}
      </article>;
    })}</div> : <div className="mt-3 rounded-[18px] border border-dashed border-slate-300/70 bg-white/35 px-3 py-4 text-center text-[10px] text-slate-400">还没有自选板块，点右上角 + 添加你要研究的板块。</div>}

    {message ? <div className="mt-2 px-1 text-[9px] text-slate-400">{message}</div> : null}
    {items.length ? <div className="mt-2 flex items-center justify-between px-1 text-[9px] text-slate-400"><span>已选 {items.length} 个板块</span><span className="inline-flex items-center gap-1"><Check size={10}/> 自动保存 · 板块行情30秒刷新</span></div> : null}
  </section>;
}
