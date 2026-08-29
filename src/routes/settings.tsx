import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Glass, SectionTitle } from "@/components/ui/Glass";
import { getDSKey, getDSModel, setDSKey, setDSModel } from "@/lib/storage";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const snapshot = useApp((s) => s.snapshot);
  const news = useApp((s) => s.news);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const [key, setKey] = useState(() => (typeof window === "undefined" ? "" : getDSKey()));
  const [model, setModel] = useState(() => (typeof window === "undefined" ? "deepseek-chat" : getDSModel()));
  const [msg, setMsg] = useState("");

  const save = () => {
    setDSKey(key.trim());
    setDSModel(model.trim() || "deepseek-chat");
    setMsg(key.trim() ? "DeepSeek Key 已保存在本机浏览器" : "已清除 Key，新闻解读使用规则版");
  };

  return (
    <div>
      <Glass>
        <SectionTitle title="数据源状态" />
        <ul className="space-y-2 text-sm">
          {(snapshot?.sources || []).concat(news?.sources || []).map((s) => (
            <li key={s.name} className="flex items-center justify-between">
              <span>{s.name}</span>
              <span className={s.status === "ok" ? "tone-down" : "tone-up"}>{s.note}</span>
            </li>
          ))}
        </ul>
      </Glass>

      <Glass>
        <SectionTitle title="刷新节奏" />
        <label className="block text-xs text-muted">行情自动刷新（秒）</label>
        <input
          type="number"
          min={30}
          value={Math.round(settings.autoRefreshMs / 1000)}
          onChange={(e) => setSettings({ autoRefreshMs: Math.max(30, Number(e.target.value) || 120) * 1000 })}
          className="mt-1 h-11 w-full rounded-2xl bg-bg-elevated px-3 text-sm outline-none ring-1 ring-border"
        />
        <p className="mt-2 text-[11px] text-subtle">新闻默认手动刷新；盘中持仓估值每 30 秒轻量更新。</p>
      </Glass>

      <Glass>
        <SectionTitle title="DeepSeek（可选）" />
        <p className="mb-2 text-xs text-muted">Key 只存在本机浏览器。深度分析默认走应用内置模型；此处仅兼容旧版设置。</p>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-…"
          className="h-11 w-full rounded-2xl bg-bg-elevated px-3 text-sm outline-none ring-1 ring-border"
        />
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="mt-2 h-11 w-full rounded-2xl bg-bg-elevated px-3 text-sm outline-none ring-1 ring-border"
        />
        <button type="button" onClick={save} className="mt-3 h-11 w-full rounded-2xl bg-fg text-sm font-semibold text-bg">
          保存
        </button>
        {msg ? <p className="mt-2 text-xs text-muted">{msg}</p> : null}
      </Glass>

      <Glass>
        <SectionTitle title="关于" />
        <p className="text-sm leading-relaxed text-muted">
          Fund AI Pro 融合了持仓估值、波段指标、板块六因子、资金分层、多源资讯与七步证据链。行情来自东方财富 / 天天基金 / 腾讯财经等公开接口。没有数据就显示「暂无可靠数据」，不用假数字填充。
        </p>
        <p className="mt-2 text-xs text-subtle">不构成投资建议。投资有风险，决策需结合自身风险承受能力。</p>
      </Glass>
    </div>
  );
}
