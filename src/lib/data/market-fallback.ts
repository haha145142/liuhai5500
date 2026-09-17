import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp, asArr } from "./fetch-util";
import { INDEX_DEFS, SECTOR_RULES } from "./sectors";
import { tradingDateLabel } from "./trading-day";
import type { IndexQuote, SectorQuote } from "../types";

const EM_UT = "fa5fd1943c7b386f172d6893dbfba10b";
const AKSHARE_SECTOR_URL = "https://raw.githubusercontent.com/haha145142/liuhai5500/data/akshare/data/akshare/sector-flow.json";

function cleanPct(value: unknown) {
  const x = n(value);
  return x != null && Number.isFinite(x) && Math.abs(x) <= 30 ? x : null;
}
function cleanMoney(value: unknown) {
  const x = n(value);
  return x != null && Number.isFinite(x) && Math.abs(x) <= 1e14 ? x : null;
}
function parseTencentIndices(text: string) {
  const lines = text.split(";");
  return INDEX_DEFS.map((def, index): IndexQuote => {
    const match = (lines[index] || "").match(/=\"([^\"]*)\"/);
    const fields = match ? match[1].split("~") : [];
    return {
      name: def.name,
      code: def.code,
      secid: def.secid,
      price: cleanMoney(fields[3]),
      pct: cleanPct(fields[32]),
      change: cleanMoney(fields[31]),
    };
  });
}
function parseSinaIndices(text: string) {
  const lines = text.split(";");
  return INDEX_DEFS.map((def, index): IndexQuote => {
    const match = (lines[index] || "").match(/=\"([^\"]*)\"/);
    const fields = match ? match[1].split(",") : [];
    return {
      name: def.name,
      code: def.code,
      secid: def.secid,
      price: cleanMoney(fields[1]),
      pct: cleanPct(fields[3]),
      change: cleanMoney(fields[2]),
    };
  });
}

const YAHOO_SYMBOLS: Record<string, string> = {
  "000001": "000001.SS",
  "399001": "399001.SZ",
  "000300": "000300.SS",
  "000905": "000905.SS",
  "399006": "399006.SZ",
  "000688": "000688.SS",
};

async function fetchYahooIndex(code: string): Promise<IndexQuote | null> {
  const def = INDEX_DEFS.find((x) => x.code === code);
  const symbol = YAHOO_SYMBOLS[code];
  if (!def || !symbol) return null;
  try {
    const raw = await fetchText(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d&includePrePost=false`, 7000, { Accept: "application/json,text/plain,*/*", Referer: "https://finance.yahoo.com/" });
    const json = JSON.parse(raw) as { chart?: { result?: Array<{ indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> } };
    const closes = (json.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    if (!closes.length) return null;
    const price = closes.at(-1) ?? null;
    const previous = closes.length > 1 ? closes.at(-2) ?? null : null;
    const change = price != null && previous != null ? price - previous : null;
    const pct = price != null && previous != null && previous !== 0 ? (change! / previous) * 100 : null;
    return { name: def.name, code: def.code, secid: def.secid, price: cleanMoney(price), pct: cleanPct(pct), change: cleanMoney(change) };
  } catch {
    return null;
  }
}

function parseAkshareRows(value: unknown) {
  const json = value as any;
  return asArr(json?.rows ?? json?.data?.rows ?? json?.items ?? json?.data?.items);
}

async function fetchAkshareSectors() {
  try {
    const raw = await fetchText(AKSHARE_SECTOR_URL, 7000, { Accept: "application/json,text/plain,*/*", Referer: "https://github.com/" });
    const json = JSON.parse(raw) as unknown;
    return parseAkshareRows(json);
  } catch {
    return [];
  }
}

function akshareChange(row: any) {
  return cleanPct(row?.change_pct ?? row?.changePct ?? row?.change ?? row?.pct ?? row?.涨跌幅 ?? row?."涨跌幅");
}
function akshareFlow(row: any) {
  return cleanMoney(row?.main_net_inflow ?? row?.mainNetInflow ?? row?.flow ?? row?.主力净流入 ?? row?."主力净流入");
}
function akshareName(row: any) {
  return String(row?.name ?? row?.sector_name ?? row?.板块名称 ?? row?."板块名称" ?? "").trim();
}

async function fetchLatestSnapshot() {
  const [indexResult, sectorResult, tencentIndexResult, sinaIndexResult, akshareSectorResult, ...yahooResults] = await Promise.all([
    fetchText(`https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f12,f14,f2,f3,f4&secids=${INDEX_DEFS.map((x) => x.secid).join(",")}&ut=${EM_UT}&_=${Date.now()}`, 7000, { Referer: "https://quote.eastmoney.com/", Accept: "application/json,text/plain,*/*" }).then((value) => ({ status: "fulfilled" as const, value })).catch((reason) => ({ status: "rejected" as const, reason })),
    fetchText(`https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=1200&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2,m:90+t:3&fields=f12,f14,f3,f62,f66,f69,f72,f75,f6&ut=${EM_UT}&_=${Date.now()}`, 7000, { Referer: "https://quote.eastmoney.com/", Accept: "application/json,text/plain,*/*" }).then((value) => ({ status: "fulfilled" as const, value })).catch((reason) => ({ status: "rejected" as const, reason })),
    fetchText("https://qt.gtimg.cn/q=sh000001,sz399001,sh000300,sh000905,sz399006,sh000688", 7000, { Referer: "https://qt.gtimg.cn/", Accept: "text/plain,*/*" }).then((value) => ({ status: "fulfilled" as const, value })).catch((reason) => ({ status: "rejected" as const, reason })),
    fetchText("https://hq.sinajs.cn/list=s_sh000001,s_sz399001,s_sh000300,s_sh000905,s_sz399006,s_sh000688", 7000, { Referer: "https://finance.sina.com.cn/", Accept: "text/plain,*/*" }).then((value) => ({ status: "fulfilled" as const, value })).catch((reason) => ({ status: "rejected" as const, reason })),
    fetchAkshareSectors(),
    ...INDEX_DEFS.map((def) => fetchYahooIndex(def.code)),
  ]);

  const indexJson = indexResult.status === "fulfilled" ? (parseMaybeJsonp(indexResult.value) as { data?: { diff?: unknown } } | null) : null;
  const sectorJson = sectorResult.status === "fulfilled" ? (parseMaybeJsonp(sectorResult.value) as { data?: { diff?: unknown } } | null) : null;
  const indexRows = asArr(indexJson?.data?.diff);
  const boardRows = asArr(sectorJson?.data?.diff);
  const tencentIndices = tencentIndexResult.status === "fulfilled" ? parseTencentIndices(tencentIndexResult.value) : [];
  const sinaIndices = sinaIndexResult.status === "fulfilled" ? parseSinaIndices(sinaIndexResult.value) : [];
  const yahooIndices = yahooResults.filter((x): x is IndexQuote | null => x != null) as Array<IndexQuote | null>;
  const akshareRows = parseAkshareRows(akshareSectorResult);

  const indices: IndexQuote[] = INDEX_DEFS.map((def, index) => {
    const eastmoney = indexRows.find((x) => String(x.f12 ?? "") === def.code);
    const tencent = tencentIndices.find((x) => x.code === def.code);
    const sina = sinaIndices.find((x) => x.code === def.code);
    const yahoo = yahooIndices[index] ?? null;
    return {
      name: def.name,
      code: def.code,
      secid: def.secid,
      price: cleanMoney(eastmoney?.f2) ?? tencent?.price ?? sina?.price ?? yahoo?.price ?? null,
      pct: cleanPct(eastmoney?.f3) ?? tencent?.pct ?? sina?.pct ?? yahoo?.pct ?? null,
      change: cleanMoney(eastmoney?.f4) ?? tencent?.change ?? sina?.change ?? yahoo?.change ?? null,
    };
  });

  const sectors: SectorQuote[] = SECTOR_RULES.map((rule) => {
    const exact = boardRows.find((x) => String(x.f12 ?? "") === rule.bkCode);
    const name = String(exact?.f14 ?? "").trim();
    const byName = exact ?? boardRows.find((x) => String(x.f14 ?? "").trim() === rule.name);
    const byKey = rule.searchKeys.map((key) => boardRows.find((x) => String(x.f14 ?? "").includes(key))).find(Boolean);
    const row = byName ?? byKey;
    const fallbackRow = akshareRows.find((x) => {
      const rowName = akshareName(x);
      return rowName === rule.name || rule.searchKeys.some((key) => rowName.includes(key));
    });
    const effectiveRow = row ?? fallbackRow;
    const change = cleanPct(row?.f3) ?? akshareChange(fallbackRow);
    const flow = cleanMoney(row?.f62) ?? akshareFlow(fallbackRow);
    return {
      id: rule.id,
      name: rule.name,
      bkCode: rule.bkCode,
      change,
      flow,
      super: cleanMoney(row?.f66),
      large: cleanMoney(row?.f69),
      mid: cleanMoney(row?.f72),
      small: cleanMoney(row?.f75),
      turnover: cleanMoney(row?.f6),
      available: change != null,
      streak: 0,
      etfCode: rule.etf?.code,
      etfName: rule.etf?.name,
      validation: row ? "single_source" : effectiveRow ? "snapshot_fallback" : "unavailable",
    };
  });

  return { marketDate: tradingDateLabel(), indices, sectors };
}

export const getLatestTradingMarketData = createServerFn({ method: "GET" }).handler(async (): Promise<{ marketDate: string | null; indices: IndexQuote[]; sectors: SectorQuote[]; note: string }> => {
  try {
    const result = await fetchLatestSnapshot();
    const hasIndices = result.indices.some((x) => x.price != null || x.pct != null);
    const hasSectors = result.sectors.some((x) => x.change != null);
    return { ...result, note: hasIndices || hasSectors ? `最近交易日历史行情（${result.marketDate || "最近可用交易日"}）` : "最近交易日历史行情暂不可用" };
  } catch {
    return {
      marketDate: null,
      indices: INDEX_DEFS.map((def) => ({ name: def.name, code: def.code, secid: def.secid, price: null, pct: null, change: null })),
      sectors: SECTOR_RULES.map((rule) => ({ id: rule.id, name: rule.name, bkCode: rule.bkCode, change: null, flow: null, super: null, large: null, mid: null, small: null, turnover: null, available: false, streak: 0, etfCode: rule.etf?.code, etfName: rule.etf?.name, validation: "unavailable" as const })),
      note: "最近交易日历史行情暂不可用",
    };
  }
});
