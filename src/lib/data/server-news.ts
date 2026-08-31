import { createServerFn } from "@tanstack/react-start";
import { asArr, fetchText, parseMaybeJsonp } from "./fetch-util";
import { safeText } from "../format";
import type { DataSource, NewsFeed, NewsItem } from "../types";
import { dedupeNews } from "./news-quality";

let cached: { ts: number; data: NewsFeed } | null = null;
const TTL = 180_000;

function source(name: string, ok: boolean, note: string): DataSource { return { name, status: ok ? "ok" : "err", note }; }
function published(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v > 1e12 ? v : v > 1e9 ? v * 1000 : null;
  const d = Date.parse(String(v).replace(/-/g, "/"));
  return Number.isFinite(d) ? d : null;
}
function makeId(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); }
function toNews(title: string, summary: string, name: string, ts: number | null, url: string, fetchedAt: number): NewsItem | null {
  const t = safeText(title); if (!t) return null;
  const category = /政策|国务院|央行|财政部|证监会/.test(t) ? "policy" : /美股|美联储|美元|黄金|原油|港股|恒生/.test(t) ? "global" : /半导体|芯片|白酒|新能源|军工|医药|人工智能|机器人/.test(t) ? "sector" : /A股|上证|深成|创业板|大盘/.test(t) ? "market" : "other";
  const sentiment = /涨|新高|流入|利好|突破|反弹|超预期/.test(t) ? "bull" : /跌|跳水|利空|制裁|冲突|暴雷|处罚|下滑/.test(t) ? "bear" : "neutral";
  return { id: makeId(name + t), title: t, summary: safeText(summary).slice(0, 180), source: name, url, publishedAt: ts, fetchedAt, category: category as NewsItem["category"], sentiment: sentiment as NewsItem["sentiment"], relatedSectors: [] };
}
async function em(url: string, timeout = 9000) { return parseMaybeJsonp(await fetchText(url, timeout, { Referer: "https://quote.eastmoney.com/" })); }
async function newsSource(url: string, name: string, extract: (x: any) => NewsItem | null, fetchedAt: number) {
  try {
    const j = await em(url) as any;
    const arr = j?.data?.list || j?.data?.fastNewsList || j?.data?.items || j?.re || [];
    return asArr(arr).map(extract).filter((x): x is NewsItem => !!x);
  } catch { return []; }
}

export const getNews = createServerFn({ method: "GET" }).handler(async (): Promise<NewsFeed> => {
  if (cached && Date.now() - cached.ts < TTL) return cached.data;
  const t = Date.now();
  const [a, b, c] = await Promise.all([
    newsSource("https://news.10jqka.com.cn/tapp/news/push/stock/?page=1&pagesize=40&track=website", "同花顺", x => toNews(String(x.title || ""), String(x.digest || x.summary || ""), "同花顺", published(x.ctime), String(x.url || ""), t), t),
    newsSource(`https://np-listapi.eastmoney.com/comm/web/getFastNewsList?client=web&biz=web_724&fastColumn=102&pageSize=30&type=0&_=${Date.now()}`, "东方财富快讯", x => toNews(String(x.title || x.showTitle || ""), String(x.digest || x.summary || ""), "东方财富快讯", published(x.showTime || x.date || x.time), String(x.url || ""), t), t),
    newsSource("https://api-one-wscn.awtmt.com/apiv1/content/lives?channel=global-channel&client=pc&limit=20", "华尔街见闻", x => toNews(String(x.title || x.content_text || "").slice(0, 80), String(x.content_text || x.content || ""), "华尔街见闻", published(x.display_time || x.created_at), String(x.uri || x.url || ""), t), t),
  ]);
  const items = dedupeNews([...a, ...b, ...c]).slice(0, 100);
  const data: NewsFeed = {
    items,
    deep: items.slice(0, 30),
    sentiment: items.slice(0, 60),
    sources: [source("同花顺", a.length > 0, "保留原始发布时间"), source("东方财富快讯", b.length > 0, "保留原始发布时间"), source("华尔街见闻", c.length > 0, "保留原始发布时间")],
    fetchedAt: t,
    latestPublishedAt: items.find(x => x.publishedAt != null)?.publishedAt ?? null,
  };
  if (items.length) cached = { ts: t, data };
  return data;
});
