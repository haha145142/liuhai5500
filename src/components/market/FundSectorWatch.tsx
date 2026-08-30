import { useEffect, useMemo, useState } from "react";
import { getFundSectorQuotes, type FundSectorQuote } from "@/lib/data/fund-sector";
import { FUND_SECTORS } from "@/lib/data/fund-sectors";
import { isWeekend, sessionLabel } from "@/lib/market-hours";
import { tradingDateLabel } from "@/lib/data/trading-day";
import { useApp } from "@/lib/store";
import "./FundSectorWatch.css";

const CACHE_KEY = "fund_ai_pro_fund_sector_watch_v2";
type Cache = { savedAt: number; marketDate: string; rows: FundSectorQuote[] };

function readCache(): Cache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Cache;
    return v?.rows?.length ? v : null;
  } catch { return null; }
}

function saveCache(rows: FundSectorQuote[], marketDate: string) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), marketDate, rows } satisfies Cache)); } catch {}
}

function pctText(v: number | null) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function tone(v: number | null) { return v == null ? "flat" : v > 0 ? "up" : v < 0 ? "down" : "flat"; }

export function FundSectorWatch() {
  const selected = useApp((s) => s.selectedSectors);
  const setSectors = useApp((s) => s.setSectors);
  const portfolio = useApp((s) => s.portfolio);
  const [rows, setRows] = useState<FundSectorQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const validSelected = useMemo(() => {
    const known = new Set(FUND_SECTORS.map((s) => s.id));
    const clean = selected.filter((id) => known.has(id));
    return clean.length ? clean : FUND_SECTORS.slice(0, 8).map((s) => s.id);
  }, [selected]);

  const refresh = async (force = false) => {
    if (loading) return;
    const weekend = isWeekend();
    const cached = readCache();
    if (!force && cached?.rows?.length && weekend) {
      setRows(cached.rows.filter((r) => validSelected.includes(r.id)));
      setStale(true);
      return;
    }
    setLoading(true);
    try {
      const result = await getFundSectorQuotes({ data: { ids: validSelected } });
      if (result.rows.some((r) => r.validCount > 0)) {
        setRows(result.rows);
        const date = result.rows.find((r) => r.marketDate)?.marketDate || tradingDateLabel();
        saveCache(result.rows, date);
        setStale(result.weekend);
      } else if (cached?.rows?.length) {
        setRows(cached.rows.filter((r) => validSelected.includes(r.id)));
        setStale(true);
      } else {
        setRows(result.rows);
        setStale(false);
      }
    } catch {
      if (cached?.rows?.length) {
        setRows(cached.rows.filter((r) => validSelected.includes(r.id)));
        setStale(true);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const cached = readCache();
    if (cached?.rows?.length) {
      setRows(cached.rows.filter((r) => validSelected.includes(r.id)));
      setStale(isWeekend());
    }
    void refresh();
    // The selection itself determines the server request key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validSelected.join(",")]);

  useEffect(() => {
    if (isWeekend()) return;
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [validSelected.join(",")]);

  const selectedSet = new Set(validSelected);
  const manager = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? FUND_SECTORS.filter((s) => `${s.name} ${s.id}`.toLowerCase().includes(q)) : FUND_SECTORS;
    return [...list].sort((a, b) => Number(selectedSet.has(b.id)) - Number(selectedSet.has(a.id)));
  }, [query, validSelected.join(",")]);

  const toggleSector = (id: string) => {
    const next = selectedSet.has(id) ? validSelected.filter((x) => x !== id) : [...validSelected, id];
    setSectors(next);
  };

  const marketDate = rows.find((r) => r.marketDate)?.marketDate || (stale ? tradingDateLabel() : null);
  const statusText = stale ? `周末休市 · 数据日 ${marketDate || tradingDateLabel()}` : `${sessionLabel()} · 基金估值`;

  return (
    <section className="fsw-wrap">
      <div className="fsw-header">
        <div>
          <div className="fsw-title-row"><span className="fsw-title-icon">📈</span><h2>自选板块行情</h2><span className="fsw-count">· {validSelected.length} 个板块</span></div>
          <div className="fsw-subtitle">只显示你关注的基金主题 · 板块涨跌按成分基金估值等权聚合</div>
        </div>
        <button type="button" className="fsw-manage" onClick={() => setManagerOpen(true)}>＋ 管理板块</button>
      </div>

      <div className="fsw-status">
        <span className={loading ? "dot pulse" : "dot"} />
        <span>{statusText}</span>
        <span className="fsw-status-right">{loading ? "更新中" : stale ? "最近交易日" : "实时更新"}</span>
      </div>

      <div className="fsw-list">
        {rows.length ? rows.map((row) => {
          const open = expanded === row.id;
          const heldCodes = new Set(portfolio.map((h) => h.code));
          return (
            <article key={row.id} className={`fsw-card ${open ? "open" : ""}`}>
              <button type="button" className="fsw-main" onClick={() => setExpanded(open ? null : row.id)} aria-expanded={open}>
                <div className="fsw-main-head">
                  <div className="fsw-name-block"><span className="fsw-icon">{row.icon}</span><div><div className="fsw-name">{row.name}<span className="fsw-fund-count">{row.validCount}/{row.totalCount} 只基金</span></div><div className="fsw-mini-source">{row.validation === "cross_checked" ? "双源核验" : row.validation === "single_source" ? "单源可用" : "暂无可靠数据"} · {row.marketDate || "日期未知"}</div></div></div>
                  <div className={`fsw-pct ${tone(row.pct)}`}>{pctText(row.pct)}</div>
                </div>
                <div className="fsw-counts"><span>上涨 <b>{row.up}</b></span><span>/</span><span>下跌 <b>{row.down}</b></span>{row.flat ? <><span>/</span><span>平 <b>{row.flat}</b></span></> : null}</div>
                <div className="fsw-bar"><i style={{ width: `${row.validCount ? (row.up / row.validCount) * 100 : 0}%` }} /></div>
                <div className="fsw-foot"><span>{row.leader ? `领涨 ${row.leader.name} ${pctText(row.leader.pct)}` : "暂无领涨数据"}</span><span>{open ? "收起 ↑" : "展开查看基金 ↓"}</span></div>
              </button>
              {open ? (
                <div className="fsw-funds">
                  {row.funds.map((fund) => {
                    const value = fund.estimate ?? fund.nav;
                    return <div className="fsw-fund-row" key={fund.code}>
                      <div className="fsw-fund-info"><div className="fsw-fund-name">{fund.name}{heldCodes.has(fund.code) ? <span className="held">持有</span> : null}</div><div className="fsw-fund-meta">{fund.code} · {fund.validation === "cross_checked" ? "双源" : fund.validation === "single_source" ? "单源" : "暂无"}{fund.time ? ` · ${fund.time}` : ""}</div></div>
                      <div className="fsw-fund-value">{value == null ? "—" : value.toFixed(4)}</div>
                      <div className={`fsw-fund-pct ${tone(fund.pct)}`}>{pctText(fund.pct)}</div>
                    </div>;
                  })}
                  <div className="fsw-expanded-note">板块涨跌 = 有效成分基金估值涨跌幅等权平均；无可靠数据的基金不参与计算，也不会被当作 0。</div>
                </div>
              ) : null}
            </article>
          );
        }) : <div className="fsw-empty"><div>📊</div><b>还没有可靠的基金板块数据</b><span>点击“管理板块”选择你真正关注的基金主题。</span></div>}
      </div>

      {managerOpen ? <div className="fsw-mask" onMouseDown={(e) => { if (e.target === e.currentTarget) setManagerOpen(false); }}>
        <div className="fsw-sheet">
          <div className="fsw-sheet-handle" />
          <div className="fsw-sheet-title"><div><h3>管理基金板块</h3><p>你选择什么，这里就显示什么</p></div><button type="button" onClick={() => setManagerOpen(false)}>完成</button></div>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} className="fsw-search" placeholder="搜索：半导体 / AI / 医药 / 黄金 / 白酒…" />
          <div className="fsw-sheet-count">已关注 {validSelected.length} 个 · 共 {FUND_SECTORS.length} 个基金主题</div>
          <div className="fsw-manager-list">
            {manager.map((s) => <button key={s.id} type="button" className={`fsw-manager-row ${selectedSet.has(s.id) ? "selected" : ""}`} onClick={() => toggleSector(s.id)}><span className="mi">{s.icon}</span><span className="mn"><b>{s.name}</b><small>{s.funds.length} 只基金</small></span><span className="check">{selectedSet.has(s.id) ? "✓" : "+"}</span></button>)}
          </div>
        </div>
      </div> : null}
    </section>
  );
}
