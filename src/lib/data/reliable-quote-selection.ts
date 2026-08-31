export type ComparableQuote = { price: number; pct: number };

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Select a consensus quote instead of trusting the fastest source. */
export function selectConsensusQuote(quotes: ComparableQuote[]): ComparableQuote | null {
  if (!quotes.length) return null;
  if (quotes.length === 1) return quotes[0];
  return { price: median(quotes.map(q => q.price)), pct: median(quotes.map(q => q.pct)) };
}
