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
type AkRow = { name?: string; change_pct?: number | null; main_net_inflow?: number | null; super_net_inflow?: number | null; large_net_inflow?: number | null; mid_net_inflow?: number | null; small_net_inflow?: number | null };
type BoardAdvice = { sector: SectorQuote; factor: ReturnType<typeof calcSixFactor>; quote: BoardWatchQuote; source: string };

function tone(v: number | null) { return v == null ? "text-muted" : v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted"; }
function flow(v: number | null) { return v == null ? "—" : `${v >= 0 ? "+" : ""}${(v / 1e8).toFixed(2)}亿`; }
function confidenceTone(v: number) { return v >= 75 ? "bg-blue-50 text-blue-600" : v >= 60 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"; }
function readWatchedCodes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(WATCH_KEY) || "null") as { items?: WatchItem[] } | null;
    return Array.isArray(raw?.items) ? raw.items.map((x) => String(x?.code ?? "").trim()).filter(Boolean) : [];
  } catch { return []; }
}
function normalizeName(value: string) { return value.replace(/[（）()\s·_-]/g, "").toLowerCase(); }
function matchAkByName(rows: AkRow[], name: string): AkRow | undefined {
  const target = normalizeName(name);
  if (!target) return undefined;
  return rows
    .map((row) => ({ row, value: normalizeName(String(row.name ?? "")) }))
    .filter((x) => x.value)
    .sort((a, b) => {
      const ae = a.value === target ? 100 : a.value.includes(target) || target.includes(a.value) ? 80 : 0;
      const be = b.value === target ? 100 : b.value.includes(target) || target.includes(b.value) ? 80 : 0;
      return be - ae;
    })[0]?.row;
}
async function fetchAk(type: "industry" | "concept"): Promise<AkRow[]> {
  try {
    const response = await fetch(`/api/akshare-sector-flow?sector_type=${type}&indicator=今日`, { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json() as { ok?: boolean; rows?: AkRow[] };
    return data.ok && Array.isArray(data.rows) ? data.rows : [];
  } catch { return []; }
}

export function OperationAdvice({ sectors, benchPct }:{ sectors:SectorQuote[]; benchPct:number|null }) {
  const [watchedCodes, setWatchedCodes] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<BoardWatchQuote[]>([]);
  const [akIndustry, setAkIndustry] = useState<AkRow[]>([]);
  const [akConcept, setAkConcept] = useState<AkRow[]>([]);
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
    if (!selectedCodes.length) { setQuotes([]); setAkIndustry([]); setAkConcept([]); setAiText(""); return; }
    setLoading(true);
    void Promise.all([
      getBoardWatchQuotes({ data: { codes: selectedCodes } }).catch(() => ({ rows: [], fetchedAt: Date.now(), weekend: false })),
      fetchAk("industry"),
      fetchAk("concept"),
    ]).then(([board, industry, concept]) => {
      if (!alive) return;
      setQuotes(board.rows);
      setAkIndustry(industry);
      setAkConcept(concept);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [selectedCodes.join(",")]);

  const rows = useMemo<BoardAdvice[]>(() => selectedCodes.map((code) => {
    const rule = SECTOR_RULES.find((r) => r.bkCode === code);
    const quote = quotes.find((q) => q.code === code);
    if (!quote) return null;
    const name = quote.name || rule?.name || code;
    const ak = matchAkByName([...akIndustry, ...akConcept], name);
    const base = rule ? sectors.find((s) => s.id === rule.id) : sectors.find((s) => s.bkCode === code || s.name === name);
    const change = ak?.change_pct ?? quote.pct ?? base?.change ?? null;
    const mainFlow = ak?.main_net_inflow ?? quote.mainFlow ?? base?.flow ?? null;
    const sector: SectorQuote = {
      id: rule?.id || code,
      name,
      bkCode: code,
      change,
      flow: mainFlow,
      super: ak?.super_net_inflow ?? quote.superFlow ?? base?.super ?? null,
      large: ak?.large_net_inflow ?? quote.largeFlow ?? base?.large ?? null,
      mid: ak?.mid_net_inflow ?? quote.midFlow ?? base?.mid ?? null,
      small: ak?.small_net_inflow ?? quote.smallFlow ?? base?.small ?? null,
      turnover: quote.turnover ?? base?.turnover ?? null,
      available: change != null,
      streak: base?.streak ?? 0,
      etfCode: base?.etfCode,
      etfName: base?.etfName,
      etfChange: base?.etfChange,
      validation: ak ? "cross_checked" : quote.validation === "live" ? "single_source" : "unavailable",
    };
    return { sector, factor: calcSixFactor(sector, benchPct), quote, source: ak ? "AKShare真实资金流" : mainFlow != null ? "东方财富板块资金流" : "暂无可靠资金流" };
  }).filter((x): x is BoardAdvice => x !== null), [akConcept, akIndustry, benchPct, quotes, sectors, selectedCodes]);

  useEffect(() => {
    const key = getDSKey();
    if (!key || !rows.length) return;
    const facts = rows.map(({ sector, factor, source }) => `${sector.name}：涨跌 ${sector.change == null ? "未知" : `${sector.change.toFixed(2)}%`}；主力资金 ${flow(sector.flow)}；趋势 ${factor.trendLabel}；波段 ${factor.band}；规则建议 ${factor.advice}；置信 ${factor.confidence}%；数据源 ${source}`).join("\n");
    setAiLoading(true);
    void analyzeDeepSeek({ data: { apiKey: key, model: getDSModel(), prompt: `你是 Fund AI Pro 的解释与评级层。只允许基于下面用户自选板块的真实数据和六因子规则结果回答。严禁创造数字、补猜资金、添加未选择板块，也不要修改规则结果。用中文输出3-6句，说明资金与趋势是否一致、强弱排序、当前更适合观察/持有/谨慎/规避，并指出证据不足。\n\n${facts}` } })
      .then((res) => { if (res.ok) setAiText(res.text); })
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, [rows]);

  const avg = rows.length ? rows.reduce((sum, x) => sum + x.factor.position, 0) / rows.length : null;
  const positive = rows.filter((x) => x.sector.change != null && x.sector.change > 0).length;
  const negative = rows.filter((x) => x.sector.change != null && x.sector.change < 0).length;
  const sharpDown = rows.filter((x) => x.sector.change != null && x.sector.change < -2).length;
  const outflow = rows.filter((x) => x.sector.flow != null && x.sector.flow < -1e8).length;
  const position = avg == null ? "数据不足" : avg >= 68 ? "偏高" : avg >= 55 ? "中性偏多" : avg >= 42 ? "中性" : "偏低";
  const top = rows.filter((x) => x.factor.position >= 60).slice(0, 4).map((x) => x.sector.name).join("、") || "暂无明确强势板块";

  return <section className="mb-3 overflow-hidden rounded-[24px] border border-white/75 bg-white/48 p-3 shadow-[0_14px_38px_rgba(38,78,112,.07)] backdrop-blur-[20px] saturate-150">
    <div className="flex items-end justify-between gap-3"><div className="min-w-0"><div className="text-[16px] font-semibold tracking-tight text-fg">🎯 操作建议 <span className="text-[10px] font-normal text-muted">仅供参考</span></div><div className="mt-0.5 text-[9px] text-muted">只分析自选板块 · 真实资金流 + 六因子规则 + DeepSeek解释</div></div><Link to="/ai" className="shrink-0 text-[9px] text-blue-600">AI复核 →</Link></div>
    {!selectedCodes.length ? <div className="mt-2.5 rounded-[16px] border border-dashed border-slate-200 bg-white/54 px-3 py-5 text-center text-[9px] text-slate-400">还没有选择板块。先在“自选板块”添加板块，这里只会显示你选择的板块。</div> : <>
      <div className="mt-2 rounded-[16px] bg-white/62 p-2.5"><div className="flex items-center justify-between gap-2"><div className="text-[12px] font-semibold text-fg">⚡ 短期策略</div><span className="rounded-full bg-white/75 px-2 py-1 text-[8px] text-slate-500">仅显示 {rows.length} 个自选板块{loading ? " · 更新中" : ""}</span></div><div className="mt-2 overflow-x-auto rounded-[13px] ring-1 ring-white/80"><div className="min-w-[700px]"><div className="grid grid-cols-[1.05fr_.65fr_.85fr_.55fr_.7fr_1fr_.7fr] gap-1 bg-white/70 px-2 py-1.5 text-[8px] font-semibold text-muted"><span>板块</span><span>涨跌</span><span>资金</span><span>趋势</span><span>波段</span><span>建议</span><span>置信</span></div>{rows.map(({ sector, factor, source }) => <div key={sector.id} className="grid grid-cols-[1.05fr_.65fr_.85fr_.55fr_.7fr_1fr_.7fr] items-center gap-1 border-t border-white/70 bg-white/48 px-2 py-2 text-[9px]"><span className="truncate font-medium text-fg">{sector.name}</span><span className={`tabular-nums ${tone(sector.change)}`}>{sector.change == null ? "—" : fmtPctShort(sector.change)}</span><span className={`tabular-nums ${tone(sector.flow)}`}>{flow(sector.flow)}</span><span className="text-slate-700">{factor.trendLabel}</span><span className="text-slate-700">{factor.band}</span><span className={factor.advice.includes("减") || factor.advice.includes("空仓") ? "font-semibold text-down" : "font-medium text-slate-700"}>{factor.advice}</span><span className="inline-flex w-fit flex-col items-center gap-0.5"><span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${confidenceTone(factor.confidence)}`}>{factor.confidence}%</span><span className="text-[8px] text-slate-400">{factor.level} · {source}</span></span></div>)}{!rows.length ? <div className="px-3 py-4 text-center text-[9px] text-slate-400">暂未取得可靠的自选板块行情，不生成方向性建议。</div> : null}</div></div></div>
      <div className="mt-2.5 grid grid-cols-2 gap-2"><div className="rounded-[16px] bg-white/58 p-2.5"><div className="text-[10px] font-semibold text-fg">🏗️ 中长期布局</div><div className="mt-1 text-[9px] leading-[1.45] text-muted">强势观察：<b className="text-fg">{top}</b>。趋势确认与估值安全边际优先，不追单日急涨。</div></div><div className="rounded-[16px] bg-white/58 p-2.5"><div className="text-[10px] font-semibold text-fg">📊 整体仓位</div><div className="mt-1 text-[9px] leading-[1.45] text-muted">当前参考：<b className="text-fg">{position}</b>{avg != null ? ` · 自选综合位置 ${avg.toFixed(0)}/100` : ""}。结合自选板块信号，不自动交易。</div></div></div>
      <div className="mt-2.5 rounded-[16px] bg-blue-50/50 p-2.5 ring-1 ring-blue-100/60"><div className="flex items-center justify-between gap-2"><div className="text-[11px] font-semibold text-fg">🤖 DeepSeek 解读</div><span className="text-[8px] text-slate-400">{getDSKey() ? (aiLoading ? "分析中…" : "基于当前自选数据") : "未配置 Key · 使用规则结果"}</span></div><div className="mt-1.5 text-[9px] leading-[1.6] text-muted">{aiText || "DeepSeek 未生成新的文字解读时，上面的六因子规则结果仍然有效；不会用 AI 猜数字。"}</div></div>
      <div className="mt-2.5 rounded-[16px] border border-amber-200/70 bg-amber-50/58 p-2.5"><div className="text-[11px] font-semibold text-amber-700">⚠️ 风险提示</div><div className="mt-0.5 text-[9px] leading-[1.5] text-muted">自选板块中 {sharpDown} 个单日跌幅超过 2%，{outflow} 个主力净流出明显；今日统计 {positive} 涨 / {negative} 跌。</div></div>
    </>}
  </section>;
}
