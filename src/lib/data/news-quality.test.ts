import assert from "node:assert/strict";
import test from "node:test";
import { dedupeNews } from "./news-quality.ts";
import type { NewsItem } from "../types.ts";

function item(overrides: Partial<NewsItem>): NewsItem {
  return {
    id: "1",
    title: "同一条快讯",
    summary: "完整摘要",
    source: "测试源",
    url: "https://example.com",
    publishedAt: Date.parse("2026-09-02T01:00:00Z"),
    fetchedAt: Date.parse("2026-09-02T01:01:00Z"),
    category: "market",
    sentiment: "neutral",
    relatedSectors: [],
    ...overrides,
  };
}

test("duplicate news prefers the newer real publication timestamp", () => {
  const older = item({ id: "old", publishedAt: Date.parse("2026-09-02T00:55:00Z"), summary: "更完整的旧摘要" });
  const newer = item({ id: "new", publishedAt: Date.parse("2026-09-02T01:05:00Z"), summary: "较短摘要" });
  const [result] = dedupeNews([older, newer]);
  assert.equal(result?.id, "new");
  assert.equal(result?.publishedAt, newer.publishedAt);
});

test("duplicate news still prefers richer record when publication timestamps tie", () => {
  const sparse = item({ id: "sparse", summary: "", url: "", publishedAt: Date.parse("2026-09-02T01:00:00Z") });
  const rich = item({ id: "rich", summary: "完整摘要", url: "https://example.com/real", publishedAt: Date.parse("2026-09-02T01:00:00Z") });
  const [result] = dedupeNews([sparse, rich]);
  assert.equal(result?.id, "rich");
});
