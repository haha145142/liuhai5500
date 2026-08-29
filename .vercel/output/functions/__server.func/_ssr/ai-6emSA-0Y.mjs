import { i as __toESM } from "../_runtime.mjs";
import { B as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as analyzeMarket, i as useApp } from "./router-DhF1B5rM.mjs";
import { n as Glass, r as SectionTitle, t as EmptyNote } from "./Glass-otXZh5Ig.mjs";
import { t as buildEvidence } from "./evidence-C85O0ei0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ai-6emSA-0Y.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AIPage() {
	const snapshot = useApp((s) => s.snapshot);
	const news = useApp((s) => s.news);
	const [aiText, setAiText] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const ev = (0, import_react.useMemo)(() => snapshot ? buildEvidence(snapshot, news?.items || []) : null, [snapshot, news]);
	const run = async () => {
		if (!snapshot) return;
		setBusy(true);
		const prompt = `请基于以下已抓取证据做7步证据链分析，没有的字段写「暂无可靠数据」，不要编数字。\n指数:${JSON.stringify(snapshot.indices)}\n板块:${JSON.stringify(snapshot.sectors)}\n资金:${JSON.stringify(snapshot.flow)}\n外围:${JSON.stringify(snapshot.global)}\n新闻:${(news?.items || []).slice(0, 10).map((n) => n.title).join("；")}`;
		const r = await analyzeMarket({ data: { prompt } });
		setAiText(r.ok ? r.text : `规则版已给出结论。${r.error}`);
		setBusy(false);
	};
	if (!ev) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyNote, { children: "等待行情证据…" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
				title: "七步证据链",
				hint: ev.confidence
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: [
					ev.verdict,
					" · ",
					ev.duration,
					" · 评分 ",
					ev.score
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => void run(),
				disabled: busy,
				className: "mt-3 w-full rounded-2xl bg-accent py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-60",
				children: busy ? "分析中…" : "用大模型复核（按需）"
			})
		] }),
		ev.steps.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-xs font-semibold text-accent",
				children: [
					s.id,
					" · ",
					s.title
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm leading-relaxed text-fg",
				children: s.body
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-[11px] text-subtle",
				children: ["证据：", s.evidence]
			})
		] }, s.id)),
		aiText ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "模型复核" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "whitespace-pre-wrap text-sm leading-relaxed text-muted",
			children: aiText
		})] }) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "px-1 pb-3 text-[10px] text-subtle",
			children: "判断只基于本页已抓取数据。没有数据就写暂无。不构成投资建议。"
		})
	] });
}
//#endregion
export { AIPage as component };
