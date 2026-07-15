"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { TaskState } from "@/lib/data";

/* ---------------- Layout ---------------- */

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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mb-8 flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="text-4xl sm:text-[2.7rem]">
          <span className="text-gradient">{title}</span>
        </h1>
        {description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{description}</p>}
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
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay }}
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
  return <div className={`glass rounded-2xl ${hover ? "glass-hover" : ""} ${className}`}>{children}</div>;
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
        {icon && <span className="text-[var(--muted)]">{icon}</span>}
      </div>
      <p className="font-display text-3xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </Card>
  );
}

/* ---------------- Status ---------------- */

const STATE_META: Record<TaskState, { label: string; pill: string; dot: string; bg: string }> = {
  todo: { label: "Sin empezar", pill: "text-zinc-300 border-white/10 bg-white/5", dot: "bg-zinc-400", bg: "state-todo" },
  doing: { label: "En curso", pill: "text-blue-300 border-blue-400/40 bg-blue-500/15", dot: "bg-blue-400", bg: "state-doing" },
  done: { label: "Listo", pill: "text-emerald-300 border-emerald-400/40 bg-emerald-500/15", dot: "bg-emerald-400", bg: "state-done" },
};

export function StatePill({ state }: { state: TaskState }) {
  const m = STATE_META[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${m.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function taskStateClass(state: TaskState) {
  return STATE_META[state].bg;
}

/* ---------------- Buttons ---------------- */

type ButtonVariant = "primary" | "ghost" | "subtle";
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-white text-black hover:bg-zinc-200 shadow-[0_8px_30px_-8px_rgba(255,255,255,0.35)]",
    ghost: "border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-[var(--border-strong)]",
    subtle: "bg-white/5 text-white hover:bg-white/10 border border-white/10",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

/* ---------------- Form fields ---------------- */

export function Field({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{label}</span>}
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`field resize-y ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`field ${props.className ?? ""}`} style={{ background: "#121216", ...props.style }} />
  );
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`glass relative z-10 w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl shadow-pop`}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
              <div>
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                {description && <p className="mt-0.5 text-xs text-[var(--muted)]">{description}</p>}
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--muted)] transition hover:text-white" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
