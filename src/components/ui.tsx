"use client";

import { motion } from "framer-motion";
import type { TaskState } from "@/lib/data";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mb-8 flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="text-4xl sm:text-5xl">
          <span className="text-gradient">{title}</span>
        </h1>
        {description && (
          <p className="mt-3 max-w-xl text-sm text-[var(--muted)]">{description}</p>
        )}
      </div>
      {action}
    </motion.header>
  );
}

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Card({
  children,
  className = "",
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={`glass rounded-3xl ${hover ? "glass-hover" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {icon && <span className="text-terra">{icon}</span>}
      </div>
      <p className="font-display text-3xl text-cream">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </Card>
  );
}

const STATE_META: Record<TaskState, { label: string; className: string; dot: string }> = {
  todo: { label: "Sin empezar", className: "text-[var(--muted)] border-[var(--border)]", dot: "bg-white/40" },
  doing: { label: "En curso", className: "text-sky-300 border-sky-400/30 bg-sky-400/10", dot: "bg-sky-400" },
  done: { label: "Listo", className: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10", dot: "bg-emerald-400" },
};

export function StatePill({ state }: { state: TaskState }) {
  const m = STATE_META[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${m.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function stateMeta(state: TaskState) {
  return STATE_META[state];
}
