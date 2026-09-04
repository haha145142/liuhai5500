import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp, asArr } from "./fetch-util";
import { INDEX_DEFS, SECTOR_RULES } from "./sectors";
import { tradingDateLabel } from "./trading-day";
import type { IndexQuote, SectorQuote } from "../types";

const EM_UT = "fa5fd1943c7b386f172d6893dbfba10b";

function cleanPct(value: unknown) {
  const x = n(value);
  return x != null && Number.isFinite(x) && Math.abs(x) <= 30 ? x : null;
}
function cleanMoney(value: unknown) {
  const x = n(value);
  return x != null && Number.isFinite(x) && Math.abs(x) <= 1e14 ? x : null;
}

async function fetchLatestSnapshot() {
  const [indexResult, sectorResult] = await Promise.allSettled([
    fetchText(`https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f12,f14,f2,f3,f4&secids=${INDEX_DEFS.map((x) => x.secid).join(",")}&ut=${EM_UT}&_=${Date.now()}`, 7000, { Referer: "https://quote.eastmoney.com/", Accept: "application/json,text/plain,*/*" }),
    fetchText(`https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=1200&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2,m:90+t:3&fields=f12,f14,f3,f62,f66,f69,f72,f75,f6&ut=${EM_UT}&_=${Date.now()}`, 7000, { Referer: "https://quote.eastmoney.com/", Accept: "application/json,text/plain,*/*" }),
  ]);

  const indexJson = indexResult.status === "fulfilled" ? (parseMaybeJsonp(indexResult.value) as { data?: { diff?: unknown } } | null) : null;
  const sectorJson = sectorResult.status === "fulfilled" ? (parseMaybeJsonp(sectorResult.value) as { data?: { diff?: unknown } } | null) : null;
  const indexRows = asArr(indexJson?.data?.diff);
  const boardRows = asArr(sectorJson?.data?.diff);

  const indices: IndexQuote[] = INDEX_DEFS.map((def) => {
    const row = indexRows.find((x) => String(x.f12 ?? "") === def.code);
    return { name: def.name, code: def.code, secid: def.secid, price: cleanMoney(row?.f2), pct: cleanPct(row?.f3), change: cleanMoney(row?.f4) };
  });

  const sectors: SectorQuote[] = SECTOR_RULES.map((rule) => {
    const exact = boardRows.find((x) => String(x.f12 ?? "") === rule.bkCode);
    const name = String(exact?.f14 ?? "").trim();
    const byName = exact ?? boardRows.find((x) => String(x.f14 ?? "").trim() === rule.name);
    const byKey = rule.searchKeys.map((key) => boardRows.find((x) => String(x.f14 ?? "").includes(key))).find(Boolean);
    const row = byName ?? byKey;
    const change = cleanPct(row?.f3);
    return {
      id: rule.id,
      name: rule.name,
      bkCode: rule.bkCode,
      change,
      flow: cleanMoney(row?.f62),
      super: cleanMoney(row?.f66),
      large: cleanMoney(row?.f69),
      mid: cleanMoney(row?.f72),
      small: cleanMoney(row?.f75),
      turnover: cleanMoney(row?.f6),
      available: change != null,
      streak: 0,
      etfCode: rule.etf?.code,
      etfName: rule.etf?.name,
      validation: change != null ? "single_source" : "unavailable",
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
