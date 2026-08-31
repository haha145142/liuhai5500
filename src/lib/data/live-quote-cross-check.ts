import { fetchText, n } from "./fetch-util";
import type { LiveHolding } from "./live-valuation";

type StockQuote = { price: number | null; pct: number | null; source: string };

function quoteSymbol(code: string) {
  if (/^(6|68|58)\d{4,5}$/.test(code) || /^5\d{5}$/.test(code)) return `sh${code}`;
  if (/^(0|3|15|16)\d{4}$/.test(code)) return `sz${code}`;
  return null;
}

function parseTencent(text: string): Map<string, StockQuote> {
  const out = new Map<string, StockQuote>();
  for (const line of text.split(";")) {
    const m = line.match(/v_(?:sh|sz)(\d{6})=\"([^\"]*)\"/);
    if (!m) continue;
    const p = m[2].split("~");
    out.set(m[1], { price: n(p[3]), pct: n(p[32]), source: "腾讯财经" });
  }
  return out;
}

function parseSina(text: string): Map<string, StockQuote> {
  const out = new Map<string, StockQuote>();
  for (const match of text.matchAll(/hq_str_(?:sh|sz)(\d{6})="([^"]*)"/g)) {
    const p = match[2].split(",");
    const prev = n(p[2]);
    const current = n(p[3]);
    const pct = prev != null && prev !== 0 && current != null ? ((current / prev) - 1) * 100 : null;
    out.set(match[1], { price: current, pct, source: "新浪财经" });
  }
  return out;
}

export type CrossCheckedHolding = LiveHolding & {
  quoteStatus: "cross_checked" | "single_source" | "disagreed" | "unavailable";
  quoteDeviationPctPoints: number | null;
  quoteNote: string;
};

export async function crossCheckStockQuotes(holdings: LiveHolding[]): Promise<CrossCheckedHolding[]> {
  const symbols = holdings.map((h) => ({ code: h.code, symbol: quoteSymbol(h.code) })).filter((x): x is { code: string; symbol: string } => !!x.symbol);
  if (!symbols.length) {
    return holdings.map((h) => ({ ...h, quoteStatus: "unavailable" as const, quoteDeviationPctPoints: null, quoteNote: "无法映射A股行情代码" }));
  }

  const joined = symbols.map((x) => x.symbol).join(",");
  const [tencentRaw, sinaRaw] = await Promise.all([
    fetchText(`https://qt.gtimg.cn/q=${joined}`, 8000).catch(() => ""),
    fetchText(`https://hq.sinajs.cn/list=${joined}`, 8000, { Referer: "https://finance.sina.com.cn/" }).catch(() => ""),
  ]);

  const tencent = parseTencent(tencentRaw);
  const sina = parseSina(sinaRaw);

  return holdings.map((holding) => {
    const primary = tencent.get(holding.code);
    const secondary = sina.get(holding.code);
    if (!primary && !secondary) {
      return { ...holding, quoteStatus: "unavailable", quoteDeviationPctPoints: null, quoteNote: "腾讯财经与新浪财经均无可靠行情" };
    }
    if (!primary) {
      return { ...holding, price: secondary?.price ?? null, pct: secondary?.pct ?? null, quoteStatus: "single_source", quoteDeviationPctPoints: null, quoteNote: "仅新浪财经有可靠行情" };
    }
    if (!secondary) {
      return { ...holding, price: primary.price, pct: primary.pct, quoteStatus: "single_source", quoteDeviationPctPoints: null, quoteNote: "仅腾讯财经有可靠行情" };
    }

    const pctDeviation = primary.pct != null && secondary.pct != null ? Math.abs(primary.pct - secondary.pct) : null;
    const priceDeviation = primary.price != null && secondary.price != null && primary.price !== 0
      ? Math.abs(primary.price - secondary.price) / Math.abs(primary.price) * 100
      : null;
    const pctAgree = pctDeviation == null || pctDeviation <= 0.15;
    const priceAgree = priceDeviation == null || priceDeviation <= 0.20;
    const agree = pctAgree && priceAgree;

    return {
      ...holding,
      price: primary.price,
      pct: primary.pct,
      quoteStatus: agree ? "cross_checked" : "disagreed",
      quoteDeviationPctPoints: pctDeviation,
      quoteNote: agree
        ? "腾讯财经 + 新浪财经交叉一致"
        : `腾讯财经与新浪财经存在分歧${pctDeviation != null ? `，涨跌幅差 ${pctDeviation.toFixed(2)} 个百分点` : ""}`,
    };
  });
}
