import { i as __toESM } from "../_runtime.mjs";
import { B as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as getDSKey, d as setDSModel, i as useApp, l as getDSModel, u as setDSKey } from "./router-DhF1B5rM.mjs";
import { n as Glass, r as SectionTitle } from "./Glass-otXZh5Ig.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-DjEE0sMq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SettingsPage() {
	const snapshot = useApp((s) => s.snapshot);
	const news = useApp((s) => s.news);
	const settings = useApp((s) => s.settings);
	const setSettings = useApp((s) => s.setSettings);
	const [key, setKey] = (0, import_react.useState)(() => typeof window === "undefined" ? "" : getDSKey());
	const [model, setModel] = (0, import_react.useState)(() => typeof window === "undefined" ? "deepseek-chat" : getDSModel());
	const [msg, setMsg] = (0, import_react.useState)("");
	const save = () => {
		setDSKey(key.trim());
		setDSModel(model.trim() || "deepseek-chat");
		setMsg(key.trim() ? "DeepSeek Key 已保存在本机浏览器" : "已清除 Key，新闻解读使用规则版");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "数据源状态" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-2 text-sm",
			children: (snapshot?.sources || []).concat(news?.sources || []).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: s.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: s.status === "ok" ? "tone-down" : "tone-up",
					children: s.note
				})]
			}, s.name))
		})] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "刷新节奏" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				className: "block text-xs text-muted",
				children: "行情自动刷新（秒）"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				type: "number",
				min: 30,
				value: Math.round(settings.autoRefreshMs / 1e3),
				onChange: (e) => setSettings({ autoRefreshMs: Math.max(30, Number(e.target.value) || 120) * 1e3 }),
				className: "mt-1 h-11 w-full rounded-2xl bg-bg-elevated px-3 text-sm outline-none ring-1 ring-border"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[11px] text-subtle",
				children: "新闻默认手动刷新；盘中持仓估值每 30 秒轻量更新。"
			})
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "DeepSeek（可选）" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-2 text-xs text-muted",
				children: "Key 只存在本机浏览器。深度分析默认走应用内置模型；此处仅兼容旧版设置。"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				value: key,
				onChange: (e) => setKey(e.target.value),
				placeholder: "sk-…",
				className: "h-11 w-full rounded-2xl bg-bg-elevated px-3 text-sm outline-none ring-1 ring-border"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				value: model,
				onChange: (e) => setModel(e.target.value),
				className: "mt-2 h-11 w-full rounded-2xl bg-bg-elevated px-3 text-sm outline-none ring-1 ring-border"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: save,
				className: "mt-3 h-11 w-full rounded-2xl bg-fg text-sm font-semibold text-bg",
				children: "保存"
			}),
			msg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs text-muted",
				children: msg
			}) : null
		] }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, { title: "关于" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm leading-relaxed text-muted",
				children: "Fund AI Pro 融合了持仓估值、波段指标、板块六因子、资金分层、多源资讯与七步证据链。行情来自东方财富 / 天天基金 / 腾讯财经等公开接口。没有数据就显示「暂无可靠数据」，不用假数字填充。"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs text-subtle",
				children: "不构成投资建议。投资有风险，决策需结合自身风险承受能力。"
			})
		] })
	] });
}
//#endregion
export { SettingsPage as component };
