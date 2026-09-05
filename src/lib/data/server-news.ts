import { createServerFn } from "@tanstack/react-start";
import { createHash } from "node:crypto";
import { asArr, fetchText, parseMaybeJsonp } from "./fetch-util";
import { safeText } from "../format";
import type { DataSource, NewsFeed, NewsItem } from "../types";
import { dedupeNews } from "./news-quality";
import { sharedCacheGet, sharedCacheSet } from "./shared-cache";

let cached: { ts: number; data: NewsFeed } | null = null;
const TTL = 180_000;
const SHARED_TTL = 180_000;
const UA = "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 Chrome/126 Safari/537.36";

function source(name: string, ok: boolean, note: string): DataSource { return { name, status: ok ? "ok" : "err", note }; }
function published(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v > 1e12 ? v : v > 1e9 ? v * 1000 : v > 1e6 ? v * 1000 : null;
  const n = Number(v); if (Number.isFinite(n)) return n > 1e12 ? n : n > 1e9 ? n * 1000 : n > 1e6 ? n * 1000 : null;
  const d = Date.parse(String(v).replace(/-/g, "/")); return Number.isFinite(d) ? d : null;
}
function makeId(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); }
function stripHtml(v: unknown) { return safeText(String(v ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ")); }
function inferSectors(text: string) {
  const rules: Array<[string, string[]]> = [["人工智能", ["人工智能", "AI", "大模型", "算力", "英伟达", "OpenAI", "Anthropic"]], ["半导体", ["半导体", "芯片", "晶圆", "光刻", "存储", "封装", "设备"]], ["新能源", ["新能源", "锂电", "电池", "光伏", "储能", "风电"]], ["机器人", ["机器人", "人形机器人", "工业机器人"]], ["医药", ["医药", "创新药", "医疗", "药企"]], ["军工", ["军工", "航天", "航空", "导弹"]], ["黄金", ["黄金", "贵金属", "金价"]], ["白酒", ["白酒", "贵州茅台", "五粮液"]], ["港股", ["港股", "恒生", "恒生科技"]]];
  const hay = text.toLowerCase(); return rules.filter(([, keys]) => keys.some((k) => hay.includes(k.toLowerCase()))).map(([name]) => name).slice(0, 4);
}
function toNews(title: string, summary: string, name: string, ts: number | null, url: string, fetchedAt: number): NewsItem | null {
  const t = safeText(title); if (!t) return null; const s = stripHtml(summary).slice(0, 220); const full = `${t} ${s}`;
  const category = /政策|国务院|央行|财政部|证监会|商务部|发改委/.test(full) ? "policy" : /GDP|CPI|PPI|PMI|通胀|就业|非农|失业率|利率|降息|加息|经济数据|宏观经济|经济增长|衰退|制造业数据|服务业数据/.test(full) ? "macro" : /美股|美联储|美元|黄金|原油|港股|恒生|纳指|标普/.test(full) ? "global" : /半导体|芯片|白酒|新能源|军工|医药|人工智能|机器人|光伏|储能/.test(full) ? "sector" : /A股|上证|深成|创业板|大盘|沪深300/.test(full) ? "market" : "other";
  const sentiment = /上涨|新高|净流入|利好|突破|反弹|超预期|增长|上调/.test(t) ? "bull" : /下跌|跳水|净流出|利空|制裁|冲突|暴雷|处罚|下滑|下调/.test(t) ? "bear" : "neutral";
  return { id: makeId(name + t + String(ts ?? "")), title: t, summary: s, source: name, url, publishedAt: ts, fetchedAt, category: category as NewsItem["category"], sentiment: sentiment as NewsItem["sentiment"], relatedSectors: inferSectors(full) };
}
async function json(url: string, timeout = 9000, headers: Record<string, string> = {}) { return parseMaybeJsonp(await fetchText(url, timeout, { "User-Agent": UA, ...headers })); }

async function fetchTHS(fetchedAt: number): Promise<NewsItem[]> { const url = "https://news.10jqka.com.cn/tapp/news/push/stock/?page=1&pagesize=50&track=website"; try { const j = await json(url, 9000, { Referer: "https://news.10jqka.com.cn/", Accept: "application/json,text/plain,*/*" }) as any; const arr = asArr(j?.data?.list || j?.data?.news || j?.list || j?.re || j?.data || []); return arr.map((x: any) => toNews(String(x.title || x.showTitle || ""), String(x.digest || x.summary || x.content || ""), "同花顺", published(x.ctime || x.time || x.publish_time), String(x.url || x.link || ""), fetchedAt)).filter((x): x is NewsItem => !!x); } catch { return []; } }
async function fetchJin10(fetchedAt: number): Promise<NewsItem[]> { const url = "https://flash-api.jin10.com/get_flash_list?channel=-8200&vip=1"; try { const j = await json(url, 9000, { "x-app-id": "bVBF4FyRTn5NJF5n", "x-version": "1.0.0", Referer: "https://www.jin10.com/", Origin: "https://www.jin10.com" }) as any; const arr = asArr(j?.data || []); return arr.filter((x: any) => x?.type !== 1).map((x: any) => { const content = stripHtml(x?.data?.content || x?.data?.description || ""); const title = safeText(x?.data?.title || (content.match(/〖(.+?)〗/)?.[1] ?? content.slice(0, 80))); return toNews(title, content, "金十数据", published(x?.time || x?.timestamp), String(x?.data?.link || "https://www.jin10.com/flash"), fetchedAt); }).filter((x): x is NewsItem => !!x); } catch { return []; } }
function clsSign(params: URLSearchParams) { params.sort(); const qs = params.toString(); const sha1 = createHash("sha1").update(qs).digest("hex"); return createHash("md5").update(sha1).digest("hex"); }
async function fetchCLS(fetchedAt: number): Promise<NewsItem[]> { const params = new URLSearchParams({ appName: "CailianpressWeb", os: "web", sv: "7.7.5", last_time: "", refresh_type: "1", rn: "50" }); const sign = clsSign(params); const url = `https://www.cls.cn/v1/roll/get_roll_list?${params.toString()}&sign=${sign}`; try { const j = await json(url, 9000, { Referer: "https://www.cls.cn/", Accept: "application/json,text/plain,*/*" }) as any; const arr = asArr(j?.data?.roll_data || j?.data?.data || j?.roll_data || []); return arr.map((x: any) => toNews(String(x.title || x.brief || ""), String(x.content || x.brief || ""), "财联社", published(x.ctime || x.time), "https://www.cls.cn/", fetchedAt)).filter((x): x is NewsItem => !!x); } catch { return []; } }

export const getNews = createServerFn({ method: "GET" }).handler(async (): Promise<NewsFeed> => {
  if (cached && Date.now() - cached.ts < TTL) return cached.data;
  const shared = await sharedCacheGet<NewsFeed>("fund-ai-pro:news");
  if (shared?.value && Date.now() - shared.savedAt < SHARED_TTL) { cached = { ts: Date.now(), data: shared.value }; return shared.value; }
  const t = Date.now();
  const [a, b, c] = await Promise.all([fetchTHS(t), fetchJin10(t), fetchCLS(t)]);
  const items = dedupeNews([...a, ...b, ...c]).sort((x, y) => (y.publishedAt ?? 0) - (x.publishedAt ?? 0)).slice(0, 120);
  const data: NewsFeed = { items, deep: items.filter((x) => x.category !== "other").slice(0, 40), sentiment: items.slice(0, 60), sources: [source("同花顺", a.length > 0, "财经快讯 · 保留原始发布时间"), source("金十数据", b.length > 0, "全球财经快讯 · 保留原始发布时间"), source("财联社", c.length > 0, "A股财经电报 · 保留原始发布时间")], fetchedAt: t, latestPublishedAt: items.find((x) => x.publishedAt != null)?.publishedAt ?? null };
  if (items.length) { cached = { ts: t, data }; await sharedCacheSet("fund-ai-pro:news", data, SHARED_TTL); }
  return data;
});
