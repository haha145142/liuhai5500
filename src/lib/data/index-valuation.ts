import { createServerFn } from "@tanstack/react-start";
import { fetchText, n } from "./fetch-util";

export type IndexValuation = {
  code: string;
  name: string;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  percentile: number | null;
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

function level(percentile: number | null): IndexValuation["level"] {
  if (percentile == null || !Number.isFinite(percentile)) return "暂无可靠数据";
  if (percentile >= 80) return "高估";
  if (percentile <= 20) return "低估";
  return "中性";
}

async function load(config: Config): Promise<IndexValuation> {
  try {
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${config.secid}&fields=f57,f58,f43,f169,f162,f167&_=${Date.now()}`;
    const raw = await fetchText(url, 7000, { Referer: "https://quote.eastmoney.com/" });
    const data = JSON.parse(raw)?.data as Record<string, unknown> | null;
    const peRaw = n(data?.f162);
    const pbRaw = n(data?.f167);
    const pe = peRaw == null ? null : peRaw / 100;
    const pb = pbRaw == null ? null : pbRaw / 100;
    return {
      code: config.code,
      name: config.name,
      pe,
      pb,
      roe: null,
      percentile: null,
      level: "暂无可靠数据",
      source: pe != null || pb != null ? "东方财富指数行情" : "东方财富指数估值字段不可用",
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return { code: config.code, name: config.name, pe: null, pb: null, roe: null, percentile: null, level: "暂无可靠数据", source: "暂无可靠指数估值数据", updatedAt: null };
  }
}

export const getCoreIndexValuations = createServerFn({ method: "GET" }).handler(async (): Promise<IndexValuation[]> => {
  return Promise.all(CORE.map(load));
});
