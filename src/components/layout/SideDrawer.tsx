import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  ChevronRight,
  Cpu,
  LineChart,
  Newspaper,
  Settings2,
  Trophy,
  X,
} from "lucide-react";

const GROUPS = [
  {
    title: "市场",
    items: [
      { to: "/market", label: "大盘 / 板块", icon: BarChart3 },
      { to: "/funds", label: "基金排行", icon: Trophy },
    ],
  },
  {
    title: "持仓",
    items: [
      { to: "/portfolio", label: "我的持仓", icon: BriefcaseBusiness },
      { to: "/band", label: "波段信号", icon: Activity },
    ],
  },
  {
    title: "资讯",
    items: [
      { to: "/news", label: "市场资讯", icon: Newspaper },
      { to: "/ai", label: "AI 证据链", icon: Cpu },
    ],
  },
  {
    title: "工具 / 设置",
    items: [
      { to: "/more", label: "更多工具", icon: LineChart },
      { to: "/settings", label: "DeepSeek / 设置", icon: Settings2 },
    ],
  },
] as const;

export function SideDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-[6000] bg-slate-950/25 backdrop-blur-[2px] transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        aria-label="侧边导航"
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-[6001] flex w-[min(88vw,340px)] flex-col overflow-y-auto border-r border-white/10 bg-[#0b1428]/[.98] px-4 pb-6 pt-[max(18px,env(safe-area-inset-top))] text-white shadow-[18px_0_60px_rgba(0,0,0,.28)] transition-transform duration-250 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between gap-3 px-2 pb-5">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[.18em] text-white/45">Fund AI Pro</div>
            <div className="mt-1 text-xl font-semibold tracking-tight">投资工作台</div>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭菜单" className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white/80 transition-transform active:scale-95">
            <X size={19} />
          </button>
        </div>

        <div className="space-y-5">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <div className="px-2 pb-2 text-[10px] font-medium uppercase tracking-[.16em] text-white/35">{group.title}</div>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      activeProps={{ className: "bg-white/14 ring-1 ring-white/14" }}
                      className="group flex min-h-[64px] items-center gap-2 rounded-[18px] border border-white/8 bg-white/[.045] px-3 py-2.5 transition active:scale-[.98]"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[.08] text-white/75"><Icon size={18} strokeWidth={1.8} /></span>
                      <span className="min-w-0 flex-1 text-xs font-medium leading-tight text-white/90">{item.label}</span>
                      <ChevronRight size={14} className="shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-auto pt-6 px-2 text-[10px] leading-relaxed text-white/32">
          数据不足时显示“暂无可靠数据”。盘中估值为模型计算值，官方净值公布后自动切换。
        </div>
      </aside>
    </>
  );
}
