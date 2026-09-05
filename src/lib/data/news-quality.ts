import type { NewsItem } from "../types";

/** Normalize cosmetic differences so the same story from different feeds can be collapsed. */
export function newsKey(item: NewsItem): string {
  return item.title
    .toLowerCase()
    .replace(/[\u3000\s]+/g, "")
    .replace(/[，。、“”‘’：:；;！!？?（）()【】[\]《》<>「」『』·—–-]/g, "")
    .replace(/快讯|消息|最新|盘中|午间|收盘/g, "")
    .slice(0, 120);
}

export function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Map<string, NewsItem>();
  for (const item of items) {
    const key = newsKey(item);
    const previous = seen.get(key);
    if (!previous) {
      seen.set(key, item);
      continue;
    }
    // Never let an older duplicate replace a newer publication timestamp.
    // When timestamps tie (or both are unavailable), keep the richer record.
    const itemTs = item.publishedAt ?? -1;
    const previousTs = previous.publishedAt ?? -1;
    if (itemTs > previousTs) {
      seen.set(key, item);
      continue;
    }
    if (itemTs < previousTs) continue;
    const score = (x: NewsItem) => (x.summary ? 2 : 0) + (x.url ? 1 : 0) + (x.publishedAt != null ? 1 : 0);
    seen.set(key, score(item) > score(previous) ? item : previous);
  }
  return [...seen.values()].sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
}

export function isFreshPublication(item: NewsItem, now = Date.now()): boolean {
  return item.publishedAt != null && item.publishedAt <= now + 5 * 60_000;
}
