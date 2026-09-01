import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { isExchangeClosed, tradingDateLabel } from "./trading-day";

export type MarketFlowRow = {
  code: string;
  name: string;
  change: number | null;
  main: number | null;
  super: number | null;
  large: number | null;
  mid: number | null;
  small: number | null;
};

export type MarketPanorama = {
  topIn: MarketFlowRow[];
  topOut: MarketFlowRow[];
  order: { main: number; super: number; large: number; mid: number; small: number; count: number } | null;
  validation: "consistent" | "partial" | "unreliable" | "unavailable";
  marketDate: string;
  source: string;
  fetchedAt: number;
};

const UT = "fa5fd1943c7b386f172d6893dbfba10b";
const BOARD_FIELDS = "f12,f14,f3,f62,f66,f72,f78,f84";
const STOCK_FIELDS = "f12,f14,f62,f66,f72,f78,f84";

function arr(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object") return Object.values(value) as Record<string, unknown>[];
  return [];
}

async function fetchBoards() {
  const text = await fetchText(
    `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=1200&po=1&np=1&fltt=2&invt=2&fid=f62&fs=m:90+t:2,m:90+t:3&fields=${encodeURIComponent(BOARD_FIELDS)}&ut=${UT}&_=${Date.now()}`,
    10_000,
    { Referer: "https://data.eastmoney.com/zjlx/" },
  );
  const parsed = parseMaybeJsonp(text) as { data?: { diff?: unknown } };
  return arr(parsed?.data?.diff).filter((x) => String(x.f14 ?? "").trim());
}

async function fetchStocks() {
  const text = await fetchText(
    `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=6000&po=1&np=1&fltt=2&invt=2&fid=f62&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=${encodeURIComponent(STOCK_FIELDS)}&ut=${UT}&_=${Date.now()}`,
    12_000,
    { Referer: "https://data.eastmoney.com/zjlx/dpzjlx.html" },
  );
  const parsed = parseMaybeJsonp(text) as { data?: { diff?: unknown } };
  return arr(parsed?.data?.diff);
}

function rowToFlow(row: Record<string, unknown>): MarketFlowRow {
  return {
    code: String(row.f12 ?? ""),
    name: String(row.f14 ?? ""),
    change: n(row.f3),
    main: n(row.f62),
    super: n(row.f66),
    large: n(row.f72),
    mid: n(row.f78),
    small: n(row.f84),
  };
}

function validateOrder(order: MarketPanorama["order"]) {
  if (!order) return "unavailable" as const;
  const internal = Math.abs(order.main - (order.super + order.large));
  const balance = Math.abs(order.main + order.mid + order.small);
  const scale = Math.max(1, Math.abs(order.main), Math.abs(order.mid), Math.abs(order.small));
  const tolerance = Math.max(1, scale * 0.02);
  return internal <= Math.max(1, Math.abs(order.main) * 0.02) && balance <= tolerance
    ? "consistent" as const
    : internal <= Math.max(1, Math.abs(order.main) * 0.02) || balance <= tolerance
      ? "partial" as const
      : "unreliable" as const;
}

export const getMarketPanorama = createServerFn({ method: "GET" }).handler(async (): Promise<MarketPanorama> => {
  const marketDate = tradingDateLabel();
  try {
    const [boards, stocks] = await Promise.all([fetchBoards(), fetchStocks()]);
    const boardRows = boards.map(rowToFlow).filter((x) => x.name && x.main != null);
    const topIn = boardRows.slice().sort((a, b) => (b.main ?? -Infinity) - (a.main ?? -Infinity)).slice(0, 5);
    const topOut = boardRows.slice().sort((a, b) => (a.main ?? Infinity) - (b.main ?? Infinity)).slice(0, 5);

    let order: MarketPanorama["order"] = null;
    if (stocks.length) {
      const sum = (key: string) => stocks.reduce<number | null>((total, row) => {
        const value = n(row[key]);
        return value == null ? null : (total ?? 0) + value;
      }, 0);
      const main = sum("f62"); const superFlow = sum("f66"); const large = sum("f72");
      const mid = sum("f78"); const small = sum("f84");
      if ([main, superFlow, large, mid, small].every((x) => x != null)) {
        order = { main: main!, super: superFlow!, large: large!, mid: mid!, small: small!, count: stocks.length };
      }
    }
    return {
      topIn,
      topOut,
      order,
      validation: validateOrder(order),
      marketDate,
      source: "东方财富板块 + 全A股资金流字段（f62/f66/f72/f78/f84）",
      fetchedAt: Date.now(),
    };
  } catch {
    return { topIn: [], topOut: [], order: null, validation: "unavailable", marketDate, source: "资金数据源暂不可用", fetchedAt: Date.now() };
  }
});
