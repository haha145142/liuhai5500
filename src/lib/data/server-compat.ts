import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import type { RankRow } from "../types";

export const searchFund = createServerFn({ method: "POST" }).validator((input: { q: string }) => input).handler(async ({ data }): Promise<{ code: string; name: string; type: string }[]> => {
  const q = data.q.trim(); if (!q) return [];
  try {
    const raw = await fetchText(`https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(q)}`, 8000, { Referer: "https://fund.eastmoney.com/" });
    const j = parseMaybeJsonp(raw) as { Datas?: { CODE?: string; NAME?: string; CATEGORYDESC?: string }[] } | null;
    return (j?.Datas || []).filter(x => x.CODE && x.NAME).slice(0, 8).map(x => ({ code: String(x.CODE), name: String(x.NAME), type: String(x.CATEGORYDESC || "基金") }));
  } catch { return []; }
});

export const getFundRank = createServerFn({ method: "POST" }).validator((input: { sort?: string }) => input).handler(async ({ data }): Promise<{ rows: RankRow[]; source: string; fetchedAt: number }> => {
  const sort = data.sort || "r"; const sc = sort === "z" ? "zzf" : sort === "1n" ? "1nzf" : sort === "6y" ? "6yzf" : "rzf";
  try {
    const raw = await fetchText(`https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=${sc}&st=desc&pi=1&pn=40&dx=1&_=${Date.now()}`, 12000, { Referer: "https://fund.eastmoney.com/" });
    const j = parseMaybeJsonp(raw) as { datas?: string[] } | null;
    const rows = (j?.datas || []).map(line => { const a = String(line).split(","); return { code: a[0] || "", name: a[1] || "", nav: n(a[4]), day: n(a[6]), week: n(a[7]), month: n(a[8]), sixMonth: n(a[10]), oneYear: n(a[11]), ytd: n(a[14]) }; }).filter(x => x.code && x.name);
    return { rows, source: rows.length ? "天天基金/东方财富排行" : "数据源暂不可用", fetchedAt: Date.now() };
  } catch { return { rows: [], source: "数据源暂不可用", fetchedAt: Date.now() }; }
});

async function callAI(system: string, prompt: string, maxTokens: number): Promise<{ ok: true; error: string; text: string } | { ok: false; error: string; text: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "AI 暂不可用：未配置 XAI_API_KEY", text: "" };
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, signal: controller.signal, body: JSON.stringify({ model: "grok-4.5", max_tokens: maxTokens, temperature: 0.15, messages: [{ role: "system", content: system }, { role: "user", content: prompt.slice(0, 10000) }] }) });
    if (!res.ok) return { ok: false, error: `AI 接口 ${res.status}`, text: "" };
    const body = await res.json() as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim() || "";
    return text ? { ok: true, error: "", text } : { ok: false, error: "AI 未返回有效内容", text: "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "AbortError" ? "AI 请求超时" : "AI 暂时不可用", text: "" };
  } finally { clearTimeout(timer); }
}

export const analyzeMarket = createServerFn({ method: "POST" }).validator((input: { prompt: string }) => input).handler(async ({ data }) => callAI(
  "你是严谨的基金投研助手。只使用输入证据；没有就写“暂无可靠数据”；绝不编造数字、时间或来源。区分事实与推测，按7步输出：发生了什么/市场反应/资金确认/新闻催化/政策支持/外围共振/最后判断。不构成投资建议。",
  data.prompt,
  700,
));

export const analyzeNews = createServerFn({ method: "POST" }).validator((input: { prompt: string }) => input).handler(async ({ data }) => callAI(
  "你是基金新闻解读助手。只使用输入新闻、发布时间、板块、指数和资金证据。绝不补造事实、数字、时间或来源；没有证据就写“暂无可靠数据”。区分新闻事实与市场推测。输出：【今日新闻结论】【最重要的新闻】【板块影响】【与我的持仓关系】【一句话提醒】。",
  data.prompt,
  1000,
));
