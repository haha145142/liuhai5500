import { createServerFn } from "@tanstack/react-start";
import { FUND_SECTORS, DEFAULT_FUND_SECTOR_IDS } from "./fund-sectors";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";

export type FundSectorFundQuote = {
  code: string;
  name: string;
  pct: number | null;
  nav: number | null;
  estimate: number | null;
  time: string | null;
  date: string | null;
  validation: "cross_checked" | "single_source" | "unavailable";
  source: string;
};

export type FundSectorQuote = {
  id: string;
  name: string;
  icon: string;
  pct: number | null;
  up: number;
  down: number;
  flat: number;
  validCount: number;
  totalCount: number;
  leader: FundSectorFundQuote | null;
  weakest: FundSectorFundQuote | null;
  funds: FundSectorFundQuote[];
  marketDate: string | null;
  source: string;
  validation: "cross_checked" | "single_source" | "cached_latest_trading_day" | "unavailable";
};

const EM = "https://fundcomapi.eastmoney.com/mm/newCore/FundValuationLast";
const TT = "https://fundcomapi.tiantianfunds.com/mm/newCore/FundValuationLast";
const FIELDS = "FCODE,SHORTNAME,GSZZL,GZTIME,GSZ,NAV,PDATE";
const WEEK = 7 * 24 * 60 * 60 * 1000;
let cache: { key: string; ts: number; data: FundSectorQuote[] } | null = null;

function isWeekend() {
  const d = new Date();
  const cn = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const w = cn.getUTCDay();
  return w === 0 || w === 6;
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function pct(v: unknown) {
  const x = n(v);
  return x != null && Number.isFinite(x) && Math.abs(x) <= 30 ? x : null;
}

function parseRows(payload: unknown): Record<string, unknown>[] {
  const j = parseMaybeJsonp(String(payload ?? "")) as any;
  const rows = j?.Data || j?.data || j?.Datas || [];
  return Array.isArray(rows) ? rows : [];
}

async function fetchProvider(base: string, codes: string[]) {
  if (!codes.length) return [] as Record<string, unknown>[];
  const url = `${base}?FCODES=${encodeURIComponent(codes.join(","))}&FIELDS=${encodeURIComponent(FIELDS)}&_=${Date.now()}`;
  try {
    const text = await fetchText(url, 10_000, { Referer: "https://fund.eastmoney.com/" });
    return parseRows(text);
  } catch {
    return [];
  }
}

function pick(row: Record<string, unknown>) {
  return {
    code: String(row.FCODE ?? row.fundcode ?? "").trim(),
    name: String(row.SHORTNAME ?? row.name ?? "").trim(),
    pct: pct(row.GSZZL ?? row.gszzl),
    nav: n(row.NAV ?? row.dwjz),
    estimate: n(row.GSZ ?? row.gsz),
    time: row.GZTIME ?? row.gztime ? String(row.GZTIME ?? row.gztime) : null,
    date: row.PDATE ?? row.jzrq ? String(row.PDATE ?? row.jzrq) : null,
  };
}

function mergeQuote(primary: ReturnType<typeof pick> | null, secondary: ReturnType<typeof pick> | null, code: string, fallbackName: string): FundSectorFundQuote {
  if (!primary && !secondary) return { code, name: fallbackName, pct: null, nav: null, estimate: null, time: null, date: null, validation: "unavailable", source: "暂无可靠数据" };
  if (primary && secondary) {
    const pctOk = primary.pct != null && secondary.pct != null && Math.abs(primary.pct - secondary.pct) <= 0.15;
    const navOk = primary.nav == null || secondary.nav == null || (secondary.nav !== 0 && Math.abs(primary.nav - secondary.nav) / Math.abs(secondary.nav) <= 0.01);
    if (pctOk && navOk) return { code, name: primary.name || secondary.name || fallbackName, pct: primary.pct, nav: primary.nav ?? secondary.nav, estimate: primary.estimate ?? secondary.estimate, time: primary.time ?? secondary.time, date: primary.date ?? secondary.date, validation: "cross_checked", source: "天天基金 + 东方财富" };
    return { code, name: primary.name || secondary.name || fallbackName, pct: primary.pct ?? secondary.pct, nav: primary.nav ?? secondary.nav, estimate: primary.estimate ?? secondary.estimate, time: primary.time ?? secondary.time, date: primary.date ?? secondary.date, validation: "single_source", source: "双源有分歧，采用可用值并降级" };
  }
  const p = primary ?? secondary!;
  return { code, name: p.name || fallbackName, pct: p.pct, nav: p.nav, estimate: p.estimate, time: p.time, date: p.date, validation: "single_source", source: primary ? "东方财富估值" : "天天基金估值" };
}

export const getFundSectorQuotes = createServerFn({ method: "POST" })
  .validator((input: { ids?: string[] }) => input)
  .handler(async ({ data }): Promise<{ rows: FundSectorQuote[]; fetchedAt: number; weekend: boolean }> => {
    const ids = (data.ids?.length ? data.ids : DEFAULT_FUND_SECTOR_IDS).filter((id) => FUND_SECTORS.some((s) => s.id === id));
    const key = ids.join(",");
    const weekend = isWeekend();
    const ttl = weekend ? WEEK : 25_000;
    if (cache && cache.key === key && Date.now() - cache.ts < ttl) return { rows: cache.data, fetchedAt: cache.ts, weekend };

    const sectors = FUND_SECTORS.filter((s) => ids.includes(s.id));
    const unique = new Map<string, { code: string; name: string }>();
    for (const sector of sectors) for (const fund of sector.funds) unique.set(fund.code, fund);
    const codes = [...unique.keys()];
    const batches = chunk(codes, 40);

    const providerPairs = await Promise.all(batches.map(async (batch) => {
      const [east, tt] = await Promise.all([fetchProvider(EM, batch), fetchProvider(TT, batch)]);
      return { east, tt };
    }));

    const eastMap = new Map<string, ReturnType<typeof pick>>();
    const ttMap = new Map<string, ReturnType<typeof pick>>();
    for (const pair of providerPairs) {
      for (const row of pair.east) { const q = pick(row); if (q.code) eastMap.set(q.code, q); }
      for (const row of pair.tt) { const q = pick(row); if (q.code) ttMap.set(q.code, q); }
    }

    const rows = sectors.map((sector): FundSectorQuote => {
      const funds = sector.funds.map((f) => mergeQuote(eastMap.get(f.code) ?? null, ttMap.get(f.code) ?? null, f.code, f.name));
      const valid = funds.filter((f) => f.pct != null);
      const up = valid.filter((f) => (f.pct as number) > 0).length;
      const down = valid.filter((f) => (f.pct as number) < 0).length;
      const flat = valid.length - up - down;
      const avg = valid.length ? valid.reduce((sum, f) => sum + (f.pct as number), 0) / valid.length : null;
      const sorted = valid.slice().sort((a, b) => (b.pct as number) - (a.pct as number));
      const cross = valid.filter((f) => f.validation === "cross_checked").length;
      const single = valid.filter((f) => f.validation === "single_source").length;
      const unavailable = funds.length - valid.length;
      const validation = !valid.length ? "unavailable" : cross >= Math.max(1, Math.ceil(valid.length * 0.6)) ? "cross_checked" : single > 0 || unavailable > 0 ? "single_source" : "unavailable";
      const dates = valid.map((f) => f.date).filter((v): v is string => !!v);
      const marketDate = dates.sort().at(-1) ?? null;
      return {
        id: sector.id, name: sector.name, icon: sector.icon, pct: avg,
        up, down, flat, validCount: valid.length, totalCount: sector.funds.length,
        leader: sorted[0] ?? null, weakest: sorted.at(-1) ?? null, funds,
        marketDate, validation, source: validation === "cross_checked" ? "天天基金 + 东方财富交叉验证" : validation === "single_source" ? "单源可用 / 双源部分分歧" : "暂无可靠数据",
      };
    });

    if (rows.some((r) => r.validCount > 0)) cache = { key, ts: Date.now(), data: rows };
    return { rows, fetchedAt: Date.now(), weekend };
  });
