import { Link } from "@tanstack/react-router";
import {
  Activity,
  Briefcase,
  CandlestickChart,
  LineChart,
  Newspaper,
  Settings,
  Sparkles,
  Trophy,
} from "lucide-react";

const ITEMS = [
  { to: "/portfolio", label: "我的持仓", sub: "收益 · 体检", icon: Briefcase, tint: "bg-accent/12 text-accent" },
  { to: "/market", label: "大盘资金", sub: "板块 · 资金", icon: LineChart, tint: "bg-down/12 text-down" },
  { to: "/news", label: "市场资讯", sub: "新闻 · 解读", icon: Newspaper, tint: "bg-warn/12 text-warn" },
  { to: "/funds", label: "基金排行", sub: "强弱 · 榜单", icon: Trophy, tint: "bg-up/12 text-up" },
  { to: "/band", label: "波段信号", sub: "RSI · MACD", icon: Activity, tint: "bg-accent/12 text-accent" },
  { to: "/market", label: "资金意图", sub: "订单 · 博弈", icon: CandlestickChart, tint: "bg-down/12 text-down" },
  { to: "/ai", label: "AI 证据链", sub: "七步判断", icon: Sparkles, tint: "bg-accent/12 text-accent" },
  { to: "/settings", label: "设置", sub: "数据源 · Key", icon: Settings, tint: "bg-muted/15 text-muted" },
] as const;

export function Launcher() {
  return (
    <div className="mb-3 grid grid-cols-4 gap-2">
      {ITEMS.map((it) => {
        const Icon = it.icon;
        return (
          <Link
            key={it.label}
            to={it.to}
            className="glass-tight flex flex-col items-center gap-1.5 px-1 py-3 text-center transition-transform duration-150 active:scale-95"
          >
            <span className={`flex size-11 items-center justify-center rounded-[14px] ${it.tint}`}>
              <Icon className="size-5" strokeWidth={1.9} />
            </span>
            <b className="text-[11px] font-semibold text-fg">{it.label}</b>
            <small className="text-[9px] text-subtle">{it.sub}</small>
          </Link>
        );
      })}
    </div>
  );
}
