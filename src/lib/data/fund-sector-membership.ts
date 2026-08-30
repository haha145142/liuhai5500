import type { FundSector } from "./fund-sectors";
import type { FundQuote, Holding } from "@/lib/types";

/** Conservative client-side enrichment only. It never changes the sector aggregate. */
const KEYWORDS: Record<string, string[]> = {
  semi: ["半导体", "芯片", "集成电路", "晶圆"],
  cpo: ["CPO", "光通信", "通信设备", "光模块"],
  ai: ["人工智能", "AI", "算力", "大模型"],
  computer: ["计算机", "软件"],
  ce: ["消费电子", "电子"],
  med: ["医疗", "医药", "健康"],
  drug: ["创新药", "生物医药", "医药"],
  tcm: ["中药"],
  baijiu: ["白酒"],
  consume: ["消费"],
  food: ["食品", "饮料"],
  nev: ["新能源", "新能源汽车", "电动车"],
  pv: ["光伏"],
  battery: ["锂电", "电池", "新能源汽车"],
  military: ["军工", "国防", "高端装备"],
  broker: ["证券", "券商"],
  bank: ["银行"],
  restate: ["房地产", "地产"],
  nonfer: ["有色", "有色金属"],
  gold: ["黄金"],
  coal: ["煤炭"],
  steel: ["钢铁"],
  chem: ["化工", "材料"],
  agri: ["农业", "农牧"],
  media: ["传媒", "游戏", "影视"],
  robot: ["机器人"],
  hk: ["港股", "海外互联网", "恒生互联网"],
  nas: ["纳斯达克", "标普500", "美股"],
  hs300: ["沪深300"],
  zz500: ["中证500"],
  dividend: ["红利", "低波"],
};

export function holdingMatchesFundSector(holding: Holding, sector: FundSector): boolean {
  const name = String(holding.name || "").toLowerCase();
  const keys = KEYWORDS[sector.id] || [];
  return keys.some((key) => name.includes(key.toLowerCase()));
}

export function enrichFundSectorMembers(
  sector: FundSector,
  members: { code: string; name: string }[],
  portfolio: Holding[],
) {
  const known = new Set(members.map((m) => m.code));
  return portfolio
    .filter((holding) => !known.has(holding.code) && holdingMatchesFundSector(holding, sector))
    .map((holding) => ({ code: holding.code, name: holding.name }));
}

export function quoteForEnrichedHolding(
  holding: Holding,
  funds: Record<string, FundQuote>,
) {
  const fund = funds[holding.code];
  return {
    code: holding.code,
    name: holding.name,
    pct: fund?.estimatePct ?? fund?.dayPct ?? null,
    nav: fund?.nav ?? null,
    estimate: fund?.estimate ?? null,
    time: fund?.estimateTime ?? null,
    date: fund?.navDate ?? null,
  };
}
