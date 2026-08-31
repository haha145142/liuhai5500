import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Glass({
  className,
  children,
  tight,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tight?: boolean; children: ReactNode }) {
  return (
    <div className={cn(tight ? "glass-tight" : "glass", "p-4 mb-3", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>
      {hint ? (
        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
          {hint}
        </span>
      ) : null}
      <div className="ml-auto">{right}</div>
    </div>
  );
}

export function DataStatus({
  mode,
  detail,
  className,
}: {
  mode: "live" | "frozen" | "official" | "latest" | "unavailable";
  detail?: string;
  className?: string;
}) {
  const labels = {
    live: "盘中实时",
    frozen: "午间冻结",
    official: "今日官方净值",
    latest: "最近交易日",
    unavailable: "暂无可靠数据",
  } as const;
  const dot = mode === "live" ? "bg-emerald-500 shadow-[0_0_9px_rgba(52,199,89,.45)]" : mode === "official" ? "bg-accent" : mode === "unavailable" ? "bg-slate-400" : "bg-slate-300";
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/70 bg-white/55 px-2.5 py-1 text-[9px] font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,.88)] backdrop-blur-xl", className)} title={detail}>
      <i className={cn("size-1.5 shrink-0 rounded-full", dot)} />
      <span className="truncate">{labels[mode]}</span>
      {detail ? <span className="truncate font-medium text-subtle">· {detail}</span> : null}
    </span>
  );
}

export function Tone({
  v,
  children,
  className,
}: {
  v: number | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  const t = v == null || !Number.isFinite(v) || v === 0 ? "flat" : v > 0 ? "up" : "down";
  return <span className={cn(`tone-${t}`, "tabular-nums", className)}>{children}</span>;
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-4 text-center text-sm text-muted">{children}</p>;
}
