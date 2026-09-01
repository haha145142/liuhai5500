export type FundEstimationClass = "a_share_equity" | "etf_feeder" | "etf_lof" | "qdii" | "bond" | "money_market" | "mixed" | "unknown";

export type FundEstimationPolicy = {
  className: FundEstimationClass;
  allowAshareLookThrough: boolean;
  allowLiveEstimate: boolean;
  reason: string;
};

export function classifyFund(type = "", name = ""): FundEstimationClass {
  const t = `${type} ${name}`.toLowerCase();
  if (/货币|money|cash/.test(t)) return "money_market";
  if (/债|bond|中短债|短债|纯债|信用债|利率债/.test(t)) return "bond";
  if (/qdii|港股|恒生|标普|纳斯达克|纳指|海外|全球|美股|日经|德国|欧洲/.test(t)) return "qdii";
  if (/联接/.test(t)) return "etf_feeder";
  if (/etf|lof/.test(t)) return "etf_lof";
  if (/混合|灵活配置|偏股|偏债|平衡/.test(t)) return "mixed";
  if (/股票|指数|增强/.test(t)) return "a_share_equity";
  return "unknown";
}

export function policyForFund(type?: string, name?: string): FundEstimationPolicy {
  const className = classifyFund(type, name);
  switch (className) {
    case "etf_feeder":
      return {
        className,
        allowAshareLookThrough: false,
        allowLiveEstimate: true,
        reason: "ETF联接基金应优先穿透其目标ETF或标的指数实时行情，不应把联接基金当普通主动权益基金按前十大重仓股估算。",
      };
    case "a_share_equity":
    case "etf_lof":
      return { className, allowAshareLookThrough: true, allowLiveEstimate: true, reason: "A股股票/指数类基金，可用已披露持仓与A股实时行情进行盘中穿透估算。" };
    case "mixed":
      return { className, allowAshareLookThrough: true, allowLiveEstimate: true, reason: "混合型基金只对可可靠识别的A股持仓做贡献估算，未覆盖部分不擅自猜测。" };
    case "qdii":
      return { className, allowAshareLookThrough: false, allowLiveEstimate: false, reason: "QDII跨市场、时区与汇率影响明显，未接入对应海外资产与汇率实时数据前不生成A股穿透估值。" };
    case "bond":
      return { className, allowAshareLookThrough: false, allowLiveEstimate: false, reason: "债券基金不应使用A股股票涨跌估算净值；等待官方净值或专门债券估值模型。" };
    case "money_market":
      return { className, allowAshareLookThrough: false, allowLiveEstimate: false, reason: "货币基金净值口径不同，不使用股票盘中穿透估值。" };
    default:
      return { className, allowAshareLookThrough: false, allowLiveEstimate: false, reason: "基金类型无法可靠识别，暂不生成股票穿透估值。" };
  }
}
