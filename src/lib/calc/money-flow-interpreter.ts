import type { MarketOrder } from "../types";
import { validateMoneyFlow } from "./money-flow-validation";

export type MoneyFlowInterpretation = {
  usable: boolean;
  headline: string;
  mainLabel: string;
  superLabel: string;
  largeLabel: string;
  midLabel: string;
  smallLabel: string;
  direction: "inflow" | "outflow" | "neutral" | "unknown";
  caveat: string;
};

const abs = (v: number) => Math.abs(v);
const signed = (v: number) => (v > 0 ? "流入" : v < 0 ? "流出" : "接近零");

export function interpretMoneyFlow(flow: MarketOrder | null | undefined): MoneyFlowInterpretation {
  if (!flow) {
    return { usable: false, headline: "暂无可靠资金数据", mainLabel: "未知", superLabel: "未知", largeLabel: "未知", midLabel: "未知", smallLabel: "未知", direction: "unknown", caveat: "没有拿到可靠的主力/超大单/大单/中单/小单数据，不能推断资金方向。" };
  }

  const checked = validateMoneyFlow(flow);
  const mainLabel = `${signed(flow.main)} ${abs(flow.main).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
  const superLabel = `${signed(flow.super)} ${abs(flow.super).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
  const largeLabel = `${signed(flow.large)} ${abs(flow.large).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
  const midLabel = `${signed(flow.mid)} ${abs(flow.mid).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
  const smallLabel = `${signed(flow.small)} ${abs(flow.small).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;

  if (!checked.usableForDirection) {
    return { usable: false, headline: "资金数据已读取，但暂不用于方向判断", mainLabel, superLabel, largeLabel, midLabel, smallLabel, direction: "unknown", caveat: checked.reason };
  }

  const direction = flow.main > 0 ? "inflow" : flow.main < 0 ? "outflow" : "neutral";
  const headline = flow.main > 0 ? "主力偏流入" : flow.main < 0 ? "主力偏流出" : "主力接近中性";
  const caveat = checked.validation === "fully_consistent" ? "资金结构通过内部一致性与全量平衡校验，可作为市场证据之一。" : "资金结构仅部分通过校验，方向判断已降级，不作为单独趋势确认。";
  return { usable: true, headline, mainLabel, superLabel, largeLabel, midLabel, smallLabel, direction, caveat };
}
