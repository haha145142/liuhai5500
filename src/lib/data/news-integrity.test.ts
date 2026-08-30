import test from "node:test";
import assert from "node:assert/strict";
import { mergeNewsItems, assessNewsItem } from "./news-integrity";
import type { NewsItem } from "@/lib/types";

function item(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: "1",
    title: "测试新闻",
    summary: "摘要",
    source: "测试来源",
    url: "https://example.com/news",
    publishedAt: null,
    fetchedAt: Date.now(),
    category: "market",
    sentiment: "neutral",
    relatedSectors: [],
    ...overrides,
  };
}

test("unknown publication time never becomes a reliable timestamp", () => {
  const x = item({ publishedAt: null });
  assert.equal(assessNewsItem(x).hasReliablePublishedAt, false);
});

test("duplicate titles prefer a real publication timestamp", () => {
  const unknown = item({ id: "unknown", publishedAt: null, summary: "刚抓到的版本" });
  const known = item({ id: "known", publishedAt: 1_750_000_000_000, summary: "有真实发布时间的版本" });
  const result = mergeNewsItems([unknown, known]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, "known");
});

test("richer source metadata wins when both publication times are unknown", () => {
  const plain = item({ id: "plain", publishedAt: null, url: "", summary: "" });
  const richer = item({ id: "richer", publishedAt: null, url: "https://example.com", summary: "更完整摘要" });
  const result = mergeNewsItems([plain, richer]);
  assert.equal(result[0]?.id, "richer");
});
