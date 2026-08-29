import { i as __toESM } from "../_runtime.mjs";
import { B as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as ageLabel, f as formatPublishedAt, o as clockStr } from "./format-9-Yv8U5-.mjs";
import { i as useApp } from "./router-DhF1B5rM.mjs";
import { i as Tone, n as Glass, r as SectionTitle, t as EmptyNote } from "./Glass-otXZh5Ig.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/news-B3y0zjJi.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FILTERS = [
	{
		id: "all",
		label: "全部"
	},
	{
		id: "policy",
		label: "政策"
	},
	{
		id: "market",
		label: "市场"
	},
	{
		id: "sector",
		label: "板块"
	},
	{
		id: "global",
		label: "外围"
	}
];
function NewsPage() {
	const news = useApp((s) => s.news);
	const newsLoading = useApp((s) => s.newsLoading);
	const refreshNews = useApp((s) => s.refreshNews);
	const portfolio = useApp((s) => s.portfolio);
	const funds = useApp((s) => s.funds);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [tab, setTab] = (0, import_react.useState)("flash");
	const names = portfolio.map((p) => funds[p.code]?.name || p.name).filter(Boolean);
	const items = (0, import_react.useMemo)(() => {
		const list = (tab === "deep" ? news?.deep : tab === "mood" ? news?.sentiment : news?.items) || [];
		if (filter === "all") return list;
		return list.filter((n) => n.category === filter);
	}, [
		news,
		filter,
		tab
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
				title: "市场资讯",
				hint: newsLoading ? "刷新中" : "真实发布时间",
				right: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => void refreshNews(),
					className: "text-xs font-semibold text-accent",
					children: "刷新新闻"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted",
				children: news ? `抓取于 ${clockStr(new Date(news.fetchedAt))} · 最新发布 ${news.latestPublishedAt ? formatPublishedAt(news.latestPublishedAt) : "时间未知"}` : "尚未抓取"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-[11px] text-subtle",
				children: "发布时间取自源站字段，不用抓取时间冒充「刚刚」。"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 flex gap-1",
				children: [
					"flash",
					"deep",
					"mood"
				].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setTab(t),
					className: `flex-1 rounded-xl py-2 text-xs font-semibold ${tab === t ? "bg-accent text-accent-fg" : "bg-bg-elevated text-muted"}`,
					children: t === "flash" ? "快讯" : t === "deep" ? "深度" : "社区情绪"
				}, t))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: FILTERS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setFilter(f.id),
					className: `rounded-full px-3 py-1 text-[11px] font-semibold ${filter === f.id ? "bg-fg text-bg" : "bg-bg-elevated text-muted"}`,
					children: f.label
				}, f.id))
			})
		] }),
		items.length ? items.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewsCard, {
			item: n,
			holdings: names
		}, n.id + n.source)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyNote, { children: newsLoading ? "正在抓取资讯…" : "暂无可靠资讯，请稍后刷新" }),
		news ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "px-1 pb-2 text-[10px] text-subtle",
			children: ["源：", news.sources.map((s) => `${s.name} ${s.note}`).join(" · ")]
		}) : null
	] });
}
function NewsCard({ item, holdings }) {
	const hitHold = holdings.filter((n) => n && (item.title.includes(n.slice(0, 4)) || item.relatedSectors.some((s) => n.includes(s))));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "glass-tight mb-2 p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 text-[11px] text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.source }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatPublishedAt(item.publishedAt) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-auto",
						children: ageLabel(item.publishedAt)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-1 text-sm font-semibold leading-snug text-fg",
				children: item.title
			}),
			item.summary ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs leading-relaxed text-muted",
				children: item.summary
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
					v: item.sentiment === "bull" ? 1 : item.sentiment === "bear" ? -1 : 0,
					className: "rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold",
					children: item.sentiment === "bull" ? "偏利好" : item.sentiment === "bear" ? "偏利空" : "中性"
				}), item.relatedSectors.slice(0, 3).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent",
					children: s
				}, s))]
			}),
			hitHold.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 rounded-xl bg-warn/10 px-2 py-1 text-[11px] font-semibold text-warn",
				children: ["可能关联持仓：", hitHold.join("、")]
			}) : null
		]
	});
}
//#endregion
export { NewsPage as component };
