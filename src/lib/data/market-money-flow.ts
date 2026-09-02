import { createServerFn } from "@tanstack/react-start";
import { fetchText, n, parseMaybeJsonp } from "./fetch-util";
import { validateMoneyFlow } from "../calc/money-flow-validation";
import { tradingDateLabel } from "./trading-day";
import type { MarketOrder } from "../types";

export type MarketMoneyFlow = MarketOrder & {
  marketDate: string;
  turnover: number | null;
  previousTurnover: number | null;
  turnoverChangePct: number | null;
  turnoverState: "放量" | "缩量" | "持平" | "暂无可靠数据";
  source: string;
  sourceCount: number;
  confidence: "high" | "medium" | "low";
};

const EM_UT = "fa5fd1943c7b386f172d6893dbfba10b";
const FLOW_URL = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=6000&po=1&np=1&fltt=2&invt=2&fid=f62&fs=${encodeURIComponent("m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23")}&fields=f62,f66,f69,f72,f75,f6&ut=${EM_UT}`;
const mem = new Map<string, { at: number; value: MarketMoneyFlow }>();
const TTL = 90_000;

function finite(v: unknown) { const x = n(v); return x != null && Number.isFinite(x) ? x : null; }
function safe(v: number | null) { return v != null && Math.abs(v) <= 1e14 ? v : null; }
function summarize(rows: Record<string, unknown>[]): Omit<MarketMoneyFlow, "marketDate" | "turnover" | "previousTurnover" | "turnoverChangePct" | "turnoverState" | "source" | "sourceCount" | "confidence"> {
  const keys = ["f62", "f66", "f69", "f72", "f75"] as const;
  const sums = Object.fromEntries(keys.map((key) => [key, rows.reduce((sum, row) => sum + (finite(row[key]) ?? 0), 0)])) as Record<string, number>;
  const flow: MarketOrder = { main: safe(sums.f62) ?? 0, super: safe(sums.f66) ?? 0, large: safe(sums.f69) ?? 0, mid: safe(sums.f72) ?? 0, small: safe(sums.f75) ?? 0, count: rows.length, validation: "unreliable", internalDelta: 0, balanceDelta: 0, note: "" };
  const checked = validateMoneyFlow(flow);
  return { ...flow, validation: checked.validation, internalDelta: checked.internalDelta, balanceDelta: checked.balanceDelta, note: checked.reason };
}

async function fetchEastMoney() {
  const text = await fetchText(`${FLOW_URL}&_=${Date.now()}`, 5000, { Referer: "https://data.eastmoney.com/zjlx/" });
  const json = parseMaybeJsonp(text) as { data?: { diff?: unknown } };
  const rows = Array.isArray(json?.data?.diff) ? json.data!.diff as Record<string, unknown>[] : json?.data?.diff && typeof json.data.diff === "object" ? Object.values(json.data.diff) as Record<string, unknown>[] : [];
  if (!rows.length) throw new Error("empty-money-flow");
  return rows;
}

async function fetchTurnoverKline(secid: string) {
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58&klt=101&fqt=1&beg=-5&end=20500101&_=${Date.now()}`;
  const text = await fetchText(url, 5000, { Referer: "https://quote.eastmoney.com/" });
  const json = parseMaybeJsonp(text) as { data?: { klines?: unknown[] } };
  const rows = Array.isArray(json?.data?.klines) ? json.data!.klines.map((x) => String(x).split(",")) : [];
  return rows.map((parts) => ({ date: parts[0] || "", amount: finite(parts[5]) })).filter((x) => x.date && x.amount != null);
}

export const getMarketMoneyFlow = createServerFn({ method: "GET" }).handler(async (): Promise<MarketMoneyFlow | null> => {
  const key = tradingDateLabel();
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  try {
    const rows = await fetchEastMoney();
    const base = summarize(rows);
    if (base.count < 1000 || base.validation === "unreliable") return null;

    const [sh, sz] = await Promise.all([
      fetchTurnoverKline("1.000001").catch(() => []),
      fetchTurnoverKline("0.399001").catch(() => []),
    ]);
    const merged = new Map<string, number>();
    for (const row of [...sh, ...sz]) merged.set(row.date, (merged.get(row.date) ?? 0) + row.amount);
    const dates = [...merged.keys()].sort();
    const turnover = dates.length ? merged.get(dates.at(-1)!) ?? null : null;
    const previousTurnover = dates.length > 1 ? merged.get(dates.at(-2)!) ?? null : null;
    const turnoverChangePct = turnover != null && previousTurnover != null && previousTurnover > 0 ? (turnover / previousTurnover - 1) * 100 : null;
    const turnoverState: MarketMoneyFlow["turnoverState"] = turnoverChangePct == null ? "暂无可靠数据" : turnoverChangePct > 5 ? "放量" : turnoverChangePct < -5 ? "缩量" : "持平";
    const result: MarketMoneyFlow = { ...base, marketDate: key, turnover, previousTurnover, turnoverChangePct, turnoverState, source: "东方财富全A资金流 + 沪深成交额日线", sourceCount: 1, confidence: base.validation === "fully_consistent" ? "high" : "medium" };
    mem.set(key, { at: Date.now(), value: result });
    return result;
  } catch {
    return null;
  }
});
