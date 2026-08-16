import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { motion } from "framer-motion";

/* ---------- 按钮 ---------- */
type BtnVariant = "primary" | "ghost" | "danger" | "outline";
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: "sm" | "md";
}
const btnBase =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500";
const btnVariants: Record<BtnVariant, string> = {
  primary:
    "bg-accent-500 text-accent-950 hover:bg-accent-400 shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_4px_14px_-4px_rgba(245,158,11,0.45)]",
  outline: "border border-ink-700 text-ink-300 hover:bg-ink-850 hover:text-ink-100",
  ghost: "text-ink-400 hover:bg-ink-850 hover:text-ink-100",
  danger: "border border-red-800/70 text-red-300 hover:bg-red-950/50",
};
const btnSizes = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 text-sm" };
export function Button({ variant = "outline", size = "md", className = "", ...rest }: BtnProps) {
  return (
    <button className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${className}`} {...rest} />
  );
}

/* ---------- 卡片 ---------- */
export function Card({ children, className = "", hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-ink-800 bg-ink-900 ${
        hover ? "transition-colors duration-150 hover:border-ink-600 hover:bg-ink-850" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ icon, title, extra }: { icon?: ReactNode; title: string; extra?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-ink-800 px-4 py-2.5">
      {icon && <span className="text-ink-400">{icon}</span>}
      <span className="text-sm font-medium text-ink-100">{title}</span>
      {extra && <span className="ml-auto">{extra}</span>}
    </div>
  );
}

/* ---------- 徽章 ---------- */
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "pos" | "neu" | "neg" | "accent" }) {
  const tones = {
    neutral: "bg-ink-800 text-ink-300",
    pos: "bg-emerald-500/10 text-emerald-400",
    neu: "bg-sky-500/10 text-sky-400",
    neg: "bg-red-500/10 text-red-400",
    accent: "bg-accent-500/10 text-accent-400",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ---------- 表单 ---------- */
const fieldCls =
  "w-full rounded-lg border border-ink-700 bg-ink-950 px-3 text-sm text-ink-100 placeholder:text-ink-500 outline-none transition-colors focus:border-accent-500";
export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldCls} h-9 ${className}`} {...rest} />;
}
export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldCls} py-2 ${className}`} {...rest} />;
}
export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${fieldCls} h-9 pr-8 ${className}`} {...rest}>
      {children}
    </select>
  );
}
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-ink-300">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-400">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-400">{hint}</span>
      ) : null}
    </label>
  );
}

/* ---------- 骨架屏 ---------- */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-ink-800 ${className}`} />;
}

export function CardSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <Card className="p-4">
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </div>
    </Card>
  );
}

/* ---------- 空状态 ---------- */
export function EmptyState({ icon, title, desc, action }: { icon?: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-700 px-6 py-12 text-center">
      {icon && <div className="text-ink-500">{icon}</div>}
      <div className="mt-3 text-sm font-medium text-ink-200">{title}</div>
      {desc && <div className="mt-1 max-w-sm text-[13px] text-ink-400">{desc}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- 页头 ---------- */
export function PageHeader({ title, desc, extra }: { title: string; desc?: string; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-100">{title}</h1>
        {desc && <p className="mt-0.5 text-[13px] text-ink-400">{desc}</p>}
      </div>
      {extra && <div className="ml-auto flex items-center gap-2">{extra}</div>}
    </div>
  );
}

/* ---------- 统计卡 ---------- */
export function StatCard({ label, value, sub, accentCls = "text-ink-100" }: { label: string; value: ReactNode; sub?: ReactNode; accentCls?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-ink-800 bg-ink-900 px-4 py-3"
    >
      <div className="text-xs font-medium uppercase tracking-wider text-ink-400">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${accentCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-400">{sub}</div>}
    </motion.div>
  );
}
