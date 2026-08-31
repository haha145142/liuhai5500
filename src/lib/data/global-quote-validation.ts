import { fetchText, n } from "./fetch-util";
import type { GlobalQuote } from "../types";

const SINA_SYMBOLS: Record<string, string> = {
  "纳斯达克": "int_nasdaq",
  "标普500": "int_sp500",
  "道琼斯": "int_dji",
  "恒生指数": "int_hangseng",
};

function parseLine(raw: string, name: string): GlobalQuote | null {
  const m = raw.match(/=\"([^\"]*)\"/);
  if (!m) return null;
  const p = m[1].split(",");
  const symbol = SINA_SYMBOLS[name];
  if (!symbol) return null;

  // Sina international-index fields are generally name, price, change, pct.
  // HSI uses a longer HK-style payload where current price/pct are fields 6/7.
  const price = symbol === "int_hangseng" ? n(p[6]) : n(p[1]);
  const pct = symbol === "int_hangseng" ? n(p[7]) : n(p[3]);
  return price != null || pct != null ? { name, price, pct } : null;
}

function closeEnough(a: number | null, b: number | null, tolerance = 0.35) {
  return a != null && b != null && Math.abs(a - b) <= tolerance;
}

/**
 * Reconcile the existing Tencent global snapshot with Sina as an independent
 * fallback/cross-check. Sina only replaces a missing Tencent value; when both
 * exist, a material disagreement is surfaced but the Tencent value remains the
 * displayed anchor to avoid silently switching conventions between sources.
 */
export async function validateGlobalQuotes(base: GlobalQuote[]) {
  const names = Object.keys(SINA_SYMBOLS);
  if (!names.length) return { list: base, checked: 0, agreed: 0, fallback: 0, disputed: 0 };

  try {
    const raw = await fetchText(`https://hq.sinajs.cn/list=${names.map(nm => SINA_SYMBOLS[nm]).join(",")}`, 5000, {
      Referer: "https://finance.sina.com.cn/",
    });
    const lines = raw.split(";").map(s => s.trim()).filter(Boolean);
    const parsed = new Map<string, GlobalQuote>();
    for (const line of lines) {
      const name = names.find(nm => line.includes(`_${SINA_SYMBOLS[nm]}=`));
      if (!name) continue;
      const quote = parseLine(line, name);
      if (quote) parsed.set(name, quote);
    }

    let checked = 0;
    let agreed = 0;
    let fallback = 0;
    let disputed = 0;
    const list = base.map((item) => {
      const s = parsed.get(item.name);
      if (!s) return item;
      checked++;
      if (item.pct != null && s.pct != null && closeEnough(item.pct, s.pct)) {
        agreed++;
        return item;
      }
      if (item.pct == null && s.pct != null) {
        fallback++;
        return { ...item, pct: s.pct, price: item.price ?? s.price };
      }
      if (item.price == null && s.price != null) {
        fallback++;
        return { ...item, price: s.price, pct: item.pct ?? s.pct };
      }
      if (item.pct != null && s.pct != null && !closeEnough(item.pct, s.pct)) disputed++;
      return item;
    });

    return { list, checked, agreed, fallback, disputed };
  } catch {
    return { list: base, checked: 0, agreed: 0, fallback: 0, disputed: 0 };
  }
}
