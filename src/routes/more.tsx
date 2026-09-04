import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, BarChart3, BriefcaseBusiness, GitCompare, Settings2, Sparkles, Trophy, Wrench, Users, Globe2 } from "lucide-react";
import { Glass } from "@/components/ui/Glass";
export const Route=createFileRoute("/more")({component:MorePage});
const LINKS=[
 ["/portfolio","我的持仓","资产、盈亏、组合体检",BriefcaseBusiness],["/groups","投资组合","稳健 / 定投 / 观察清单",Users],["/compare","基金对比","最多5只 · 回撤 · 夏普 · 波动",GitCompare],["/tools","决策工具","申赎 · 定投 · 压测 · 目标收益",Wrench],["/market","行情中心","指数 · 板块 · 资金 · 外围",BarChart3],["/market-plus","全球与宏观","海外指数 · 热力图 · 北向 · 国债",Globe2],["/rotation","AI轮动雷达","板块强度 · 资金 · 基金池",Activity],["/ai","AI证据链","七步证据 · DeepSeek复核",Sparkles],["/funds","基金排行","日涨幅 · 阶段收益",Trophy],["/settings","设置","数据源 · 刷新 · Key",Settings2]
] as const;
function MorePage(){return <div className="space-y-2">{LINKS.map(([to,title,sub,Icon])=><Link key={to} to={to as any}><Glass className="flex items-center gap-3 rounded-[22px] p-3"><span className="flex size-10 items-center justify-center rounded-[14px] bg-white/72 ring-1 ring-white/85"><Icon size={19}/></span><span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-fg">{title}</span><span className="mt-0.5 block text-[9px] text-muted">{sub}</span></span><span className="text-[16px] text-slate-300">›</span></Glass></Link>)}</div>}
