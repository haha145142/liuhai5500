import { getFund, getPrewarmFundCodes } from "../src/lib/data/server";
import { sharedCacheConfigured } from "../src/lib/data/shared-cache";
import { getMarketPhase } from "../src/lib/market-hours";

type Request = { method?: string; headers: Record<string, string | string[] | undefined> };
type Response = { status(code: number): Response; json(value: unknown): Response };

function isLocalDevelopment(req: Request) {
  const host = Array.isArray(req.headers.host) ? req.headers.host[0] : String(req.headers.host || "");
  return process.env.NODE_ENV !== "production" && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
}

function isToday(date: string | null | undefined) {
  if (!date) return false;
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  return String(date).slice(0, 10) === today;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method-not-allowed" });
  const secret = String(process.env.CRON_SECRET || "").trim();
  const header = req.headers.authorization;
  const auth = Array.isArray(header) ? header[0] : String(header || "");
  if (!secret && !isLocalDevelopment(req)) return res.status(503).json({ ok: false, error: "cron-secret-not-configured" });
  if (secret && auth !== `Bearer ${secret}`) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!sharedCacheConfigured()) return res.status(200).json({ ok: false, skipped: true, reason: "shared-cache-not-configured" });

  const phase = getMarketPhase();
  if (phase === "weekend" || phase === "preopen" || phase === "postclose") {
    return res.status(200).json({ ok: true, skipped: true, reason: phase === "weekend" ? "market-closed-weekend" : "official-nav-window-not-active", phase });
  }

  const codes = await getPrewarmFundCodes();
  if (!codes.length) return res.status(200).json({ ok: true, skipped: true, reason: "no-fund-codes-registered", phase });

  const settled = await Promise.allSettled(codes.map((code) => getFund({ data: { code } })));
  const results = settled.map((item, index) => {
    if (item.status === "rejected") return { code: codes[index], ok: false, official: false, error: item.reason instanceof Error ? item.reason.message : "fund-prewarm-failed" };
    const quote = item.value;
    const official = quote.officialNavPublished === true && isToday(quote.navDate);
    return { code: codes[index], ok: true, official, navDate: quote.navDate ?? null, valuationStatus: quote.valuationStatus ?? "unavailable" };
  });
  const officialCount = results.filter((x) => x.official).length;
  const failedCount = results.filter((x) => !x.ok).length;
  return res.status(failedCount ? 207 : 200).json({ ok: failedCount === 0, phase, scanned: codes.length, officialCount, pendingOfficial: codes.length - officialCount, failedCount, results });
}
