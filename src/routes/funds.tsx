import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EmptyNote, Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { getFundRank } from "@/lib/data/server";
import { fmtPctShort, fmtPrice } from "@/lib/format";
import { useApp } from "@/lib/store";
import type { RankRow } from "@/lib/types";

export const Route = createFileRoute("/funds")({ component: FundsPage });

const TABS = [
  { id: "r", label: "日涨幅" },
  { id: "z", label: "近1周" },
  { id: "6y", label: "近6月" },
  { id: "1n", label: "近1年" },
] as const;

function FundsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("r");
  const [rows, setRows] = useState<RankRow[]>([]);
  const [source, setSource] = useState("—");
  const [loading, setLoading] = useState(false);
  const watchlist = useApp((s) => s.watchlist);
  const toggleWatch = useApp((s) => s.toggleWatch);
  const addHolding = useApp((s) => s.addHolding);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void getFundRank({ data: { sort: tab } }).then((r) => {
      if (!live) return;
      setRows(r.rows);
      setSource(r.source);
      setLoading(false);
    }).catch(() => {
      if (!live) return;
      setRows([]);
      setSource("数据源暂不可用");
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [tab]);

  return (
    <div>
      <Glass>
        <SectionTitle title="基金排行" hint={source} />
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold ${tab === t.id ? "bg-accent text-accent-fg" : "bg-bg-elevated text-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Glass>
      {loading ? <EmptyNote>正在读取排行…</EmptyNote> : null}
      {!loading && !rows.length ? <EmptyNote>暂无可靠排行数据，请稍后刷新</EmptyNote> : null}
      {rows.map((r, i) => {
        const addable = r.nav != null && Number.isFinite(r.nav) && r.nav > 0;
        const displayValue = tab === "z" ? r.week : tab === "1n" ? r.ytd : tab === "6y" ? r.month : r.day;
        return (
          <article key={r.code} className="glass-tight mb-2 flex items-center gap-3 p-3">
            <div className="w-6 text-xs font-semibold text-subtle">{i + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{r.name}</div>
              <div className="text-[11px] text-muted">
                {r.code} · 净值 {fmtPrice(r.nav, 4)}
              </div>
            </div>
            <Tone v={displayValue} className="text-sm font-semibold">
              {fmtPctShort(displayValue)}
            </Tone>
            <button
              type="button"
              onClick={() => toggleWatch(r.code)}
              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${watchlist.includes(r.code) ? "bg-accent text-accent-fg" : "bg-bg-elevated text-muted"}`}
            >
              {watchlist.includes(r.code) ? "已关注" : "关注"}
            </button>
            <button
              type="button"
              disabled={!addable}
              className="text-[10px] font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                if (!addable) return;
                addHolding({ code: r.code, name: r.name, shares: 100, cost: r.nav as number });
              }}
            >
              {addable ? "加入" : "无可靠净值"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
