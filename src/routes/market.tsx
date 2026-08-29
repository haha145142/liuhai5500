import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { IndexGrid } from "@/components/market/IndexGrid";
import { EmptyNote, Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { calcSixFactor } from "@/lib/calc/six-factor";
import { SECTOR_RULES } from "@/lib/data/sectors";
import { getAllSectorWatch } from "@/lib/data/sector-watch";
import { fmtPctShort, fmtYi } from "@/lib/format";
import { useApp } from "@/lib/store";
import type { SectorQuote } from "@/lib/types";

export const Route = createFileRoute("/market")({ component: MarketPage });

function MarketPage() {
  const snapshot = useApp((s) => s.snapshot);
  const selected = useApp((s) => s.selectedSectors);
  const setSectors = useApp((s) => s.setSectors);
  const [allSectors, setAllSectors] = useState<SectorQuote[]>([]);
  const [sectorLoading, setSectorLoading] = useState(false);
  const [sectorQuery, setSectorQuery] = useState("");

  useEffect(() => {
    let alive = true;
    setSectorLoading(true);
    void getAllSectorWatch().then((rows) => { if (alive) setAllSectors(rows); }).finally(() => { if (alive) setSectorLoading(false); });
    return () => { alive = false; };
  }, []);

  const bench = snapshot?.indices[0]?.pct ?? null;
  const flow = snapshot?.flow ?? null;
  const knownById = new Map((snapshot?.sectors ?? []).map((s) => [s.id, s]));
  const allByCode = new Map(allSectors.map((s) => [s.bkCode, s]));
  const selectedCodes = selected.map((id) => SECTOR_RULES.find((r) => r.id === id)?.bkCode || id);
  const watched = selectedCodes.map((code) => allByCode.get(code) || knownById.get(code)).filter((s): s is SectorQuote => !!s);

  const managerRows = useMemo(() => {
    const rows = allSectors.length ? allSectors : (snapshot?.boards ?? []).map((b) => ({ id: b.code, name: b.name, bkCode: b.code, change: b.change, flow: b.flow, super: null, large: null, mid: null, small: null, turnover: null, available: b.change != null, streak: 0 } as SectorQuote));
    const q = sectorQuery.trim().toLowerCase();
    return q ? rows.filter((s) => s.name.toLowerCase().includes(q)) : rows;
  }, [allSectors, snapshot?.boards, sectorQuery]);

  if (!snapshot) return <EmptyNote>正在接入行情…</EmptyNote>;

  return (
    <div>
      <IndexGrid indices={snapshot.indices} />

      <Glass>
        <SectionTitle title="全市场资金" hint={snapshot.sources.find((s) => s.name === "资金")?.note} />
        {flow ? (
          <div className="grid grid-cols-2 gap-2">
            <FlowCell label="主力净流入" v={flow.main} />
            <FlowCell label="超大单" v={flow.super} />
            <FlowCell label="大单" v={flow.large} />
            <FlowCell label="中单" v={flow.mid} />
            <FlowCell label="小单" v={flow.small} />
            <div className="rounded-2xl bg-bg-elevated p-3"><div className="text-[11px] text-subtle">抽样只数</div><div className="text-lg font-semibold tabular-nums">{flow.count}</div></div>
          </div>
        ) : <p className="text-sm text-muted">资金数据源暂不可用</p>}
      </Glass>

      <Glass>
        <SectionTitle title="我的关注板块" hint={`${watched.length} 个 · 实时六因子`} />
        {watched.length ? (
          <div className="space-y-2">
            {watched.map((s) => {
              const r = calcSixFactor(s, bench);
              return (
                <div key={s.bkCode} className="rounded-2xl bg-bg-elevated p-3">
                  <div className="flex items-center justify-between gap-2"><b className="text-sm">{s.name}</b><Tone v={s.change} className="font-semibold">{s.available ? fmtPctShort(s.change) : "暂无可靠数据"}</Tone></div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px]"><Mini label="综合分" value={`${r.position}/100`} /><Mini label="判断" value={r.advice} /><Mini label="置信" value={`${r.confidence}%`} /></div>
                  <div className="mt-2 text-[11px] text-muted">资金 {s.flow == null ? "—" : fmtYi(s.flow)} · {r.basis}</div>
                </div>
              );
            })}
          </div>
        ) : <p className="text-sm text-muted">还没有关注板块，请在下方添加。你不添加，就不会显示它的数据。</p>}
      </Glass>

      <Glass>
        <SectionTitle title="管理关注板块" hint={sectorLoading ? "正在加载全部板块…" : `${managerRows.length} 个可选`} />
        <p className="mb-2 text-[11px] leading-relaxed text-muted">这里是市场全部可选板块，不是让你全部添加。搜索一个板块，点一下“＋”即可加入；只有你主动选择的板块才会出现在上面的关注区。</p>
        <input value={sectorQuery} onChange={(e) => setSectorQuery(e.target.value)} placeholder="搜索板块，例如：医药、黄金、商业航天、锂矿…" className="mb-3 h-10 w-full rounded-xl bg-bg-elevated px-3 text-xs ring-1 ring-border outline-none" />
        <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
          {managerRows.map((s) => {
            const on = selectedCodes.includes(s.bkCode);
            return (
              <button key={s.bkCode} type="button" onClick={() => setSectors(on ? selected.filter((x) => (SECTOR_RULES.find((r) => r.id === x)?.bkCode || x) !== s.bkCode) : [...selected, s.bkCode])} className="flex w-full items-center justify-between rounded-xl bg-bg-elevated px-3 py-2 text-left">
                <span className="min-w-0"><b className="text-xs">{on ? "✓ " : "+ "}{s.name}</b><span className="ml-2 text-[10px] text-subtle">板块</span></span>
                <Tone v={s.change} className="ml-2 shrink-0 text-xs font-semibold">{s.available ? fmtPctShort(s.change) : "—"}</Tone>
              </button>
            );
          })}
          {!managerRows.length && !sectorLoading ? <p className="py-4 text-center text-xs text-muted">没有找到这个板块</p> : null}
        </div>
      </Glass>

      <Glass>
        <SectionTitle title="行业涨跌榜" hint="东财" />
        {snapshot.boards.length ? <div className="space-y-1">{snapshot.boards.slice(0, 12).map((b) => <div key={b.code + b.name} className="flex items-center justify-between py-1 text-sm"><span className="text-fg">{b.name}</span><Tone v={b.change} className="font-semibold">{fmtPctShort(b.change)}</Tone></div>)}</div> : <p className="text-sm text-muted">暂无可靠数据</p>}
      </Glass>

      <Glass>
        <SectionTitle title="外围市场" />
        {snapshot.global.length ? <div className="grid grid-cols-2 gap-2">{snapshot.global.map((g) => <div key={g.name} className="rounded-2xl bg-bg-elevated p-3"><div className="text-xs text-muted">{g.name}</div><Tone v={g.pct} className="text-base font-semibold">{g.pct == null ? "暂无可靠数据" : fmtPctShort(g.pct)}</Tone></div>)}</div> : <p className="text-sm text-muted">外围数据源暂不可用</p>}
      </Glass>
      <p className="px-1 pb-2 text-[10px] text-subtle">数据源：{snapshot.sources.map((s) => `${s.name}${s.status === "ok" ? "✓" : "×"}`).join(" · ")}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/60 p-2"><div className="text-[10px] text-subtle">{label}</div><div className="mt-0.5 text-xs font-semibold">{value}</div></div>; }
function FlowCell({ label, v }: { label: string; v: number }) { return <div className="rounded-2xl bg-bg-elevated p-3"><div className="text-[11px] text-subtle">{label}</div><Tone v={v} className="text-lg font-semibold">{fmtYi(v)}</Tone></div>; }
