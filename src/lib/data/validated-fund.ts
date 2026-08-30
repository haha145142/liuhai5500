import { createServerFn } from "@tanstack/react-start";
import { getCalculatedFund } from "./live-valuation";
import { getMultiSourceQuote } from "./multi-source-quotes";
import type { FundQuote } from "../types";

type LiveHolding = NonNullable<Awaited<ReturnType<typeof getCalculatedFund>>>["liveHoldings"] extends Array<infer T> ? T : never;

function canUse(q: Awaited<ReturnType<typeof getMultiSourceQuote>>) {
  return q.pct != null && (q.agreement === "three_source" || q.agreement === "two_source" || q.agreement === "single_source");
}

export const getValidatedFund = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<FundQuote> => {
    const base = await getCalculatedFund({ data: { code: data.code } });
    const holdings = (base as FundQuote & { liveHoldings?: LiveHolding[] }).liveHoldings || [];
    if (!holdings.length || base.nav == null || base.officialNavPublished) return base;

    const validated = await Promise.all(
      holdings.map(async (h) => ({ holding: h, quote: await getMultiSourceQuote(h.code) })),
    );
    const usable = validated.filter((x) => x.holding.weight > 0 && canUse(x.quote));
    if (!usable.length) {
      return {
        ...base,
        estimate: null,
        estimatePct: null,
        estimateConfidence: "low",
        valuationStatus: base.nav != null ? "waiting_official_nav" : "unavailable",
        source: "三源实时行情均未达到可靠门槛，暂不生成盘中穿透估值",
        estimateValidation: "三源数据不足",
      };
    }

    const pct = usable.reduce((sum, x) => sum + x.holding.weight * (x.quote.pct as number), 0) / 100;
    const estimate = base.nav * (1 + pct / 100);
    const three = usable.filter((x) => x.quote.agreement === "three_source").length;
    const two = usable.filter((x) => x.quote.agreement === "two_source").length;
    const disputed = validated.filter((x) => x.quote.agreement === "disputed").length;
    const sourceAgreementPct = usable.length ? ((three + two) / usable.length) * 100 : 0;
    const weightedCoverage = usable.reduce((sum, x) => sum + x.holding.weight, 0);

    let confidence: "high" | "medium" | "low" = "low";
    if (sourceAgreementPct >= 85 && weightedCoverage >= 60) confidence = "high";
    else if (sourceAgreementPct >= 60 && weightedCoverage >= 35) confidence = "medium";

    return {
      ...base,
      estimate,
      estimatePct: pct,
      estimateConfidence: confidence,
      estimateCoverage: Math.min(100, weightedCoverage),
      usableWeight: weightedCoverage,
      source: `自有穿透估值 · 三源实时行情校验 · 腾讯 ${three + two > 0 ? "✓" : "×"} · 东方财富 ✓ · 新浪 ${three > 0 ? "✓" : two > 0 ? "部分一致" : "×"}`,
      estimateValidation: disputed > 0 ? `三源核验 · ${three}组三源一致 · ${two}组双源一致 · ${disputed}组存在分歧` : `三源核验 · ${three}组三源一致 · ${two}组双源一致`,
      liveHoldings: holdings.map((h) => {
        const item = validated.find((x) => x.holding.code === h.code);
        if (!item) return h;
        return {
          ...h,
          price: item.quote.price,
          pct: item.quote.pct,
          source: `三源：${item.quote.agreement}`,
        };
      }),
    } as FundQuote;
  });
