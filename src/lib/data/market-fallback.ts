import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { INDEX_DEFS, SECTOR_RULES } from "./sectors";
import type { IndexQuote, SectorQuote } from "../types";

function latestKline(raw: unknown): { date: string | null; close: number | null; pct: number | null } {
  const data = raw as { data?: { klines?: string[] } } | null;
  const lines = data?.data?.klines || [];
  const last = lines.at(-1)?.split(",") || [];
  if (!last.length) return { date: null, close: null, pct: null };
  return { date: last[0] || null, close: n(last[2]), pct: n(last[8]) };
}

async function fetchKline(secid: string): Promise<{ date: string | null; close: number | null; pct: number | null }> {
  try {
    const text = await fetchText(
      `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&end=20500101&lmt=2&ut=fa5fd1943c7b386f172d6893dbfba10b&_=${Date.now()}`,
      8000,
    );
    return latestKline(parseMaybeJsonp(text));
  } catch {
    return { date: null, close: null, pct: null };
  }
}

export const getLatestTradingMarketData = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ marketDate: string | null; indices: IndexQuote[]; sectors: SectorQuote[]; note: string }> => {
    const indexRows = await Promise.all(INDEX_DEFS.map(async (d) => ({ def: d, row: await fetchKline(d.secid) })));
    const marketDate = indexRows.map((x) => x.row.date).find(Boolean) || null;
    const indices = indexRows.map(({ def, row }) => ({
      name: def.name,
      code: def.code,
      secid: def.secid,
      price: row.close,
      pct: row.pct,
      change: null,
    }));

    const sectorRows = await Promise.all(SECTOR_RULES.map(async (r) => ({ rule: r, row: await fetchKline(`90.${r.bkCode}`) })));
    const sectors = sectorRows.map(({ rule, row }) => ({
      id: rule.id,
      name: rule.name,
      bkCode: rule.bkCode,
      change: row.pct,
      flow: null,
      super: null,
      large: null,
      mid: null,
      small: null,
      turnover: null,
      available: row.pct != null,
      streak: 0,
      etfCode: rule.etf?.code,
      etfName: rule.etf?.name,
    }));

    return {
      marketDate,
      indices,
      sectors,
      note: marketDate ? `最近交易日历史行情（${marketDate}）` : "最近交易日历史行情暂不可用",
    };
  });
