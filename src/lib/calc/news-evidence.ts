export type EvidenceLevel = "verified" | "corroborated" | "event_only" | "insufficient";

export type NewsEvidenceInput = {
  publishedAt: number | null;
  sourceUrl?: string | null;
  relatedSector: boolean;
  sectorPct?: number | null;
  sectorValidation?: "cross_checked" | "single_source" | "cached_latest_trading_day" | "unavailable";
  indexPct?: number | null;
  moneyFlow?: number | null;
  hasFundQuote?: boolean;
};

export type NewsEvidenceResult = {
  level: EvidenceLevel;
  label: string;
  checks: {
    publishTime: boolean;
    source: boolean;
    theme: boolean;
    market: boolean;
    flow: boolean;
    fund: boolean;
  };
  statement: string;
};

export function assessNewsEvidence(input: NewsEvidenceInput): NewsEvidenceResult {
  const checks = {
    publishTime: input.publishedAt != null && Number.isFinite(input.publishedAt) && input.publishedAt > 0,
    source: !!input.sourceUrl,
    theme: input.relatedSector,
    market: input.sectorPct != null && Number.isFinite(input.sectorPct) && input.sectorValidation !== "unavailable",
    flow: input.moneyFlow != null && Number.isFinite(input.moneyFlow),
    fund: input.hasFundQuote === true,
  };

  const verifiedMarket = checks.market && input.sectorValidation === "cross_checked";
  const corroborated = checks.market || checks.flow || checks.fund || (checks.theme && checks.source);

  if (checks.publishTime && checks.source && checks.theme && verifiedMarket && checks.flow) {
    return {
      level: "verified",
      label: "多维验证",
      checks,
      statement: "新闻主题、板块行情与资金数据方向一致，具备多维证据支持。",
    };
  }
  if (corroborated) {
    return {
      level: "corroborated",
      label: "部分验证",
      checks,
      statement: "存在主题关联及部分行情/资金/基金证据，但尚不足以确认完整趋势。",
    };
  }
  if (checks.theme || checks.source || checks.publishTime) {
    return {
      level: "event_only",
      label: "事件关联",
      checks,
      statement: "目前只有事件或主题关联证据，尚未验证趋势或资金兑现。",
    };
  }
  return {
    level: "insufficient",
    label: "证据不足",
    checks,
    statement: "当前可靠证据不足，不生成方向性结论。",
  };
}
