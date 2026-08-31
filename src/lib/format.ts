export function num(v: unknown): number | null {
  if (v == null || v === "" || v === "-") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "暂无可靠数据";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

export function fmtPctShort(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

export function fmtPrice(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

export function fmtYi(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(2)}万`;
  return v.toFixed(0);
}

export function fmtMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(2)}万`;
  return `${sign}${abs.toFixed(2)}`;
}

export function tone(v: number | null | undefined): "up" | "down" | "flat" {
  if (v == null || !Number.isFinite(v) || v === 0) return "flat";
  return v > 0 ? "up" : "down";
}

export function cnTime(d = new Date()): Date {
  return new Date(d.getTime() + 8 * 60 * 60 * 1000);
}

export function dateTimeStr(d = new Date()): string {
  const t = cnTime(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCMonth() + 1}/${t.getUTCDate()} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

export function clockStr(d = new Date()): string {
  const t = cnTime(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

/** Display a news published timestamp. Never invent "刚刚" from fetch time. */
export function formatPublishedAt(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return "时间未知";
  const now = Date.now();
  if (ts > now + 5 * 60 * 1000) return "时间未知";
  const t = cnTime(new Date(ts));
  const n = cnTime();
  const p = (x: number) => String(x).padStart(2, "0");
  const sameDay =
    t.getUTCFullYear() === n.getUTCFullYear() &&
    t.getUTCMonth() === n.getUTCMonth() &&
    t.getUTCDate() === n.getUTCDate();
  const hm = `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
  if (sameDay) return hm;
  return `${t.getUTCMonth() + 1}/${t.getUTCDate()} ${hm}`;
}

export function ageLabel(ts: number | null | undefined): string {
  if (ts == null || ts <= 0) return "时间未知";
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 0) return "时间未知";
  if (mins < 60) return `${mins} 分钟前发布`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} 小时前发布`;
  return `${Math.round(mins / 1440)} 天前发布`;
}

export function safeText(s: unknown): string {
  return String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .trim();
}
