import { createServerFn } from "@tanstack/react-start";
import { fetchText, n } from "./fetch-util";

export type IndexValuation = {
  code: string;
  name: string;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  pePercentile: number | null;
  pbPercentile: number | null;
  percentile: number | null;
  dataDate: string | null;
  level: "高估" | "中性" | "低估" | "暂无可靠数据";
  source: string;
  updatedAt: string | null;
};

type Config = { code: string; secid: string; name: string };
const CORE: Config[] = [
  { code: "000001", secid: "1.000001", name: "上证指数" },
  { code: "399001", secid: "0.399001", name: "深证成指" },
  { code: "399006", secid: "0.399006", name: "创业板指" },
  { code: "000300", secid: "1.000300", name: "沪深300" },
];

const PERCENTILE_SOURCE = "https://baifenwei.com/indices/";

type PercentileSnapshot = { pePercentile: number; pbPercentile: number | null; dataDate: string | null };

function levelFromPercentile(percentile: number | null): IndexValuation["level"] {
  if (percentile == null) return "暂无可靠数据";
  if (percentile >= 70) return "高估";
  if (percentile <= 30) return "低估";
  return "中性";
}

function parsePercentileRow(normalized: string, code: string): PercentileSnapshot | null {
  const index = normalized.indexOf(code);
  if (index < 0) return null;
  const row = normalized.slice(index, Math.min(normalized.length, index + 900));
  const dates = [...row.matchAll(/20\d{2}-\d{2}-\d{2}/g)].map((m) => m[0]);
  const percents = [...row.matchAll(/(\d+(?:\.\d+)?)%/g)]
    .map((m) => Number(m[1]))
    .filter((v) => Number.isFinite(v) && v >= 0 && v <= 100);
  if (percents.length < 2) return null;
  return { pePercentile: percents[0], pbPercentile: percents[1], dataDate: dates[0] ?? null };
}

async function loadPercentiles(): Promise<Map<string, PercentileSnapshot>> {
  try {
    const raw = await fetchText(`${PERCENTILE_SOURCE}?_=${Date.now()}`, 8000, { Referer: "https://baifenwei.com/" });
    const normalized = raw.replace(/\s+/g, " ");
    const result = new Map<string, PercentileSnapshot>();
    for (const code of ["399001", "399006", "000300", "000001"]) {
      const snapshot = parsePercentileRow(normalized, code);
      if (snapshot) result.set(code, snapshot);
    }
    return result;
  } catch {
    return new Map();
  }
}

async function load(config: Config, percentiles: Map<string, PercentileSnapshot>): Promise<IndexValuation> {
  try {
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${config.secid}&fields=f57,f58,f43,f169,f162,f167&_=${Date.now()}`;
    const raw = await fetchText(url, 7000, { Referer: "https://quote.eastmoney.com/" });
    const data = JSON.parse(raw)?.data as Record<string, unknown> | null;
    const peRaw = n(data?.f162);
    const pbRaw = n(data?.f167);
    const pe = peRaw == null ? null : peRaw / 100;
    const pb = pbRaw == null ? null : pbRaw / 100;
    const roe = pe != null && pb != null && pe > 0 ? (pb / pe) * 100 : null;
    const valuation = percentiles.get(config.code);
    const pePercentile = valuation?.pePercentile ?? null;
    const pbPercentile = valuation?.pbPercentile ?? null;
    const percentile = pePercentile != null && pbPercentile != null
      ? pePercentile * 0.6 + pbPercentile * 0.4
      : pePercentile ?? pbPercentile;
    const level = levelFromPercentile(percentile);
    const sourceParts = ["东方财富 PE/PB 实时字段"];
    if (percentile != null) sourceParts.push("百分位：百分位官网近10年指数估值表");
    if (valuation?.dataDate) sourceParts.push(`数据日 ${valuation.dataDate}`);
    if (roe != null) sourceParts.push("ROE由PB/PE推导");
    return { code: config.code, name: config.name, pe, pb, roe, pePercentile, pbPercentile, percentile, dataDate: valuation?.dataDate ?? null, level, source: sourceParts.join(" · "), updatedAt: new Date().toISOString() };
  } catch {
    return { code: config.code, name: config.name, pe: null, pb: null, roe: null, pePercentile: null, pbPercentile: null, percentile: null, dataDate: null, level: "暂无可靠数据", source: "暂无可靠指数估值数据", updatedAt: null };
  }
}

export const getCoreIndexValuations = createServerFn({ method: "GET" }).handler(async (): Promise<IndexValuation[]> => {
  const percentiles = await loadPercentiles();
  return Promise.all(CORE.map((config) => load(config, percentiles)));
});
