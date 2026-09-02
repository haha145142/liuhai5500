import { getSnapshot } from "../src/lib/data/server";
import { sharedCacheConfigured } from "../src/lib/data/shared-cache";

type Request = { method?: string; headers: Record<string, string | string[] | undefined> };
type Response = { status(code: number): Response; json(value: unknown): Response };

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method-not-allowed" });
  const secret = String(process.env.CRON_SECRET || "").trim();
  const header = req.headers.authorization;
  const auth = Array.isArray(header) ? header[0] : String(header || "");
  if (secret && auth !== `Bearer ${secret}`) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!sharedCacheConfigured()) return res.status(200).json({ ok: false, skipped: true, reason: "shared-cache-not-configured" });
  try {
    const snapshot = await getSnapshot();
    return res.status(200).json({ ok: true, marketDate: snapshot.marketDate ?? null, fetchedAt: snapshot.fetchedAt, indexCount: snapshot.indices.length, sectorCount: snapshot.sectors.filter((x) => x.change != null).length });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "prewarm-failed" });
  }
}
