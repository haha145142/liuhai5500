import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, BarChart3, BriefcaseBusiness, Cpu, LineChart, Newspaper, Settings2, Trophy, X } from "lucide-react";

const GROUPS = [
  { title: "市场", items: [{ to: "/market", label: "大盘 / 板块", icon: BarChart3 }, { to: "/funds", label: "基金排行", icon: Trophy }] },
  { title: "持仓", items: [{ to: "/portfolio", label: "我的持仓", icon: BriefcaseBusiness }, { to: "/band", label: "波段信号", icon: Activity }] },
  { title: "资讯", items: [{ to: "/news", label: "市场资讯", icon: Newspaper }, { to: "/ai", label: "AI 证据链", icon: Cpu }] },
  { title: "工具", items: [{ to: "/more", label: "更多工具", icon: LineChart }, { to: "/settings", label: "DeepSeek 设置", icon: Settings2 }] },
] as const;

export function SideDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  return (
    <>
      <button aria-label="关闭侧边菜单" aria-hidden={!open} onClick={onClose} className={`fixed inset-0 z-[6000] cursor-default bg-slate-900/18 backdrop-blur-[7px] transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside aria-label="侧边菜单" aria-hidden={!open} className={`fixed inset-y-0 left-0 z-[6001] w-[min(84vw,332px)] overflow-y-auto rounded-r-[32px] border-r border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,.86),rgba(237,245,252,.96))] px-4 pb-7 pt-[max(20px,env(safe-area-inset-top))] text-slate-900 shadow-[24px_0_76px_rgba(57,82,108,.20)] backdrop-blur-[30px] transition-transform duration-300 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-2 pb-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[.24em] text-slate-400">Fund AI Pro</div>
            <div className="mt-1 text-[23px] font-semibold tracking-[-.025em] text-slate-900">投资工作台</div>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭菜单" className="flex size-11 items-center justify-center rounded-full border border-white bg-white/65 text-slate-600 shadow-[0_8px_24px_rgba(65,88,111,.12)] backdrop-blur-xl active:scale-95"><X size={20} /></button>
        </div>
        <div className="space-y-4 px-0.5">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">{group.title}</div>
              <div className="overflow-hidden rounded-[22px] border border-white/90 bg-white/52 shadow-[0_10px_32px_rgba(70,95,120,.07)] backdrop-blur-2xl">
                {group.items.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.to} to={item.to} onClick={onClose} className={`group flex min-h-[62px] items-center gap-3.5 px-3.5 transition active:bg-white/75 ${index ? "border-t border-white/75" : ""}`} activeProps={{ className: `group flex min-h-[62px] items-center gap-3.5 px-3.5 bg-white/82 ${index ? "border-t border-white/75" : ""}` }}>
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] border border-white bg-white/68 text-slate-600 shadow-sm"><Icon size={19} strokeWidth={1.85} /></span>
                      <span className="min-w-0 flex-1 text-[14px] font-medium tracking-tight text-slate-800">{item.label}</span>
                      <span className="text-[22px] leading-none text-slate-300 transition group-hover:translate-x-0.5">›</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-7 rounded-2xl border border-white/80 bg-white/42 px-3.5 py-3 text-[10px] leading-relaxed text-slate-500/85 backdrop-blur-xl">
          盘中数据优先使用实时行情计算。没有可靠数据时显示“暂无可靠数据”；官方净值公布后自动切换。
        </div>
      </aside>
    </>
  );
}
