import { i as __toESM } from "../_runtime.mjs";
import { B as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { l as fmtPctShort, u as fmtPrice } from "./format-B7cjnRuX.mjs";
import { i as useApp, s as getFundRank } from "./router-Byr1StPg.mjs";
import { i as Tone, n as Glass, r as SectionTitle, t as EmptyNote } from "./Glass-BjTxdcl0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/funds-C-CVdy-C.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TABS = [
	{
		id: "r",
		label: "日涨幅"
	},
	{
		id: "z",
		label: "近1周"
	},
	{
		id: "6y",
		label: "近6月"
	},
	{
		id: "1n",
		label: "近1年"
	}
];
function FundsPage() {
	const [tab, setTab] = (0, import_react.useState)("r");
	const [rows, setRows] = (0, import_react.useState)([]);
	const [source, setSource] = (0, import_react.useState)("—");
	const [loading, setLoading] = (0, import_react.useState)(false);
	const watchlist = useApp((s) => s.watchlist);
	const toggleWatch = useApp((s) => s.toggleWatch);
	const addHolding = useApp((s) => s.addHolding);
	(0, import_react.useEffect)(() => {
		let live = true;
		setLoading(true);
		getFundRank({ data: { sort: tab } }).then((r) => {
			if (!live) return;
			setRows(r.rows);
			setSource(r.source);
			setLoading(false);
		});
		return () => {
			live = false;
		};
	}, [tab]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
			title: "基金排行",
			hint: source
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex gap-1",
			children: TABS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setTab(t.id),
				className: `flex-1 rounded-xl py-2 text-xs font-semibold ${tab === t.id ? "bg-accent text-accent-fg" : "bg-bg-elevated text-muted"}`,
				children: t.label
			}, t.id))
		})] }),
		loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyNote, { children: "正在读取排行…" }) : null,
		!loading && !rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyNote, { children: "排行数据源暂不可用（周末接口可能暂停）" }) : null,
		rows.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
			className: "glass-tight mb-2 flex items-center gap-3 p-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "w-6 text-xs font-semibold text-subtle",
					children: i + 1
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "truncate text-sm font-semibold",
						children: r.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-[11px] text-muted",
						children: [
							r.code,
							" · 净值 ",
							fmtPrice(r.nav, 4)
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
					v: r.day,
					className: "text-sm font-semibold",
					children: fmtPctShort(tab === "z" ? r.week : tab === "1n" ? r.ytd : tab === "6y" ? r.month : r.day)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => toggleWatch(r.code),
					className: `rounded-full px-2 py-1 text-[10px] font-semibold ${watchlist.includes(r.code) ? "bg-accent text-accent-fg" : "bg-bg-elevated text-muted"}`,
					children: watchlist.includes(r.code) ? "已关注" : "关注"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "text-[10px] font-semibold text-accent",
					onClick: () => addHolding({
						code: r.code,
						name: r.name,
						shares: 100,
						cost: r.nav || 1
					}),
					children: "加入"
				})
			]
		}, r.code))
	] });
}
//#endregion
export { FundsPage as component };
