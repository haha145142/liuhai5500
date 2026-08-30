import { useEffect, useMemo, useState } from "react";
import { ChevronDown, GripVertical, Pin, Plus, Search, X } from "lucide-react";
import { getFundSectorQuotes, type FundSectorQuote } from "@/lib/data/server";
import { FUND_SECTORS, DEFAULT_FUND_SECTOR_IDS } from "@/lib/data/fund-sectors";
import { fmtPctShort } from "@/lib/format";
import type { FundQuote, Holding } from "@/lib/types";

const KEY = "fund_ai_pro_fund_sector_watch_v2";

type StoredPrefs = { ids: string[]; pinned: string[] };

function readPrefs(): StoredPrefs {
  if (typeof window === "undefined") return { ids: DEFAULT_FUND_SECTOR_IDS, pinned: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<StoredPrefs> | null;
    const ids = Array.isArray(raw?.ids) && raw.ids.every((x) => typeof x === "string") ? raw!.ids! : DEFAULT_FUND_SECTOR_IDS;
    const pinned = Array.isArray(raw?.pinned) && raw.pinned.every((x) => typeof x === "string") ? raw!.pinned! : [];
    return { ids, pinned: pinned.filter((id) => ids.includes(id)) };
  } catch {
    return { ids: DEFAULT_FUND_SECTOR_IDS, pinned: [] };
  }
}

function toneClass(pct: number | null) {
  if (pct == null) return "text-subtle";
  return pct > 0 ? "text-up" : pct < 0 ? "text-down" : "text-muted";
}

export function FundSectorWatch({ portfolio = [], funds = {} }: { portfolio?: Holding[]; funds?: Record<string, FundQuote> }) {
  const [{ ids, pinned }, setPrefs] = useState<StoredPrefs>(readPrefs);
  const [rows, setRows] = useState<FundSectorQuote[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FUND_SECTORS.filter((s) => !ids.includes(s.id) && (!q || `${s.name} ${s.id}`.toLowerCase().includes(q)));
  }, [ids, query]);

  const heldCodes = useMemo(() => new Set(portfolio.map((h) => h.code)), [portfolio]);

  const orderedRows = useMemo(() => {
    const rank = new Map(pinned.map((id, i) => [id, i]));
    return rows.slice().sort((a, b) => {
      const ap = rank.get(a.id);
      const bp = rank.get(b.id);
      if (ap != null || bp != null) return (ap ?? Number.MAX_SAFE_INTEGER) - (bp ?? Number.MAX_SAFE_INTEGER);
      return ids.indexOf(a.id) - ids.indexOf(b.id);
    });
  }, [ids, pinned, rows]);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ ids, pinned } satisfies StoredPrefs)); } catch { /* local only */ }
  }, [ids, pinned]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void getFundSectorQuotes({ data: { ids } })
      .then((res) => {
        if (!alive) return;
        setRows(res.rows);
        setMessage(res.weekend ? "周末休市 · 沿用最近交易日数据" : "");
      })
      .catch(() => { if (alive) setMessage("板块数据暂不可用 · 已保留上一轮结果"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [ids.join(",")]);

  const addSector = (id: string) => {
    setPrefs((cur) => ({ ...cur, ids: cur.ids.includes(id) ? cur.ids : [...cur.ids, id] }));
    setAdding(false);
    setQuery("");
  };

  const removeSector = (id: string) => {
    setPrefs((cur) => ({ ids: cur.ids.filter((x) => x !== id), pinned: cur.pinned.filter((x) => x !== id) }));
    setOpenId((cur) => cur === id ? null : cur);
  };

  const togglePin = (id: string) => {
    setPrefs((cur) => cur.pinned.includes(id)
      ? { ...cur, pinned: cur.pinned.filter((x) => x !== id) }
      : { ...cur, pinned: [id, ...cur.pinned.filter((x) => x !== id)] });
  };

  const moveSector = (id: string, direction: -1 | 1) => {
    setPrefs((cur) => {
      const next = cur.ids.slice();
      const idx = next.indexOf(id);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= next.length) return cur;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...cur, ids: next };
    });
  };

  return (
    <section className="mb-3 rounded-[26px] border border-white/70 bg-white/50 p-3 shadow-[0_14px_40px_rgba(30,76,125,.08)] backdrop-blur-[14px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold tracking-tight text-fg">我的基金板块</div>
          <div className="text-[10px] text-subtle">只显示你关注的基金主题 · 点开看包含基金</div>
        </div>
        <button type="button" onClick={() => setAdding((v) => !v)} className="flex size-9 items-center justify-center rounded-full bg-fg text-bg" aria-label="管理基金板块">
          <Plus size={17} />
        </button>
      </div>

      {adding ? (
        <div className="mt-2 rounded-2xl bg-bg-elevated p-2">
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/70 px-2.5 py-2 ring-1 ring-border">
            <Search size={14} className="text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索基金板块" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
          </div>
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
            {available.slice(0, 40).map((sector) => (
              <button key={sector.id} type="button" onClick={() => addSector(sector.id)} className="rounded-full bg-white/70 px-2.5 py-1.5 text-[10px] font-medium ring-1 ring-border hover:bg-white">
                {sector.icon} {sector.name}
              </button>
            ))}
          </div>
          {!available.length ? <div className="text-[10px] text-subtle">没有匹配的板块</div> : null}
        </div>
      ) : null}

      <div className="mt-2.5 space-y-2">
        {loading && !rows.length ? <div className="rounded-2xl bg-bg-elevated px-3 py-4 text-center text-[10px] text-subtle">正在读取基金板块…</div> : null}
        {orderedRows.map((row) => {
          const open = openId === row.id;
          const heldFunds = row.funds.filter((fund) => heldCodes.has(fund.code));
          const otherFunds = row.funds.filter((fund) => !heldCodes.has(fund.code));
          const orderedFunds = [...heldFunds, ...otherFunds];
          const isPinned = pinned.includes(row.id);
          return (
            <div key={row.id} className="overflow-hidden rounded-2xl bg-bg-elevated/75 ring-1 ring-white/70">
              <button type="button" onClick={() => setOpenId((cur) => cur === row.id ? null : row.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                <GripVertical size={14} className="shrink-0 text-subtle/70" aria-hidden />
                <span className="text-base">{row.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-fg">{row.name}</span>
                    {isPinned ? <Pin size={11} className="shrink-0 text-accent" fill="currentColor" /> : null}
                  </span>
                  <span className="mt-0.5 block text-[9px] text-subtle">{row.validCount}/{row.totalCount} 只基金有可靠行情 · {row.up} 涨 {row.down} 跌{heldFunds.length ? ` · 你持有 ${heldFunds.length} 只` : ""}</span>
                </span>
                <span className={`text-sm font-bold tabular-nums ${toneClass(row.pct)}`}>{row.pct == null ? "—" : fmtPctShort(row.pct)}</span>
                <ChevronDown size={15} className={`text-subtle transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {open ? (
                <div className="border-t border-white/60 px-3 pb-3 pt-2">
                  <div className="mb-2 flex items-center justify-between text-[9px] text-subtle">
                    <span>板块内基金 · 持仓优先</span>
                    <span>{row.validation === "cross_checked" ? "双源核验" : row.validation === "single_source" ? "部分可用" : "暂无可靠数据"}</span>
                  </div>
                  <div className="space-y-1">
                    {orderedFunds.map((fund) => {
                      const held = heldCodes.has(fund.code);
                      const appFund = funds[fund.code];
                      return (
                        <div key={fund.code} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${held ? "bg-accent/10 ring-1 ring-accent/15" : "bg-white/45"}`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <div className="truncate text-[10px] font-medium text-fg">{fund.name}</div>
                              {held ? <span className="shrink-0 rounded-full bg-accent/12 px-1.5 py-0.5 text-[8px] font-semibold text-accent">持仓</span> : null}
                            </div>
                            <div className="text-[9px] text-subtle">{fund.code}{appFund?.nav != null ? ` · 净值 ${appFund.nav.toFixed(4)}` : ""}</div>
                          </div>
                          <div className="text-right">
                            <div className={`text-[11px] font-semibold tabular-nums ${toneClass(fund.pct)}`}>{fund.pct == null ? "—" : fmtPctShort(fund.pct)}</div>
                            {held ? <div className="text-[8px] text-accent">重点关注</div> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[9px] text-subtle">数据日 {row.marketDate || "暂无"}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={(e) => { e.stopPropagation(); togglePin(row.id); }} className="rounded-full px-2 py-1 text-[9px] text-subtle hover:bg-white/60">{isPinned ? "取消置顶" : "置顶"}</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); moveSector(row.id, -1); }} className="rounded-full px-2 py-1 text-[9px] text-subtle hover:bg-white/60">上移</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); moveSector(row.id, 1); }} className="rounded-full px-2 py-1 text-[9px] text-subtle hover:bg-white/60">下移</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeSector(row.id); }} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] text-subtle hover:bg-white/60"><X size={11} /> 移除</button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {message ? <div className="mt-2 text-[9px] text-subtle">{message}</div> : null}
    </section>
  );
}
