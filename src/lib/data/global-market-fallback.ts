import { createServerFn } from "@tanstack/react-start";
import { fetchText, n } from "./fetch-util";
import type { GlobalQuote } from "../types";

const GLOBALS: Array<{ name: string; symbol: string }> = [
  { name: "纳斯达克", symbol: "%5EIXIC" },
  { name: "标普500", symbol: "%5EGSPC" },
  { name: "道琼斯", symbol: "%5EDJI" },
  { name: "恒生指数", symbol: "%5EHSI" },
  { name: "黄金", symbol: "GC%3DF" },
  { name: "原油", symbol: "CL%3DF" },
  { name: "美元指数", symbol: "DX-Y.NYB" },
];

function finite(v: number | null | undefined) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pct(v: number | null | undefined) {
  const x = finite(v);
  return x != null && Math.abs(x) <= 30 ? x : null;
}

async function fetchOne(item: (typeof GLOBALS)[number]): Promise<GlobalQuote> {
  try {
    const raw = await fetchText(
      `https://query1.finance.yahoo.com/v8/finance/chart/${item.symbol}?range=5d&interval=1d&includePrePost=false&events=history&_=${Date.now()}`,
      7000,
      { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    );
    const parsed = JSON.parse(raw) as any;
    const result = parsed?.chart?.result?.[0];
    const closes = (result?.indicators?.quote?.[0]?.close ?? []).map((x: unknown) => n(x)).filter((x: number | null): x is number => x != null && Number.isFinite(x));
    const previousClose = finite(result?.meta?.previousClose) ?? (closes.length > 1 ? closes[closes.length - 2] : null);
    const last = finite(result?.meta?.regularMarketPrice) ?? (closes.length ? closes[closes.length - 1] : null);
    const change = last != null && previousClose != null && previousClose !== 0 ? pct(((last - previousClose) / previousClose) * 100) : null;
    return { name: item.name, price: last, pct: change };
  } catch {
    return { name: item.name, price: null, pct: null };
  }
}

export const getGlobalMarketFallback = createServerFn({ method: "GET" }).handler(async (): Promise<GlobalQuote[]> => Promise.all(GLOBALS.map(fetchOne)));
