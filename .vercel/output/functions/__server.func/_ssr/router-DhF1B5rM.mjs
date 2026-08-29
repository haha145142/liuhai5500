import { i as __toESM } from "../_runtime.mjs";
import { B as require_react, _ as createRootRoute, b as require_jsx_runtime, d as useRouterState, g as createFileRoute, h as lazyRouteComponent, l as Scripts, m as Outlet, p as createRouter, u as HeadContent, v as Link, y as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { o as clockStr, s as cnTime, t as DEFAULT_SECTOR_IDS } from "./format-9-Yv8U5-.mjs";
import { a as RefreshCw, c as Grid2x2, f as Briefcase, l as ChartColumn, n as TriangleAlert, o as Newspaper, s as House } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-DhF1B5rM.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: error.message || "An unexpected error occurred. Try reloading the page."
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	if (typeof window === "undefined") return () => {};
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	const parentOrigin = resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		if (envelope.data.type === "hello") {
			if (!HelloSchema.safeParse(event.data).success) return;
			announce();
			return;
		}
		if (envelope.data.type === "navigate") {
			const parsed = NavigateSchema.safeParse(event.data);
			if (!parsed.success) return;
			navigate(parsed.data.path);
			queueMicrotask(reportLocation);
			return;
		}
		if (envelope.data.type === "history") {
			const parsed = HistorySchema.safeParse(event.data);
			if (!parsed.success) return;
			if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
			window.history.go(parsed.data.delta);
		}
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var TABS = [
	{
		to: "/",
		label: "首页",
		icon: House,
		match: (p) => p === "/"
	},
	{
		to: "/portfolio",
		label: "持仓",
		icon: Briefcase,
		match: (p) => p.startsWith("/portfolio") || p.startsWith("/band")
	},
	{
		to: "/market",
		label: "大盘",
		icon: ChartColumn,
		match: (p) => p.startsWith("/market")
	},
	{
		to: "/news",
		label: "资讯",
		icon: Newspaper,
		match: (p) => p.startsWith("/news")
	},
	{
		to: "/more",
		label: "更多",
		icon: Grid2x2,
		match: (p) => [
			"/more",
			"/funds",
			"/ai",
			"/settings"
		].some((x) => p.startsWith(x))
	}
];
function TabBar() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		className: "tabbar",
		"aria-label": "主导航",
		children: TABS.map((t) => {
			const active = t.match(pathname);
			const Icon = t.icon;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: t.to,
				className: cn("flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium transition-transform duration-150 active:scale-95", active ? "bg-white/80 text-accent shadow-sm" : "text-muted"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
					className: "size-5",
					strokeWidth: active ? 2.2 : 1.8
				}), t.label]
			}, t.to);
		})
	});
}
var PORT_KEYS = [
	"fund_ai_pro_portfolio_v3",
	"fund_ai_pro_portfolio_v2",
	"fund_ai_pro_portfolio"
];
var DS_KEY = "fund_ai_pro_deepseek_key";
var DS_MODEL = "fund_ai_pro_deepseek_model";
var SECTOR_KEY = "fund_ai_pro_selected_sectors_v1";
var WATCH_KEY = "fund_ai_pro_watchlist_v1";
var SETTINGS_KEY = "fund_ai_pro_settings_v1";
var DEFAULT_SETTINGS = {
	autoRefreshMs: 12e4,
	newsRefreshMs: 9e5
};
function readJson(key, fallback) {
	if (typeof window === "undefined") return fallback;
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return fallback;
		return JSON.parse(raw);
	} catch {
		return fallback;
	}
}
function loadPortfolio() {
	if (typeof window === "undefined") return [];
	for (const key of PORT_KEYS) try {
		const arr = JSON.parse(localStorage.getItem(key) || "null");
		if (Array.isArray(arr) && arr.length) {
			const cleaned = arr.filter((x) => x && /^\d{6}$/.test(x.code) && Number(x.shares) > 0 && Number(x.cost) > 0);
			if (cleaned.length) {
				if (key !== PORT_KEYS[0]) savePortfolio(cleaned);
				return cleaned;
			}
		}
	} catch {}
	return [];
}
function savePortfolio(list) {
	try {
		localStorage.setItem(PORT_KEYS[0], JSON.stringify(list));
	} catch {}
}
function getDSKey() {
	if (typeof window === "undefined") return "";
	return localStorage.getItem(DS_KEY) || "";
}
function setDSKey(key) {
	if (!key) localStorage.removeItem(DS_KEY);
	else localStorage.setItem(DS_KEY, key);
}
function getDSModel() {
	if (typeof window === "undefined") return "deepseek-chat";
	return localStorage.getItem(DS_MODEL) || "deepseek-chat";
}
function setDSModel(model) {
	localStorage.setItem(DS_MODEL, model || "deepseek-chat");
}
function loadSelectedSectors() {
	const ids = readJson(SECTOR_KEY, DEFAULT_SECTOR_IDS);
	return ids.length ? ids : DEFAULT_SECTOR_IDS;
}
function saveSelectedSectors(ids) {
	try {
		localStorage.setItem(SECTOR_KEY, JSON.stringify(ids));
	} catch {}
}
function loadWatchlist() {
	return readJson(WATCH_KEY, []);
}
function saveWatchlist(codes) {
	try {
		localStorage.setItem(WATCH_KEY, JSON.stringify(codes));
	} catch {}
}
function loadSettings() {
	return {
		...DEFAULT_SETTINGS,
		...readJson(SETTINGS_KEY, {})
	};
}
function saveSettings(s) {
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
	} catch {}
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var getSnapshot = createServerFn({ method: "GET" }).handler(createSsrRpc("d5c85af2cdd0d4ca6f5ee19fc2d37fa786862b309025e81de5ffb43187814c88"));
var getNews = createServerFn({ method: "GET" }).handler(createSsrRpc("0e39e01627c0019bc0118b3c68923d593e7efdae58ecc850dd18eac7b4936c0b"));
var getFund = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("d502d08757452348aa74f57b4a5411607d7ed89fba2ebf7b5b7e1403c5c5fdda"));
var searchFund = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("38368aa5bcbe1c86986c53744abc9f7fb688a49ce64d4f5cde0e4d04d71e9e27"));
var getFundRank = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("cb8805ffcf74315a64dc4280f23e4072d8b9d2531e8c56cc68aea777ea5f9eae"));
var analyzeMarket = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("258976656f4feb5fd9a5db431afd47b55fb1695680e0adcfe50f4b89f4c8472a"));
var useApp = create((set, get) => ({
	ready: false,
	loading: false,
	newsLoading: false,
	snapshot: null,
	news: null,
	portfolio: [],
	funds: {},
	selectedSectors: [],
	watchlist: [],
	settings: loadSettings(),
	lastError: null,
	hydrate: () => {
		if (get().ready) return;
		set({
			ready: true,
			portfolio: loadPortfolio(),
			selectedSectors: loadSelectedSectors(),
			watchlist: loadWatchlist(),
			settings: loadSettings()
		});
	},
	refreshSnapshot: async () => {
		if (get().loading) return;
		set({
			loading: true,
			lastError: null
		});
		try {
			set({
				snapshot: await getSnapshot(),
				loading: false
			});
		} catch (e) {
			set({
				loading: false,
				lastError: e instanceof Error ? e.message : "刷新失败"
			});
		}
	},
	refreshNews: async () => {
		if (get().newsLoading) return;
		set({ newsLoading: true });
		try {
			set({
				news: await getNews(),
				newsLoading: false
			});
		} catch {
			set({ newsLoading: false });
		}
	},
	refreshFunds: async () => {
		const list = get().portfolio;
		if (!list.length) return;
		const entries = await Promise.all(list.map(async (h) => {
			try {
				const q = await getFund({ data: { code: h.code } });
				return [h.code, q];
			} catch {
				return null;
			}
		}));
		const funds = { ...get().funds };
		for (const e of entries) if (e) funds[e[0]] = e[1];
		set({ funds });
	},
	addHolding: (h) => {
		const list = get().portfolio.slice();
		const i = list.findIndex((x) => x.code === h.code);
		if (i >= 0) list[i] = {
			...list[i],
			...h
		};
		else list.push(h);
		savePortfolio(list);
		set({ portfolio: list });
		get().refreshFunds();
	},
	updateHolding: (code, patch) => {
		const list = get().portfolio.map((x) => x.code === code ? {
			...x,
			...patch
		} : x);
		savePortfolio(list);
		set({ portfolio: list });
	},
	removeHolding: (code) => {
		const list = get().portfolio.filter((x) => x.code !== code);
		savePortfolio(list);
		set({ portfolio: list });
	},
	setSectors: (ids) => {
		saveSelectedSectors(ids);
		set({ selectedSectors: ids });
	},
	toggleWatch: (code) => {
		const cur = get().watchlist;
		const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
		saveWatchlist(next);
		set({ watchlist: next });
	},
	setSettings: (s) => {
		const next = {
			...get().settings,
			...s
		};
		saveSettings(next);
		set({ settings: next });
	}
}));
function isWeekend(d = /* @__PURE__ */ new Date()) {
	const day = cnTime(d).getUTCDay();
	return day === 0 || day === 6;
}
/** A-share continuous auction: 09:30–11:30, 13:00–15:00 CST, weekdays. */
function isTradeTime(d = /* @__PURE__ */ new Date()) {
	const t = cnTime(d);
	const day = t.getUTCDay();
	if (day === 0 || day === 6) return false;
	const mins = t.getUTCHours() * 60 + t.getUTCMinutes();
	return mins >= 570 && mins <= 690 || mins >= 780 && mins <= 900;
}
function sessionLabel(d = /* @__PURE__ */ new Date()) {
	if (isWeekend(d)) return "周末休市";
	if (isTradeTime(d)) return "盘中实时";
	const t = cnTime(d);
	const mins = t.getUTCHours() * 60 + t.getUTCMinutes();
	if (mins < 570) return "开盘前";
	if (mins < 780) return "午间休市";
	return "已收盘";
}
function AppShell({ children }) {
	const hydrate = useApp((s) => s.hydrate);
	const refreshSnapshot = useApp((s) => s.refreshSnapshot);
	const refreshNews = useApp((s) => s.refreshNews);
	const refreshFunds = useApp((s) => s.refreshFunds);
	const loading = useApp((s) => s.loading);
	const snapshot = useApp((s) => s.snapshot);
	const settings = useApp((s) => s.settings);
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	(0, import_react.useEffect)(() => {
		hydrate();
		refreshSnapshot();
		refreshNews();
		refreshFunds();
	}, [
		hydrate,
		refreshSnapshot,
		refreshNews,
		refreshFunds
	]);
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => {
			if (document.hidden) return;
			refreshSnapshot();
			refreshFunds();
		}, settings.autoRefreshMs);
		return () => window.clearInterval(id);
	}, [
		refreshSnapshot,
		refreshFunds,
		settings.autoRefreshMs
	]);
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => {
			if (document.hidden) return;
			if (isTradeTime()) refreshFunds();
		}, 3e4);
		return () => window.clearInterval(id);
	}, [refreshFunds]);
	const onRefresh = () => {
		refreshSnapshot();
		refreshFunds();
		if (pathname.startsWith("/news") || pathname === "/") refreshNews();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "app-shell",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "sticky top-0 z-30 px-4 pb-2 pt-[max(14px,env(safe-area-inset-top))]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "glass flex items-center justify-between px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-lg font-semibold tracking-tight text-fg",
						children: "Fund AI Pro"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted",
						children: [sessionLabel(), snapshot ? ` · 数据截至 ${clockStr(new Date(snapshot.fetchedAt))}` : " · 正在接入行情"]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onRefresh,
						"aria-label": "刷新",
						className: "flex size-10 items-center justify-center rounded-full bg-white/80 text-fg shadow-sm ring-1 ring-border transition-transform active:scale-95",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: cn("size-4", loading && "animate-spin") })
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "px-3 pt-1",
				children
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabBar, {})
		]
	});
}
var styles_default = "/assets/styles-CKy4Dy1q.css";
var APP_NAME = "Fund AI Pro";
var Route$9 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover"
			},
			{ title: APP_NAME },
			{
				name: "theme-color",
				content: "#EEF3F9"
			},
			{
				name: "apple-mobile-web-app-capable",
				content: "yes"
			},
			{
				name: "apple-mobile-web-app-status-bar-style",
				content: "black-translucent"
			},
			{
				name: "description",
				content: "基金智能决策台 · 持仓估值、板块资金、新闻证据链"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "zh-CN",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	})
});
var $$splitComponentImporter$8 = () => import("./routes-ispLcfjY.mjs");
var Route$8 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$8, "component") });
var $$splitComponentImporter$7 = () => import("./ai-6emSA-0Y.mjs");
var Route$7 = createFileRoute("/ai")({ component: lazyRouteComponent($$splitComponentImporter$7, "component") });
var $$splitComponentImporter$6 = () => import("./band-DzWgiFan.mjs");
var Route$6 = createFileRoute("/band")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./funds-DTLBJEYu.mjs");
var Route$5 = createFileRoute("/funds")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
var $$splitComponentImporter$4 = () => import("./market-BQZ0X662.mjs");
var Route$4 = createFileRoute("/market")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./more-BNfgCVnT.mjs");
var Route$3 = createFileRoute("/more")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./news-B3y0zjJi.mjs");
var Route$2 = createFileRoute("/news")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./portfolio-J-MMuxSY.mjs");
var Route$1 = createFileRoute("/portfolio")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./settings-DjEE0sMq.mjs");
var Route = createFileRoute("/settings")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var rootRouteChildren = {
	IndexRoute: Route$8.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$9
	}),
	AiRoute: Route$7.update({
		id: "/ai",
		path: "/ai",
		getParentRoute: () => Route$9
	}),
	BandRoute: Route$6.update({
		id: "/band",
		path: "/band",
		getParentRoute: () => Route$9
	}),
	FundsRoute: Route$5.update({
		id: "/funds",
		path: "/funds",
		getParentRoute: () => Route$9
	}),
	MarketRoute: Route$4.update({
		id: "/market",
		path: "/market",
		getParentRoute: () => Route$9
	}),
	MoreRoute: Route$3.update({
		id: "/more",
		path: "/more",
		getParentRoute: () => Route$9
	}),
	NewsRoute: Route$2.update({
		id: "/news",
		path: "/news",
		getParentRoute: () => Route$9
	}),
	PortfolioRoute: Route$1.update({
		id: "/portfolio",
		path: "/portfolio",
		getParentRoute: () => Route$9
	}),
	SettingsRoute: Route.update({
		id: "/settings",
		path: "/settings",
		getParentRoute: () => Route$9
	})
};
var routeTree = Route$9._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { analyzeMarket as a, getDSKey as c, setDSModel as d, cn as f, useApp as i, getDSModel as l, isTradeTime as n, getFundRank as o, isWeekend as r, searchFund as s, router_exports as t, setDSKey as u };
