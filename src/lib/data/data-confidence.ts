export type DataConfidence = "verified" | "single_source" | "degraded_cache" | "unavailable";

export type ConfidenceInput = {
  hasValue: boolean;
  crossChecked?: boolean;
  fromCache?: boolean;
  stale?: boolean;
};

export function resolveDataConfidence(input: ConfidenceInput): DataConfidence {
  if (!input.hasValue) return "unavailable";
  if (input.crossChecked) return "verified";
  if (input.fromCache || input.stale) return "degraded_cache";
  return "single_source";
}

export function confidenceLabel(value: DataConfidence): string {
  switch (value) {
    case "verified": return "已核验";
    case "single_source": return "单源可用";
    case "degraded_cache": return "缓存降级";
    case "unavailable": return "暂无可靠数据";
  }
}
