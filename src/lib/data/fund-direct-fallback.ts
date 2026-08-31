import { createServerFn } from "@tanstack/react-start";
import { calcIndicators } from "../calc/indicators";
import type { FundHistoryPoint, FundQuote } from "../types";
import { fetchText, n } from "./fetch-util";

const ROOT = "https://fund.eastmoney.com/pingzhongdata";

type ParsedDirect = {
  code: string;
  name: string;
  type: string;
  historyPoints: FundHistoryPoint[];
  oneYear: number | null;
  sixMonth: number | null;
  oneMonth: number | null;
};

function extractString(text: string, key: string) {
  const m = text.match(new RegExp(`var\\s+${key}\\s*=\\s*[\"']([^\"']*)[\"']\\s*;`, "i"));
  return m?.[1]?.trim() || "";
}

function extractJson(text: string, key: string): unknown[] {
  const re = new RegExp(`var\\s+${key}\\s*=\\s*(\\[[\\s\\S]*?\\]);`);
  const m = text.match(re);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[1]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseDirect(text: string, code: string): ParsedDirect {
  const trend = extractJson(text, "Data_netWorthTrend");
  const historyPoints = trend.map((x) => {
    const item = x as { x?: unknown; y?: unknown; equityReturn?: unknown };
    const ts = n(item.x);
    return {
      date: ts != null ? new Date(ts).toISOString().slice(0, 10) : "",
      nav: n(item.y) ?? 0,
      changePct: n(item.equityReturn),
    };
  }).filter((x) => x.date && x.nav > 0);
  return {
    code: extractString(text, "fS_code") || code,
    name: extractString(text, "fS_name") || code,
    type: "基金",
    historyPoints,
    oneYear: n(extractString(text, "syl_1n")),
    sixMonth: n(extractString(text, "syl_6y")),
    oneMonth: n(extractString(text, "syl_1y")),
  };
}

export const getDirectFundFallback = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<FundQuote | null> => {
    const code = data.code.trim();
    if (!/^\d{6}$/.test(code)) return null;
    const versions = [Date.now(), Date.now() - 60_000];
    for (const version of versions) {
      try {
        const text = await fetchText(`${ROOT}/${code}.js?v=${version}`, 9000, { Referer: `https://fund.eastmoney.com/${code}.html` });
        const parsed = parseDirect(text, code);
        const latest = parsed.historyPoints.at(-1) || null;
        const previous = parsed.historyPoints.at(-2) || null;
        if (!latest) continue;
        const history = parsed.historyPoints.map((x) => x.nav);
        const metrics = calcIndicators(history);
        const dayPct = latest.changePct ?? (previous?.nav ? (latest.nav / previous.nav - 1) * 100 : null);
        const weekBase = parsed.historyPoints.at(-6)?.nav;
        const monthBase = parsed.historyPoints.at(-22)?.nav;
        return {
          code: parsed.code,
          name: parsed.name,
          type: parsed.type,
          nav: latest.nav,
          navDate: latest.date,
          estimate: null,
          estimatePct: null,
          estimateTime: null,
          dayPct,
          weekPct: weekBase ? (latest.nav / weekBase - 1) * 100 : null,
          monthPct: monthBase ? (latest.nav / monthBase - 1) * 100 : null,
          history,
          historyPoints: parsed.historyPoints,
          metrics,
          source: "东方财富 pingzhongdata 直接历史净值兜底",
          officialNavPublished: true,
          valuationStatus: "official_nav",
          estimateConfidence: "medium",
          estimateMethod: "历史官方净值直接读取；无盘中估值时不猜测",
          estimateCoverage: 0,
          externalEstimatePct: null,
          estimateDeviation: null,
          estimateValidation: "直接历史净值",
          historyMae20: null,
          historySample20: Math.min(20, parsed.historyPoints.length),
          historyMaxError: null,
          historyP95Error: null,
          historyMae5: null,
        };
      } catch {
        // try next version / fail closed
      }
    }
    return null;
  });
