import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { getFundSectorQuotes, type FundSectorQuote } from "@/lib/data/server";
import { FUND_SECTORS, DEFAULT_FUND_SECTOR_IDS } from "@/lib/data/fund-sectors";
import { fmtPctShort } from "@/lib/format";

const KEY = "fund_ai_pro_fund_sector_watch_v1";

function readIds() {
  if (typeof window === "undefined") return DEFAULT_FUND_SECTOR_IDS;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    return Array.isArray(raw) && raw.every((x) => typeof x === "string") ? raw : DEFAULT_FUND_SECTOR_IDS;
  } catch {
    return DEFAULT_FUND_SECTOR_IDS;
  }
}

function toneClass(pct: number | null) {
  if (pct == null) return "text-subtle";
  return pct > 0 ? "text-up" : pct < 0 ? "text-down" : "text-muted";
}

export function FundSectorWatch() {
  const [ids, setIds] = useState<string[]>(readIds);
  const [rows, setRows] = useState<FundSectorQuote[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const available = useMemo(() => FUND_SECTORS.filter((s) => !ids.includes(s.id)), [ids]);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* local only */ }
  }, [ids]);

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
    if (!ids.includes(id)) setIds((cur) => [...cur, id]);
    setAdding(false);
  };

  const removeSector = (id: string) => {
    setIds((cur) => cur.filter((x) => x !== id));
    setOpenId((cur) => cur === id ? null : cur);
  };

  return (
    <section className="mb-3 rounded-[26px] border border-white/70 bg-white/50 p-3 shadow-[0_14px_40px_rgba(30,76,125,.08)] backdrop-blur-[14px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold tracking-tight text-fg">我的基金板块</div>
          <div className="text-[10px] text-subtle">只显示你关注的基金主题 · 点开看包含基金</div>
        </div>
        <button type="button" onClick={() => setAdding((v) => !v)} className="flex size-9 items-center justify-center rounded-full bg-fg text-bg" aria-label="添加基金板块">
          <Plus size={17} />
        </button>
      </div>

      {adding ? (
        <div className="mt-2 rounded-2xl bg-bg-elevated p-2">
          <div className="mb-2 text-[10px] font-semibold text-muted">添加关注板块</div>
          <div className="flex flex-wrap gap-1.5">
            {available.slice(0, 24).map((sector) => (
              <button key={sector.id} type="button" onClick={() => addSector(sector.id)} className="rounded-full bg-white/70 px-2.5 py-1.5 text-[10px] font-medium ring-1 ring-border hover:bg-white">
                {sector.icon} {sector.name}
              </button>
            ))}
          </div>
          {!available.length ? <div className="text-[10px] text-subtle">已经全部添加</div> : null}
        </div>
      ) : null}

      <div className="mt-2.5 space-y-2">
        {loading && !rows.length ? <div className="rounded-2xl bg-bg-elevated px-3 py-4 text-center text-[10px] text-subtle">正在读取基金板块…</div> : null}
        {rows.map((row) => {
          const open = openId === row.id;
          return (
            <div key={row.id} className="overflow-hidden rounded-2xl bg-bg-elevated/75 ring-1 ring-white/70">
              <button type="button" onClick={() => setOpenId((cur) => cur === row.id ? null : row.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                <span className="text-base">{row.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-fg">{row.name}</span>
                  <span className="mt-0.5 block text-[9px] text-subtle">{row.validCount}/{row.totalCount} 只基金有可靠行情 · {row.up} 涨 {row.down} 跌</span>
                </span>
                <span className={`text-sm font-bold tabular-nums ${toneClass(row.pct)}`}>{row.pct == null ? "—" : fmtPctShort(row.pct)}</span>
                <ChevronDown size={15} className={`text-subtle transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {open ? (
                <div className="border-t border-white/60 px-3 pb-3 pt-2">
                  <div className="mb-2 flex items-center justify-between text-[9px] text-subtle">
                    <span>板块内基金</span>
                    <span>{row.validation === "cross_checked" ? "双源核验" : row.validation === "single_source" ? "部分可用" : "暂无可靠数据"}</span>
                  </div>
                  <div className="space-y-1">
                    {row.funds.map((fund) => (
                      <div key={fund.code} className="flex items-center gap-2 rounded-xl bg-white/45 px-2.5 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[10px] font-medium text-fg">{fund.name}</div>
                          <div className="text-[9px] text-subtle">{fund.code}</div>
                        </div>
                        <div className={`text-[11px] font-semibold tabular-nums ${toneClass(fund.pct)}`}>{fund.pct == null ? "—" : fmtPctShort(fund.pct)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[9px] text-subtle">数据日 {row.marketDate || "暂无"}</span>
                    <button type="button" onClick={() => removeSector(row.id)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] text-subtle hover:bg-white/60"><X size={11} /> 移除关注</button>
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
