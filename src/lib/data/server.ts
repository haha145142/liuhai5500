import { createServerFn } from "@tanstack/react-start";
import { asArr, fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { GLOBAL_DEFS, INDEX_DEFS, SECTOR_RULES } from "./sectors";
import { calcIndicators } from "../calc/indicators";
import type {
  BoardQuote,
  DataSource,
  FundHistoryPoint,
  FundQuote,
  GlobalQuote,
  IndexQuote,
  MarketOrder,
  NewsFeed,
  NewsItem,
  RankRow,
  SectorQuote,
  Snapshot,
} from "../types";
import { safeText } from "../format";

const EM_UT = "fa5fd1943c7b386f172d6893dbfba10b";
const EM_REFERER = "https://quote.eastmoney.com/";

type CacheEntry<T> = { ts: number; data: T };
const mem = new Map<string, CacheEntry<unknown>>();

function cached<T>(key: string, ttl: number, data: T | null): T | null {
  if (data) mem.set(key, { ts: Date.now(), data });
  const hit = mem.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.ts < ttl) return hit.data;
  return data;
}

function src(name: string, ok: boolean, note: string): DataSource {
  return { name, status: ok ? "ok" : "err", note };
}

async function emJson(url: string, timeout = 10000): Promise<unknown> {
  const text = await fetchText(url, timeout, { Referer: EM_REFERER });
  return parseMaybeJsonp(text);
}

async function fetchIndices(): Promise<{ list: IndexQuote[]; source: DataSource }> {
  const secids = INDEX_DEFS.map((x) => x.secid).join(",");
  try {
    const j = (await emJson(
      `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f12,f14,f2,f3,f4&secids=${secids}&ut=${EM_UT}&_=${Date.now()}`,
    )) as { data?: { diff?: unknown } };
    const arr = asArr(j?.data?.diff);
    if (arr.length) {
      const list = INDEX_DEFS.map((d) => {
        const x = arr.find((v) => String(v.f12) === d.code) || {};
        return { name: d.name, code: d.code, secid: d.secid, price: n(x.f2), pct: n(x.f3), change: n(x.f4) };
      });
      if (list.some((x) => x.pct != null)) return { list, source: src("指数", true, "东方财富实时行情") };
    }
  } catch { /* fallback */ }
  try {
    const codes = ["sh000001", "sz399001", "sz399006", "sh000688"];
    const text = await fetchText(`https://qt.gtimg.cn/q=${codes.join(",")}`, 8000);
    const lines = text.split(";");
    const list: IndexQuote[] = INDEX_DEFS.map((d, i) => {
      const line = lines[i] || "";
      const m = line.match(/="([^"]*)"/);
      const p = m ? m[1].split("~") : [];
      return { name: d.name, code: d.code, secid: d.secid, price: n(p[3]), pct: n(p[32]), change: n(p[31]) };
    });
    return { list, source: src("指数", list.some((x) => x.pct != null), "腾讯财经兜底") };
  } catch {
    return { list: INDEX_DEFS.map((d) => ({ name: d.name, code: d.code, secid: d.secid, price: null, pct: null, change: null })), source: src("指数", false, "数据源暂不可用") };
  }
}

async function fetchBoards(): Promise<{ sectors: SectorQuote[]; boards: BoardQuote[]; source: DataSource }> {
  const fields = "f12,f14,f2,f3,f62,f66,f69,f72,f75,f6";
  async function clist(fs: string, type: "industry" | "concept") {
    const j = (await emJson(
      `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=80&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(fs)}&fields=${fields}&ut=${EM_UT}&_=${Date.now()}`,
      12000,
    )) as { data?: { diff?: unknown } };
    return asArr(j?.data?.diff).map((x) => ({ code: String(x.f12 || ""), name: String(x.f14 || ""), type, change: n(x.f3), flow: n(x.f62), super: n(x.f66), large: n(x.f69), mid: n(x.f72), small: n(x.f75), turnover: n(x.f6) }));
  }
  try {
    const [ind, con] = await Promise.all([clist("m:90+t:2", "industry"), clist("m:90+t:3", "concept")]);
    const all = [...ind, ...con];
    const boards: BoardQuote[] = all.filter((x) => x.name && x.change != null).map((x) => ({ code: x.code, name: x.name, type: x.type, change: x.change, flow: x.flow }));
    const sectors: SectorQuote[] = SECTOR_RULES.map((r) => {
      const hit = all.find((x) => x.code === r.bkCode) || all.find((x) => x.name === r.name) || all.find((x) => r.searchKeys.some((k) => x.name.includes(k)));
      return { id: r.id, name: r.name, bkCode: r.bkCode, change: hit?.change ?? null, flow: hit?.flow ?? null, super: hit?.super ?? null, large: hit?.large ?? null, mid: hit?.mid ?? null, small: hit?.small ?? null, turnover: hit?.turnover ?? null, available: hit?.change != null, streak: 0, etfCode: r.etf?.code, etfName: r.etf?.name };
    });
    return { sectors, boards: boards.sort((a, b) => (b.change ?? -999) - (a.change ?? -999)), source: src("板块", sectors.some((s) => s.available), "东方财富板块资金") };
  } catch {
    return { sectors: SECTOR_RULES.map((r) => ({ id: r.id, name: r.name, bkCode: r.bkCode, change: null, flow: null, super: null, large: null, mid: null, small: null, turnover: null, available: false, streak: 0, etfCode: r.etf?.code, etfName: r.etf?.name })), boards: [], source: src("板块", false, "数据源暂不可用") };
  }
}

async function fetchFlow(): Promise<{ flow: MarketOrder | null; source: DataSource }> {
  try {
    const j = (await emJson(`https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=400&po=1&np=1&fltt=2&invt=2&fid=f62&fs=${encodeURIComponent("m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23")}&fields=f62,f66,f69,f72,f75&ut=${EM_UT}&_=${Date.now()}`, 12000)) as { data?: { diff?: unknown } };
    const arr = asArr(j?.data?.diff);
    if (!arr.length) throw new Error("empty");
    const sum = (k: string) => arr.reduce((s, x) => s + (n(x[k]) || 0), 0);
    return { flow: { main: sum("f62"), super: sum("f66"), large: sum("f69"), mid: sum("f72"), small: sum("f75"), count: arr.length }, source: src("资金", true, `东方财富全A抽样 ${arr.length} 只`) };
  } catch { return { flow: null, source: src("资金", false, "数据源暂不可用") }; }
}

async function fetchGlobal(): Promise<{ list: GlobalQuote[]; source: DataSource }> {
  try {
    const q = GLOBAL_DEFS.map((x) => x.tencent).join(",");
    const text = await fetchText(`https://qt.gtimg.cn/q=${q}`, 8000);
    const chunks = text.split(";");
    const list: GlobalQuote[] = GLOBAL_DEFS.map((d, i) => { const line = chunks[i] || ""; const m = line.match(/="([^"]*)"/); const p = m ? m[1].split("~") : []; return { name: d.name, price: n(p[3]), pct: n(p[32]) ?? n(p[31]) }; });
    return { list, source: src("外围", list.some((x) => x.pct != null), "腾讯财经") };
  } catch { return { list: [], source: src("外围", false, "数据源暂不可用") }; }
}

export const getSnapshot = createServerFn({ method: "GET" }).handler(async (): Promise<Snapshot> => {
  const hit = cached<Snapshot>("snap", 20_000, null);
  if (hit) return hit;
  const [idx, boards, flow, global] = await Promise.all([fetchIndices(), fetchBoards(), fetchFlow(), fetchGlobal()]);
  const snapshot: Snapshot = { indices: idx.list, sectors: boards.sectors, boards: boards.boards, flow: flow.flow, global: global.list, sources: [idx.source, boards.source, flow.source, global.source] };
  return cached("snap", 20_000, snapshot)!;
});

export const analyzeNews = createServerFn({ method: "POST" })
  .validator((input: { prompt: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI 暂不可用：未配置 XAI_API_KEY", text: "" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 1000,
          temperature: 0.15,
          messages: [
            {
              role: "system",
              content:
                "你是基金投资者的新闻解读助手。只使用输入中的新闻、发布时间、板块、指数和资金证据。绝不补造事实、数字、时间或来源；没有证据就明确写‘暂无可靠数据’。先判断新闻本身是否重要，再判断是否有行情/资金证据验证。必须区分‘新闻事实’与‘市场推测’。不要机械复述标题，不要喊单，不给确定性买卖建议。输出简洁白话中文，结构固定为：【今日新闻结论】【最重要的新闻】【板块影响】【与我的持仓关系】【一句话提醒】。每条重要新闻写：发生了什么｜为什么重要｜影响谁｜利好/利空/中性｜证据是否验证。若无法判断持仓关联就写‘暂无明显关联’。",
            },
            { role: "user", content: data.prompt.slice(0, 10000) },
          ],
        }),
      });
      if (!res.ok) return { ok: false as const, error: `AI 接口 ${res.status}`, text: "" };
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content?.trim() ?? "";
      return text ? { ok: true as const, error: "", text } : { ok: false as const, error: "AI 未返回有效解读", text: "" };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error && e.name === "AbortError" ? "AI 解读超时，请稍后重试" : "AI 解读暂时不可用", text: "" };
    } finally {
      clearTimeout(timer);
    }
  });