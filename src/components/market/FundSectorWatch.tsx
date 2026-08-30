import { useEffect, useMemo, useState } from "react";
import { getFundSectorQuotes, type FundSectorQuote, type FundSectorFundQuote } from "@/lib/data/fund-sector";
import { FUND_SECTORS } from "@/lib/data/fund-sectors";
import { isWeekend, isTradeTime, sessionLabel } from "@/lib/market-hours";
import { tradingDateLabel } from "@/lib/data/trading-day";
import { useApp } from "@/lib/store";
import "./FundSectorWatch.css";

const CACHE_KEY = "fund_ai_pro_fund_sector_watch_v3";
type Cache = { savedAt: number; marketDate: string; rows: FundSectorQuote[] };

function readCache(): Cache | null {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(CACHE_KEY); if (!raw) return null; const v = JSON.parse(raw) as Cache; return v?.rows?.length ? v : null; } catch { return null; }
}
function saveCache(rows: FundSectorQuote[], marketDate: string) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), marketDate, rows } satisfies Cache)); } catch {} }
function pctText(v: number | null) { if (v == null || !Number.isFinite(v)) return "—"; return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`; }
function tone(v: number | null) { return v == null ? "flat" : v > 0 ? "up" : "down"; }
function validationText(row: FundSectorQuote) { return row.validation === "cross_checked" ? "双源核验" : row.validation === "single_source" ? "单源可用" : row.validation === "cached_latest_trading_day" ? "最近交易日" : "暂无可靠数据"; }
function isTodayChina(date: string | null) { if (!date) return false; const now = new Date(Date.now() + 8 * 60 * 60 * 1000); const [y,m,d] = date.split(/[-/]/).map(Number); return y === now.getUTCFullYear() && m === now.getUTCMonth()+1 && d === now.getUTCDate(); }
function displayQuote(fund: FundSectorFundQuote) { const officialToday = isTodayChina(fund.date); if (officialToday && fund.nav != null) return { value: fund.nav, label: "今日官方净值" }; if (isTradeTime() && fund.estimate != null) return { value: fund.estimate, label: "盘中估值" }; return { value: fund.nav ?? null, label: fund.date ? `最近官方净值 · ${fund.date}` : "暂无可靠价格" }; }

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
  const validSelected = useMemo(() => { const known = new Set(FUND_SECTORS.map((s) => s.id)); const clean = selected.filter((id) => known.has(id)); return clean.length ? clean : FUND_SECTORS.slice(0, 8).map((s) => s.id); }, [selected]);

  const refresh = async (force = false) => {
    if (loading) return;
    const weekend = isWeekend();
    const cached = readCache();
    if (!force && cached?.rows?.length && weekend) { setRows(cached.rows.filter((r) => validSelected.includes(r.id))); setStale(true); return; }
    setLoading(true);
    try {
      const result = await getFundSectorQuotes({ data: { ids: validSelected } });
      if (result.rows.some((r) => r.validCount > 0)) { setRows(result.rows); saveCache(result.rows, result.rows.find((r) => r.marketDate)?.marketDate || tradingDateLabel()); setStale(result.weekend); }
      else if (cached?.rows?.length) { setRows(cached.rows.filter((r) => validSelected.includes(r.id))); setStale(true); }
      else { setRows(result.rows); setStale(false); }
    } catch { if (cached?.rows?.length) { setRows(cached.rows.filter((r) => validSelected.includes(r.id))); setStale(true); } }
    finally { setLoading(false); }
  };
  useEffect(() => { const cached = readCache(); if (cached?.rows?.length) { setRows(cached.rows.filter((r) => validSelected.includes(r.id))); setStale(isWeekend()); } void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [validSelected.join(",")]);
  useEffect(() => { if (isWeekend()) return; const id = window.setInterval(() => void refresh(), 30_000); return () => window.clearInterval(id); }, [validSelected.join(",")]);

  const selectedSet = new Set(validSelected);
  const manager = useMemo(() => { const q = query.trim().toLowerCase(); const list = q ? FUND_SECTORS.filter((s) => `${s.name} ${s.id}`.toLowerCase().includes(q)) : FUND_SECTORS; return [...list].sort((a,b)=>Number(selectedSet.has(b.id))-Number(selectedSet.has(a.id))); }, [query, validSelected.join(",")]);
  const toggleSector = (id:string) => setSectors(selectedSet.has(id) ? validSelected.filter((x)=>x!==id) : [...validSelected,id]);
  const marketDate = rows.find((r)=>r.marketDate)?.marketDate || (stale ? tradingDateLabel() : null);
  const statusText = stale ? `周末休市 · 数据日 ${marketDate || tradingDateLabel()}` : `${sessionLabel()} · 基金主题估值`;
  const totalFunds = rows.reduce((sum,row)=>sum+row.validCount,0);
  const crossFunds = rows.reduce((sum,row)=>sum+row.crossCheckedCount,0);

  return <section className="fsw-wrap">
    <div className="fsw-header"><div className="fsw-title-row"><span className="fsw-title-icon">◩</span><h2>我的基金板块</h2><span className="fsw-count">· {validSelected.length} 个关注</span></div><div className="fsw-subtitle">只看你关注的基金主题。板块涨跌只由有可靠数据的成分基金计算，不使用股票行业指数代替。</div><button type="button" className="fsw-manage" onClick={()=>setManagerOpen(true)}>＋ 管理板块</button></div>
    <div className="fsw-status"><span className={loading ? "dot pulse" : "dot"}/><span>{statusText}</span><span className="fsw-status-right">{loading ? "更新中" : stale ? "最近交易日" : crossFunds > 0 ? `已核验 ${crossFunds}/${Math.max(totalFunds,1)}` : "已接入"}</span></div>
    <div className="fsw-list">{rows.length ? rows.map((row)=>{ const open=expanded===row.id; const heldCodes=new Set(portfolio.map((h)=>h.code)); const valid=row.funds.filter((f)=>f.pct!=null); const leaders=valid.slice().sort((a,b)=>(b.pct??-Infinity)-(a.pct??-Infinity)); const displayFunds=open?leaders:valid; return <article key={row.id} className={`fsw-card ${open?"open":""}`}>
      <button type="button" className="fsw-main" onClick={()=>setExpanded(open?null:row.id)} aria-expanded={open}>
        <div className="fsw-main-head"><div className="fsw-name-block"><span className="fsw-icon">{row.icon}</span><div><div className="fsw-name">{row.name}<span className="fsw-fund-count">{row.validCount}/{row.totalCount} 只基金</span></div><div className="fsw-mini-source">{validationText(row)} · 覆盖 {row.coveragePct.toFixed(0)}% · 核验 {row.crossCheckedPct.toFixed(0)}% · {row.marketDate || "日期未知"}</div></div></div><div className={`fsw-pct ${tone(row.pct)}`}>{pctText(row.pct)}</div></div>
        <div className="fsw-counts"><span>↑ <b>{row.up}</b></span><span>/</span><span>↓ <b>{row.down}</b></span>{row.flat?<><span>/</span><span>— <b>{row.flat}</b></span></>:null}<span className="fsw-expand-mark">{open?"收起":"查看基金"}</span></div>
        <div className="fsw-bar"><i style={{width:`${row.validCount?Math.min(100,(row.up/row.validCount)*100):0}%`}}/></div>
        <div className="fsw-foot"><span>{row.leader?`领涨 · ${row.leader.name} ${pctText(row.leader.pct)}`:leaders[0]?`领涨 · ${leaders[0].name} ${pctText(leaders[0].pct)}`:"暂无可靠领涨数据"}</span><span>{open?"⌃ 收起":"⌄ 展开查看基金"}</span></div>
      </button>
      {open?<div className="fsw-funds"><div className="fsw-fund-head"><span>包含基金</span><span>价格</span><span>涨跌</span></div>{displayFunds.map((fund)=>{const q=displayQuote(fund);return <div className="fsw-fund-row" key={fund.code}><div className="fsw-fund-info"><div className="fsw-fund-name">{fund.name}{heldCodes.has(fund.code)?<span className="held">持有</span>:null}</div><div className="fsw-fund-meta">{fund.code} · {fund.validation==="cross_checked"?"双源":fund.validation==="single_source"?"单源":"暂无"}{fund.time?` · ${fund.time}`:""}{fund.date?` · ${fund.date}`:""}</div></div><div className="fsw-fund-value">{q.value==null?"—":q.value.toFixed(4)}<small>{q.label}</small></div><div className={`fsw-fund-pct ${tone(fund.pct)}`}>{pctText(fund.pct)}</div></div>})}<div className="fsw-expanded-note">板块涨跌 = 有效成分基金涨跌幅等权平均；没有可靠数据的基金不参与计算，也不会被当成 0。展开后按涨跌从强到弱排序。</div></div>:null}
    </article>}) : <div className="fsw-placeholder-list">{validSelected.slice(0,8).map((id)=>{const meta=FUND_SECTORS.find((s)=>s.id===id)!;return <article key={id} className="fsw-card fsw-placeholder-card"><div className="fsw-main"><div className="fsw-main-head"><div className="fsw-name-block"><span className="fsw-icon">{meta.icon}</span><div><div className="fsw-name">{meta.name}<span className="fsw-fund-count">{meta.funds.length} 只基金</span></div><div className="fsw-mini-source">{loading?"正在获取基金数据…":"等待可靠数据"}</div></div></div><div className="fsw-skeleton-value">—</div></div><div className="fsw-placeholder-line"/><div className="fsw-placeholder-line short"/></div></article>})}</div>}
    </div>
    {managerOpen?<div className="fsw-mask" onMouseDown={(e)=>{if(e.target===e.currentTarget)setManagerOpen(false)}}><div className="fsw-sheet"><div className="fsw-sheet-handle"/><div className="fsw-sheet-title"><div><h3>管理基金板块</h3><p>选中后，这个主题会出现在大盘页</p></div><button type="button" onClick={()=>setManagerOpen(false)}>完成</button></div><input autoFocus value={query} onChange={(e)=>setQuery(e.target.value)} className="fsw-search" placeholder="搜索 半导体 / CPO / AI / 医药 / 白酒 / 黄金…"/><div className="fsw-sheet-count">已关注 {validSelected.length} 个 · 可选 {FUND_SECTORS.length} 个主题 · 只管理基金主题，不管理股票板块</div><div className="fsw-manager-list">{manager.map((s)=><button key={s.id} type="button" className={`fsw-manager-row ${selectedSet.has(s.id)?"selected":""}`} onClick={()=>toggleSector(s.id)}><span className="mi">{s.icon}</span><span className="mn"><b>{s.name}</b><small>{s.funds.length} 只关联基金</small></span><span className="check">{selectedSet.has(s.id)?"✓":"+"}</span></button>)}</div></div></div>:null}
  </section>;
}
