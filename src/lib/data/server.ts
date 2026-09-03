import { getResilientFund } from "./resilient-fund";
import { getCalculatedFund } from "./live-valuation-v2";
import { getMarketPhase } from "../market-hours";
import { getSnapshot as getStableSnapshot } from "./server-stable";
import { getMultiSourceQuote } from "./multi-source-quotes";
import { validateGlobalQuotes } from "./global-quote-validation";
import { preserveReliableSnapshot } from "./reliable-snapshot";
import { sharedCacheGet, sharedCacheSet } from "./shared-cache";
import { getMarketMoneyFlow } from "./market-money-flow";
import { normalizeFundValuationState } from "./fund-valuation-state";
import type { FundQuote, Snapshot } from "../types";

export { calcIndicators } from "./server-stable";
export { getNews } from "./server-news";
export { getFundSectorQuotes } from "./fund-sector";
export type { FundSectorQuote } from "./fund-sector";
export { searchFund, getFundRank, analyzeMarket, analyzeNews } from "./compat";
export { testDeepSeek, analyzeDeepSeek } from "./deepseek";

const FUND_CACHE_TTL_MS = 25_000;
const FUND_POSTCLOSE_TTL_MS = 5_000;
const FUND_SHARED_CACHE_TTL_MS = 60_000;
const FUND_ESTIMATE_SHARED_CACHE_TTL_MS = 5_000;
const FUND_REGISTRY_TTL_MS = 30 * 24 * 60 * 60_000;
const FUND_REGISTRY_KEY = "fund-ai-pro:prewarm:fund-codes";
const SNAPSHOT_FIELD_TTL = { indices: 15_000, sectors: 60_000, flow: 5 * 60_000, global: 60_000, metadata: 60_000 } as const;
const fundResolved = new Map<string, { at: number; value: FundQuote }>();
const fundPending = new Map<string, Promise<FundQuote>>();
const postCloseEstimate = new Map<string, FundQuote>();
let snapshotPending: Promise<Snapshot> | null = null;

type SnapshotField<T> = { generation: string; value: T };
type SnapshotMeta = { generation: string; sources: Snapshot["sources"]; marketDate: string | null; fetchedAt: number; validation: Snapshot["validation"] };

function chinaDateLabel(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}
function usableFundData(quote: FundQuote | null | undefined) { return !!quote && (quote.nav != null || quote.estimate != null || quote.historyPoints.length > 0 || quote.metrics != null); }
function isSameDayEstimate(quote: FundQuote | null | undefined) { return !!quote && quote.officialNavPublished !== true && quote.estimate != null && quote.estimateTime != null && chinaDateLabel(new Date(quote.estimateTime)) === chinaDateLabel(); }

async function rememberFundCode(code: string) {
  if (!/^\d{6}$/.test(code)) return;
  try {
    const cached = await sharedCacheGet<string[]>(FUND_REGISTRY_KEY);
    const existing = Array.isArray(cached?.value) ? cached.value.filter((x) => /^\d{6}$/.test(String(x))) : [];
    const next = [code, ...existing.filter((x) => x !== code)].slice(0, 200);
    await sharedCacheSet(FUND_REGISTRY_KEY, next, FUND_REGISTRY_TTL_MS);
  } catch {}
}

export async function getPrewarmFundCodes(): Promise<string[]> {
  const cached = await sharedCacheGet<string[]>(FUND_REGISTRY_KEY);
  return Array.isArray(cached?.value) ? cached.value.filter((x) => /^\d{6}$/.test(String(x))).slice(0, 200) : [];
}

async function loadFundQuote(code: string): Promise<FundQuote> {
  const phase = getMarketPhase();
  try {
    const calculated = normalizeFundValuationState(await getCalculatedFund({ data: { code } }));
    if (isSameDayEstimate(calculated)) postCloseEstimate.set(code, calculated);
    if (usableFundData(calculated) && (calculated.officialNavPublished || calculated.valuationStatus === "estimate" || calculated.estimate != null)) return calculated;
  } catch {}
  if (phase === "postclose") {
    const saved = postCloseEstimate.get(code);
    if (saved && isSameDayEstimate(saved)) return saved;
  }
  return normalizeFundValuationState(await getResilientFund({ data: { code } }));
}

export async function refreshFundQuote(code: string): Promise<FundQuote> {
  const normalizedCode = code.trim();
  await rememberFundCode(normalizedCode);
  const value = normalizeFundValuationState(await loadFundQuote(normalizedCode));
  if (usableFundData(value)) {
    fundResolved.set(normalizedCode, { at: Date.now(), value });
    if (isSameDayEstimate(value)) postCloseEstimate.set(normalizedCode, value);
    await sharedCacheSet(`fund-ai-pro:fund:${normalizedCode}`, value, isSameDayEstimate(value) ? FUND_ESTIMATE_SHARED_CACHE_TTL_MS : FUND_SHARED_CACHE_TTL_MS);
  }
  return value;
}

export const getFund = async ({ data }: { data: { code: string } }): Promise<FundQuote> => {
  const code = data.code.trim();
  void rememberFundCode(code);
  const phase = getMarketPhase();
  const localTtl = phase === "postclose" ? FUND_POSTCLOSE_TTL_MS : FUND_CACHE_TTL_MS;
  const cached = fundResolved.get(code);
  if (cached && Date.now() - cached.at < localTtl) return normalizeFundValuationState(cached.value);
  const running = fundPending.get(code);
  if (running) return running;
  const shared = await sharedCacheGet<FundQuote>(`fund-ai-pro:fund:${code}`);
  if (shared?.value && usableFundData(shared.value)) {
    const normalized = normalizeFundValuationState(shared.value);
    const sameDayEstimate = isSameDayEstimate(normalized);
    if (normalized.officialNavPublished === true || phase !== "postclose" || sameDayEstimate) {
      fundResolved.set(code, { at: Date.now(), value: normalized });
      if (sameDayEstimate) postCloseEstimate.set(code, normalized);
      return normalized;
    }
  }
  const request = loadFundQuote(code).then((value) => {
    const normalized = normalizeFundValuationState(value);
    if (usableFundData(normalized)) {
      fundResolved.set(code, { at: Date.now(), value: normalized });
      if (isSameDayEstimate(normalized)) postCloseEstimate.set(code, normalized);
      void sharedCacheSet(`fund-ai-pro:fund:${code}`, normalized, isSameDayEstimate(normalized) ? FUND_ESTIMATE_SHARED_CACHE_TTL_MS : FUND_SHARED_CACHE_TTL_MS).catch(() => {});
    }
    return normalized;
  }).finally(() => fundPending.delete(code));
  fundPending.set(code, request);
  return request;
};

const INDEX_CODES = ["000001", "399001", "399006", "000688"] as const;
async function cacheSnapshotFields(snapshot: Snapshot) {
  const generation = `${snapshot.fetchedAt}:${snapshot.marketDate ?? "none"}`;
  void Promise.all([
    sharedCacheSet("fund-ai-pro:snapshot:indices", { generation, value: snapshot.indices } satisfies SnapshotField<Snapshot["indices"]>, SNAPSHOT_FIELD_TTL.indices),
    sharedCacheSet("fund-ai-pro:snapshot:sectors", { generation, value: snapshot.sectors } satisfies SnapshotField<Snapshot["sectors"]>, SNAPSHOT_FIELD_TTL.sectors),
    sharedCacheSet("fund-ai-pro:snapshot:flow", { generation, value: snapshot.flow } satisfies SnapshotField<Snapshot["flow"]>, SNAPSHOT_FIELD_TTL.flow),
    sharedCacheSet("fund-ai-pro:snapshot:global", { generation, value: snapshot.global } satisfies SnapshotField<Snapshot["global"]>, SNAPSHOT_FIELD_TTL.global),
    sharedCacheSet("fund-ai-pro:snapshot:meta", { generation, sources: snapshot.sources, marketDate: snapshot.marketDate ?? null, fetchedAt: snapshot.fetchedAt, validation: snapshot.validation } satisfies SnapshotMeta, SNAPSHOT_FIELD_TTL.metadata),
  ]).catch(() => {});
}
async function readFieldCachedSnapshot(): Promise<Snapshot | null> {
  const [indices, sectors, flow, global, meta] = await Promise.all([
    sharedCacheGet<SnapshotField<Snapshot["indices"]>>("fund-ai-pro:snapshot:indices"),
    sharedCacheGet<SnapshotField<Snapshot["sectors"]>>("fund-ai-pro:snapshot:sectors"),
    sharedCacheGet<SnapshotField<Snapshot["flow"]>>("fund-ai-pro:snapshot:flow"),
    sharedCacheGet<SnapshotField<Snapshot["global"]>>("fund-ai-pro:snapshot:global"),
    sharedCacheGet<SnapshotMeta>("fund-ai-pro:snapshot:meta"),
  ]);
  if (!meta?.value) return null;
  const generation = meta.value.generation;
  const same = (entry: { value?: SnapshotField<unknown> } | null | undefined) => entry?.value?.generation === generation;
  const coherentIndices = same(indices) ? indices!.value!.value : null;
  const coherentSectors = same(sectors) ? sectors!.value!.value : null;
  const coherentFlow = same(flow) ? flow!.value!.value : null;
  const coherentGlobal = same(global) ? global!.value!.value : null;
  if (!coherentIndices || !coherentSectors || !meta.value.sources.length) return null;
  return { indices: coherentIndices, sectors: coherentSectors, boards: [], flow: coherentFlow, global: coherentGlobal ?? [], sources: meta.value.sources, fetchedAt: meta.value.fetchedAt, marketDate: meta.value.marketDate, validation: meta.value.validation };
}
async function buildSnapshot(): Promise<Snapshot> {
  const [baseSnapshot, moneyFlow] = await Promise.all([preserveReliableSnapshot(await getStableSnapshot()), getMarketMoneyFlow().catch(() => null)]);
  const snapshot = moneyFlow ? { ...baseSnapshot, flow: moneyFlow, sources: baseSnapshot.sources.map((s) => s.name === "资金" ? { ...s, status: "ok" as const, note: `全A资金流 ${moneyFlow.count} 条 · ${moneyFlow.sourceCount} 个供应商 · ${moneyFlow.confidence}置信` } : s) } : baseSnapshot;
  const [checked, global] = await Promise.all([
    Promise.all(INDEX_CODES.map(async (code) => { try { return { code, quote: await getMultiSourceQuote(code) }; } catch { return { code, quote: null }; } })),
    validateGlobalQuotes(snapshot.global),
  ]);
  const indices = snapshot.indices.map((index) => { const hit = checked.find((item) => item.code === index.code)?.quote; if (!hit || hit.pct == null || hit.price == null) return index; return ["three_source", "two_source", "single_source"].includes(hit.agreement) ? { ...index, price: hit.price, pct: hit.pct } : index; });
  const sources = snapshot.sources.map((entry) => entry.name === "指数" ? { ...entry, note: "腾讯 + 东方财富 + 新浪多源校验；分歧时保留稳定结果" } : entry.name === "外围" ? { ...entry, note: `腾讯财经主源 + 新浪备用/交叉校验；检查${global.checked}项，一致${global.agreed}项，备用补齐${global.fallback}项${global.disputed ? `，分歧${global.disputed}项` : ""}` } : entry);
  return preserveReliableSnapshot({ ...snapshot, indices, global: global.list, sources, validation: checked.some((x) => x.quote?.agreement === "three_source") ? "cross_checked" : snapshot.validation });
}
export const getSnapshot = async () => {
  if (snapshotPending) return snapshotPending;
  snapshotPending = (async () => {
    const cached = await readFieldCachedSnapshot();
    if (cached && cached.indices.length && cached.sectors.length && cached.sources.length) return cached;
    const snapshot = await buildSnapshot();
    cacheSnapshotFields(snapshot);
    return snapshot;
  })().finally(() => { snapshotPending = null; });
  return snapshotPending;
};
