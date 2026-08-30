import { createServerFn } from "@tanstack/react-start";
import { getCalculatedFund } from "./live-valuation";
import { getMultiSourceQuote, type MultiSourceQuote } from "./multi-source-quotes";
import type { FundQuote } from "../types";

type LiveHolding = NonNullable<Awaited<ReturnType<typeof getCalculatedFund>>>["liveHoldings"] extends Array<infer T> ? T : never;

type AuditStats = {
  three: number;
  two: number;
  single: number;
  disputed: number;
  unavailable: number;
  usableWeight: number;
  weightedHealth: number;
  weightedAgreement: number;
};

function canUse(q: MultiSourceQuote) {
  return q.pct != null && (q.agreement === "three_source" || q.agreement === "two_source" || q.agreement === "single_source");
}

function healthScore(q: MultiSourceQuote) {
  if (!q.health.length) return 0;
  return q.health.reduce((sum, h) => sum + h.score, 0) / q.health.length;
}

function agreementScore(q: MultiSourceQuote) {
  if (q.agreement === "three_source") return 100;
  if (q.agreement === "two_source") return 80;
  if (q.agreement === "single_source") return 55;
  if (q.agreement === "disputed") return 20;
  return 0;
}

function confidenceFrom(stats: AuditStats): "high" | "medium" | "low" {
  if (stats.usableWeight >= 60 && stats.weightedAgreement >= 85 && stats.weightedHealth >= 80) return "high";
  if (stats.usableWeight >= 35 && stats.weightedAgreement >= 65 && stats.weightedHealth >= 65) return "medium";
  return "low";
}

export const getValidatedFund = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<FundQuote> => {
    const base = await getCalculatedFund({ data: { code: data.code } });
    const holdings = (base as FundQuote & { liveHoldings?: LiveHolding[] }).liveHoldings || [];
    if (!holdings.length || base.nav == null || base.officialNavPublished) return base;

    const validated = await Promise.all(
      holdings.map(async (holding) => ({ holding, quote: await getMultiSourceQuote(holding.code) })),
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

    const allWeight = Math.max(0.0001, holdings.reduce((sum, h) => sum + Math.max(0, h.weight), 0));
    const stats: AuditStats = {
      three: usable.filter((x) => x.quote.agreement === "three_source").length,
      two: usable.filter((x) => x.quote.agreement === "two_source").length,
      single: usable.filter((x) => x.quote.agreement === "single_source").length,
      disputed: validated.filter((x) => x.quote.agreement === "disputed").length,
      unavailable: validated.filter((x) => x.quote.agreement === "unavailable").length,
      usableWeight: usable.reduce((sum, x) => sum + x.holding.weight, 0),
      weightedHealth: usable.reduce((sum, x) => sum + x.holding.weight * healthScore(x.quote), 0) / Math.max(0.0001, usable.reduce((sum, x) => sum + x.holding.weight, 0)),
      weightedAgreement: usable.reduce((sum, x) => sum + x.holding.weight * agreementScore(x.quote), 0) / Math.max(0.0001, usable.reduce((sum, x) => sum + x.holding.weight, 0)),
    };

    const confidence = confidenceFrom(stats);
    const coverage = Math.min(100, stats.usableWeight);
    const agreementPct = Math.round(stats.weightedAgreement);
    const healthPct = Math.round(stats.weightedHealth);
    const auditLabel = `三源核验 · ${stats.three}组三源一致 · ${stats.two}组双源一致 · ${stats.single}组单源可用 · ${stats.disputed}组分歧 · 健康${healthPct}`;
    const validation = stats.disputed > 0
      ? `${auditLabel} · 覆盖 ${coverage.toFixed(1)}% · 加权一致度 ${agreementPct}`
      : `${auditLabel} · 覆盖 ${coverage.toFixed(1)}% · 加权一致度 ${agreementPct}`;

    return {
      ...base,
      estimate,
      estimatePct: pct,
      estimateConfidence: confidence,
      estimateCoverage: coverage,
      usableWeight: stats.usableWeight,
      source: `自有穿透估值 · 三源实时行情校验 · 加权健康 ${healthPct}`,
      estimateValidation: validation,
      liveHoldings: holdings.map((h) => {
        const item = validated.find((x) => x.holding.code === h.code);
        if (!item) return h;
        const q = item.quote;
        const sourceLabel = q.agreement === "three_source"
          ? "三源一致"
          : q.agreement === "two_source"
            ? "双源一致"
            : q.agreement === "single_source"
              ? "单源可用"
              : q.agreement === "disputed"
                ? "来源分歧"
                : "暂无可靠行情";
        return {
          ...h,
          price: q.price,
          pct: q.pct,
          source: `${sourceLabel} · 健康${Math.round(healthScore(q))}`,
        };
      }),
    } as FundQuote;
  });
