import { createServerFn } from "@tanstack/react-start";
import { calcIndicators } from "../calc/indicators";
import { policyForFund } from "../calc/fund-type-policy";
import type { FundHistoryPoint, FundMetrics, FundQuote } from "../types";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { crossCheckStockQuotes, type CrossCheckedHolding } from "./live-quote-cross-check-v2";

export type LiveHolding = {
  code: string;
  name: string;
  weight: number;
  price: number | null;
  pct: number | null;
  source: string;
};

type ValuationAudit = {
  estimateMethod?: string;
  estimateCoverage?: number;
  disclosedWeight?: number;
  usableWeight?: number;
  coverageOfDisclosed?: number;
  externalEstimatePct?: number | null;
  estimateDeviation?: number | null;
  estimateValidation?: string;
  quoteCrossCheckedWeight?: number;
  quoteDisagreedWeight?: number;
};

const VALUATION_PROVIDERS = [
  "https://fundcomapi.tiantianfunds.com/mm/newCore/FundValuationLast",
  "https://fundcomapi.eastmoney.com/mm/newCore/FundValuationLast",
];
const HOLDING = "https://fundf10.eastmoney.com/FundArchivesDatas.aspx";
const NAV = "https://api.fund.eastmoney.com/f10/lsjz";
const CACHE = new Map<string, { ts: number; quote: FundQuote & ValuationAudit }>();
const TTL = 20_000;

function chinaNow() { return new Date(Date.now() + 8 * 60 * 60 * 1000); }
function today() { const d = chinaNow(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`; }
function htmlEntity(s: string) { return s.replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#39;/g,"'").trim(); }
function stripTags(s: string) { return htmlEntity(s.replace(/<[^>]+>/g," ").replace(/\s+/g," ")); }

function parseValuationRows(text: string): Record<string, unknown>[] {
  const j = parseMaybeJsonp(text) as any;
  const rows = j?.Data || j?.data || j?.Datas || [];
  return Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
}

function pickValuation(row: Record<string, unknown> | null) {
  if (!row) return null;
  const code = String(row.FCODE ?? row.fundcode ?? row.CODE ?? "").trim();
  return {
    code,
    name: String(row.SHORTNAME ?? row.name ?? "").trim(),
    estimate: n(row.GSZ ?? row.gsz),
    pct: n(row.GSZZL ?? row.gszzl),
    nav: n(row.NAV ?? row.dwjz),
    navDate: row.PDATE ?? row.jzrq ? String(row.PDATE ?? row.jzrq) : null,
    time: row.GZTIME ?? row.gztime ? String(row.GZTIME ?? row.gztime) : null,
  };
}

async function fetchValuation(code: string) {
  const results = await Promise.all(VALUATION_PROVIDERS.map(async (base) => {
    try {
      const url = `${base}?FCODES=${encodeURIComponent(code)}&FIELDS=FCODE,SHORTNAME,GSZZL,GZTIME,GSZ,NAV,PDATE&_=${Date.now()}`;
      const text = await fetchText(url, 8_000, { Referer: "https://fund.eastmoney.com/" });
      const row = parseValuationRows(text).find((x) => String(x.FCODE ?? x.fundcode ?? x.CODE ?? "").trim() === code) ?? null;
      return pickValuation(row);
    } catch {
      return null;
    }
  }));
  return results.find((x) => x?.code === code) ?? results.find(Boolean) ?? null;
}

async function fetchHistory(code: string): Promise<FundHistoryPoint[]> {
  try {
    const text = await fetchText(`${NAV}?fundCode=${code}&pageIndex=1&pageSize=300`, 10_000, { Referer: "https://fund.eastmoney.com/" });
    const j = parseMaybeJsonp(text) as any;
    return (j?.Data?.LSJZList || [])
      .map((x: any) => ({ date: String(x.FSRQ || ""), nav: n(x.DWJZ) ?? 0, changePct: n(x.JZZL) }))
      .filter((x: FundHistoryPoint) => x.date && x.nav > 0)
      .reverse();
  } catch {
    return [];
  }
}

async function getHoldings(code: string): Promise<LiveHolding[]> {
  try {
    const raw = await fetchText(`${HOLDING}?type=jjcc&code=${code}&topline=10&year=&month=&rt=${Date.now()}`, 10_000, { Referer: "https://fund.eastmoney.com/" });
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
      const anchors = [...row.matchAll(/<a[^>]*>([^<]+)<\/a>/gi)].map((x) => stripTags(x[1])).filter(Boolean);
      const name = anchors.find((x) => !/^\d{6}$/.test(x)) || "";
      const values = [...row.matchAll(/<td[^>]*class=['"][^'"]*(?:tor|toc)[^'"]*['"][^>]*>([\s\S]*?)<\/td>/gi)]
        .map((x) => stripTags(x[1])).map((x) => n(x));
      const weights = values.filter((x): x is number => x != null && x > 0 && x <= 15);
      const weight = weights.at(-1);
      if (!weight) continue;
      seen.add(stockCode);
      out.push({ code: stockCode, name, weight, price: null, pct: null, source: "东方财富基金持仓" });
      if (out.length >= 10) break;
    }
    return out;
  } catch {
    return [];
  }
}

function calculateEstimate(nav: number | null, holdings: CrossCheckedHolding[], externalPct: number | null) {
  const disclosedWeight = holdings.reduce((sum, h) => sum + Math.max(0, h.weight), 0);
  const usable = holdings.filter((h) => h.weight > 0 && h.pct != null);
  const usableWeight = usable.reduce((sum, h) => sum + h.weight, 0);
  if (nav == null || disclosedWeight <= 0 || usableWeight <= 0) {
    return { estimate: null, pct: null, disclosedWeight, usableWeight, coverage: usableWeight, coverageOfDisclosed: disclosedWeight ? usableWeight / disclosedWeight * 100 : 0, deviation: null, confidence: "low" as const, validation: "暂无可靠重仓行情", crossCheckedWeight: 0, disagreedWeight: 0 };
  }
  const pct = usable.reduce((sum, h) => sum + h.weight * (h.pct as number), 0) / 100;
  const estimate = nav * (1 + pct / 100);
  const coverageOfDisclosed = usableWeight / disclosedWeight * 100;
  const deviation = externalPct == null ? null : Math.abs(pct - externalPct);
  const crossCheckedWeight = usable.filter((h) => h.quoteStatus === "cross_checked").reduce((sum, h) => sum + h.weight, 0);
  const disagreedWeight = usable.filter((h) => h.quoteStatus === "disagreed").reduce((sum, h) => sum + h.weight, 0);
  const crossRate = usableWeight > 0 ? crossCheckedWeight / usableWeight : 0;
  let confidence: "high" | "medium" | "low" = usableWeight >= 60 && coverageOfDisclosed >= 70 ? "high" : usableWeight >= 35 && coverageOfDisclosed >= 50 ? "medium" : "low";
  if (crossRate < 0.5 || disagreedWeight / usableWeight > 0.2) confidence = "low";
  else if (crossRate < 0.7 && confidence === "high") confidence = "medium";
  let validation = "暂无外部参考";
  if (deviation != null) validation = deviation <= 0.35 ? "一致" : deviation <= 0.9 ? "轻微偏差" : "明显偏差";
  if (validation === "明显偏差") confidence = "low";
  return { estimate, pct, disclosedWeight, usableWeight, coverage: Math.min(100, usableWeight), coverageOfDisclosed, deviation, confidence, validation, crossCheckedWeight, disagreedWeight };
}

export const getCalculatedFund = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<FundQuote & ValuationAudit & { liveHoldings?: CrossCheckedHolding[] }> => {
    const code = data.code.trim();
    const hit = CACHE.get(code);
    if (hit && Date.now() - hit.ts < TTL) return hit.quote;
    try {
      const valuationPromise = fetchValuation(code);
      const historyPromise = fetchHistory(code);
      const valuation = await valuationPromise;
      const historyPoints = await historyPromise;
      const latest = historyPoints.at(-1);
      const nav = valuation?.nav ?? latest?.nav ?? null;
      const navDate = valuation?.navDate ?? latest?.date ?? null;
      const fundName = valuation?.name || code;
      const fundType = "基金";
      const policy = policyForFund(fundType, fundName);
      const externalPct = valuation?.pct ?? null;
      const rawHoldings = policy.allowAshareLookThrough ? await getHoldings(code) : [];
      const holdings = policy.allowAshareLookThrough ? await crossCheckStockQuotes(rawHoldings) : [];
      const result = policy.allowAshareLookThrough
        ? calculateEstimate(nav, holdings, externalPct)
        : { estimate: null, pct: null, disclosedWeight: 0, usableWeight: 0, coverage: 0, coverageOfDisclosed: 0, deviation: null, confidence: "low" as const, validation: policy.reason, crossCheckedWeight: 0, disagreedWeight: 0 };
      const history = historyPoints.map((x) => x.nav);
      const weekBase = historyPoints[Math.max(0, historyPoints.length - 6)];
      const monthBase = historyPoints[Math.max(0, historyPoints.length - 22)];
      const weekPct = latest && weekBase?.nav ? (latest.nav / weekBase.nav - 1) * 100 : null;
      const monthPct = latest && monthBase?.nav ? (latest.nav / monthBase.nav - 1) * 100 : null;
      const metrics: FundMetrics | null = calcIndicators(history);
      const officialToday = navDate === today();
      const dayPct = officialToday ? latest?.changePct ?? valuation?.pct ?? null : result.pct ?? valuation?.pct ?? null;
      const quote: FundQuote & ValuationAudit & { liveHoldings?: CrossCheckedHolding[] } = {
        code,
        name: fundName,
        type: fundType,
        nav,
        navDate,
        estimate: officialToday ? nav : result.estimate,
        estimatePct: officialToday ? null : result.pct,
        estimateTime: result.estimate != null && !officialToday ? new Date().toISOString() : null,
        dayPct,
        weekPct,
        monthPct,
        history,
        historyPoints,
        metrics,
        source: officialToday
          ? "今日官方净值"
          : result.estimate != null
            ? `自算盘中估值 · 前十大重仓×双源行情 · ${result.validation}`
            : valuation?.estimate != null
              ? "基金估值接口可用 · 自算穿透暂不可用"
              : "暂无可靠盘中估值 · 已保留最近官方净值",
        officialNavPublished: officialToday,
        valuationStatus: officialToday ? "official_nav" : result.estimate != null ? "estimate" : nav != null ? "waiting_official_nav" : "unavailable",
        estimateConfidence: result.confidence,
        estimateMethod: policy.allowAshareLookThrough ? "已披露前十大重仓权重×实时资产涨跌；双源交叉校验；未覆盖部分不猜测" : policy.reason,
        estimateCoverage: result.coverage,
        disclosedWeight: result.disclosedWeight,
        usableWeight: result.usableWeight,
        coverageOfDisclosed: result.coverageOfDisclosed,
        externalEstimatePct: externalPct,
        estimateDeviation: result.deviation,
        estimateValidation: result.validation,
        quoteCrossCheckedWeight: result.crossCheckedWeight,
        quoteDisagreedWeight: result.disagreedWeight,
        liveHoldings: holdings,
        historyMae20: null,
        historySample20: 0,
        historyMaxError: null,
        historyP95Error: null,
        historyMae5: null,
      };
      CACHE.set(code, { ts: Date.now(), quote });
      return quote;
    } catch {
      return {
        code, name: code, type: "基金", nav: null, navDate: null, estimate: null, estimatePct: null, estimateTime: null,
        dayPct: null, weekPct: null, monthPct: null, history: [], historyPoints: [], metrics: null,
        source: "基金行情接口暂不可用", officialNavPublished: false, valuationStatus: "unavailable", estimateConfidence: "low",
        historyMae20: null, historySample20: 0, historyMaxError: null, historyP95Error: null, historyMae5: null,
      };
    }
  });
