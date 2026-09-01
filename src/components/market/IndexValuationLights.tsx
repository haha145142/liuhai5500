import { useEffect, useState } from "react";
import { Glass, SectionTitle } from "@/components/ui/Glass";
import { getCoreIndexValuations, type IndexValuation } from "@/lib/data/index-valuation";

function tone(level: IndexValuation["level"]) {
  if (level === "高估") return "bg-red-50/85 text-red-600 ring-red-100";
  if (level === "低估") return "bg-emerald-50/85 text-emerald-700 ring-emerald-100";
  if (level === "中性") return "bg-amber-50/85 text-amber-700 ring-amber-100";
  return "bg-slate-50/75 text-slate-500 ring-slate-100";
}

function value(v: number | null, digits = 2) {
  return v == null || !Number.isFinite(v) ? "暂无可靠数据" : v.toFixed(digits);
}

export function IndexValuationLights() {
  const [rows, setRows] = useState<IndexValuation[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    void getCoreIndexValuations()
      .then((next) => { if (live) setRows(next); })
      .catch(() => { if (live) setRows([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  return <Glass className="mt-3 overflow-hidden rounded-[22px] p-3">
    <SectionTitle title="指数估值红绿灯" hint="估值字段缺失时不生成伪值" />
    {loading ? <div className="rounded-xl bg-white/50 px-3 py-4 text-center text-[9px] text-muted">正在读取核心指数估值…</div> : <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{rows.map((row) => <article key={row.code} className="rounded-[17px] bg-white/52 p-2.5 ring-1 ring-white/80"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="truncate text-[11px] font-semibold text-fg">{row.name}</div><div className="text-[8px] text-muted">{row.code}</div></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ring-1 ${tone(row.level)}`}>{row.level}</span></div><div className="mt-2 grid grid-cols-3 gap-1 text-center text-[8px]"><Metric label="PE" value={value(row.pe)} /><Metric label="PB" value={value(row.pb)} /><Metric label="ROE" value={value(row.roe,1)} suffix={row.roe == null ? "" : "%"} /></div><div className="mt-1.5 flex items-center justify-between text-[7px] text-subtle"><span>{row.percentile == null ? "估值百分位：暂无可靠数据" : `估值百分位 ${row.percentile.toFixed(0)}%`}</span><span>{row.updatedAt ? new Date(row.updatedAt).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",hour12:false}) : "—"}</span></div><div className="mt-1 text-[7px] text-subtle">{row.source}</div></article>)}</div>}
  </Glass>;
}

function Metric({ label, value: displayed, suffix = "" }: { label: string; value: string; suffix?: string }) {
  return <div className="rounded-xl bg-white/65 px-1.5 py-1.5"><div className="text-slate-400">{label}</div><div className="mt-0.5 font-semibold text-slate-700">{displayed === "暂无可靠数据" ? displayed : `${displayed}${suffix}`}</div></div>;
}
