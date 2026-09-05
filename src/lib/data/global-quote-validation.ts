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
  const price = symbol === "int_hangseng" ? n(p[6]) : n(p[1]);
  const pct = symbol === "int_hangseng" ? n(p[7]) : n(p[3]);
  return price != null || pct != null ? { name, price, pct } : null;
}

function closeEnough(a: number | null, b: number | null, tolerance = 0.35) {
  return a != null && b != null && Math.abs(a - b) <= tolerance;
}

function relativeDiff(a: number | null, b: number | null) {
  if (a == null || b == null || b === 0) return null;
  return Math.abs(a - b) / Math.abs(b);
}

/**
 * Reconcile the primary global snapshot with Sina independently.
 * A duplicated price across different indices is treated as a hard anomaly:
 * when Sina has a distinct valid quote, prefer the independent value instead
 * of allowing an obviously copied number to survive the validation layer.
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

    const priceCounts = new Map<number, number>();
    for (const item of base) {
      if (item.price == null || !Number.isFinite(item.price)) continue;
      const rounded = Number(item.price.toFixed(4));
      priceCounts.set(rounded, (priceCounts.get(rounded) ?? 0) + 1);
    }

    let checked = 0;
    let agreed = 0;
    let fallback = 0;
    let disputed = 0;
    const list = base.map((item) => {
      const s = parsed.get(item.name);
      if (!s) return item;
      checked++;

      const duplicateBasePrice = item.price != null && (priceCounts.get(Number(item.price.toFixed(4))) ?? 0) > 1;
      const priceGap = relativeDiff(item.price, s.price);
      const materialPriceDisagreement = priceGap != null && priceGap > 0.02;
      const pctAgrees = item.pct != null && s.pct != null && closeEnough(item.pct, s.pct);

      if (duplicateBasePrice && s.price != null && Number.isFinite(s.price) && (!pctAgrees || materialPriceDisagreement)) {
        fallback++;
        return { ...item, price: s.price, pct: s.pct ?? item.pct };
      }
      if (item.pct != null && s.pct != null && pctAgrees) {
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
      if (item.pct != null && s.pct != null && !closeEnough(item.pct, s.pct)) {
        disputed++;
        // A sufficiently large price disagreement plus pct disagreement means
        // the primary quote is stale or malformed; prefer the independent quote.
        if (materialPriceDisagreement && s.price != null) {
          fallback++;
          return { ...item, price: s.price, pct: s.pct };
        }
      }
      return item;
    });

    return { list, checked, agreed, fallback, disputed };
  } catch {
    return { list: base, checked: 0, agreed: 0, fallback: 0, disputed: 0 };
  }
}
