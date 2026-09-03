import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { getLiveFundQuote } from "./fund-live-provider";
import { getCalculatedFund } from "./live-valuation";
import { SECTOR_RULES, type SectorRule } from "./sectors";

export type SectorFundTrust = { score:number; label:"高"|"中"|"低"; updatedAt:string|null };

export type SectorFundRow = {
  code: string;
  name: string;
  type: string;
  nav: number | null;
  day: number | null;
  week: number | null;
  month: number | null;
  threeMonth: number | null;
  sixMonth: number | null;
  oneYear: number | null;
  matchScore: number;
  matchReason: string;
  valuationTrust?: SectorFundTrust;
};

// Board fund-pool source is configurable here; the live universe currently uses Eastmoney's fund ranking feed.
const RANK_URL = "https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=rzf&st=desc&pi=1&pn=2000&dx=1";
const CACHE_MS = 60 * 60 * 1000;
const UNIVERSE_TIMEOUT_MS = 6_000;
const TRUST_ENRICH_TIMEOUT_MS = 2_500;
let cached: { savedAt: number; rows: SectorFundRow[] } | null = null;

type TrustQuote = { estimate:number|null; valuationStatus?:FundQuoteStatus; estimateRoutes?:{pct:number|null;source:string}[]; estimateRouteSpreadPct?:number|null; estimateTime:string|null; estimateCoverage?:number; usableWeight?:number; crossCheckedWeightPct?:number|null };
type FundQuoteStatus = "estimate"|"waiting_official_nav"|"official_nav"|"stale"|"unavailable"|"live_estimate";

function parseRows(value: unknown): SectorFundRow[] {
  const data = value as { datas?: string[] } | null;
  return (data?.datas || []).map((line) => {
    const a = String(line).split(",");
    return {
      code: a[0] || "",
      name: a[1] || "",
      nav: Number.isFinite(Number(a[4])) ? Number(a[4]) : null,
      day: Number.isFinite(Number(a[6])) ? Number(a[6]) : null,
      week: Number.isFinite(Number(a[7])) ? Number(a[7]) : null,
      month: Number.isFinite(Number(a[8])) ? Number(a[8]) : null,
      threeMonth: Number.isFinite(Number(a[9])) ? Number(a[9]) : null,
      sixMonth: Number.isFinite(Number(a[10])) ? Number(a[10]) : null,
      oneYear: Number.isFinite(Number(a[11])) ? Number(a[11]) : null,
      type: a[3] || "",
      matchScore: 0,
      matchReason: "",
    };
  }).filter((x) => /^\d{6}$/.test(x.code) && !!x.name);
}

async function fetchFundUniverse() {
  if (cached && Date.now() - cached.savedAt < CACHE_MS) return cached.rows;
  try {
    const raw = await fetchText(`${RANK_URL}&_=${Date.now()}`, UNIVERSE_TIMEOUT_MS, { Referer: "https://fund.eastmoney.com/" });
    const rows = parseRows(parseMaybeJsonp(raw));
    if (rows.length) cached = { savedAt: Date.now(), rows };
    return rows;
  } catch {
    return cached?.rows || [];
  }
}

function getRule(code: string): SectorRule | null {
  return SECTOR_RULES.find((x) => x.bkCode === code) || null;
}

function scoreFund(row: SectorFundRow, rule: SectorRule) {
  const name = row.name.toLowerCase();
  let score = 0;
  const hits: string[] = [];
  for (const key of rule.keys) {
    const k = key.toLowerCase();
    if (!name.includes(k)) continue;
    score += k === rule.name.toLowerCase() ? 100 : 55;
    hits.push(key);
  }
  if (rule.name === "人工智能" && /(ai|人工智能|大模型|算力)/i.test(row.name)) score += 20;
  if (rule.name === "新能源" && /(光伏|锂电|新能源)/i.test(row.name)) score += 15;
  if (rule.name === "半导体" && /(芯片|半导体|集成电路)/i.test(row.name)) score += 20;
  if (rule.name === "通信" && /(通信|5g)/i.test(row.name)) score += 10;
  return { score, reason: hits.slice(0, 2).join(" · ") || rule.name };
}

function deriveTrend(row: SectorFundRow) {
  const values = [row.week, row.month, row.threeMonth, row.sixMonth, row.oneYear].filter((v): v is number => v != null && Number.isFinite(v));
  if (values.length < 3) return { label: "趋势数据不足", score: null as number | null };
  const weights = [1, 2, 3, 2, 1].slice(-values.length);
  const weighted = values.reduce((sum, value, i) => sum + value * weights[i], 0) / weights.reduce((sum, value) => sum + value, 0);
  const short = row.week ?? row.month;
  const long = row.sixMonth ?? row.oneYear;
  const score = Math.max(0, Math.min(100, Math.round(50 + weighted * 4 + ((short ?? 0) - (long ?? 0)) * 1.5)));
  const label = score >= 75 ? "趋势强" : score >= 60 ? "趋势偏强" : score >= 40 ? "趋势中性" : score >= 25 ? "趋势偏弱" : "趋势弱";
  return { label, score };
}

function deriveBand(row: SectorFundRow) {
  const day = row.day;
  const month = row.month;
  if (day == null || month == null || !Number.isFinite(day) || !Number.isFinite(month)) return "波段数据不足";
  const spread = day - month / 4;
  if (spread >= 1.2 && day >= 0) return "短线偏强";
  if (spread <= -1.2 && day <= 0) return "短线偏弱";
  if (month >= 8 && day < 0) return "高位震荡";
  if (month <= -8 && day > 0) return "低位修复";
  return "波段中性";
}

function withDerivedLabels(row: SectorFundRow, reason: string, matchScore = row.matchScore): SectorFundRow {
  const trend = deriveTrend(row);
  const band = deriveBand(row);
  return { ...row, matchScore, matchReason: `${reason} · ${trend.label} · ${band}` };
}

function trustFromQuote(quote: TrustQuote): SectorFundTrust | undefined {
  if (quote.estimate == null || quote.valuationStatus !== "estimate") return undefined;
  const routes = quote.estimateRoutes ?? [];
  const values = routes.map((r) => r.pct).filter((v): v is number => v != null && Number.isFinite(v));
  const routeScore = Math.min(30, values.length / 3 * 30);
  const spread = quote.estimateRouteSpreadPct;
  const consistencyScore = spread == null ? 0 : Math.max(0, Math.min(25, (1 - Math.min(spread, 2) / 2) * 25));
  const coverage = typeof quote.estimateCoverage === "number" ? Math.max(0, Math.min(100, quote.estimateCoverage)) : 0;
  const coverageScore = coverage / 100 * 20;
  const usable = quote.usableWeight ?? 0;
  const checked = quote.crossCheckedWeightPct ?? 0;
  const crossScore = usable > 0 ? Math.max(0, Math.min(15, checked / usable * 15)) : routes[0]?.source?.includes("双源") ? 15 : 0;
  const ageSec = quote.estimateTime ? Math.max(0, (Date.now() - new Date(quote.estimateTime).getTime()) / 1000) : Infinity;
  const freshnessScore = ageSec <= 30 ? 10 : ageSec <= 60 ? 8 : ageSec <= 120 ? 5 : ageSec <= 300 ? 2 : 0;
  const score = Math.round(Math.max(0, Math.min(100, routeScore + consistencyScore + coverageScore + crossScore + freshnessScore)));
  return { score, label: score >= 80 ? "高" : score >= 60 ? "中" : "低", updatedAt: quote.estimateTime ?? null };
}

async function enrichValuationTrust(rows: SectorFundRow[]) {
  const targets = rows.slice(0, 3);
  if (!targets.length) return rows;
  const enrich = Promise.allSettled(targets.map((row) => getCalculatedFund({ data: { code: row.code } })));
  let settled: PromiseSettledResult<unknown>[] = [];
  try {
    settled = await Promise.race([
      enrich,
      new Promise<PromiseSettledResult<unknown>[]>((resolve) => setTimeout(() => resolve([]), TRUST_ENRICH_TIMEOUT_MS)),
    ]);
  } catch {}
  const byCode = new Map<string, SectorFundTrust>();
  settled.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const trust = trustFromQuote(result.value as TrustQuote);
    if (trust) byCode.set(targets[index].code, trust);
  });
  return rows.map((row) => {
    const valuationTrust = byCode.get(row.code);
    return valuationTrust ? { ...row, valuationTrust, matchReason: `${row.matchReason} · 估值可信度 ${valuationTrust.score}/100·${valuationTrust.label}` } : row;
  });
}

async function fallbackRepresentativeFund(rule: SectorRule): Promise<SectorFundRow[]> {
  const etf = rule.etf;
  if (!etf) return [];
  try {
    const quote = await getLiveFundQuote(etf.code);
    const row: SectorFundRow = {
      code: etf.code,
      name: quote?.name || etf.name,
      type: quote?.type || "ETF",
      nav: quote?.nav ?? quote?.estimate ?? null,
      day: quote?.pct ?? null,
      week: null,
      month: null,
      threeMonth: null,
      sixMonth: null,
      oneYear: null,
      matchScore: 1000,
      matchReason: "",
    };
    return [withDerivedLabels(row, `${rule.name}代表ETF · 数据源降级；仅展示可靠可取得的实时数据`, 1000)];
  } catch {
    const row: SectorFundRow = {
      code: etf.code,
      name: etf.name,
      type: "ETF",
      nav: null,
      day: null,
      week: null,
      month: null,
      threeMonth: null,
      sixMonth: null,
      oneYear: null,
      matchScore: 1000,
      matchReason: "",
    };
    return [withDerivedLabels(row, `${rule.name}代表ETF · 当前行情源不可用`, 1000)];
  }
}

export const getSectorFunds = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<SectorFundRow[]> => {
    const rule = getRule(String(data.code ?? "").trim());
    if (!rule) return [];
    const universe = await fetchFundUniverse();
    const matched = universe
      .map((row) => {
        const hit = scoreFund(row, rule);
        if (!hit.score) return null;
        return withDerivedLabels({ ...row, matchScore: hit.score }, hit.reason, hit.score);
      })
      .filter((x): x is SectorFundRow => !!x)
      .sort((a, b) => (b.matchScore - a.matchScore) || ((b.day ?? -999) - (a.day ?? -999)))
      .slice(0, 40);
    if (matched.length) return enrichValuationTrust(matched);
    return fallbackRepresentativeFund(rule);
  });
