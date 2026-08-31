import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DataStatus, Glass, SectionTitle } from "@/components/ui/Glass";
import { getDSKey, getDSModel, setDSKey, setDSModel } from "@/lib/storage";
import { testDeepSeek } from "@/lib/data/deepseek";
import { useApp } from "@/lib/store";
import { isWeekend, isTradeTime, sessionLabel } from "@/lib/market-hours";
import { tradingDateLabel } from "@/lib/data/trading-day";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const snapshot = useApp((s) => s.snapshot);
  const news = useApp((s) => s.news);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const [key, setKey] = useState(() => (typeof window === "undefined" ? "" : getDSKey()));
  const [model, setModel] = useState(() => (typeof window === "undefined" ? "deepseek-chat" : getDSModel()));
  const [msg, setMsg] = useState("");
  const [testing, setTesting] = useState(false);

  const marketMode = useMemo(() => {
    if (isWeekend()) return { mode: "latest" as const, detail: `数据日 ${tradingDateLabel()}` };
    if (isTradeTime()) return { mode: "live" as const, detail: sessionLabel() };
    return { mode: "latest" as const, detail: "开盘前 / 收盘后" };
  }, []);

  const save = () => {
    setDSKey(key.trim());
    setDSModel(model.trim() || "deepseek-chat");
    setMsg(key.trim() ? "已保存在本机浏览器" : "已清除 Key");
  };

  const test = async () => {
    const nextKey = key.trim();
    if (!nextKey) { setMsg("请先输入 DeepSeek Key"); return; }
    setTesting(true);
    setMsg("正在测试连接…");
    try {
      const r = await testDeepSeek({ data: { apiKey: nextKey, model: model.trim() || "deepseek-chat" } });
      setMsg(r.ok ? `连接成功 · ${r.model} · ${r.latencyMs} ms` : `连接失败 · ${r.error}`);
    } catch { setMsg("连接测试失败 · 请检查网络或服务状态"); }
    finally { setTesting(false); }
  };

  const sources = [...(snapshot?.sources || []), ...(news?.sources || [])];

  return (
    <div className="space-y-3">
      <Glass tight className="overflow-hidden">
        <SectionTitle title="数据中心" hint="全局口径" />
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg-elevated/70 px-3 py-3">
          <div>
            <div className="text-xs font-semibold text-fg">当前市场数据状态</div>
            <div className="mt-1 text-[10px] text-subtle">所有页面统一使用同一套交易时段规则</div>
          </div>
          <DataStatus mode={marketMode.mode} detail={marketMode.detail} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-2xl bg-bg-elevated px-3 py-2.5"><div className="text-subtle">市场日期</div><div className="mt-0.5 font-semibold text-fg">{snapshot?.marketDate || tradingDateLabel()}</div></div>
          <div className="rounded-2xl bg-bg-elevated px-3 py-2.5"><div className="text-subtle">最近刷新</div><div className="mt-0.5 font-semibold text-fg">{snapshot?.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "等待数据"}</div></div>
        </div>
      </Glass>

      <Glass>
        <SectionTitle title="数据源状态" hint={sources.length ? `${sources.filter((s) => s.status === "ok").length}/${sources.length} 可用` : "等待连接"} />
        {sources.length ? (
          <div className="space-y-1.5">
            {sources.map((s, i) => <div key={`${s.name}-${i}`} className="flex items-center gap-3 rounded-2xl bg-bg-elevated px-3 py-2.5"><span className={`size-2 shrink-0 rounded-full ${s.status === "ok" ? "bg-emerald-500" : "bg-slate-400"}`} /><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-fg">{s.name}</div><div className="mt-0.5 truncate text-[10px] text-subtle">{s.note}</div></div><span className={`text-[10px] font-semibold ${s.status === "ok" ? "tone-down" : "text-muted"}`}>{s.status === "ok" ? "正常" : "暂不可用"}</span></div>)}
          </div>
        ) : <p className="text-sm text-muted">尚未取得数据源状态。</p>}
        <p className="mt-2 text-[10px] leading-relaxed text-subtle">数据源异常时，页面只能降级到最近可靠状态，不会用模拟数字补齐。</p>
      </Glass>

      <Glass>
        <SectionTitle title="刷新节奏" hint="行情" />
        <div className="rounded-2xl bg-bg-elevated px-3 py-3">
          <div className="flex items-center justify-between"><label className="text-xs font-semibold text-fg">行情自动刷新（秒）</label><span className="text-xs font-bold text-accent tabular-nums">{Math.round(settings.autoRefreshMs / 1000)}s</span></div>
          <input type="range" min={30} max={300} step={30} value={Math.round(settings.autoRefreshMs / 1000)} onChange={(e) => setSettings({ autoRefreshMs: Number(e.target.value) * 1000 })} className="mt-3 w-full accent-[var(--color-accent)]" />
          <div className="mt-1 flex justify-between text-[9px] text-subtle"><span>30秒</span><span>5分钟</span></div>
        </div>
        <p className="mt-2 text-[10px] text-subtle">最低 30 秒；非交易时段不做无意义的高频请求。</p>
      </Glass>

      <Glass>
        <SectionTitle title="DeepSeek" hint="AI" />
        <p className="mb-2 text-xs leading-relaxed text-muted">Key 仅保存在本机浏览器。测试调用会临时经服务器请求 DeepSeek，不写入 GitHub。</p>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="DeepSeek API Key（sk-…）" type="password" autoComplete="off" className="h-11 w-full rounded-2xl bg-bg-elevated px-3 text-sm outline-none ring-1 ring-border" />
        <input value={model} onChange={(e) => setModel(e.target.value)} className="mt-2 h-11 w-full rounded-2xl bg-bg-elevated px-3 text-sm outline-none ring-1 ring-border" placeholder="deepseek-chat" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={save} className="h-11 rounded-2xl bg-fg text-sm font-semibold text-bg">保存</button>
          <button type="button" onClick={() => void test()} disabled={testing} className="h-11 rounded-2xl bg-accent text-sm font-semibold text-accent-fg disabled:opacity-60">{testing ? "测试中…" : "测试连接"}</button>
        </div>
        {msg ? <p className={`mt-2 text-xs ${msg.startsWith("连接成功") ? "tone-down" : "text-muted"}`}>{msg}</p> : null}
      </Glass>

      <Glass>
        <SectionTitle title="关于 Fund AI Pro" />
        <div className="space-y-2 text-[11px] leading-relaxed text-muted">
          <p>持仓估值、基金主题、市场行情、资金验证、新闻证据链统一在同一套数据状态下运行。</p>
          <p>盘中使用经过可靠性门槛的数据；午间沿用上午最后可靠状态；收盘后等待官方净值；周末显示最近交易日。</p>
          <p className="text-subtle">不构成投资建议。没有可靠数据就显示“暂无可靠数据”，不使用假数字。</p>
        </div>
      </Glass>
    </div>
  );
}
