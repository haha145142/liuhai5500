type Request = { method?: string; headers: Record<string, string | string[] | undefined> };
type Response = { status(code: number): Response; json(value: unknown): Response };

function isLocalDevelopment(req: Request) {
  const host = Array.isArray(req.headers.host) ? req.headers.host[0] : String(req.headers.host || "");
  return process.env.NODE_ENV !== "production" && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
}

function chinaToday() {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function isToday(date: string | null | undefined) {
  return !!date && String(date).slice(0, 10) === chinaToday();
}

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    out.push(...await Promise.all(batch.map(fn)));
  }
  return out;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method-not-allowed" });
  const secret = String(process.env.CRON_SECRET || "").trim();
  const header = req.headers.authorization;
  const auth = Array.isArray(header) ? header[0] : String(header || "");
  if (!secret && !isLocalDevelopment(req)) return res.status(503).json({ ok: false, error: "cron-secret-not-configured" });
  if (secret && auth !== `Bearer ${secret}`) return res.status(401).json({ ok: false, error: "unauthorized" });

  const [{ getMarketPhase }, { sharedCacheConfigured }] = await Promise.all([
    import("../src/lib/market-hours"),
    import("../src/lib/data/shared-cache"),
  ]);
  if (!sharedCacheConfigured()) return res.status(200).json({ ok: false, skipped: true, reason: "shared-cache-not-configured" });

  const phase = getMarketPhase();
  if (phase !== "postclose") {
    return res.status(200).json({ ok: true, skipped: true, reason: phase === "weekend" ? "market-closed-weekend" : "official-nav-window-not-active", phase });
  }

  const { refreshFundQuote, getPrewarmFundCodes } = await import("../src/lib/data/server");
  const codes = await getPrewarmFundCodes();
  if (!codes.length) return res.status(200).json({ ok: true, skipped: true, reason: "no-fund-codes-registered", phase });

  const results = await inBatches(codes, 8, async (code) => {
    try {
      const quote = await refreshFundQuote(code);
      const official = quote.officialNavPublished === true && isToday(quote.navDate);
      return { code, ok: true, official, navDate: quote.navDate ?? null, valuationStatus: quote.valuationStatus ?? "unavailable" };
    } catch (error) {
      return { code, ok: false, official: false, error: error instanceof Error ? error.message : "fund-prewarm-failed" };
    }
  });

  const officialCount = results.filter((x) => x.official).length;
  const failedCount = results.filter((x) => !x.ok).length;
  const pendingOfficial = results.length - officialCount;
  return res.status(failedCount ? 207 : 200).json({ ok: failedCount === 0, phase, scanned: codes.length, officialCount, pendingOfficial, failedCount, results });
}
