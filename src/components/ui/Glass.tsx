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
