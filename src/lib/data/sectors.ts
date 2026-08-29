export type SectorRule = {
  id: string;
  name: string;
  bkCode: string;
  prefer: "concept" | "industry";
  searchKeys: string[];
  keys: string[];
  etf?: { code: string; name: string };
};

/** Watchable sector universe. Only selected sectors are shown in the personal watch panel. */
export const SECTOR_RULES: SectorRule[] = [
  { id: "semi", name: "半导体", bkCode: "BK0917", prefer: "industry", searchKeys: ["半导体"], keys: ["半导体", "芯片", "集成电路", "晶圆"], etf: { code: "512480", name: "半导体ETF" } },
  { id: "semi_eq", name: "半导体材料设备", bkCode: "BK1059", prefer: "concept", searchKeys: ["半导体材料", "半导体设备"], keys: ["半导体设备", "半导体材料", "光刻", "刻蚀"], etf: { code: "159516", name: "半导体材料ETF" } },
  { id: "storage", name: "存储芯片", bkCode: "BK1137", prefer: "concept", searchKeys: ["存储芯片", "存储器"], keys: ["存储芯片", "存储器", "存储"], etf: { code: "159995", name: "芯片ETF" } },
  { id: "compute", name: "国产算力", bkCode: "BK1134", prefer: "concept", searchKeys: ["国产算力", "算力"], keys: ["国产算力", "算力", "服务器", "东数西算"], etf: { code: "512720", name: "计算机ETF" } },
  { id: "comm", name: "通信", bkCode: "BK1650", prefer: "industry", searchKeys: ["通信", "通信设备"], keys: ["通信", "通信设备", "5G"], etf: { code: "515880", name: "通信ETF" } },
  { id: "cpo", name: "CPO", bkCode: "BK1128", prefer: "concept", searchKeys: ["CPO", "光模块", "光通信"], keys: ["CPO", "光模块", "光通信"], etf: { code: "159652", name: "CPO/光模块ETF" } },
  { id: "mlcc", name: "MLCC", bkCode: "BK0890", prefer: "concept", searchKeys: ["MLCC", "被动元件"], keys: ["MLCC", "电容", "被动元件"], etf: { code: "512560", name: "电子ETF" } },
  { id: "consumer_el", name: "消费电子", bkCode: "BK1037", prefer: "concept", searchKeys: ["消费电子"], keys: ["消费电子", "苹果", "果链"], etf: { code: "159732", name: "消费电子ETF" } },
  { id: "ai", name: "人工智能", bkCode: "BK0800", prefer: "concept", searchKeys: ["人工智能", "AI"], keys: ["人工智能", "AI", "大模型"], etf: { code: "512930", name: "AIETF" } },
  { id: "robot", name: "机器人", bkCode: "BK1090", prefer: "concept", searchKeys: ["机器人"], keys: ["机器人", "人形机器人"], etf: { code: "562500", name: "机器人ETF" } },
  { id: "new_energy", name: "新能源", bkCode: "BK0493", prefer: "concept", searchKeys: ["新能源"], keys: ["新能源", "光伏", "锂电"], etf: { code: "516160", name: "新能源ETF" } },
  { id: "liquor", name: "白酒", bkCode: "BK0896", prefer: "concept", searchKeys: ["白酒"], keys: ["白酒", "酒"], etf: { code: "512690", name: "酒ETF" } },
  { id: "pharma", name: "创新药", bkCode: "BK1143", prefer: "concept", searchKeys: ["创新药"], keys: ["创新药", "生物医药", "CXO"], etf: { code: "159992", name: "创新药ETF" } },
  { id: "gold", name: "黄金", bkCode: "BK0547", prefer: "concept", searchKeys: ["黄金"], keys: ["黄金", "金"], etf: { code: "518880", name: "黄金ETF" } },
  { id: "defense", name: "军工", bkCode: "BK0490", prefer: "industry", searchKeys: ["军工", "国防"], keys: ["军工", "国防", "航空"], etf: { code: "512660", name: "军工ETF" } },
  { id: "space", name: "商业航天", bkCode: "BK0963", prefer: "concept", searchKeys: ["商业航天", "卫星互联网"], keys: ["商业航天", "卫星互联网", "卫星", "航天"], etf: { code: "563380", name: "卫星互联网ETF" } },
  { id: "nonferrous", name: "有色金属", bkCode: "BK0478", prefer: "industry", searchKeys: ["有色金属"], keys: ["有色金属", "有色"], etf: { code: "512400", name: "有色金属ETF" } },
  { id: "lithium", name: "锂矿", bkCode: "BK1173", prefer: "concept", searchKeys: ["锂矿", "锂资源"], keys: ["锂矿", "锂资源", "盐湖提锂"], etf: { code: "159840", name: "锂电池ETF" } },
];

export const DEFAULT_SECTOR_IDS = SECTOR_RULES.slice(0, 8).map((s) => s.id);

export const INDEX_DEFS = [
  { name: "上证指数", secid: "1.000001", code: "000001" },
  { name: "深证成指", secid: "0.399001", code: "399001" },
  { name: "创业板指", secid: "0.399006", code: "399006" },
  { name: "科创50", secid: "1.000688", code: "000688" },
] as const;

export const GLOBAL_DEFS = [
  { name: "纳斯达克", tencent: "usNDX" },
  { name: "标普500", tencent: "usSPX" },
  { name: "道琼斯", tencent: "usDJI" },
  { name: "恒生指数", tencent: "hkHSI" },
  { name: "黄金", tencent: "hf_GC" },
  { name: "原油", tencent: "hf_CL" },
  { name: "美元指数", tencent: "hf_DINIW" },
] as const;

export function matchFundSector(fundName: string): SectorRule | null {
  const n = fundName || "";
  for (const r of SECTOR_RULES) {
    if (r.keys.some((k) => n.includes(k))) return r;
  }
  return null;
}
