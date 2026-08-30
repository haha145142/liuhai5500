import type { NewsItem } from "@/lib/types";

export type NewsIntegrity = {
  hasReliablePublishedAt: boolean;
  hasSourceUrl: boolean;
  hasSummary: boolean;
  freshness: "known" | "unknown";
};

/**
 * News publication time and fetch time are different concepts.
 * This helper never derives a publication time from fetchedAt.
 */
export function assessNewsItem(item: NewsItem): NewsIntegrity {
  const hasReliablePublishedAt = item.publishedAt != null && Number.isFinite(item.publishedAt) && item.publishedAt > 0;
  const hasSourceUrl = /^https?:\/\//i.test(item.url || "");
  const hasSummary = Boolean(item.summary?.trim());
  return {
    hasReliablePublishedAt,
    hasSourceUrl,
    hasSummary,
    freshness: hasReliablePublishedAt ? "known" : "unknown",
  };
}

function score(item: NewsItem): number {
  const meta = assessNewsItem(item);
  return (meta.hasReliablePublishedAt ? 8 : 0)
    + (meta.hasSourceUrl ? 4 : 0)
    + (meta.hasSummary ? 2 : 0)
    + Math.min((item.summary || "").length, 180) / 180;
}

/**
 * Merge same-title articles without letting a late fetch overwrite an older
 * article's real publication time. A version with a reliable publishedAt wins
 * over an unknown-time version; otherwise the richer source wins.
 */
export function mergeNewsItems(items: NewsItem[]): NewsItem[] {
  const byTitle = new Map<string, NewsItem>();
  for (const item of items) {
    const key = item.title.trim().replace(/\s+/g, " ").toLowerCase();
    if (!key) continue;
    const current = byTitle.get(key);
    if (!current || score(item) > score(current)) byTitle.set(key, item);
  }
  return [...byTitle.values()].sort((a, b) => {
    const at = a.publishedAt ?? -Infinity;
    const bt = b.publishedAt ?? -Infinity;
    if (at !== bt) return bt - at;
    return score(b) - score(a);
  });
}

/** Never use fetchedAt as a publication timestamp. */
export function displayNewsTimestamp(item: NewsItem): number | null {
  const meta = assessNewsItem(item);
  return meta.hasReliablePublishedAt ? item.publishedAt! : null;
}
