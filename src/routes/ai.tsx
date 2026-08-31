import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyNote, Glass, SectionTitle } from "@/components/ui/Glass";
import { buildEvidence } from "@/lib/calc/evidence";
import { analyzeDeepSeek } from "@/lib/data/deepseek";
import { getDSKey, getDSModel } from "@/lib/storage";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/ai")({ component: AIPage });

function AIPage() {
  const snapshot = useApp((s) => s.snapshot);
  const news = useApp((s) => s.news);
  const [aiText, setAiText] = useState("");
  const [busy, setBusy] = useState(false);
  const ev = useMemo(() => snapshot ? buildEvidence(snapshot, news?.items || []) : null, [snapshot, news]);

  const run = async () => {
    if (!snapshot) return;
    const apiKey = getDSKey();
    const model = getDSModel();
    if (!apiKey) { setAiText("DeepSeek 暂不可用：请先在设置中输入 Key，并点击“测试连接”。"); return; }
    setBusy(true);
    const evidenceNews = (news?.items || []).slice(0, 10).map((item, index) => ({
      evidenceId: `N${index + 1}`,
      title: item.title,
      source: item.source,
      sourceUrl: item.url || null,
      publishedAt: item.publishedAt,
      category: item.category,
      sentiment: item.sentiment,
      relatedSectors: item.relatedSectors,
    }));
    const prompt = [
      "你是 Fund AI Pro 的证据审查器。只能根据输入证据回答，不得补造行情、资金、净值、新闻发布时间或基金影响金额。",
      "每一个方向性结论都必须能回指输入中的 evidenceId、行情字段或资金字段；找不到证据就明确写‘暂无可靠数据’。",
      "新闻影响与行情验证必须分开：新闻提到某主题 ≠ 该主题已经上涨；新闻提到利好 ≠ 资金已经流入。",
      "若新闻只有事件关联，没有板块行情/资金交叉验证，必须写‘事件关联，尚未验证趋势’，不能写成‘趋势确认’。",
      "如果官方净值尚未公布，不得把估值写成官方净值；如果估值只有单源或低覆盖，不得写成高可信实时估值。",
      `新闻证据包:${JSON.stringify(evidenceNews)}`,
      `指数:${JSON.stringify(snapshot.indices)}`,
      `板块:${JSON.stringify(snapshot.sectors)}`,
      `资金:${JSON.stringify(snapshot.flow)}`,
      `外围:${JSON.stringify(snapshot.global)}`,
      `数据日期:${snapshot.marketDate || "暂无"}`,
      `数据校验状态:${snapshot.validation || "暂无"}`,
      "输出结构：\n【结论】一句话\n【关键证据】每条先写 evidenceId/数据字段，再写结论\n【新闻影响】逐条说明事件关联与行情验证是否成立\n【持仓影响】只有已有可靠基金价格时才计算，否则写暂无可靠数据\n【风险】列出证据不足、来源单一或数据过期的地方\n【后续观察】告诉我下一步需要验证什么。",
    ].join("\n");
    try {
      const r = await analyzeDeepSeek({ data: { apiKey, model, prompt } });
      setAiText(r.ok ? r.text : `DeepSeek 调用失败：${r.error}`);
    } catch { setAiText("DeepSeek 请求失败，请检查网络、Key 或模型设置。"); }
    finally { setBusy(false); }
  };

  if (!ev) return <EmptyNote>等待行情证据…</EmptyNote>;
  return (
    <div>
      <Glass>
        <SectionTitle title="七步证据链" hint={ev.confidence} />
        <p className="text-sm text-muted">{ev.verdict} · {ev.duration} · 评分 {ev.score}</p>
        <button type="button" onClick={() => void run()} disabled={busy} className="mt-3 w-full rounded-2xl bg-accent py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-60">{busy ? "DeepSeek 分析中…" : "用 DeepSeek 深度复核"}</button>
        <p className="mt-2 text-[10px] text-subtle">API Key 只保存在本机。首次使用到 <Link to="/settings" className="text-accent">设置</Link> 测试连接。</p>
      </Glass>
      {ev.steps.map(s => <Glass key={s.id}><div className="text-xs font-semibold text-accent">{s.id} · {s.title}</div><p className="mt-2 text-sm leading-relaxed text-fg">{s.body}</p><p className="mt-2 text-[11px] text-subtle">证据：{s.evidence}</p></Glass>)}
      {aiText ? <Glass><SectionTitle title="DeepSeek 复核" /><p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{aiText}</p></Glass> : null}
      <p className="px-1 pb-3 text-[10px] text-subtle">AI 只基于本页已抓取证据；新闻、行情和资金必须分别验证。没有证据就写暂无，不构成投资建议。</p>
    </div>
  );
}
