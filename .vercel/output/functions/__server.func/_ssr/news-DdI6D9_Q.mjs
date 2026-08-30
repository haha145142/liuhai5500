import { i as __toESM } from "../_runtime.mjs";
import { B as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as ageLabel, f as formatPublishedAt, o as clockStr } from "./format-B7cjnRuX.mjs";
import { i as useApp, o as analyzeNews } from "./router-Byr1StPg.mjs";
import { i as Tone, n as Glass, r as SectionTitle, t as EmptyNote } from "./Glass-BjTxdcl0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/news-DdI6D9_Q.js
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
var AI_CACHE_KEY = "fund_ai_pro_news_ai_v2";
var AI_CACHE_TTL = 6e5;
function readAiCache() {
	if (typeof window === "undefined") return "";
	try {
		const raw = JSON.parse(sessionStorage.getItem(AI_CACHE_KEY) || "null");
		return raw?.text && raw.ts && Date.now() - raw.ts < AI_CACHE_TTL ? raw.text : "";
	} catch {
		return "";
	}
}
function writeAiCache(text) {
	try {
		sessionStorage.setItem(AI_CACHE_KEY, JSON.stringify({
			ts: Date.now(),
			text
		}));
	} catch {}
}
function renderAiText(text) {
	return text.split("\n").map((line, i) => {
		return /^【.+】$/.test(line.trim()) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 first:mt-0 rounded-xl bg-accent/8 px-2.5 py-1.5 text-xs font-bold text-fg",
			children: line
		}, `${i}-${line}`) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-sm leading-7 text-fg",
			children: line || "\xA0"
		}, `${i}-${line}`);
	});
}
function NewsPage() {
	const news = useApp((s) => s.news);
	const newsLoading = useApp((s) => s.newsLoading);
	const refreshNews = useApp((s) => s.refreshNews);
	const snapshot = useApp((s) => s.snapshot);
	const portfolio = useApp((s) => s.portfolio);
	const funds = useApp((s) => s.funds);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [tab, setTab] = (0, import_react.useState)("flash");
	const [aiText, setAiText] = (0, import_react.useState)(() => readAiCache());
	const [aiBusy, setAiBusy] = (0, import_react.useState)(false);
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
	const runNewsAI = async () => {
		if (!items.length || aiBusy) return;
		setAiBusy(true);
		try {
			const evidence = items.slice(0, 10).map((n, i) => ({
				no: i + 1,
				title: n.title,
				summary: n.summary,
				source: n.source,
				publishedAt: n.publishedAt ? formatPublishedAt(n.publishedAt) : "暂无可靠时间",
				category: n.category,
				sentiment: n.sentiment,
				relatedSectors: n.relatedSectors
			}));
			const holdingEvidence = names.length ? `我的持仓名称：${JSON.stringify(names.slice(0, 20))}` : "我的持仓：暂无可靠数据";
			const prompt = [
				"请解读下面最新新闻。重点回答哪些新闻真正可能影响A股、影响哪个板块，以及影响逻辑。",
				`新闻：${JSON.stringify(evidence)}`,
				holdingEvidence,
				snapshot ? `指数：${JSON.stringify(snapshot.indices)}` : "指数：暂无可靠数据",
				snapshot ? `板块资金：${JSON.stringify(snapshot.sectors)}` : "板块资金：暂无可靠数据",
				snapshot ? `市场资金：${JSON.stringify(snapshot.flow)}` : "市场资金：暂无可靠数据",
				snapshot ? `外围：${JSON.stringify(snapshot.global)}` : "外围：暂无可靠数据",
				"优先挑出最值得关注的3—5条，不要机械重复新闻标题。没有行情或资金证据时，明确写暂无可靠数据，不要用常识假装已经验证。",
				"输出结构：\n【今日新闻结论】一句话总判断\n【最重要的新闻】按重要性列3—5条，每条包含：发生了什么｜为什么重要｜影响谁｜利好/利空/中性｜证据是否验证\n【板块影响】指出最值得关注的板块和原因；没有证据就写暂无可靠数据\n【与我的持仓关系】只在输入证据能支持时关联具体持仓，否则写暂无明显关联\n【一句话提醒】告诉普通投资者今天最应该盯什么。"
			].join("\n");
			const r = await analyzeNews({ data: { prompt } });
			if (r.ok && r.text) {
				setAiText(r.text);
				writeAiCache(r.text);
			} else setAiText(`AI 解读暂时不可用：${r.error}`);
		} finally {
			setAiBusy(false);
		}
	};
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
		items.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Glass, {
			className: "mb-2 border border-accent/15",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionTitle, {
					title: "AI解读新闻",
					hint: "新闻 + 行情 + 资金交叉验证"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs leading-relaxed text-muted",
					children: "只分析当前页面已经抓到的新闻，并用现有指数、板块资金、市场资金和你的持仓做交叉验证。没有证据就明确标注，不把推测当事实。"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => void runNewsAI(),
					disabled: aiBusy,
					className: "mt-3 w-full rounded-2xl bg-accent py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-60",
					children: aiBusy ? "正在交叉分析新闻…" : aiText && !aiText.startsWith("AI 解读暂时不可用") ? "重新分析最新新闻" : "一键生成 AI 解读"
				}),
				aiText ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 rounded-2xl bg-bg-elevated/80 p-3",
					children: renderAiText(aiText)
				}) : null,
				aiText && !aiBusy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-[10px] text-subtle",
					children: "AI 解读仅基于当前已获取证据；结果已在本次会话缓存约 10 分钟。"
				}) : null
			]
		}), items.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewsCard, {
			item: n,
			holdings: names
		}, n.id + n.source))] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyNote, { children: newsLoading ? "正在抓取资讯…" : "暂无可靠资讯，请稍后刷新" }),
		news ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "px-1 pb-2 text-[10px] text-subtle",
			children: ["源：", news.sources.map((s) => `${s.name} ${s.note}`).join(" · ")]
		}) : null
	] });
}
function NewsCard({ item, holdings }) {
	const hitHold = holdings.filter((n) => n && (item.title.includes(n.slice(0, 4)) || item.relatedSectors.some((s) => n.includes(s))));
	const hasSourceUrl = /^https?:\/\//i.test(item.url);
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
				className: "mt-2 flex flex-wrap items-center gap-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tone, {
						v: item.sentiment === "bull" ? 1 : item.sentiment === "bear" ? -1 : 0,
						className: "rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold",
						children: item.sentiment === "bull" ? "偏利好" : item.sentiment === "bear" ? "偏利空" : "中性"
					}),
					item.relatedSectors.slice(0, 3).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent",
						children: s
					}, s)),
					hasSourceUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: item.url,
						target: "_blank",
						rel: "noopener noreferrer",
						className: "ml-auto rounded-full bg-bg-elevated px-2.5 py-1 text-[10px] font-semibold text-accent",
						children: "查看原文"
					}) : null
				]
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
