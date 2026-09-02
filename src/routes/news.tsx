import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, RefreshCw, Sparkles } from "lucide-react";
import { EmptyNote, Glass } from "@/components/ui/Glass";
import { ageLabel, clockStr, formatPublishedAt } from "@/lib/format";
import { analyzeNews } from "@/lib/data/server";
import { getDSKey, getDSModel } from "@/lib/storage";
import { useApp } from "@/lib/store";
import type { NewsItem } from "@/lib/types";

export const Route = createFileRoute("/news")({ component: NewsPage });

type FilterId = "all" | "fund" | "sector" | "policy" | "market" | "macro" | "global";
type AiInsight = { id: string; text: string; relation: string; validation: string; importance: number };

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "全部" },
  { id: "fund", label: "基金" },
  { id: "sector", label: "科技" },
  { id: "policy", label: "政策" },
  { id: "market", label: "市场" },
  { id: "macro", label: "宏观" },
  { id: "global", label: "海外" },
];
const AI_CACHE_KEY = "fund_ai_pro_news_ai_v4";
const VISIBLE_DEFAULT = 5;

function normalizeText(text: string) { return text.replace(/\s+/g, " ").trim(); }
function filterItem(item: NewsItem, filter: FilterId) {
  if (filter === "all") return true;
  if (filter === "fund") return item.relatedSectors.length > 0 || /基金|ETF|份额|净值|申购|赎回|持仓/.test(`${item.title} ${item.summary}`);
  if (filter === "sector") return item.category === "sector";
  if (filter === "policy") return item.category === "policy";
  if (filter === "market") return item.category === "market";
  if (filter === "global") return item.category === "global";
  return item.category === "other";
}
function sentimentLabel(item: NewsItem) { return item.sentiment === "bull" ? "偏利好" : item.sentiment === "bear" ? "偏利空" : "中性"; }
function sentimentClass(item: NewsItem) { return item.sentiment === "bull" ? "bg-emerald-50/75 text-emerald-700" : item.sentiment === "bear" ? "bg-rose-50/75 text-rose-700" : "bg-slate-50/80 text-slate-600"; }
function cacheSignature(items: NewsItem[]) { return items.slice(0, 5).map((x) => `${x.id}:${x.title}`).join("|"); }
function readAiCache(signature: string): Record<string, AiInsight> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(sessionStorage.getItem(AI_CACHE_KEY) || "null") as { signature?: string; items?: AiInsight[]; ts?: number } | null;
    if (!raw || raw.signature !== signature || !raw.ts || Date.now() - raw.ts > 15 * 60_000) return {};
    return Object.fromEntries((raw.items || []).map((x) => [x.id, x]));
  } catch { return {}; }
}
function writeAiCache(signature: string, items: AiInsight[]) {
  try { sessionStorage.setItem(AI_CACHE_KEY, JSON.stringify({ signature, items, ts: Date.now() })); } catch {}
}
function parseAi(text: string): AiInsight[] {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    const arr = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed && Array.isArray((parsed as { items?: unknown[] }).items) ? (parsed as { items: unknown[] }).items : [];
    return arr.map((x) => {
      const v = x as Partial<AiInsight>;
      return {
        id: String(v.id || ""),
        text: normalizeText(String(v.text || "")),
        relation: normalizeText(String(v.relation || "")),
        validation: normalizeText(String(v.validation || "")),
        importance: Number.isFinite(Number(v.importance)) ? Number(v.importance) : 0,
      };
    }).filter((x) => x.id && x.text).slice(0, 5);
  } catch { return []; }
}

function NewsPage() {
  const news = useApp((s) => s.news);
  const newsLoading = useApp((s) => s.newsLoading);
  const refreshNews = useApp((s) => s.refreshNews);
  const snapshot = useApp((s) => s.snapshot);
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  const [filter, setFilter] = useState<FilterId>("all");
  const [expanded, setExpanded] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMap, setAiMap] = useState<Record<string, AiInsight>>({});

  const filteredItems = useMemo(() => (news?.items || []).filter((x) => filterItem(x, filter)), [filter, news]);
  const visibleItems = expanded ? filteredItems : filteredItems.slice(0, VISIBLE_DEFAULT);
  const signature = useMemo(() => cacheSignature(filteredItems), [filteredItems]);

  useEffect(() => {
    setExpanded(false);
    setAiMap(readAiCache(signature));
  }, [signature]);

  useEffect(() => {
    if (!filteredItems.length) return;
    if (Object.keys(readAiCache(signature)).length) return;
    void runBatchAI(filteredItems.slice(0, VISIBLE_DEFAULT), snapshot, portfolio.map((p) => funds[p.code]?.name || p.name));
  }, [filteredItems, signature, snapshot, portfolio, funds]);

  async function runBatchAI(items: NewsItem[], market: ReturnType<typeof useApp.getState>["snapshot"], holdingNames: string[]) {
    if (!items.length || aiBusy) return;
    setAiBusy(true);
    try {
      const evidence = items.map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        source: item.source,
        publishedAt: item.publishedAt ? formatPublishedAt(item.publishedAt) : "暂无可靠时间",
        category: item.category,
        sentiment: item.sentiment,
        relatedSectors: item.relatedSectors,
      }));
      const prompt = [
        "你是基金投资者的新闻研判助手。逐条解读下面最多5条新闻，每条只输出一段非常短、但有事实依据的判断。",
        "核心规则：新闻提到某行业，不等于该行业上涨；新闻提到某公司，不等于相关基金已经受益；没有行情数据就不能说趋势成立；没有资金数据就不能说资金流入或流出。",
        "最重要：不要为了‘看起来和基金有关’而强行联系用户持仓。只有新闻主题与基金主题直接吻合，并且输入的行情/指数/板块数据也支持时，才可以写具体基金或持仓影响；否则必须写‘暂无直接关联’。",
        "不要复制新闻原文，不要做事实之外的延伸，不要给确定性买卖指令。",
        `新闻：${JSON.stringify(evidence)}`,
        `用户当前持仓名称（仅在证据充分时使用）：${JSON.stringify(holdingNames.slice(0, 20))}`,
        `当前指数数据：${JSON.stringify(market?.indices || [])}`,
        `当前板块数据：${JSON.stringify(market?.sectors || [])}`,
        `当前市场资金：${JSON.stringify(market?.flow || null)}`,
        `当前外围数据：${JSON.stringify(market?.global || null)}`,
        "输出必须是 JSON 数组，不要 Markdown：[{\"id\":\"对应新闻id\",\"text\":\"20-55字中文解读\",\"relation\":\"暂无直接关联/主题相关/与持仓直接相关\",\"validation\":\"已被行情验证/事件关联，行情尚未验证/暂无可靠行情验证\",\"importance\":1}]",
      ].join("\n");
      const r = await analyzeNews({ data: { prompt, apiKey: typeof window === "undefined" ? "" : getDSKey(), model: typeof window === "undefined" ? "deepseek-chat" : getDSModel() } });
      const parsed = r.ok && r.text ? parseAi(r.text) : [];
      setAiMap(Object.fromEntries(parsed.map((x) => [x.id, x])));
      if (parsed.length) writeAiCache(signature, parsed);
    } catch {
      setAiMap({});
    } finally {
      setAiBusy(false);
    }
  }

  const sourceNames = news?.sources?.map((s) => s.name).filter((name) => /同花顺|金十数据|财联社/.test(name)).join(" · ") || "同花顺 · 金十数据 · 财联社";
  const latest = news?.latestPublishedAt;

  return (
    <div className="news-page pb-4">
      <Glass className="overflow-hidden rounded-[26px] bg-white/56 p-3 shadow-[0_16px_42px_rgba(38,78,112,.07)] backdrop-blur-[24px]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[17px] font-bold tracking-tight text-slate-950">📰 市场资讯</span>
              <span className="text-[10px] font-medium text-slate-400">最新快讯</span>
            </div>
            <div className="mt-1 text-[9px] text-slate-400">最后更新 {news?.fetchedAt ? clockStr(new Date(news.fetchedAt)) : "等待数据"}</div>
          </div>
          <button type="button" onClick={() => void refreshNews()} disabled={newsLoading} className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/70 text-slate-600 shadow-sm disabled:opacity-50" aria-label="刷新资讯"><RefreshCw className={`size-4 ${newsLoading ? "animate-spin" : ""}`} /></button>
        </div>

        <div className="mt-2 rounded-[16px] border border-emerald-200/65 bg-emerald-50/55 px-3 py-2 text-[9px] font-medium text-emerald-700">
          🟢 实时资讯已连接 · {news?.items?.length || 0} 条 · {news?.sources?.length || 0} 个来源 · 最新 {latest ? formatPublishedAt(latest) : "暂无可靠时间"} · {latest ? ageLabel(latest) : ""}
        </div>
        <div className="mt-1.5 truncate px-1 text-[8px] text-slate-400">来源：{sourceNames}</div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {FILTERS.map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition ${filter === item.id ? "bg-blue-500 text-white shadow-[0_4px_12px_rgba(59,130,246,.20)]" : "bg-white/72 text-slate-500 ring-1 ring-white/80"}`}>{item.label}</button>)}
        </div>
      </Glass>

      {visibleItems.length ? <div className="mt-2.5 space-y-2">
        {visibleItems.map((item, index) => <NewsCard key={`${item.id}-${item.source}`} item={item} insight={aiMap[item.id]} index={index} />)}
      </div> : <EmptyNote>{newsLoading ? "正在抓取资讯…" : "暂无可靠资讯，请稍后刷新"}</EmptyNote>}

      {filteredItems.length > VISIBLE_DEFAULT ? <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[18px] border border-white/80 bg-white/58 py-2.5 text-[10px] font-semibold text-slate-500 shadow-sm backdrop-blur-xl">{expanded ? "收起其余资讯" : `展开更多资讯（还有 ${filteredItems.length - VISIBLE_DEFAULT} 条）`}<ChevronDown className={`size-3.5 transition ${expanded ? "rotate-180" : ""}`} /></button> : null}

      <div className="mt-2 flex items-center justify-between px-1 text-[8px] text-slate-400"><span>{aiBusy ? "🤖 AI正在重新研判前5条资讯…" : "🤖 每条新闻独立判断，未被强行绑定持仓"}</span><button type="button" onClick={() => void runBatchAI(filteredItems.slice(0, VISIBLE_DEFAULT), snapshot, portfolio.map((p) => funds[p.code]?.name || p.name))} className="rounded-full bg-blue-50/75 px-2 py-1 font-semibold text-blue-600"><Sparkles className="mr-0.5 inline size-3" />重新解读</button></div>
    </div>
  );
}

function NewsCard({ item, insight, index }: { item: NewsItem; insight?: AiInsight; index: number }) {
  const aiTone = insight?.validation?.includes("已被行情验证") ? "border-emerald-200/70 bg-emerald-50/45" : insight?.relation === "暂无直接关联" ? "border-slate-200/80 bg-slate-50/60" : "border-blue-100/80 bg-blue-50/45";
  return <article className="overflow-hidden rounded-[22px] border border-white/80 bg-white/58 p-3 shadow-[0_12px_32px_rgba(38,78,112,.06)] backdrop-blur-[22px]">
    <div className="flex items-center gap-2 text-[9px] text-slate-400"><span className="font-medium text-slate-500">{item.source}</span><span>·</span><span>{formatPublishedAt(item.publishedAt)}</span><span className="ml-auto rounded-full bg-white/72 px-2 py-0.5 text-[8px]">{ageLabel(item.publishedAt)}</span></div>
    <div className="mt-1.5 flex items-start gap-2"><div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-slate-100/80 text-[9px] font-bold text-slate-400">{index + 1}</div><h2 className="min-w-0 flex-1 text-[14px] font-bold leading-[1.45] tracking-tight text-slate-900">{item.title}</h2></div>
    {item.summary ? <p className="mt-1 line-clamp-2 text-[10px] leading-[1.55] text-slate-500">{item.summary}</p> : null}
    <div className="mt-2 flex flex-wrap items-center gap-1.5"><span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${sentimentClass(item)}`}>{sentimentLabel(item)}</span>{item.relatedSectors.slice(0, 3).map((s) => <span key={s} className="rounded-full bg-white/72 px-2 py-0.5 text-[8px] text-slate-500 ring-1 ring-white/80">{s}</span>)}</div>
    <div className={`mt-2.5 rounded-[16px] border px-2.5 py-2.5 ${aiTone}`}>
      <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1 text-[10px] font-bold text-blue-700">🤖 AI解读</span><span className="text-[8px] text-slate-400">{insight?.importance ? `重要度 ${insight.importance}` : "当前证据"}</span></div>
      <p className="mt-1 text-[10px] font-medium leading-[1.55] text-slate-700">{insight?.text || "正在结合新闻主题、指数、板块与资金证据判断；没有可靠验证时不会强行下结论。"}</p>
      {insight ? <div className="mt-1.5 flex flex-wrap gap-1.5 text-[8px]"><span className="rounded-full bg-white/72 px-2 py-0.5 text-slate-500">{insight.relation}</span><span className="rounded-full bg-white/72 px-2 py-0.5 text-slate-500">{insight.validation}</span></div> : null}
    </div>
  </article>;
}
