import { b as require_jsx_runtime, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as Settings, p as Activity, r as Sparkles, t as Trophy } from "../_libs/lucide-react.mjs";
import { n as Glass } from "./Glass-otXZh5Ig.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/more-BNfgCVnT.js
var import_jsx_runtime = require_jsx_runtime();
var LINKS = [
	{
		to: "/funds",
		title: "基金排行",
		sub: "日涨幅 / 阶段收益 / 关注",
		icon: Trophy
	},
	{
		to: "/ai",
		title: "AI 证据链",
		sub: "七步判断 · 模型复核",
		icon: Sparkles
	},
	{
		to: "/band",
		title: "波段与做 T",
		sub: "RSI MACD 布林 · 趋势禁 T",
		icon: Activity
	},
	{
		to: "/settings",
		title: "设置",
		sub: "数据源 · 刷新 · Key",
		icon: Settings
	}
];
function MorePage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: LINKS.map((l) => {
		const Icon = l.icon;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: l.to,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, {
				className: "flex items-center gap-3 transition-transform active:scale-[0.99]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "flex size-11 items-center justify-center rounded-2xl bg-accent/10 text-accent",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm font-semibold",
					children: l.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted",
					children: l.sub
				})] })]
			})
		}, l.to);
	}) });
}
//#endregion
export { MorePage as component };
