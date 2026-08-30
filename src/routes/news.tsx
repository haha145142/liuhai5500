import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EmptyNote, Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { ageLabel, clockStr, formatPublishedAt } from "@/lib/format";
import { analyzeNews } from "@/lib/data/server";
import { assessNewsEvidence } from "@/lib/calc/news-evidence";
import { useApp } from "@/lib/store";
import type { NewsItem } from "@/lib/types";

export const Route = createFileRoute("/news")({ component: NewsPage });

const FILTERS = [
  { id: "all", label: "全部" },
  { id: "policy", label: "政策" },
  { id: "market", label: "市场" },
  { id: "sector", label: "板块" },
  { id: "global", label: "外围" },
] as const;

const AI_CACHE_KEY = "fund_ai_pro_news_ai_v2";
const AI_CACHE_TTL = 10 * 60 * 1000;

function readAiCache() {
  if (typeof window === "undefined") return "";
  try {
    const raw = JSON.parse(sessionStorage.getItem(AI_CACHE_KEY) || "null") as { ts?: number; text?: string } | null;
    return raw?.text && raw.ts && Date.now() - raw.ts < AI_CACHE_TTL ? raw.text : "";
  } catch {
    return "";
  }
}

function writeAiCache(text: string) {
  try { sessionStorage.setItem(AI_CACHE_KEY, JSON.stringify({ ts: Date.now(), text })); } catch { /* local only */ }
}

function renderAiText(text: string) {
  return text.split("\n").map((line, i) => {
    const heading = /^【.+】$/.test(line.trim());
    return heading
      ? <div key={`${i}-${line}`} className="mt-3 first:mt-0 rounded-xl bg-accent/8 px-2.5 py-1.5 text-xs font-bold text-fg">{line}</div>
      : <p key={`${i}-${line}`} className="mt-1 text-sm leading-7 text-fg">{line || "\u00a0"}</p>;
  });
}

function normalizeTopic(s: string) {
  return s.replace(/基金|指数|行业|概念/g, "").trim().toLowerCase();
}

function newsTouchesHoldings(item: NewsItem, holdingNames: string[]) {
  const topics = item.relatedSectors.map(normalizeTopic).filter(Boolean);
  return holdingNames.some((name) => {
    const n = normalizeTopic(name);
    return topics.some((topic) => topic.length >= 2 && (n.includes(topic) || topic.includes(n.slice(0, 4))));
  });
}

function matchFundThemes(item: NewsItem, funds: Array<{ name: string; code: string }>) {
  const topics = item.relatedSectors.map(normalizeTopic).filter(Boolean);
  if (!topics.length) return [] as string[];
  return funds
    .filter((f) => {
      const name = normalizeTopic(f.name);
      return topics.some((topic) => topic.length >= 2 && (name.includes(topic) || topic.includes(name.slice(0, 4))));
    })
    .slice(0, 8)
    .map((f) => f.name);
}

function evidenceTone(validation?: string) {
  if (validation === "cross_checked") return "已交叉验证";
  if (validation === "single_source") return "部分验证";
  return "待验证";
}

function NewsPage() {
  const news = useApp((s) => s.news);
  const newsLoading = useApp((s) => s.newsLoading);
  const refreshNews = useApp((s) => s.refreshNews);
  const snapshot = useApp((s) => s.snapshot);
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [tab, setTab] = useState<"flash" | "deep" | "mood">("flash");
  const [aiText, setAiText] = useState(() => readAiCache());
  const [aiBusy, setAiBusy] = useState(false);

  const names = portfolio.map((p) => funds[p.code]?.name || p.name).filter(Boolean);
  const fundList = Object.values(funds).map((f) => ({ name: f.name, code: f.code }));

  const items = useMemo(() => {
    const src = tab === "deep" ? news?.deep : tab === "mood" ? news?.sentiment : news?.items;
    const list = src || [];
    if (filter === "all") return list;
    return list.filter((n) => n.category === filter);
  }, [news, filter, tab]);

  const runNewsAI = async () => {
    if (!items.length || aiBusy) return;
    setAiBusy(true);
    try {
      const evidence = items.slice(0, 10).map((n, i) => ({
        no: i + 1,
        title: n.title,
        summary: n.summary,
        source: n.source,
        publishedAt: n.publishedAt ? formatPublishedAt(n.publishedAt) : "暂无可靠时间",
        category: n.category,
        sentiment: n.sentiment,
        relatedSectors: n.relatedSectors,
      }));
      const holdingEvidence = names.length ? `我的持仓名称：${JSON.stringify(names.slice(0, 20))}` : "我的持仓：暂无可靠数据";
      const fundEvidence = fundList.length ? `当前已加载基金：${JSON.stringify(fundList.slice(0, 30))}` : "当前基金数据：暂无可靠数据";
      const prompt = [
        "请解读下面最新新闻。重点回答哪些新闻真正可能影响A股、影响哪个基金主题，以及影响逻辑。",
        "必须把‘新闻关联’和‘行情验证’分开：新闻提到某板块，不代表这个板块已经上涨，也不代表资金已经流入。",
        `新闻：${JSON.stringify(evidence)}`,
        holdingEvidence,
        fundEvidence,
        snapshot ? `指数：${JSON.stringify(snapshot.indices)}` : "指数：暂无可靠数据",
        snapshot ? `板块资金：${JSON.stringify(snapshot.sectors)}` : "板块资金：暂无可靠数据",
        snapshot ? `市场资金：${JSON.stringify(snapshot.flow)}` : "市场资金：暂无可靠数据",
        snapshot ? `外围：${JSON.stringify(snapshot.global)}` : "外围：暂无可靠数据",
        "只在现有证据支持时说‘验证成立’；新闻只有主题关联但没有行情/资金验证时，明确写‘事件关联，尚未验证趋势’。",
        "没有可靠发布时间时，不得称为最新；没有资金数据时，不得声称资金流入/流出；没有基金价格时，不得计算持仓影响金额。",
        "输出结构：\n【今日新闻结论】一句话总判断\n【最重要的新闻】按重要性列3—5条，每条包含：发生了什么｜影响哪个基金主题｜利好/利空/中性｜行情是否验证｜资金是否验证\n【基金主题影响】说明新闻涉及的基金主题，以及哪些已经得到行情验证；没有证据就写暂无可靠数据\n【与我的持仓关系】只在输入证据能支持时关联具体持仓，否则写暂无明显关联\n【后续观察】告诉我下一步需要盯什么数据\n【一句话提醒】普通投资者今天最应该关注什么。",
      ].join("\n");
      const r = await analyzeNews({ data: { prompt } });
      if (r.ok && r.text) {
        setAiText(r.text);
        writeAiCache(r.text);
      } else {
        setAiText(`AI 解读暂时不可用：${r.error}`);
      }
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div>
      <Glass>
        <SectionTitle
          title="市场资讯"
          hint={newsLoading ? "刷新中" : "真实发布时间"}
          right={<button type="button" onClick={() => void refreshNews()} className="text-xs font-semibold text-accent">刷新新闻</button>}
        />
        <p className="text-xs text-muted">
          {news ? `抓取于 ${clockStr(new Date(news.fetchedAt))} · 最新发布 ${news.latestPublishedAt ? formatPublishedAt(news.latestPublishedAt) : "时间未知"}` : "尚未抓取"}
        </p>
        <p className="mt-1 text-[11px] text-subtle">发布时间取自源站字段，不用抓取时间冒充「刚刚」。</p>
        <div className="mt-3 flex gap-1">
          {(["flash", "deep", "mood"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`flex-1 rounded-xl py-2 text-xs font-semibold ${tab === t ? "bg-accent text-accent-fg" : "bg-bg-elevated text-muted"}`}>
              {t === "flash" ? "快讯" : t === "deep" ? "深度" : "社区情绪"}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${filter === f.id ? "bg-fg text-bg" : "bg-bg-elevated text-muted"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </Glass>

      {items.length ? (
        <>
          <Glass className="mb-2 border border-accent/15">
            <SectionTitle title="AI解读新闻" hint="新闻 + 基金主题 + 行情 + 资金" />
            <p className="text-xs leading-relaxed text-muted">先判断新闻影响谁，再检查基金主题、指数和资金有没有实际验证。没有证据时不强行下结论。</p>
            <button type="button" onClick={() => void runNewsAI()} disabled={aiBusy} className="mt-3 w-full rounded-2xl bg-accent py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-60">
              {aiBusy ? "正在交叉分析新闻…" : aiText && !aiText.startsWith("AI 解读暂时不可用") ? "重新分析最新新闻" : "一键生成 AI 解读"}
            </button>
            {aiText ? <div className="mt-3 rounded-2xl bg-bg-elevated/80 p-3">{renderAiText(aiText)}</div> : null}
            {aiText && !aiBusy ? <p className="mt-2 text-[10px] text-subtle">AI 解读仅基于当前已获取证据；结果已在本次会话缓存约 10 分钟。</p> : null}
          </Glass>
          {items.map((n) => {
            const matchedFunds = matchFundThemes(n, fundList);
            const touched = matchedFunds.length > 0 || newsTouchesHoldings(n, names);
            return <NewsCard key={n.id + n.source} item={n} holdings={names} matchedFunds={matchedFunds} touched={touched} snapshot={snapshot} />;
          })}
        </>
      ) : (
        <EmptyNote>{newsLoading ? "正在抓取资讯…" : "暂无可靠资讯，请稍后刷新"}</EmptyNote>
      )}

      {news ? <p className="px-1 pb-2 text-[10px] text-subtle">源：{news.sources.map((s) => `${s.name} ${s.note}`).join(" · ")}</p> : null}
    </div>
  );
}

function NewsCard({ item, holdings, matchedFunds, touched, snapshot }: { item: NewsItem; holdings: string[]; matchedFunds: string[]; touched: boolean; snapshot: ReturnType<typeof useApp.getState>["snapshot"] }) {
  const hitHold = holdings.filter((n) => n && (item.title.includes(n.slice(0, 4)) || item.relatedSectors.some((s) => n.includes(s))));
  const hasSourceUrl = /^https?:\/\//i.test(item.url);
  const timeReliable = item.publishedAt != null;
  const signalLabel = item.sentiment === "bull" ? "偏利好" : item.sentiment === "bear" ? "偏利空" : "中性";
  const normalized = item.relatedSectors.map(normalizeTopic).filter(Boolean);
  const sector = snapshot?.sectors.find((s) => normalized.some((t) => t.length >= 2 && (normalizeTopic(s.name).includes(t) || t.includes(normalizeTopic(s.name).slice(0, 4)))));
  const evidence = assessNewsEvidence({
    publishedAt: item.publishedAt,
    sourceUrl: item.url,
    relatedSector: item.relatedSectors.length > 0,
    sectorPct: sector?.change ?? null,
    sectorValidation: sector?.validation,
    indexPct: snapshot?.indices.find((x) => x.pct != null)?.pct ?? null,
    moneyFlow: sector?.flow ?? snapshot?.flow?.main ?? null,
    hasFundQuote: matchedFunds.length > 0,
  });
  const evidenceReasons = [
    !evidence.checks.publishTime ? "缺可靠发布时间" : null,
    !evidence.checks.source ? "缺原文来源" : null,
    !evidence.checks.theme ? "未识别明确基金主题" : null,
    !evidence.checks.market ? "缺板块行情验证" : null,
    !evidence.checks.flow ? "缺资金验证" : null,
    !evidence.checks.fund ? "缺具体基金行情" : null,
  ].filter(Boolean) as string[];
  const tone = evidence.level === "verified" ? "bg-up/10 text-up" : evidence.level === "corroborated" ? "bg-accent/10 text-accent" : evidence.level === "event_only" ? "bg-warn/10 text-warn" : "bg-bg-elevated text-muted";
  return (
    <article className={`glass-tight mb-2 p-3 ${touched ? "ring-1 ring-accent/10" : ""}`}>
      <div className="flex items-center gap-2 text-[11px] text-muted"><span>{item.source}</span><span>·</span><span>{formatPublishedAt(item.publishedAt)}</span><span className="ml-auto">{ageLabel(item.publishedAt)}</span></div>
      <h3 className="mt-1 text-sm font-semibold leading-snug text-fg">{item.title}</h3>
      {item.summary ? <p className="mt-1 text-xs leading-relaxed text-muted">{item.summary}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Tone v={item.sentiment === "bull" ? 1 : item.sentiment === "bear" ? -1 : 0} className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold">{signalLabel}</Tone>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{evidence.label}</span>
        {item.relatedSectors.slice(0, 3).map((s) => <span key={s} className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">{s}</span>)}
        {timeReliable ? <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold text-muted">时间可信</span> : <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[10px] font-semibold text-warn">时间未知</span>}
        {matchedFunds.length ? <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">关联基金 {matchedFunds.length} 只</span> : null}
        {hasSourceUrl ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="ml-auto rounded-full bg-bg-elevated px-2.5 py-1 text-[10px] font-semibold text-accent">查看原文</a> : null}
      </div>
      {matchedFunds.length ? <p className="mt-2 rounded-xl bg-accent/8 px-2 py-1 text-[10.5px] leading-relaxed text-accent">相关基金：{matchedFunds.slice(0, 4).join("、")}</p> : null}
      {hitHold.length ? <p className="mt-2 rounded-xl bg-warn/10 px-2 py-1 text-[11px] font-semibold text-warn">可能关联持仓：{hitHold.join("、")}</p> : null}
      <div className="mt-2 rounded-xl bg-bg-elevated/65 px-2.5 py-2 text-[9.5px] leading-relaxed text-subtle">
        <div className="flex items-center justify-between gap-2"><span>{evidence.statement}</span><span className="shrink-0">{evidence.checks.market ? evidenceTone(evidence.checks.market ? sector?.validation : undefined) : "待验证"}</span></div>
        {evidenceReasons.length ? <div className="mt-1">尚缺：{evidenceReasons.join(" · ")}</div> : null}
      </div>
      <p className="mt-2 text-[9.5px] text-subtle">新闻情绪只表示文本倾向；是否真正影响行情，需要指数、基金涨跌和资金数据进一步验证。</p>
    </article>
  );
}
