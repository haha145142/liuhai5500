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
  { to: "/portfolio", label: "我的持仓", sub: "收益 · 体检", icon: Briefcase },
  { to: "/market", label: "大盘资金", sub: "板块 · 资金", icon: LineChart },
  { to: "/news", label: "市场资讯", sub: "新闻 · 解读", icon: Newspaper },
  { to: "/funds", label: "基金排行", sub: "强弱 · 榜单", icon: Trophy },
  { to: "/band", label: "波段信号", sub: "RSI · MACD", icon: Activity },
  { to: "/market", label: "资金意图", sub: "订单 · 博弈", icon: CandlestickChart },
  { to: "/ai", label: "AI 证据链", sub: "七步判断", icon: Sparkles },
  { to: "/settings", label: "设置", sub: "数据源 · Key", icon: Settings },
] as const;

export function Launcher() {
  return (
    <section className="launcher-grid" aria-label="核心功能">
      {ITEMS.map((it) => {
        const Icon = it.icon;
        return (
          <Link key={it.label} to={it.to} className="launcher-card">
            <span className="launcher-icon" aria-hidden="true">
              <Icon className="size-7" strokeWidth={1.75} />
            </span>
            <b className="launcher-title">{it.label}</b>
            <small className="launcher-sub">{it.sub}</small>
          </Link>
        );
      })}
    </section>
  );
}
