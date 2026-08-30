import type { MarketOrder } from "../types";

export type MoneyFlowValidation = {
  validation: "fully_consistent" | "partially_consistent" | "unreliable";
  internalDelta: number;
  balanceDelta: number;
  internalTolerance: number;
  balanceTolerance: number;
  usableForDirection: boolean;
  label: string;
  reason: string;
};

export function validateMoneyFlow(flow: Pick<MarketOrder, "main" | "super" | "large" | "mid" | "small">): MoneyFlowValidation {
  const nums = [flow.main, flow.super, flow.large, flow.mid, flow.small];
  if (nums.some((v) => !Number.isFinite(v))) {
    return {
      validation: "unreliable",
      internalDelta: Number.NaN,
      balanceDelta: Number.NaN,
      internalTolerance: Number.NaN,
      balanceTolerance: Number.NaN,
      usableForDirection: false,
      label: "资金数据不完整",
      reason: "主力/超大单/大单/中单/小单存在缺失或非数值，不能据此判断资金方向。",
    };
  }

  const internalDelta = Math.abs(flow.main - (flow.super + flow.large));
  const balanceDelta = Math.abs(flow.main + flow.mid + flow.small);
  const internalTolerance = Math.max(1, Math.abs(flow.main) * 0.02);
  const balanceScale = Math.max(1, Math.abs(flow.main), Math.abs(flow.mid), Math.abs(flow.small));
  const balanceTolerance = Math.max(1, balanceScale * 0.02);
  const internalOk = internalDelta <= internalTolerance;
  const balanceOk = balanceDelta <= balanceTolerance;
  const validation = internalOk && balanceOk ? "fully_consistent" : internalOk || balanceOk ? "partially_consistent" : "unreliable";
  const usableForDirection = validation !== "unreliable";

  if (validation === "fully_consistent") {
    return { validation, internalDelta, balanceDelta, internalTolerance, balanceTolerance, usableForDirection, label: "资金结构一致", reason: "主力约等于超大单+大单，且主力+中单+小单接近 0。" };
  }
  if (validation === "partially_consistent") {
    const passed = internalOk ? "主力内部一致" : "全量资金平衡一致";
    return { validation, internalDelta, balanceDelta, internalTolerance, balanceTolerance, usableForDirection, label: "资金数据降级", reason: `仅通过${passed}校验，方向判断应降低置信度。` };
  }
  return { validation, internalDelta, balanceDelta, internalTolerance, balanceTolerance, usableForDirection, label: "资金数据不可用于方向判断", reason: `主力内部差 ${internalDelta.toFixed(0)}，全量平衡差 ${balanceDelta.toFixed(0)}，超过容忍范围。` };
}

export function withMoneyFlowValidation(flow: MarketOrder): MarketOrder {
  const checked = validateMoneyFlow(flow);
  return { ...flow, validation: checked.validation, internalDelta: checked.internalDelta, balanceDelta: checked.balanceDelta, note: checked.reason };
}
