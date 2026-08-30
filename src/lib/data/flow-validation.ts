import { createServerFn } from "@tanstack/react-start";
import type { MarketOrder } from "../types";

export const validateMarketFlow = createServerFn({ method: "POST" })
  .validator((input: { flow: MarketOrder | null }) => input)
  .handler(async ({ data }): Promise<{ flow: MarketOrder | null; checked: boolean; note: string }> => {
    const flow = data.flow;
    if (!flow) return { flow: null, checked: false, note: "市场资金暂无可靠数据" };

    const expectedMain = flow.super + flow.large;
    const gap = Math.abs(flow.main - expectedMain);
    const denominator = Math.max(Math.abs(flow.main), Math.abs(expectedMain), 1);
    const consistent = gap / denominator <= 0.02;

    return {
      flow: {
        ...flow,
        main: consistent ? flow.main : expectedMain,
      },
      checked: true,
      note: consistent
        ? "主力净流入与超大单+大单通过内部一致性核验"
        : "主力净流入与分单结果存在偏差，已按超大单+大单口径校正",
    };
  });
