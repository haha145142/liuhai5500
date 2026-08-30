import { createServerFn } from "@tanstack/react-start";
import { asArr, fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { GLOBAL_DEFS, INDEX_DEFS, SECTOR_RULES } from "./sectors";
import { calcIndicators } from "../calc/indicators";
import type { BoardQuote, DataSource, FundHistoryPoint, FundQuote, GlobalQuote, IndexQuote, MarketOrder, NewsFeed, NewsItem, RankRow, SectorQuote, Snapshot } from "../types";
import { safeText } from "../format";

const EM_UT = "fa5fd1943c7b386f172d6893dbfba10b";
const EM_REFERER = "https://quote.eastmoney.com/";
type CacheEntry<T> = { ts: number; data: T };
const mem = new Map<string, CacheEntry<unknown>>();
function cached<T>(key: string, ttl: number, data: T | null): T | null { if (data) mem.set(key, { ts: Date.now(), data }); const hit = mem.get(key) as CacheEntry<T> | undefined; if (hit && Date.now() - hit.ts < ttl) return hit.data; return data; }
function src(name: string, ok: boolean, note: string): DataSource { return { name, status: ok ? "ok" : "err", note }; }
async function emJson(url: string, timeout = 10000): Promise<unknown> { return parseMaybeJsonp(await fetchText(url, timeout, { Referer: EM_REFERER })); }

function quoteConsistent(a: IndexQuote, b: IndexQuote): boolean {
  if (a.pct == null || b.pct == null) return false;
  return Math.abs(a.pct - b.pct) <= 0.35 && (a.price == null || b.price == null || a.price === 0 || Math.abs(a.price - b.price) / Math.abs(a.price) <= 0.004);
}

async function fetchIndices(): Promise<{ list: IndexQuote[]; source: DataSource; validation: Snapshot["validation"] }> {
  const secids = INDEX_DEFS.map((x) => x.secid).join(",");
  let em: IndexQuote[] | null = null;
  try {
    const j = (await emJson(`https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f12,f14,f2,f3,f4&secids=${secids}&ut=${EM_UT}&_=${Date.now()}`)) as { data?: { diff?: unknown } };
    const arr = asArr(j?.data?.diff);
    const list = INDEX_DEFS.map((d) => { const x = arr.find((v) => String(v.f12) === d.code) || {}; return { name: d.name, code: d.code, secid: d.secid, price: n(x.f2), pct: n(x.f3), change: n(x.f4) }; });
    if (list.some((x) => x.pct != null)) em = list;
  } catch {}
  let tq: IndexQuote[] | null = null;
  try {
    const codes = ["sh000001", "sz399001", "sz399006", "sh000688"];
    const lines = (await fetchText(`https://qt.gtimg.cn/q=${codes.join(",")}`, 8000)).split(";");
    const list = INDEX_DEFS.map((d, i) => { const m = (lines[i] || "").match(/=\"([^\"]*)\"/); const p = m ? m[1].split("~") : []; return { name: d.name, code: d.code, secid: d.secid, price: n(p[3]), pct: n(p[32]), change: n(p[31]) }; });
    if (list.some((x) => x.pct != null)) tq = list;
  } catch {}
  if (em && tq) {
    const checked = em.map((e, i) => quoteConsistent(e, tq?.[i] ?? e) ? e : (tq?.[i] ?? e));
    const allOk = em.every((e, i) => quoteConsistent(e, tq?.[i] ?? e));
    return { list: checked, source: src("指数", true, allOk ? "东方财富 + 腾讯财经交叉验证" : "双源有分歧，采用可用值并标记谨慎"), validation: allOk ? "cross_checked" : "single_source" };
  }
  if (em) return { list: em, source: src("指数", true, "东方财富实时行情"), validation: "single_source" };
  if (tq) return { list: tq, source: src("指数", true, "腾讯财经兜底"), validation: "single_source" };
  return { list: INDEX_DEFS.map((d) => ({ name: d.name, code: d.code, secid: d.secid, price: null, pct: null, change: null })), source: src("指数", false, "数据源暂不可用"), validation: "cached_latest_trading_day" };
}

async function fetchBoards(): Promise<{ sectors: SectorQuote[]; boards: BoardQuote[]; source: DataSource }> {
  const fields = "f12,f14,f2,f3,f62,f66,f69,f72,f75,f6";
  async function clist(fs: string, type: "industry" | "concept") {
    const j = (await emJson(`https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=80&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(fs)}&fields=${fields}&ut=${EM_UT}&_=${Date.now()}`, 12000)) as { data?: { diff?: unknown } };
    return asArr(j?.data?.diff).map((x) => ({ code: String(x.f12 || ""), name: String(x.f14 || ""), type, change: n(x.f3), flow: n(x.f62), largeOrder: n(x.f69), extraLarge: n(x.f66), mid: n(x.f72), small: n(x.f75), turnover: n(x.f6) }));
  }
  try {
    const [ind, con] = await Promise.all([clist("m:90+t:2", "industry"), clist("m:90+t:3", "concept")]);
    const all = [...ind, ...con];
    const boards = all.filter((x) => x.name && x.change != null).map((x) => ({ code: x.code, name: x.name, type: x.type, change: x.change, flow: x.flow }));
    const sectors = SECTOR_RULES.map((r) => { const hit = all.find((x) => x.code === r.bkCode) || all.find((x) => x.name === r.name) || all.find((x) => r.searchKeys.some((k) => x.name.includes(k))); return { id: r.id, name: r.name, bkCode: r.bkCode, change: hit?.change ?? null, flow: hit?.flow ?? null, super: hit?.extraLarge ?? null, large: hit?.largeOrder ?? null, mid: hit?.mid ?? null, small: hit?.small ?? null, turnover: hit?.turnover ?? null, available: hit?.change != null, streak: 0, etfCode: r.etf?.code, etfName: r.etf?.name, validation: hit?.change != null ? "single_source" as const : "unavailable" as const }; });
    return { sectors, boards: boards.sort((a, b) => (b.change ?? -999) - (a.change ?? -999)), source: src("板块", sectors.some((s) => s.available), "东方财富板块资金") };
  } catch {
    return { sectors: SECTOR_RULES.map((r) => ({ id: r.id, name: r.name, bkCode: r.bkCode, change: null, flow: null, super: null, large: null, mid: null, small: null, turnover: null, available: false, streak: 0, etfCode: r.etf?.code, etfName: r.etf?.name, validation: "unavailable" as const })), boards: [], source: src("板块", false, "数据源暂不可用") };
  }
}

async function fetchFlow(): Promise<{ flow: MarketOrder | null; source: DataSource }> {
  try {
    const j = (await emJson(`https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=400&po=1&np=1&fltt=2&invt=2&fid=f62&fs=${encodeURIComponent("m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23")}&fields=f62,f66,f69,f72,f75&ut=${EM_UT}&_=${Date.now()}`, 12000)) as { data?: { diff?: unknown } };
    const arr = asArr(j?.data?.diff); if (!arr.length) throw new Error("empty");
    const sum = (k: string) => arr.reduce((s, x) => s + (n(x[k]) || 0), 0);
    const mainFlow = sum("f62"); const extraLargeFlow = sum("f66"); const largeFlow = sum("f69"); const midFlow = sum("f72"); const smallFlow = sum("f75");
    const gap = Math.abs(mainFlow - (extraLargeFlow + largeFlow));
    const consistent = gap <= Math.max(50_000_000, Math.abs(mainFlow) * 0.12);
    return { flow: { main: mainFlow, super: extraLargeFlow, large: largeFlow, mid: midFlow, small: smallFlow, count: arr.length }, source: src("资金", true, `东方财富全A抽样 ${arr.length} 只 · ${consistent ? "主力口径一致" : "主力与大单拆分存在偏差"}`) };
  } catch { return { flow: null, source: src("资金", false, "数据源暂不可用") }; }
}

async function fetchGlobal(): Promise<{ list: GlobalQuote[]; source: DataSource }> {
  try {
    const q = GLOBAL_DEFS.map((x) => x.tencent).join(",");
    const chunks = (await fetchText(`https://qt.gtimg.cn/q=${q}`, 8000)).split(";");
    const list = GLOBAL_DEFS.map((d, i) => { const m = (chunks[i] || "").match(/=\"([^\"]*)\"/); const p = m ? m[1].split("~") : []; return { name: d.name, price: n(p[3]), pct: n(p[32]) ?? n(p[31]) }; });
    return { list, source: src("外围", list.some((x) => x.pct != null), "腾讯财经") };
  } catch { return { list: [], source: src("外围", false, "数据源暂不可用") }; }
}

export const getSnapshot = createServerFn({ method: "GET" }).handler(async (): Promise<Snapshot> => {
  const weekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  const ttl = weekend ? 7 * 24 * 60 * 60 * 1000 : 20_000;
  const hit = cached<Snapshot>("snap", ttl, null); if (hit) return hit;
  const [idx, boards, flow, global] = await Promise.all([fetchIndices(), fetchBoards(), fetchFlow(), fetchGlobal()]);
  const anyMarket = idx.list.some((x) => x.pct != null) || boards.sectors.some((x) => x.change != null) || !!flow.flow;
  const validation: Snapshot["validation"] = weekend ? "cached_latest_trading_day" : idx.validation === "cross_checked" && anyMarket ? "cross_checked" : anyMarket ? "single_source" : "cached_latest_trading_day";
  const marketDate = weekend ? tradingDateLabel() : new Date().toISOString().slice(0, 10);
  return cached("snap", ttl, { indices: idx.list, sectors: boards.sectors, boards: boards.boards.slice(0, 40), flow: flow.flow, global: global.list, sources: [idx.source, boards.source, flow.source, global.source], fetchedAt: Date.now(), marketDate, validation })!;
});

function hashId(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); }
function classifyNews(title: string): NewsItem["category"] { if (/政策|国务院|央行|财政部|证监会|发改委|降准|降息|LPR/.test(title)) return "policy"; if (/美股|美联储|美元|黄金|原油|纳指|标普|港股|恒生|外围/.test(title)) return "global"; if (/半导体|芯片|白酒|新能源|军工|医药|人工智能|机器人/.test(title)) return "sector"; if (/A股|上证|深成|创业板|大盘|北向|成交/.test(title)) return "market"; return "other"; }
function newsSentiment(title: string): NewsItem["sentiment"] { if (/涨|升|新高|流入|利好|突破|反弹|超预期/.test(title)) return "bull"; if (/跌|崩|跳水|利空|制裁|冲突|暴雷|处罚|下滑/.test(title)) return "bear"; return "neutral"; }
function relatedSectors(title: string): string[] { return SECTOR_RULES.filter((r) => r.keys.some((k) => title.includes(k))).map((r) => r.name); }
function parsePublished(raw: unknown): number | null { if (raw == null || raw === "") return null; if (typeof raw === "number") { if (raw > 1e12) return raw; if (raw > 1e9) return raw * 1000; return null; } const s = String(raw).trim(); if (!s || /刚刚|刚才|刚刚发布/.test(s)) return null; if (/^\d{10,13}$/.test(s)) { const n0 = Number(s); return s.length === 10 ? n0 * 1000 : n0; } const iso = Date.parse(s.replace(/-/g, "/")); return Number.isFinite(iso) && iso > 0 ? iso : null; }
function toNews(title: string, summary: string, source: string, publishedAt: number | null, url: string, fetchedAt: number): NewsItem | null { const t = safeText(title); if (!t) return null; return { id: hashId(source + t), title: t, summary: safeText(summary).slice(0, 180), source, url, publishedAt, fetchedAt, category: classifyNews(t), sentiment: newsSentiment(t), relatedSectors: relatedSectors(t) }; }
async function fetchTHS(fetchedAt: number): Promise<NewsItem[]> { try { const j = (await emJson("https://news.10jqka.com.cn/tapp/news/push/stock/?page=1&pagesize=40&track=website", 10000)) as { data?: { list?: Record<string, unknown>[] } }; return (j?.data?.list || []).map((x) => toNews(String(x.title || ""), String(x.digest || x.summary || ""), "同花顺", parsePublished(x.ctime), String(x.url || ""), fetchedAt)).filter((x): x is NewsItem => !!x); } catch { return []; } }
async function fetchEmFlash(fetchedAt: number): Promise<NewsItem[]> { try { const j = (await emJson(`https://np-listapi.eastmoney.com/comm/web/getFastNewsList?client=web&biz=web_724&fastColumn=102&sortEnd=&pageSize=30&type=0&_=${Date.now()}`, 10000)) as { data?: { fastNewsList?: Record<string, unknown>[] } }; return (j?.data?.fastNewsList || []).map((x) => toNews(String(x.title || x.showTitle || ""), String(x.digest || x.summary || ""), "东方财富快讯", parsePublished(x.showTime || x.date || x.time), String(x.url || x.code_name || ""), fetchedAt)).filter((x): x is NewsItem => !!x); } catch { return []; } }
async function fetchWscn(fetchedAt: number): Promise<NewsItem[]> { try { const j = (await emJson("https://api-one-wscn.awtmt.com/apiv1/content/lives?channel=global-channel&client=pc&limit=20", 10000)) as { data?: { items?: Record<string, unknown>[] } }; return (j?.data?.items || []).map((x) => toNews(String(x.title || x.content_text || "").slice(0, 80), String(x.content_text || x.content || ""), "华尔街见闻", parsePublished(x.display_time || x.created_at), String(x.uri || x.url || ""), fetchedAt)).filter((x): x is NewsItem => !!x); } catch { return []; } }
async function fetchGuba(fetchedAt: number): Promise<NewsItem[]> { try { const j = (await emJson("https://guba.eastmoney.com/interface/GetData.aspx?path=topics/hotlist&param=ps=15&p=1", 8000)) as { re?: Record<string, unknown>[] } | Record<string, unknown>[]; const list = Array.isArray(j) ? j : (j as { re?: Record<string, unknown>[] })?.re || []; return list.map((x) => toNews(String(x.title || x.post_title || ""), "股吧热帖 · 社区情绪，非官方新闻", "东方财富股吧", parsePublished(x.post_publish_time || x.time), String(x.post_url || ""), fetchedAt)).filter((x): x is NewsItem => !!x); } catch { return []; } }

export const getNews = createServerFn({ method: "GET" }).handler(async (): Promise<NewsFeed> => {
  const hit = cached<NewsFeed>("news", 180_000, null); if (hit) return hit;
  const fetchedAt = Date.now(); const [ths, em, wscn, guba] = await Promise.all([fetchTHS(fetchedAt), fetchEmFlash(fetchedAt), fetchWscn(fetchedAt), fetchGuba(fetchedAt)]);
  const seen = new Set<string>(); const items: NewsItem[] = [];
  for (const item of [...ths, ...em, ...wscn]) { if (seen.has(item.title)) continue; seen.add(item.title); items.push(item); }
  items.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  const sentiment = [...items].sort((a, b) => (a.sentiment === "bull" ? -1 : a.sentiment === "bear" ? 1 : 0) - (b.sentiment === "bull" ? -1 : b.sentiment === "bear" ? 1 : 0));
  return cached("news", 180_000, { items: items.slice(0, 100), deep: items.slice(0, 30), sentiment: [...sentiment, ...guba].slice(0, 60), sources: [src("同花顺", ths.length > 0, "原始发布时间"), src("东方财富快讯", em.length > 0, "原始发布时间"), src("华尔街见闻", wscn.length > 0, "原始发布时间"), src("东方财富股吧", guba.length > 0, "社区内容")], fetchedAt, latestPublishedAt: items.find((x) => x.publishedAt != null)?.publishedAt ?? null })!;
});

function parseFundHistory(raw: unknown): FundHistoryPoint[] {
  const arr = asArr(raw); return arr.map((x) => { const parts = String(x).split(","); return { date: parts[0] || "", nav: n(parts[1]) ?? 0, changePct: n(parts[3]); } as FundHistoryPoint; }).filter((x) => x.date && x.nav > 0);
}

export const getFund = createServerFn({ method: "POST" }).validator((input: { code: string }) => input).handler(async ({ data }): Promise<FundQuote> => {
  const code = data.code.trim();
  const hit = cached<FundQuote>(`fund:${code}`, 20_000, null); if (hit) return hit;
  const raw = await fetchText(`https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`, 8000, { Referer: "https://fund.eastmoney.com/" });
  const gz = parseMaybeJsonp(raw) as Record<string, unknown> | null;
  const nav = gz ? n(gz.dwjz) : null; const estimate = gz ? n(gz.gsz) : null; const estimatePct = gz ? n(gz.gszzl) : null; const navDate = gz ? String(gz.jzrq || "") : null; const estimateTime = gz ? String(gz.gztime || "") : null; const name = gz ? String(gz.name || code) : code;
  const historyText = await fetchText(`https://api.fund.eastmoney.com/f10/lsjz?fundcode=${code}&pageIndex=1&pageSize=300`, 10000, { Referer: "https://fund.eastmoney.com/" }).catch(() => "");
  const historyJson = historyText ? parseMaybeJsonp(historyText) as { Data?: { LSJZList?: Record<string, unknown>[] } } : null;
  const points = historyJson?.Data?.LSJZList?.map((x) => ({ date: String(x.FSRQ || ""), nav: n(x.DWJZ) ?? 0, changePct: n(x.JZZZL) }))?.filter((x) => x.date && x.nav > 0) ?? [];
  const history = points.map((x) => x.nav).reverse();
  const dayPct = n(gz?.gszzl) ?? n(points[0]?.changePct);
  const metrics = calcIndicators(history);
  const result: FundQuote = { code, name, type: String(gz?.fundtype || "基金"), nav, navDate, estimate, estimatePct, estimateTime, dayPct, weekPct: null, monthPct: null, history, historyPoints: points.reverse(), metrics, source: "天天基金估值 + 东方财富历史净值", officialNavPublished: false, valuationStatus: estimate != null ? "estimate" : nav != null ? "official_nav" : "unavailable", estimateConfidence: estimate != null && nav != null ? "medium" : "low" };
  return cached(`fund:${code}`, 20_000, result)!;
});

export const getRankings = createServerFn({ method: "GET" }).handler(async (): Promise<RankRow[]> => []);
export { calcIndicators };
