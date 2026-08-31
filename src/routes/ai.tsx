import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyNote, Glass, SectionTitle } from "@/components/ui/Glass";
import { buildEvidence } from "@/lib/calc/evidence";
import { analyzeMarket } from "@/lib/data/server";
import { getDSKey, getDSModel } from "@/lib/storage";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/ai")({ component: AIPage });

function AIPage() {
  const snapshot = useApp((s) => s.snapshot);
  const news = useApp((s) => s.news);
  const [aiText, setAiText] = useState("");
  const [busy, setBusy] = useState(false);
  const ev = useMemo(
    () => (snapshot ? buildEvidence(snapshot, news?.items || []) : null),
    [snapshot, news],
  );

  const run = async () => {
    if (!snapshot) return;
    const apiKey = getDSKey();
    const model = getDSModel();
    if (!apiKey) {
      setAiText("DeepSeek 暂不可用：请先在设置中填写 Key，并点击“测试连接”。");
      return;
    }
    setBusy(true);
    const prompt = `请基于以下已抓取证据做7步证据链分析，没有的字段写「暂无可靠数据」，不要编数字。\n指数:${JSON.stringify(snapshot.indices)}\n板块:${JSON.stringify(snapshot.sectors)}\n资金:${JSON.stringify(snapshot.flow)}\n外围:${JSON.stringify(snapshot.global)}\n新闻:${(news?.items || []).slice(0, 10).map((n) => n.title).join("；")}`;
    try {
      const r = await analyzeMarket({ data: { prompt, apiKey, model } });
      setAiText(r.ok ? r.text : r.error || "DeepSeek 接口暂不可用");
    } catch {
      setAiText("DeepSeek 请求失败，请检查网络、Key 或模型设置。");
    } finally {
      setBusy(false);
    }
  };

  if (!ev) return <EmptyNote>等待行情证据…</EmptyNote>;

  return (
    <div>
      <Glass>
        <SectionTitle title="七步证据链" hint={ev.confidence} />
        <p className="text-sm text-muted">
          {ev.verdict} · {ev.duration} · 评分 {ev.score}
        </p>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="mt-3 w-full rounded-2xl bg-accent py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-60"
        >
          {busy ? "DeepSeek 分析中…" : "用 DeepSeek 深度复核"}
        </button>
        <p className="mt-2 text-[10px] text-subtle">第一次使用先到 <Link to="/settings" className="text-accent">设置</Link> 测试连接。</p>
      </Glass>
      {ev.steps.map((s) => (
        <Glass key={s.id}>
          <div className="text-xs font-semibold text-accent">
            {s.id} · {s.title}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-fg">{s.body}</p>
          <p className="mt-2 text-[11px] text-subtle">证据：{s.evidence}</p>
        </Glass>
      ))}
      {aiText ? (
        <Glass>
          <SectionTitle title="DeepSeek 复核" />
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{aiText}</p>
        </Glass>
      ) : null}
      <p className="px-1 pb-3 text-[10px] text-subtle">判断只基于本页已抓取数据。没有数据就写暂无。不构成投资建议。</p>
    </div>
  );
}
