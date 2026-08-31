import { fetchText, n } from "./fetch-util";
import type { LiveHolding } from "./live-valuation-v2";

type StockQuote = { price: number | null; pct: number | null };

function quoteSymbol(code: string) {
  if (/^(6|68|58)\d{4,5}$/.test(code) || /^5\d{5}$/.test(code)) return `sh${code}`;
  if (/^(0|3|15|16)\d{4}$/.test(code)) return `sz${code}`;
  return null;
}
function parseTencent(text: string) {
  const out = new Map<string, StockQuote>();
  for (const line of text.split(";")) {
    const m = line.match(/v_(?:sh|sz)(\d{6})=\"([^\"]*)\"/);
    if (!m) continue;
    const p = m[2].split("~");
    out.set(m[1], { price: n(p[3]), pct: n(p[32]) });
  }
  return out;
}
function parseSina(text: string) {
  const out = new Map<string, StockQuote>();
  for (const match of text.matchAll(/hq_str_(?:sh|sz)(\d{6})="([^"]*)"/g)) {
    const p = match[2].split(",");
    const prev = n(p[2]);
    const current = n(p[3]);
    out.set(match[1], { price: current, pct: prev != null && prev !== 0 && current != null ? (current / prev - 1) * 100 : null });
  }
  return out;
}

export type CrossCheckedHolding = LiveHolding & {
  quoteStatus: "cross_checked" | "single_source" | "disagreed" | "unavailable";
  quoteDeviationPctPoints: number | null;
  quoteNote: string;
};

export async function crossCheckStockQuotes(holdings: LiveHolding[]): Promise<CrossCheckedHolding[]> {
  const mapped = holdings.map((h) => ({ code: h.code, symbol: quoteSymbol(h.code) })).filter((x): x is { code: string; symbol: string } => !!x.symbol);
  if (!mapped.length) return holdings.map((h) => ({ ...h, quoteStatus: "unavailable", quoteDeviationPctPoints: null, quoteNote: "无法映射A股行情代码" }));
  const joined = mapped.map((x) => x.symbol).join(",");
  const [tencentRaw, sinaRaw] = await Promise.all([
    fetchText(`https://qt.gtimg.cn/q=${joined}`, 6_000).catch(() => ""),
    fetchText(`https://hq.sinajs.cn/list=${joined}`, 6_000, { Referer: "https://finance.sina.com.cn/" }).catch(() => ""),
  ]);
  const tencent = parseTencent(tencentRaw);
  const sina = parseSina(sinaRaw);
  return holdings.map((holding) => {
    const a = tencent.get(holding.code);
    const b = sina.get(holding.code);
    if (!a && !b) return { ...holding, quoteStatus: "unavailable", quoteDeviationPctPoints: null, quoteNote: "腾讯财经与新浪财经均无可靠行情" };
    if (!a) return { ...holding, price: b?.price ?? null, pct: b?.pct ?? null, quoteStatus: "single_source", quoteDeviationPctPoints: null, quoteNote: "仅新浪财经有可靠行情" };
    if (!b) return { ...holding, price: a.price, pct: a.pct, quoteStatus: "single_source", quoteDeviationPctPoints: null, quoteNote: "仅腾讯财经有可靠行情" };
    const pctDeviation = a.pct != null && b.pct != null ? Math.abs(a.pct - b.pct) : null;
    const priceDeviation = a.price != null && b.price != null && a.price !== 0 ? Math.abs(a.price - b.price) / Math.abs(a.price) * 100 : null;
    const agree = (pctDeviation == null || pctDeviation <= 0.15) && (priceDeviation == null || priceDeviation <= 0.20);
    return {
      ...holding,
      price: a.price,
      pct: a.pct,
      quoteStatus: agree ? "cross_checked" : "disagreed",
      quoteDeviationPctPoints: pctDeviation,
      quoteNote: agree ? "腾讯财经 + 新浪财经交叉一致" : `腾讯财经与新浪财经存在分歧${pctDeviation != null ? `，涨跌幅差 ${pctDeviation.toFixed(2)} 个百分点` : ""}`,
    };
  });
}
