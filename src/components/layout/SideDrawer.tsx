import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, BarChart3, BriefcaseBusiness, ChevronRight, Cpu, LineChart, Newspaper, Settings2, Trophy, X } from "lucide-react";

const GROUPS = [
  { title: "市场", items: [{ to: "/market", label: "大盘 / 板块", icon: BarChart3 }, { to: "/funds", label: "基金排行", icon: Trophy }] },
  { title: "持仓", items: [{ to: "/portfolio", label: "我的持仓", icon: BriefcaseBusiness }, { to: "/band", label: "波段信号", icon: Activity }] },
  { title: "资讯", items: [{ to: "/news", label: "市场资讯", icon: Newspaper }, { to: "/ai", label: "AI 证据链", icon: Cpu }] },
  { title: "工具", items: [{ to: "/more", label: "更多工具", icon: LineChart }, { to: "/settings", label: "DeepSeek / 设置", icon: Settings2 }] },
] as const;

export function SideDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  return (
    <>
      <button aria-label="关闭侧边菜单" aria-hidden={!open} onClick={onClose} className={`fixed inset-0 z-[6000] bg-slate-950/18 backdrop-blur-[3px] transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside aria-label="投资工作台菜单" aria-hidden={!open} className={`fixed inset-y-0 left-0 z-[6001] flex w-[min(82vw,310px)] flex-col border-r border-white/45 bg-white/[.86] px-3 pb-5 pt-[max(14px,env(safe-area-inset-top))] text-slate-900 shadow-[18px_0_55px_rgba(20,45,80,.16)] backdrop-blur-2xl transition-transform duration-250 ease-out dark:bg-slate-950/[.88] dark:text-white ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-2 pb-4">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-slate-400 dark:text-white/35">Fund AI Pro</div>
            <div className="mt-1 text-xl font-semibold tracking-tight">投资工作台</div>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="flex size-10 items-center justify-center rounded-full bg-slate-900/[.06] text-slate-600 transition active:scale-95 dark:bg-white/10 dark:text-white/75"><X size={19}/></button>
        </div>
        <div className="space-y-5 overflow-y-auto px-1 pb-3">
          {GROUPS.map(group => (
            <section key={group.title}>
              <div className="px-2 pb-1.5 text-[10px] font-semibold tracking-[.12em] text-slate-400 dark:text-white/35">{group.title}</div>
              <div className="overflow-hidden rounded-2xl border border-slate-900/[.05] bg-white/55 shadow-[0_6px_18px_rgba(20,45,80,.045)] dark:border-white/10 dark:bg-white/[.045]">
                {group.items.map((item, index) => {
                  const Icon = item.icon;
                  return <Link key={item.to} to={item.to} onClick={onClose} activeOptions={{ exact: false }} className="group flex min-h-[58px] items-center gap-3 px-3.5 transition active:bg-slate-900/[.04] dark:active:bg-white/[.06]" activeProps={{ className: "group flex min-h-[58px] items-center gap-3 px-3.5 bg-slate-900/[.055] dark:bg-white/[.08]" }}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-900/[.055] text-slate-600 dark:bg-white/[.08] dark:text-white/72"><Icon size={18} strokeWidth={1.8}/></span>
                    <span className="min-w-0 flex-1 text-[13px] font-medium">{item.label}</span>
                    <ChevronRight size={15} className="text-slate-300 dark:text-white/25"/>
                    {index === 0 ? null : null}
                  </Link>;
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-auto px-2 pt-3 text-[10px] leading-relaxed text-slate-400 dark:text-white/32">数据不足时显示“暂无可靠数据”。盘中估值使用自算重仓穿透并交叉验证，官方净值公布后自动切换。</div>
      </aside>
    </>
  );
}
