export type SourceKind = "fund_nav" | "fund_intraday" | "stock_quote" | "market_index" | "news";

export type SourceHealth = {
  source: string;
  kind: SourceKind;
  healthy: boolean;
  lastSuccessAt: string | null;
  latencyMs: number | null;
  checkedAt: string;
  note: string;
};

export function summarizeSources(
  samples: Array<Omit<SourceHealth, "checkedAt"> & { checkedAt?: string }>,
): { healthy: number; degraded: number; unavailable: number; items: SourceHealth[] } {
  const items = samples.map((sample) => ({
    ...sample,
    checkedAt: sample.checkedAt ?? new Date().toISOString(),
  }));
  return {
    healthy: items.filter((x) => x.healthy).length,
    degraded: items.filter((x) => !x.healthy && x.lastSuccessAt != null).length,
    unavailable: items.filter((x) => !x.healthy && x.lastSuccessAt == null).length,
    items,
  };
}
