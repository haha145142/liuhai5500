import { createServerFn } from "@tanstack/react-start";
import { calcIndicators } from "../calc/indicators";
import type { FundHistoryPoint, FundMetrics, FundQuote } from "../types";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";

export type LiveHolding = { code: string; name: string; weight: number; price: number | null; pct: number | null; source: string };

const YJB = "https://fundgz.1234567.com.cn/js";
const HOLDING = "https://fundf10.eastmoney.com/FundArchivesDatas.aspx";
const QQ = "https://qt.gtimg.cn/q=";
const NAV = "https://api.fund.eastmoney.com/f10/lsjz";
const CACHE = new Map<string, { ts: number; quote: FundQuote }>();
const TTL = 20_000;

function chinaNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}
function today() {
  const d = chinaNow();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function stockSymbol(code: string) {
  if (/^6\d{5}$/.test(code)) return `sh${code}`;
  if (/^(0|3)\d{5}$/.test(code)) return `sz${code}`;
  if (/^688\d{3}$/.test(code)) return `sh${code}`;
  return null;
}
function htmlEntity(s: string) {
  return s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").trim();
}
function stripTags(s: string) { return htmlEntity(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")); }

async function getBase(code: string) {
  const [gzRaw, histRaw] = await Promise.all([
    fetchText(`${YJB}/${code}.js?rt=${Date.now()}`, 8000, { Referer: "https://fund.eastmoney.com/" }),
    fetchText(`${NAV}?fundCode=${code}&pageIndex=1&pageSize=300`, 10000, { Referer: "https://fund.eastmoney.com/" }),
  ]);
  const gz = parseMaybeJsonp(gzRaw) as any;
  const hj = parseMaybeJsonp(histRaw) as any;
  const ordered: FundHistoryPoint[] = (hj?.Data?.LSJZList || []).map((x: any) => ({ date: String(x.FSRQ || ""), nav: n(x.DWJZ) ?? 0, changePct: n(x.JZZZL) })).filter((x: FundHistoryPoint) => x.date && x.nav > 0).reverse();
  const latest = ordered.at(-1);
  return { gz, ordered, latest };
}

async function getHoldings(code: string): Promise<LiveHolding[]> {
  const raw = await fetchText(`${HOLDING}?type=jjcc&code=${code}&topline=10&year=&month=&rt=${Date.now()}`, 10000, { Referer: "https://fund.eastmoney.com/" });
  const m = raw.match(/content:\\?"([\s\S]*?)\\?",arryear/i);
  if (!m) return [];
  let html = m[1];
  try { html = JSON.parse(`"${html}"`); } catch {}
  const out: LiveHolding[] = [];
  const seen = new Set<string>();
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = tr[1];
    const codeMatch = row.match(/(?:quote\.eastmoney\.com\/|href=['"][^'"]*?)(?:sz|sh)(\d{6})/i) || row.match(/(?:0|1)\.(\d{6})/);
    if (!codeMatch) continue;
    const stockCode = codeMatch[1];
    if (seen.has(stockCode)) continue;
    const anchors = [...row.matchAll(/<a[^>]*>([^<]+)<\/a>/gi)].map(x => stripTags(x[1])).filter(Boolean);
    const name = anchors.find(x => !/^\d{6}$/.test(x)) || "";
    const values = [...row.matchAll(/<td[^>]*class=['"][^'"]*(?:tor|toc)[^'"]*['"][^>]*>([\s\S]*?)<\/td>/gi)].map(x => stripTags(x[1])).map(x => n(x));
    const weights = values.filter((x): x is number => x != null && x > 0 && x <= 15);
    const weight = weights.at(-1);
    if (!weight) continue;
    seen.add(stockCode);
    out.push({ code: stockCode, name, weight, price: null, pct: null, source: "东方财富基金持仓" });
    if (out.length >= 10) break;
  }
  return out;
}

async function getStockQuotes(holdings: LiveHolding[]) {
  const mapped = holdings.map(h => ({ ...h, symbol: stockSymbol(h.code) })).filter((h): h is typeof h & { symbol: string } => !!h.symbol);
  if (!mapped.length) return holdings;
  try {
    const text = await fetchText(`${QQ}${mapped.map(x => x.symbol).join(",")}`, 8000);
    const lines = text.split(";");
    const byCode = new Map<string, { price: number | null; pct: number | null }>();
    for (const line of lines) {
      const m = line.match(/v_(?:sh|sz)(\d{6})=\"([^\"]*)\"/);
      if (!m) continue;
      const p = m[2].split("~");
      byCode.set(m[1], { price: n(p[3]), pct: n(p[32]) });
    }
    return holdings.map(h => ({ ...h, price: byCode.get(h.code)?.price ?? null, pct: byCode.get(h.code)?.pct ?? null }));
  } catch {
    return holdings;
  }
}

function buildEstimate(nav: number | null, holdings: LiveHolding[], externalPct: number | null) {
  const usable = holdings.filter(h => h.weight > 0 && h.pct != null);
  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
  if (nav == null || !usable.length || totalWeight <= 0) return { estimate: null, pct: null, coverage: 0, deviation: null, confidence: "low" as const, validation: "无法验证" };
  const weighted = usable.reduce((s, h) => s + h.weight * (h.pct as number), 0) / totalWeight;
  const estimate = nav * (1 + weighted / 100);
  const coverage = Math.min(100, (usable.reduce((s, h) => s + h.weight, 0) / Math.max(totalWeight, 1)) * 100);
  const deviation = externalPct == null ? null : Math.abs(weighted - externalPct);
  let confidence: "high" | "medium" | "low" = coverage >= 55 ? "high" : coverage >= 35 ? "medium" : "low";
  let validation = "无法验证";
  if (deviation != null) {
    if (deviation <= 0.35) { validation = "一致"; confidence = confidence === "low" ? "low" : "high"; }
    else if (deviation <= 0.9) validation = "轻微偏差";
    else { validation = "明显偏差"; confidence = "low"; }
  }
  return { estimate, pct: weighted, coverage, deviation, confidence, validation };
}

export const getCalculatedFund = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<FundQuote & { liveHoldings?: LiveHolding[]; estimateMethod?: string; estimateCoverage?: number; externalEstimatePct?: number | null; estimateDeviation?: number | null; estimateValidation?: string }> => {
    const code = data.code.trim();
    const hit = CACHE.get(code);
    if (hit && Date.now() - hit.ts < TTL) return hit.quote as FundQuote & { liveHoldings?: LiveHolding[] };
    try {
      const { gz, ordered, latest } = await getBase(code);
      const nav = n(gz?.dwjz) ?? latest?.nav ?? null;
      const navDate = gz?.jzrq ? String(gz.jzrq) : latest?.date ?? null;
      const externalPct = n(gz?.gszzl ?? gz?.vgszzl ?? gz?.zsgzzl);
      const holdings = await getStockQuotes(await getHoldings(code));
      const result = buildEstimate(nav, holdings, externalPct);
      const history = ordered.map(x => x.nav);
      const weekBase = ordered[Math.max(0, ordered.length - 6)];
      const monthBase = ordered[Math.max(0, ordered.length - 22)];
      const weekPct = latest && weekBase?.nav ? ((latest.nav / weekBase.nav) - 1) * 100 : null;
      const monthPct = latest && monthBase?.nav ? ((latest.nav / monthBase.nav) - 1) * 100 : null;
      const metrics: FundMetrics | null = calcIndicators(history);
      const officialToday = navDate === today();
      const quote: FundQuote & { liveHoldings?: LiveHolding[]; estimateMethod?: string; estimateCoverage?: number; externalEstimatePct?: number | null; estimateDeviation?: number | null; estimateValidation?: string } = {
        code,
        name: String(gz?.name || code),
        type: String(gz?.fundtype || "基金"),
        nav,
        navDate,
        estimate: result.estimate,
        estimatePct: result.pct,
        estimateTime: new Date().toISOString(),
        dayPct: officialToday ? n(gz?.gszzl ?? gz?.jzzzl) ?? latest?.changePct ?? null : result.pct,
        weekPct,
        monthPct,
        history,
        historyPoints: ordered,
        metrics,
        source: result.estimate != null ? `自有穿透估值 · 前十大重仓 × 实时行情 · ${result.validation}${externalPct != null ? ` · 参考源差 ${result.deviation?.toFixed(2)}个百分点` : ""}` : "自有估值暂不可用 · 未满足可靠持仓覆盖条件",
        officialNavPublished: officialToday,
        valuationStatus: officialToday ? "official_nav" : result.estimate != null ? "estimate" : nav != null ? "waiting_official_nav" : "unavailable",
        estimateConfidence: result.confidence,
        liveHoldings: holdings,
        estimateMethod: "前十大重仓归一化加权 + 实时个股涨跌幅",
        estimateCoverage: result.coverage,
        externalEstimatePct: externalPct,
        estimateDeviation: result.deviation,
        estimateValidation: result.validation,
      };
      CACHE.set(code, { ts: Date.now(), quote });
      return quote;
    } catch {
      return { code, name: code, type: "基金", nav: null, navDate: null, estimate: null, estimatePct: null, estimateTime: null, dayPct: null, weekPct: null, monthPct: null, history: [], historyPoints: [], metrics: null, source: "自有估值引擎暂不可用", officialNavPublished: false, valuationStatus: "unavailable", estimateConfidence: "low" };
    }
  });
