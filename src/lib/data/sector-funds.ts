import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { getLiveFundQuote } from "./fund-live-provider";
import { SECTOR_RULES, type SectorRule } from "./sectors";

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
};

const RANK_URL = "https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=rzf&st=desc&pi=1&pn=2000&dx=1";
const CACHE_MS = 60 * 60 * 1000;
let cached: { savedAt: number; rows: SectorFundRow[] } | null = null;

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
    const raw = await fetchText(`${RANK_URL}&_=${Date.now()}`, 12_000, { Referer: "https://fund.eastmoney.com/" });
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

async function fallbackRepresentativeFund(rule: SectorRule): Promise<SectorFundRow[]> {
  const etf = rule.etf;
  if (!etf) return [];
  try {
    const quote = await getLiveFundQuote(etf.code);
    return [{
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
      matchReason: `${rule.name}代表ETF · 数据源降级；仅展示可靠可取得的实时数据`,
    }];
  } catch {
    return [{
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
      matchReason: `${rule.name}代表ETF · 当前行情源不可用`,
    }];
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
        return {
          ...row,
          matchScore: hit.score,
          matchReason: hit.reason,
        };
      })
      .filter((x): x is SectorFundRow => !!x)
      .sort((a, b) => (b.matchScore - a.matchScore) || ((b.day ?? -999) - (a.day ?? -999)))
      .slice(0, 40);
    if (matched.length) return matched;
    return fallbackRepresentativeFund(rule);
  });
