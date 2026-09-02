import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { calcSixFactor } from "@/lib/calc/six-factor";
import { fmtPctShort } from "@/lib/format";
import { getDSKey, getDSModel } from "@/lib/storage";
import { analyzeDeepSeek } from "@/lib/data/deepseek";
import { getBoardWatchQuotes, type BoardWatchQuote } from "@/lib/data/board-watch";
import type { SectorQuote } from "@/lib/types";
import { SECTOR_RULES } from "@/lib/data/sectors";

const WATCH_KEY = "fund_ai_pro_board_watch_v8";

type WatchItem = { code: string; name: string };
type ApiFlowRow = {
  name?: string;
  change_pct?: number | null;
  main_net_inflow?: number | null;
  main_net_ratio?: number | null;
  super_net_inflow?: number | null;
  large_net_inflow?: number | null;
  mid_net_inflow?: number | null;
  small_net_inflow?: number | null;
};
type AdviceRow = { quote: BoardWatchQuote; sector: SectorQuote; factor: ReturnType<typeof calcSixFactor>; sourceLabel: string };

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
function matchRule(code: string, name: string) {
  return SECTOR_RULES.find((r) => r.bkCode === code)
    || SECTOR_RULES.find((r) => r.name === name)
    || SECTOR_RULES.find((r) => r.searchKeys.some((k) => name.includes(k) || k.includes(name)));
}
function toSectorQuote(quote: BoardWatchQuote, api?: ApiFlowRow, ruleId?: string): SectorQuote {
  const change = api?.change_pct ?? quote.pct ?? null;
  const mainFlow = api?.main_net_inflow ?? quote.mainFlow ?? null;
  return {
    id: ruleId || quote.code,
    name: quote.name,
    bkCode: quote.code,
    change,
    flow: mainFlow,
    super: api?.super_net_inflow ?? quote.superFlow,
    large: api?.large_net_inflow ?? quote.largeFlow,
    mid: api?.mid_net_inflow ?? quote.midFlow,
    small: api?.small_net_inflow ?? quote.smallFlow,
    turnover: quote.turnover,
    available: change != null,
    streak: 0,
    validation: api ? "cross_checked" : quote.validation === "live" ? "single_source" : "unavailable",
  };
}
function scoreApiRow(row: ApiFlowRow, rule: ReturnType<typeof matchRule>) {
  if (!rule || !row.name) return 0;
  const name = row.name.toLowerCase();
  let score = 0;
  if (name === rule.name.toLowerCase()) score += 100;
  for (const key of [...rule.searchKeys, ...rule.keys]) {
    if (name.includes(key.toLowerCase())) score += key.length > 2 ? 20 : 10;
  }
  return score;
}
async function fetchAkshareRows(type: "industry" | "concept") {
  try {
    const res = await fetch(`/api/akshare-sector-flow?sector_type=${type}&indicator=今日`, { cache: "no-store" });
    if (!res.ok) return [] as ApiFlowRow[];
    const body = await res.json() as { ok?: boolean; rows?: ApiFlowRow[] };
    return body.ok && Array.isArray(body.rows) ? body.rows : [];
  } catch { return [] as ApiFlowRow[]; }
}

export function OperationAdvice({ sectors: _sectors, benchPct }:{ sectors:SectorQuote[]; benchPct:number|null }) {
  const [watchedCodes, setWatchedCodes] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<BoardWatchQuote[]>([]);
  const [akRows, setAkRows] = useState<{ industry: ApiFlowRow[]; concept: ApiFlowRow[] }>({ industry: [], concept: [] });
  const [loading, setLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const lastAiAt = useRef(0);
  const lastAiSignature = useRef("");

  useEffect(() => {
    const sync = () => setWatchedCodes(readWatchedCodes());
    sync();
    const timer = window.setInterval(sync, 800);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => { window.clearInterval(timer); window.removeEventListener("storage", onStorage); };
  }, []);

  const selectedCodes = useMemo(() => [...new Set(watchedCodes)], [watchedCodes]);

  useEffect(() => {
    let alive = true;
    if (!selectedCodes.length) {
      setQuotes([]);
      setAkRows({ industry: [], concept: [] });
      setAiText("");
      return;
    }
    setLoading(true);
    void Promise.all([
      getBoardWatchQuotes({ data: { codes: selectedCodes } }).catch(() => ({ rows: [], fetchedAt: Date.now(), weekend: false })),
      fetchAkshareRows("industry"),
      fetchAkshareRows("concept"),
    ]).then(([boardRes, industry, concept]) => {
      if (!alive) return;
      setQuotes(boardRes.rows || []);
      setAkRows({ industry, concept });
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [selectedCodes.join(",")]);

  const adviceRows = useMemo<AdviceRow[]>(() => {
    return selectedCodes.map((code) => {
      const quote = quotes.find((q) => q.code === code);
      const rule = matchRule(code, quote?.name || "");
      if (!quote) return null;
      const pool = rule?.prefer === "industry" ? akRows.industry : akRows.concept;
      const ak = pool.map((r) => ({ r, score: scoreApiRow(r, rule) })).sort((a, b) => b.score - a.score)[0]?.r;
      const sector = toSectorQuote(quote, ak, rule?.id);
      const factor = calcSixFactor(sector, benchPct);
      return { quote, sector, factor, sourceLabel: ak ? "AKShare真实资金流" : "东方财富实时资金流" };
    }).filter((x): x is AdviceRow => !!x);
  }, [akRows, benchPct, quotes, selectedCodes]);

  useEffect(() => {
    const key = getDSKey();
    if (!key || !adviceRows.length) return;
    const signature = adviceRows.map(({ quote, factor }) => `${quote.code}:${quote.pct ?? "-"}:${quote.mainFlow ?? "-"}:${factor.advice}:${factor.trendLabel}:${factor.band}`).join("|");
    const now = Date.now();
    if (signature === lastAiSignature.current && now - lastAiAt.current < 180_000) return;
    if (now - lastAiAt.current < 180_000 && lastAiSignature.current) return;
    lastAiSignature.current = signature;
    lastAiAt.current = now;
    setAiLoading(true);
    const facts = adviceRows.map(({ quote, factor, sourceLabel }) => `${quote.name}: 涨跌 ${quote.pct == null ? "未知" : `${quote.pct.toFixed(2)}%`}；主力资金 ${flow(quote.mainFlow)}；趋势 ${factor.trendLabel}；波段 ${factor.band}；规则建议 ${factor.advice}；置信 ${factor.confidence}%；数据源 ${sourceLabel}`).join("\n");
    void analyzeDeepSeek({
      data: {
        apiKey: key,
        model: getDSModel(),
        prompt: `你是 Fund AI Pro 的数据解释与评级层。严格禁止创造数字、补猜资金流、修改规则结论。下面只有用户自选板块的真实数据和规则引擎结果。请用中文输出 3-6 句，说明哪些板块偏强/偏弱、资金流向与趋势是否一致、当前适合持有/观察/谨慎/规避，并指出证据不足之处。不要输出虚构数据，不要扩展未出现的板块。\n\n${facts}`,
      },
    }).then((res) => { if (res.ok) setAiText(res.text); }).catch(() => {}).finally(() => setAiLoading(false));
  }, [adviceRows]);

  const avg = adviceRows.length ? adviceRows.reduce((sum, x) => sum + x.factor.position, 0) / adviceRows.length : null;
  const positive = adviceRows.filter((x) => x.quote.pct != null && x.quote.pct > 0).length;
  const negative = adviceRows.filter((x) => x.quote.pct != null && x.quote.pct < 0).length;
  const sharpDown = adviceRows.filter((x) => x.quote.pct != null && x.quote.pct < -2).length;
  const outflow = adviceRows.filter((x) => x.quote.mainFlow != null && x.quote.mainFlow < -1e8).length;
  const position = avg == null ? "数据不足" : avg >= 68 ? "偏高" : avg >= 55 ? "中性偏多" : avg >= 42 ? "中性" : "偏低";
  const top = adviceRows.filter((x) => x.factor.position >= 60).slice(0, 4).map((x) => x.quote.name).join("、") || "暂无明确强势板块";

  return <section className="mb-3 overflow-hidden rounded-[24px] border border-white/75 bg-white/48 p-3 shadow-[0_14px_38px_rgba(38,78,112,.07),inset_0_1px_0_rgba(255,255,255,.95)] backdrop-blur-[20px] saturate-150">
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0"><div className="text-[16px] font-semibold tracking-tight text-fg">🎯 操作建议 <span className="text-[10px] font-normal text-muted">仅供参考</span></div><div className="mt-0.5 text-[9px] text-muted">只分析你的自选板块 · 真实资金流 + 六因子规则 + DeepSeek解释</div></div>
      <Link to="/ai" className="shrink-0 text-[9px] text-blue-600">AI复核 →</Link>
    </div>

    {!selectedCodes.length ? <div className="mt-2.5 rounded-[16px] border border-dashed border-slate-200 bg-white/54 px-3 py-5 text-center text-[9px] text-slate-400">还没有选择板块。先在“自选板块”添加，例如“半导体”；这里会自动同步同一板块的资金、趋势、波段和操作建议。</div> : null}

    {selectedCodes.length ? <>
      <div className="mt-2 rounded-[16px] bg-white/62 p-2.5">
        <div className="flex items-center justify-between gap-2"><div className="text-[12px] font-semibold text-fg">⚡ 短期策略</div><span className="rounded-full bg-white/75 px-2 py-1 text-[8px] text-slate-500">仅显示 {adviceRows.length} 个自选板块{loading ? " · 更新中" : ""}</span></div>
        <div className="mt-2 overflow-x-auto rounded-[13px] ring-1 ring-white/80">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-[1.05fr_.65fr_.85fr_.55fr_.7fr_1fr_.7fr] gap-1 bg-white/70 px-2 py-1.5 text-[8px] font-semibold text-muted"><span>板块</span><span>涨跌</span><span>资金</span><span>趋势</span><span>波段</span><span>建议</span><span>置信</span></div>
            {adviceRows.map(({ quote, factor, sourceLabel }) => <div key={quote.code} className="grid grid-cols-[1.05fr_.65fr_.85fr_.55fr_.7fr_1fr_.7fr] items-center gap-1 border-t border-white/70 bg-white/48 px-2 py-2 text-[9px]">
              <span className="truncate font-medium text-fg">{quote.name}</span>
              <span className={`tabular-nums ${tone(quote.pct)}`}>{quote.pct == null ? "—" : fmtPctShort(quote.pct)}</span>
              <span className={`tabular-nums ${tone(quote.mainFlow)}`}>{flow(quote.mainFlow)}</span>
              <span className="text-slate-700">{factor.trendLabel}</span>
              <span className="text-slate-700">{factor.band}</span>
              <span className={factor.advice.includes("减") || factor.advice.includes("空仓") ? "font-semibold text-down" : "font-medium text-slate-700"}>{factor.advice}</span>
              <span className="inline-flex w-fit flex-col items-center gap-0.5"><span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${confidenceTone(factor.confidence)}`}>{factor.confidence}%</span><span className="text-[8px] text-slate-400">{factor.level} · {sourceLabel}</span></span>
            </div>)}
            {!adviceRows.length ? <div className="px-3 py-4 text-center text-[9px] text-slate-400">暂未取得可靠的自选板块行情，不生成方向性建议。</div> : null}
          </div>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="rounded-[16px] bg-white/58 p-2.5"><div className="text-[10px] font-semibold text-fg">🏗️ 中长期布局</div><div className="mt-1 text-[9px] leading-[1.45] text-muted">强势观察：<b className="text-fg">{top}</b>。趋势确认与估值安全边际优先，不追单日急涨。</div></div>
        <div className="rounded-[16px] bg-white/58 p-2.5"><div className="text-[10px] font-semibold text-fg">📊 整体仓位</div><div className="mt-1 text-[9px] leading-[1.45] text-muted">当前参考：<b className="text-fg">{position}</b>{avg != null ? ` · 自选综合位置 ${avg.toFixed(0)}/100` : ""}。结合自选板块信号，不自动交易。</div></div>
      </div>

      <div className="mt-2.5 rounded-[16px] bg-blue-50/50 p-2.5 ring-1 ring-blue-100/60"><div className="flex items-center justify-between gap-2"><div className="text-[11px] font-semibold text-fg">🤖 DeepSeek 解读</div><span className="text-[8px] text-slate-400">{getDSKey() ? (aiLoading ? "分析中…" : "基于当前自选数据") : "未配置 Key · 使用规则结果"}</span></div>{aiText ? <div className="mt-1.5 text-[9px] leading-[1.6] text-muted">{aiText}</div> : <div className="mt-1.5 text-[9px] leading-[1.6] text-muted">DeepSeek 未生成新的文字解读时，上面的六因子规则结果仍然有效；不会用 AI 猜数字。</div>}</div>

      <div className="mt-2.5 rounded-[16px] border border-amber-200/70 bg-amber-50/58 p-2.5"><div className="text-[11px] font-semibold text-amber-700">⚠️ 风险提示</div><div className="mt-0.5 text-[9px] leading-[1.5] text-muted">你的自选板块中 {sharpDown} 个单日跌幅超过 2%，{outflow} 个主力净流出明显；今日统计 {positive} 涨 / {negative} 跌。资金、趋势或相对强弱证据不足时，只给观察建议。</div></div>
    </> : null}
  </section>;
}
