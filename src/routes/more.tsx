import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Settings, Sparkles, Trophy, Radar } from "lucide-react";
import { Glass } from "@/components/ui/Glass";

export const Route = createFileRoute("/more")({ component: MorePage });

const LINKS = [
  { to: "/funds" as const, title: "基金排行", sub: "日涨幅 / 阶段收益 / 关注", icon: Trophy },
  { to: "/rotation" as const, title: "AI 轮动雷达", sub: "板块强度 / 资金 / 代表ETF", icon: Radar },
  { to: "/ai" as const, title: "AI 证据链", sub: "七步判断 · 模型复核", icon: Sparkles },
  { to: "/band" as const, title: "波段与做 T", sub: "RSI MACD 布林 · 趋势禁 T", icon: Activity },
  { to: "/settings" as const, title: "设置", sub: "数据源 · 刷新 · Key", icon: Settings },
];

function MorePage() {
  return (
    <div>
      {LINKS.map((l) => {
        const Icon = l.icon;
        return (
          <Link key={l.to} to={l.to}>
            <Glass className="flex items-center gap-3 transition-transform active:scale-[0.99]">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Icon className="size-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">{l.title}</div>
                <div className="text-xs text-muted">{l.sub}</div>
              </div>
            </Glass>
          </Link>
        );
      })}
    </div>
  );
}
