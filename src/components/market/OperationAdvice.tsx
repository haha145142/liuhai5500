import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { calcSixFactor } from "@/lib/calc/six-factor";
import { fmtPctShort } from "@/lib/format";
import { getDSKey, getDSModel } from "@/lib/storage";
import { analyzeDeepSeek } from "@/lib/data/deepseek";
import { getBoardWatchQuotes, type BoardWatchQuote } from "@/lib/data/board-watch";
import type { SectorQuote } from "@/lib/types";
import { SECTOR_RULES } from "@/lib/data/sectors";

const WATCH_KEY = "fund_ai_pro_board_watch_v8";
type WatchItem = { code: string; name: string };
type BoardAdvice = { sector: SectorQuote; factor: ReturnType<typeof calcSixFactor>; quote: BoardWatchQuote };

function tone(v: number | null) { return v == null ? "text-muted" : v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted"; }
function confidenceTone(v: number) { return v >= 75 ? "bg-blue-50 text-blue-600" : v >= 60 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"; }
function readWatchedCodes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(WATCH_KEY) || "null") as { items?: WatchItem[] } | null;
    return Array.isArray(raw?.items) ? raw.items.map((x) => String(x?.code ?? "").trim()).filter(Boolean) : [];
  } catch { return []; }
}

export function OperationAdvice({ sectors, benchPct }:{ sectors:SectorQuote[]; benchPct:number|null }) {
  const [watchedCodes, setWatchedCodes] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<BoardWatchQuote[]>([]);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = readWatchedCodes();
      setWatchedCodes((prev) => prev.length === next.length && prev.every((code, index) => code === next[index]) ? prev : next);
    };
    sync();
    const timer = window.setInterval(sync, 3_000);
    window.addEventListener("storage", sync);
    window.addEventListener("fap-board-watch-change", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", sync);
      window.removeEventListener("fap-board-watch-change", sync);
    };
  }, []);

  const selectedCodes = useMemo(() => [...new Set(watchedCodes)], [watchedCodes]);

  useEffect(() => {
    let alive = true;
    if (!selectedCodes.length) { setQuotes([]); setAiText(""); return; }
    setLoading(true);
    void getBoardWatchQuotes({ data: { codes: selectedCodes } })
      .then((result) => { if (alive) setQuotes(result.rows); })
      .catch(() => { if (alive) setQuotes([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [selectedCodes.join(",")]);

  const rows = useMemo<BoardAdvice[]>(() => selectedCodes.map((code) => {
    const rule = SECTOR_RULES.find((r) => r.bkCode === code);
    const quote = quotes.find((q) => q.code === code);
    if (!quote) return null;
    const name = quote.name || rule?.name || code;
    const base = rule ? sectors.find((s) => s.id === rule.id) : sectors.find((s) => s.bkCode === code || s.name === name);
    const change = quote.pct ?? base?.change ?? null;
    const sector: SectorQuote = {
      id: rule?.id || code,
      name,
      bkCode: code,
      change,
      flow: null,
      super: null,
      large: null,
      mid: null,
      small: null,
      turnover: null,
      available: change != null,
      streak: base?.streak ?? 0,
      etfCode: base?.etfCode,
      etfName: base?.etfName,
      etfChange: base?.etfChange,
      validation: change == null ? "unavailable" : quote.validation === "live" ? "single_source" : "unavailable",
    };
    return { sector, factor: calcSixFactor(sector, benchPct), quote };
  }).filter((x): x is BoardAdvice => x !== null), [benchPct, quotes, sectors, selectedCodes]);

  useEffect(() => {
    const key = getDSKey();
    if (!key || !rows.length) return;
    const facts = rows.map(({ sector, factor }) => `${sector.name}：今日涨跌 ${sector.change == null ? "未知" : `${sector.change.toFixed(2)}%`}；趋势 ${factor.trendLabel}；波段 ${factor.band}；规则建议 ${factor.advice}；置信 ${factor.confidence}%。`).join("\n");
    setAiLoading(true);
    void analyzeDeepSeek({ data: { apiKey: key, model: getDSModel(), prompt: `你是 Fund AI Pro 的解释层。只允许基于下面用户自选板块的今日涨跌和规则结果回答。严禁创造数字、补猜资金、添加未选择板块。用中文输出3-5句，说明强弱排序以及当前更适合观察/持有/谨慎/规避，并明确证据只来自今日板块涨跌。\n\n${facts}` } })
      .then((res) => { if (res.ok) setAiText(res.text); })
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, [rows]);

  const positive = rows.filter((x) => x.sector.change != null && x.sector.change > 0).length;
  const negative = rows.filter((x) => x.sector.change != null && x.sector.change < 0).length;
  const sharpDown = rows.filter((x) => x.sector.change != null && x.sector.change < -2).length;
  const avg = rows.length ? rows.reduce((sum, x) => sum + x.factor.position, 0) / rows.length : null;
  const position = avg == null ? "数据不足" : avg >= 68 ? "偏高" : avg >= 55 ? "中性偏多" : avg >= 42 ? "中性" : "偏低";
  const top = rows.filter((x) => x.factor.position >= 60).slice(0, 4).map((x) => x.sector.name).join("、") || "暂无明确强势板块";

  return <section className="mb-3 overflow-hidden rounded-[24px] border border-white/75 bg-white/48 p-3 shadow-[0_14px_38px_rgba(38,78,112,.07)] backdrop-blur-[20px] saturate-150">
    <div className="flex items-end justify-between gap-3"><div className="min-w-0"><div className="text-[16px] font-semibold tracking-tight text-fg">🎯 自选板块 · 操作建议 <span className="text-[10px] font-normal text-muted">仅供参考</span></div><div className="mt-0.5 text-[9px] text-muted">只读取你已添加板块的今日涨跌，不再显示主力资金字段</div></div><Link to="/ai" className="shrink-0 text-[9px] text-blue-600">AI复核 →</Link></div>
    {!selectedCodes.length ? <div className="mt-2.5 rounded-[16px] border border-dashed border-slate-200 bg-white/54 px-3 py-5 text-center text-[9px] text-slate-400">还没有选择板块。先在“自选板块”添加板块，这里只会显示你选择的板块。</div> : <>
      <div className="mt-2 rounded-[16px] bg-white/62 p-2.5"><div className="flex items-center justify-between gap-2"><div className="text-[12px] font-semibold text-fg">⚡ 今日板块状态</div><span className="rounded-full bg-white/75 px-2 py-1 text-[8px] text-slate-500">{loading ? "更新中" : `共 ${rows.length} 个`}</span></div><div className="mt-2 overflow-hidden rounded-[13px] ring-1 ring-white/80"><div className="grid grid-cols-[1.2fr_.75fr_.75fr_.75fr_1fr] gap-1 bg-white/70 px-2 py-1.5 text-[8px] font-semibold text-muted"><span>板块</span><span>今日涨跌</span><span>趋势</span><span>波段</span><span>建议</span></div>{rows.map(({ sector, factor }) => <div key={sector.id} className="grid grid-cols-[1.2fr_.75fr_.75fr_.75fr_1fr] items-center gap-1 border-t border-white/70 bg-white/48 px-2 py-2 text-[9px]"><span className="truncate font-medium text-fg">{sector.name}</span><span className={`tabular-nums ${tone(sector.change)}`}>{sector.change == null ? "暂无可靠数据" : fmtPctShort(sector.change)}</span><span className="text-slate-700">{factor.trendLabel}</span><span className="text-slate-700">{factor.band}</span><span className={factor.advice.includes("减") || factor.advice.includes("空仓") ? "font-semibold text-down" : "font-medium text-slate-700"}>{factor.advice}</span></div>)}{!rows.length ? <div className="px-3 py-4 text-center text-[9px] text-slate-400">暂未取得可靠的今日板块涨跌，不生成方向性建议。</div> : null}</div></div>
      <div className="mt-2.5 grid grid-cols-2 gap-2"><div className="rounded-[16px] bg-white/58 p-2.5"><div className="text-[10px] font-semibold text-fg">🏗️ 强势观察</div><div className="mt-1 text-[9px] leading-[1.45] text-muted">{top}。以今日涨跌为核心观察指标，不用不存在的资金数据补结论。</div></div><div className="rounded-[16px] bg-white/58 p-2.5"><div className="text-[10px] font-semibold text-fg">📊 今日多空</div><div className="mt-1 text-[9px] leading-[1.45] text-muted">{positive} 涨 / {negative} 跌{avg != null ? ` · 综合位置 ${avg.toFixed(0)}/100` : ""}。不自动交易。</div></div></div>
      <div className="mt-2.5 rounded-[16px] bg-blue-50/50 p-2.5 ring-1 ring-blue-100/60"><div className="flex items-center justify-between gap-2"><div className="text-[11px] font-semibold text-fg">🤖 DeepSeek 解读</div><span className="text-[8px] text-slate-400">{getDSKey() ? (aiLoading ? "分析中…" : "基于今日涨跌") : "未配置 Key · 使用规则结果"}</span></div><div className="mt-1.5 text-[9px] leading-[1.6] text-muted">{aiText || "DeepSeek 未生成新的文字解读时，上面的规则结果仍然有效；不会用 AI 猜资金或数字。"}</div></div>
      <div className="mt-2.5 rounded-[16px] border border-amber-200/70 bg-amber-50/58 p-2.5"><div className="text-[11px] font-semibold text-amber-700">⚠️ 风险提示</div><div className="mt-0.5 text-[9px] leading-[1.5] text-muted">自选板块中 {sharpDown} 个单日跌幅超过 2%；今日统计 {positive} 涨 / {negative} 跌。没有可靠涨跌数据的板块会保持空白，不用模板数字填充。</div></div>
    </>}
  </section>;
}
