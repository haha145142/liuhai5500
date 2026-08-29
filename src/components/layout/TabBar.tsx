import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Briefcase, House, Newspaper, SquareGrid2X2 } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { to: "/", label: "首页", icon: House, match: (p: string) => p === "/" },
  { to: "/portfolio", label: "持仓", icon: Briefcase, match: (p: string) => p.startsWith("/portfolio") || p.startsWith("/band") },
  { to: "/market", label: "大盘", icon: BarChart3, match: (p: string) => p.startsWith("/market") },
  { to: "/news", label: "资讯", icon: Newspaper, match: (p: string) => p.startsWith("/news") },
  { to: "/more", label: "更多", icon: SquareGrid2X2, match: (p: string) => ["/more", "/funds", "/ai", "/settings"].some((x) => p.startsWith(x)) },
] as const;

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="tabbar" aria-label="主导航">
      {TABS.map((t) => {
        const active = t.match(pathname);
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium transition-transform duration-150 active:scale-95",
              active ? "bg-white/80 text-accent shadow-sm" : "text-muted",
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
