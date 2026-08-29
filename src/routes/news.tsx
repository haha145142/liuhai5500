import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EmptyNote, Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { ageLabel, clockStr, formatPublishedAt } from "@/lib/format";
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

function NewsPage() {
  const news = useApp((s) => s.news);
  const newsLoading = useApp((s) => s.newsLoading);
  const refreshNews = useApp((s) => s.refreshNews);
  const portfolio = useApp((s) => s.portfolio);
  const funds = useApp((s) => s.funds);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [tab, setTab] = useState<"flash" | "deep" | "mood">("flash");

  const names = portfolio.map((p) => funds[p.code]?.name || p.name).filter(Boolean);

  const items = useMemo(() => {
    const src = tab === "deep" ? news?.deep : tab === "mood" ? news?.sentiment : news?.items;
    const list = src || [];
    if (filter === "all") return list;
    return list.filter((n) => n.category === filter);
  }, [news, filter, tab]);

  return (
    <div>
      <Glass>
        <SectionTitle
          title="市场资讯"
          hint={newsLoading ? "刷新中" : "真实发布时间"}
          right={
            <button type="button" onClick={() => void refreshNews()} className="text-xs font-semibold text-accent">
              刷新新闻
            </button>
          }
        />
        <p className="text-xs text-muted">
          {news
            ? `抓取于 ${clockStr(new Date(news.fetchedAt))} · 最新发布 ${news.latestPublishedAt ? formatPublishedAt(news.latestPublishedAt) : "时间未知"}`
            : "尚未抓取"}
        </p>
        <p className="mt-1 text-[11px] text-subtle">发布时间取自源站字段，不用抓取时间冒充「刚刚」。</p>
        <div className="mt-3 flex gap-1">
          {(["flash", "deep", "mood"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold ${tab === t ? "bg-accent text-accent-fg" : "bg-bg-elevated text-muted"}`}
            >
              {t === "flash" ? "快讯" : t === "deep" ? "深度" : "社区情绪"}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${filter === f.id ? "bg-fg text-bg" : "bg-bg-elevated text-muted"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Glass>

      {items.length ? (
        items.map((n) => <NewsCard key={n.id + n.source} item={n} holdings={names} />)
      ) : (
        <EmptyNote>{newsLoading ? "正在抓取资讯…" : "暂无可靠资讯，请稍后刷新"}</EmptyNote>
      )}

      {news ? (
        <p className="px-1 pb-2 text-[10px] text-subtle">
          源：{news.sources.map((s) => `${s.name} ${s.note}`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function NewsCard({ item, holdings }: { item: NewsItem; holdings: string[] }) {
  const hitHold = holdings.filter((n) => n && (item.title.includes(n.slice(0, 4)) || item.relatedSectors.some((s) => n.includes(s))));
  return (
    <article className="glass-tight mb-2 p-3">
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <span>{item.source}</span>
        <span>·</span>
        <span>{formatPublishedAt(item.publishedAt)}</span>
        <span className="ml-auto">{ageLabel(item.publishedAt)}</span>
      </div>
      <h3 className="mt-1 text-sm font-semibold leading-snug text-fg">{item.title}</h3>
      {item.summary ? <p className="mt-1 text-xs leading-relaxed text-muted">{item.summary}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Tone v={item.sentiment === "bull" ? 1 : item.sentiment === "bear" ? -1 : 0} className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold">
          {item.sentiment === "bull" ? "偏利好" : item.sentiment === "bear" ? "偏利空" : "中性"}
        </Tone>
        {item.relatedSectors.slice(0, 3).map((s) => (
          <span key={s} className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
            {s}
          </span>
        ))}
      </div>
      {hitHold.length ? (
        <p className="mt-2 rounded-xl bg-warn/10 px-2 py-1 text-[11px] font-semibold text-warn">可能关联持仓：{hitHold.join("、")}</p>
      ) : null}
    </article>
  );
}
