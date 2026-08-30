//#region node_modules/.nitro/vite/services/ssr/assets/format-B7cjnRuX.js
/** Watchable sector universe. Only selected sectors are shown in the personal watch panel. */
var SECTOR_RULES = [
	{
		id: "semi",
		name: "半导体",
		bkCode: "BK0917",
		prefer: "industry",
		searchKeys: ["半导体"],
		keys: [
			"半导体",
			"芯片",
			"集成电路",
			"晶圆"
		],
		etf: {
			code: "512480",
			name: "半导体ETF"
		}
	},
	{
		id: "semi_eq",
		name: "半导体材料设备",
		bkCode: "BK1059",
		prefer: "concept",
		searchKeys: ["半导体材料", "半导体设备"],
		keys: [
			"半导体设备",
			"半导体材料",
			"光刻",
			"刻蚀"
		],
		etf: {
			code: "159516",
			name: "半导体材料ETF"
		}
	},
	{
		id: "storage",
		name: "存储芯片",
		bkCode: "BK1137",
		prefer: "concept",
		searchKeys: ["存储芯片", "存储器"],
		keys: [
			"存储芯片",
			"存储器",
			"存储"
		],
		etf: {
			code: "159995",
			name: "芯片ETF"
		}
	},
	{
		id: "compute",
		name: "国产算力",
		bkCode: "BK1134",
		prefer: "concept",
		searchKeys: ["国产算力", "算力"],
		keys: [
			"国产算力",
			"算力",
			"服务器",
			"东数西算"
		],
		etf: {
			code: "512720",
			name: "计算机ETF"
		}
	},
	{
		id: "comm",
		name: "通信",
		bkCode: "BK1650",
		prefer: "industry",
		searchKeys: ["通信", "通信设备"],
		keys: [
			"通信",
			"通信设备",
			"5G"
		],
		etf: {
			code: "515880",
			name: "通信ETF"
		}
	},
	{
		id: "cpo",
		name: "CPO",
		bkCode: "BK1128",
		prefer: "concept",
		searchKeys: [
			"CPO",
			"光模块",
			"光通信"
		],
		keys: [
			"CPO",
			"光模块",
			"光通信"
		],
		etf: {
			code: "159652",
			name: "CPO/光模块ETF"
		}
	},
	{
		id: "mlcc",
		name: "MLCC",
		bkCode: "BK0890",
		prefer: "concept",
		searchKeys: ["MLCC", "被动元件"],
		keys: [
			"MLCC",
			"电容",
			"被动元件"
		],
		etf: {
			code: "512560",
			name: "电子ETF"
		}
	},
	{
		id: "consumer_el",
		name: "消费电子",
		bkCode: "BK1037",
		prefer: "concept",
		searchKeys: ["消费电子"],
		keys: [
			"消费电子",
			"苹果",
			"果链"
		],
		etf: {
			code: "159732",
			name: "消费电子ETF"
		}
	},
	{
		id: "ai",
		name: "人工智能",
		bkCode: "BK0800",
		prefer: "concept",
		searchKeys: ["人工智能", "AI"],
		keys: [
			"人工智能",
			"AI",
			"大模型"
		],
		etf: {
			code: "512930",
			name: "AIETF"
		}
	},
	{
		id: "robot",
		name: "机器人",
		bkCode: "BK1090",
		prefer: "concept",
		searchKeys: ["机器人"],
		keys: ["机器人", "人形机器人"],
		etf: {
			code: "562500",
			name: "机器人ETF"
		}
	},
	{
		id: "new_energy",
		name: "新能源",
		bkCode: "BK0493",
		prefer: "concept",
		searchKeys: ["新能源"],
		keys: [
			"新能源",
			"光伏",
			"锂电"
		],
		etf: {
			code: "516160",
			name: "新能源ETF"
		}
	},
	{
		id: "liquor",
		name: "白酒",
		bkCode: "BK0896",
		prefer: "concept",
		searchKeys: ["白酒"],
		keys: ["白酒", "酒"],
		etf: {
			code: "512690",
			name: "酒ETF"
		}
	},
	{
		id: "pharma",
		name: "创新药",
		bkCode: "BK1143",
		prefer: "concept",
		searchKeys: ["创新药"],
		keys: [
			"创新药",
			"生物医药",
			"CXO"
		],
		etf: {
			code: "159992",
			name: "创新药ETF"
		}
	},
	{
		id: "gold",
		name: "黄金",
		bkCode: "BK0547",
		prefer: "concept",
		searchKeys: ["黄金"],
		keys: ["黄金", "金"],
		etf: {
			code: "518880",
			name: "黄金ETF"
		}
	},
	{
		id: "defense",
		name: "军工",
		bkCode: "BK0490",
		prefer: "industry",
		searchKeys: ["军工", "国防"],
		keys: [
			"军工",
			"国防",
			"航空"
		],
		etf: {
			code: "512660",
			name: "军工ETF"
		}
	},
	{
		id: "space",
		name: "商业航天",
		bkCode: "BK0963",
		prefer: "concept",
		searchKeys: ["商业航天", "卫星互联网"],
		keys: [
			"商业航天",
			"卫星互联网",
			"卫星",
			"航天"
		]
	},
	{
		id: "nonferrous",
		name: "有色金属",
		bkCode: "BK0478",
		prefer: "industry",
		searchKeys: ["有色金属"],
		keys: ["有色金属", "有色"]
	},
	{
		id: "lithium",
		name: "锂矿",
		bkCode: "BK1173",
		prefer: "concept",
		searchKeys: ["锂矿", "锂资源"],
		keys: [
			"锂矿",
			"锂资源",
			"盐湖提锂"
		]
	}
];
var DEFAULT_SECTOR_IDS = SECTOR_RULES.slice(0, 8).map((s) => s.id);
var INDEX_DEFS = [
	{
		name: "上证指数",
		secid: "1.000001",
		code: "000001"
	},
	{
		name: "深证成指",
		secid: "0.399001",
		code: "399001"
	},
	{
		name: "创业板指",
		secid: "0.399006",
		code: "399006"
	},
	{
		name: "科创50",
		secid: "1.000688",
		code: "000688"
	}
];
var GLOBAL_DEFS = [
	{
		name: "纳斯达克",
		tencent: "usNDX"
	},
	{
		name: "标普500",
		tencent: "usSPX"
	},
	{
		name: "道琼斯",
		tencent: "usDJI"
	},
	{
		name: "恒生指数",
		tencent: "hkHSI"
	},
	{
		name: "黄金",
		tencent: "hf_GC"
	},
	{
		name: "原油",
		tencent: "hf_CL"
	},
	{
		name: "美元指数",
		tencent: "hf_DINIW"
	}
];
function matchFundSector(fundName) {
	const n = fundName || "";
	for (const r of SECTOR_RULES) if (r.keys.some((k) => n.includes(k))) return r;
	return null;
}
function fmtPctShort(v, digits = 2) {
	if (v == null || !Number.isFinite(v)) return "—";
	return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}
function fmtPrice(v, digits = 2) {
	if (v == null || !Number.isFinite(v)) return "—";
	return v.toFixed(digits);
}
function fmtYi(v) {
	if (v == null || !Number.isFinite(v)) return "—";
	const abs = Math.abs(v);
	if (abs >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
	if (abs >= 1e4) return `${(v / 1e4).toFixed(2)}万`;
	return v.toFixed(0);
}
function fmtMoney(v) {
	if (v == null || !Number.isFinite(v)) return "—";
	const abs = Math.abs(v);
	const sign = v < 0 ? "-" : "";
	if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`;
	if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(2)}万`;
	return `${sign}${abs.toFixed(2)}`;
}
function cnTime(d = /* @__PURE__ */ new Date()) {
	return new Date(d.getTime() + 288e5);
}
function clockStr(d = /* @__PURE__ */ new Date()) {
	const t = cnTime(d);
	const p = (n) => String(n).padStart(2, "0");
	return `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}
/** Display a news published timestamp. Never invent "刚刚" from fetch time. */
function formatPublishedAt(ts) {
	if (ts == null || !Number.isFinite(ts) || ts <= 0) return "时间未知";
	if (ts > Date.now() + 3e5) return "时间未知";
	const t = cnTime(new Date(ts));
	const n = cnTime();
	const p = (x) => String(x).padStart(2, "0");
	const sameDay = t.getUTCFullYear() === n.getUTCFullYear() && t.getUTCMonth() === n.getUTCMonth() && t.getUTCDate() === n.getUTCDate();
	const hm = `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
	if (sameDay) return hm;
	return `${t.getUTCMonth() + 1}/${t.getUTCDate()} ${hm}`;
}
function ageLabel(ts) {
	if (ts == null || ts <= 0) return "时间未知";
	const mins = Math.round((Date.now() - ts) / 6e4);
	if (mins < 0) return "时间未知";
	if (mins < 60) return `${mins} 分钟前发布`;
	if (mins < 1440) return `${Math.round(mins / 60)} 小时前发布`;
	return `${Math.round(mins / 1440)} 天前发布`;
}
function safeText(s) {
	return String(s ?? "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, "\"").trim();
}
//#endregion
export { ageLabel as a, fmtMoney as c, fmtYi as d, formatPublishedAt as f, SECTOR_RULES as i, fmtPctShort as l, safeText as m, GLOBAL_DEFS as n, clockStr as o, matchFundSector as p, INDEX_DEFS as r, cnTime as s, DEFAULT_SECTOR_IDS as t, fmtPrice as u };
