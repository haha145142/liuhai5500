import { b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { m as cn } from "./router-Byr1StPg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/Glass-BjTxdcl0.js
var import_jsx_runtime = require_jsx_runtime();
function Glass({ className, children, tight, ...rest }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(tight ? "glass-tight" : "glass", "p-4 mb-3", className),
		...rest,
		children
	});
}
function SectionTitle({ title, hint, right }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-3 flex items-center gap-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-base font-semibold tracking-tight text-fg",
				children: title
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent",
				children: hint
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ml-auto",
				children: right
			})
		]
	});
}
function Tone({ v, children, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn(`tone-${v == null || !Number.isFinite(v) || v === 0 ? "flat" : v > 0 ? "up" : "down"}`, "tabular-nums", className),
		children
	});
}
function EmptyNote({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "py-4 text-center text-sm text-muted",
		children
	});
}
//#endregion
export { Tone as i, Glass as n, SectionTitle as r, EmptyNote as t };
