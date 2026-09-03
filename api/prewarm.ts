import { getSnapshot } from "../src/lib/data/server";
import { sharedCacheConfigured } from "../src/lib/data/shared-cache";
import { getMarketPhase } from "../src/lib/market-hours";

type Request = { method?: string; headers: Record<string, string | string[] | undefined> };
type Response = { status(code: number): Response; json(value: unknown): Response };

function isLocalDevelopment(req: Request) {
  const host = Array.isArray(req.headers.host) ? req.headers.host[0] : String(req.headers.host || "");
  return process.env.NODE_ENV !== "production" && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
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
  if (phase === "weekend" || phase === "postclose") {
    return res.status(200).json({ ok: true, skipped: true, reason: phase === "weekend" ? "market-closed-weekend" : "market-closed-postclose", phase });
  }

  try {
    const snapshot = await getSnapshot();
    return res.status(200).json({ ok: true, phase, marketDate: snapshot.marketDate ?? null, fetchedAt: snapshot.fetchedAt, indexCount: snapshot.indices.length, sectorCount: snapshot.sectors.filter((x) => x.change != null).length });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "prewarm-failed" });
  }
}
