import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EmptyNote, Glass, SectionTitle, Tone } from "@/components/ui/Glass";
import { getFundRank } from "@/lib/data/server";
import { fmtPctShort, fmtPrice } from "@/lib/format";
import { useApp } from "@/lib/store";
import type { RankRow } from "@/lib/types";

export const Route = createFileRoute("/funds")({ component: FundsPage });

const TABS = [
  { id: "r", label: "日涨幅", sc: "rzf" },
  { id: "z", label: "近1周", sc: "zzf" },
  { id: "6y", label: "近6月", sc: "6yzf" },
  { id: "1n", label: "近1年", sc: "1nzf" },
] as const;
const RANK_CACHE_PREFIX = "fund_ai_pro_rank_cache_v2_";
const RANK_TIMEOUT_MS = 7_000;
const JSONP_TIMEOUT_MS = 5_000;

type RankCache = { savedAt: number; rows: RankRow[]; source: string };

type RankDataWindow = Window & { rankData?: { datas?: string[] } };

function readRankCache(tab: string): RankCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = JSON.parse(localStorage.getItem(`${RANK_CACHE_PREFIX}${tab}`) || "null") as RankCache | null;
    return raw && Array.isArray(raw.rows) && raw.rows.length ? raw : null;
  } catch {
    return null;
  }
}

function writeRankCache(tab: string, value: RankCache) {
  try { localStorage.setItem(`${RANK_CACHE_PREFIX}${tab}`, JSON.stringify(value)); } catch {}
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error("rank-timeout")), ms);
    promise.then((value) => { window.clearTimeout(id); resolve(value); }, (error) => { window.clearTimeout(id); reject(error); });
  });
}

function parseRankRows(datas: string[] | undefined): RankRow[] {
  return (datas || []).map((line) => {
    const a = String(line).split(",");
    return {
      code: a[0] || "",
      name: a[1] || "",
      nav: Number.isFinite(Number(a[4])) ? Number(a[4]) : null,
      day: Number.isFinite(Number(a[6])) ? Number(a[6]) : null,
      week: Number.isFinite(Number(a[7])) ? Number(a[7]) : null,
      month: Number.isFinite(Number(a[8])) ? Number(a[8]) : null,
      sixMonth: Number.isFinite(Number(a[10])) ? Number(a[10]) : null,
      oneYear: Number.isFinite(Number(a[11])) ? Number(a[11]) : null,
      ytd: Number.isFinite(Number(a[14])) ? Number(a[14]) : null,
    };
  }).filter((x) => /^\d{6}$/.test(x.code) && !!x.name);
}

/** Browser JSONP fallback copied from the proven uploaded iOS26 version.
 * Eastmoney's rankhandler is often readable by script tag even when server-side
 * fetches are blocked; it never invents rows and only accepts the returned datas.
 */
function fetchEastmoneyRankJsonp(tab: string): Promise<RankRow[]> {
  const config = TABS.find((x) => x.id === tab) || TABS[0];
  return new Promise((resolve, reject) => {
    const old = (window as RankDataWindow).rankData;
    const url = `https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=${config.sc}&st=desc&pi=1&pn=80&dx=1&_=${Date.now()}`;
    let done = false;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => finish(false, new Error("rank-jsonp-timeout")), JSONP_TIMEOUT_MS);
    const finish = (ok: boolean, value?: unknown) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      (window as RankDataWindow).rankData = old;
      script.remove();
      if (ok) resolve(value as RankRow[]); else reject(value instanceof Error ? value : new Error("rank-jsonp-failed"));
    };
    script.src = url;
    script.async = true;
    script.onload = () => finish(true, parseRankRows((window as RankDataWindow).rankData?.datas));
    script.onerror = () => finish(false, new Error("rank-jsonp-error"));
    document.head.appendChild(script);
  });
}

function FundsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("r");
  const [rows, setRows] = useState<RankRow[]>(() => readRankCache("r")?.rows || []);
  const [source, setSource] = useState(() => readRankCache("r")?.source || "—");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const watchlist = useApp((s) => s.watchlist);
  const toggleWatch = useApp((s) => s.toggleWatch);
  const addHolding = useApp((s) => s.addHolding);

  useEffect(() => {
    let live = true;
    const cached = readRankCache(tab);
    setRows(cached?.rows || []);
    setSource(cached?.source ? `${cached.source} · 本地缓存` : "数据源连接中");
    setLoading(!cached?.rows?.length);
    setRefreshing(!!cached?.rows?.length);

    const apply = (nextRows: RankRow[], nextSource: string) => {
      if (!live) return;
      if (!nextRows.length) return;
      setRows(nextRows);
      setSource(nextSource);
      writeRankCache(tab, { savedAt: Date.now(), rows: nextRows, source: nextSource });
    };

    void withTimeout(getFundRank({ data: { sort: tab } }), RANK_TIMEOUT_MS)
      .then(async (r) => {
        if (!live) return;
        if (r.rows.length) {
          apply(r.rows, r.source);
          return;
        }
        try {
          const fallback = await fetchEastmoneyRankJsonp(tab);
          apply(fallback, "东方财富浏览器 JSONP");
        } catch {
          if (!cached?.rows?.length) { setRows([]); setSource("排行数据源暂不可用"); }
        }
      })
      .catch(async () => {
        if (!live) return;
        try {
          const fallback = await fetchEastmoneyRankJsonp(tab);
          apply(fallback, "东方财富浏览器 JSONP");
        } catch {
          if (!cached?.rows?.length) { setRows([]); setSource("排行数据源超时 · 已停止等待"); }
        }
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => { live = false; };
  }, [tab]);

  return (
    <div className="funds-page">
      <Glass>
        <SectionTitle title="基金排行" hint={source} />
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`flex-1 rounded-xl py-2 text-xs font-semibold ${tab === t.id ? "bg-accent text-accent-fg" : "bg-bg-elevated text-muted"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {refreshing ? <div className="mt-2 text-[10px] text-muted">后台刷新中 · 先显示本地最近数据</div> : null}
      </Glass>
      {loading ? <EmptyNote>正在读取排行… 网络主源最多等待 7 秒，失败会切换浏览器直连。</EmptyNote> : null}
      {!loading && !rows.length ? <EmptyNote>暂无可靠排行数据，当前数据源不可用。</EmptyNote> : null}
      {rows.map((r, i) => {
        const addable = r.nav != null && Number.isFinite(r.nav) && r.nav > 0;
        const displayValue = tab === "z" ? r.week : tab === "1n" ? r.oneYear : tab === "6y" ? r.sixMonth : r.day;
        return (
          <article key={r.code} className="glass-tight mb-2 flex items-center gap-3 p-3">
            <div className="w-6 text-xs font-semibold text-subtle">{i + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{r.name}</div>
              <div className="text-[11px] text-muted">{r.code} · 净值 {fmtPrice(r.nav, 4)}</div>
            </div>
            <Tone v={displayValue} className="text-sm font-semibold">{fmtPctShort(displayValue)}</Tone>
            <button type="button" onClick={() => toggleWatch(r.code)} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${watchlist.includes(r.code) ? "bg-accent text-accent-fg" : "bg-bg-elevated text-muted"}`}>
              {watchlist.includes(r.code) ? "已关注" : "关注"}
            </button>
            <button type="button" disabled={!addable} className="text-[10px] font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-40" onClick={() => { if (addable) addHolding({ code: r.code, name: r.name, shares: 100, cost: r.nav as number }); }}>
              {addable ? "加入" : "无可靠净值"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
