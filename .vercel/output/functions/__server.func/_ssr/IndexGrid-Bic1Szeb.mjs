import { b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { l as fmtPctShort, u as fmtPrice } from "./format-9-Yv8U5-.mjs";
import { i as Tone, n as Glass, r as SectionTitle } from "./Glass-otXZh5Ig.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/IndexGrid-Bic1Szeb.js
var import_jsx_runtime = require_jsx_runtime();
function IndexGrid({ indices }) {
	if (!indices.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
		title: "四大指数",
		hint: "实时"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "暂无可靠数据"
	})] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mb-3 grid grid-cols-2 gap-2",
		children: indices.map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "glass-tight p-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted",
					children: x.name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 text-lg font-semibold tabular-nums text-fg",
					children: fmtPrice(x.price)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
					v: x.pct,
					className: "text-sm font-semibold",
					children: fmtPctShort(x.pct)
				})
			]
		}, x.code))
	});
}
//#endregion
export { IndexGrid as t };
