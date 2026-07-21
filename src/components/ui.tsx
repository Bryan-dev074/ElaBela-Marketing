"use client";

import React, { useEffect, useId, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { TaskState } from "@/lib/data";
import { cursorIntentProps } from "@/lib/cursor-intent";
import { DialogPortalHostContext } from "@/components/dialog-portal";
import { containTabFocus, focusableElements } from "@/lib/focus-management";

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

const STATE_META: Record<TaskState, { label: string; pill: string; dot: string; bg: string; color: string }> = {
  todo: { label: "Sin empezar", pill: "text-zinc-300 border-white/10 bg-white/5", dot: "bg-zinc-400", bg: "state-todo", color: "#a1a1aa" },
  doing: { label: "En curso", pill: "text-blue-300 border-blue-400/40 bg-blue-500/15", dot: "bg-blue-400", bg: "state-doing", color: "#3b82f6" },
  done: { label: "Listo", pill: "text-emerald-300 border-emerald-400/40 bg-emerald-500/15", dot: "bg-emerald-400", bg: "state-done", color: "#22c55e" },
};

export function StatePill({ state, pulse = false }: { state: TaskState; pulse?: boolean }) {
  const m = STATE_META[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${m.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot} ${pulse && state === "doing" ? "animate-pulse" : ""}`} />
      {m.label}
    </span>
  );
}

export function taskStateClass(state: TaskState) {
  return STATE_META[state].bg;
}

export function stateLabel(state: TaskState) {
  return STATE_META[state].label;
}

/** Spread onto an element so the custom cursor tints + labels itself with the state. */
export function stateCursorProps(state: TaskState): Record<string, string> {
  if (state === "doing") return cursorIntentProps("doing", stateLabel(state));
  if (state === "done") return cursorIntentProps("complete", stateLabel(state));
  return cursorIntentProps("open", stateLabel(state));
}

/** Three-pill selector to set a TaskState by hand (proyectos, guiones, modals). */
export function StateSelector({ value, onChange, size = "md", disabled = false }: { value: TaskState; onChange: (s: TaskState) => void; size?: "sm" | "md"; disabled?: boolean }) {
  const pad = size === "sm" ? "min-h-9 px-2.5 py-1 text-[10px]" : "min-h-11 px-3 py-1.5 text-xs";
  return (
    <div className="inline-flex flex-wrap gap-1.5">
      {(Object.keys(STATE_META) as TaskState[]).map((s) => {
        const m = STATE_META[s];
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onChange(s)}
            aria-pressed={active}
            {...stateCursorProps(s)}
            className={`press inline-flex items-center gap-1.5 rounded-full border font-medium transition disabled:cursor-not-allowed disabled:opacity-55 ${pad} ${
              active ? m.pill + " shadow-[0_0_18px_-6px_currentColor]" : "border-white/10 text-[var(--faint)] hover:border-white/25 hover:text-white"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${active ? m.dot : "bg-white/25"}`} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Segmented control ---------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; badge?: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className={`inline-flex rounded-xl border border-white/10 bg-white/5 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`press flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
            value === o.value ? "bg-white text-black shadow-[0_4px_18px_-6px_rgba(255,255,255,0.4)]" : "text-[var(--muted)] hover:text-white"
          }`}
        >
          {o.label}
          {o.badge !== undefined && <span className="opacity-60">{o.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Weekday picker (Lun…Dom) ---------------- */

const WD = ["L", "M", "M", "J", "V", "S", "D"];
const WD_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Chips to pick weekdays (0 = Lunes … 6 = Domingo). Empty selection = every day. */
export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b));
  const all = value.length === 0 || value.length === 7;
  return (
    <div>
      <div className="flex gap-1.5">
        {WD.map((l, d) => {
          const on = value.includes(d);
          return (
            <button
              key={d}
              type="button"
              title={WD_FULL[d]}
              onClick={() => toggle(d)}
              {...cursorIntentProps("open", WD_FULL[d])}
              className={`press flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition ${
                on ? "border-nude/60 bg-nude/20 text-nude shadow-[0_0_14px_-4px_rgba(214,171,153,0.6)]" : "border-white/10 text-[var(--faint)] hover:border-white/30 hover:text-white"
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--faint)]">
        {all ? "Todos los días" : value.map((d) => WD_FULL[d]).join(" · ")}
      </p>
    </div>
  );
}

/* ---------------- Icon glyph (emoji o imagen/GIF) ---------------- */

/**
 * Renders a task/resource icon: an emoji string, or an uploaded image/GIF
 * (any value starting with "data:" or "http"). GIFs animate inline.
 */
export function IconGlyph({
  icon,
  size = 20,
  className = "",
  rounded = "rounded-lg",
}: {
  icon: string;
  size?: number;
  className?: string;
  rounded?: string;
}) {
  if (icon && (icon.startsWith("data:") || icon.startsWith("http"))) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon}
        alt=""
        width={size}
        height={size}
        className={`inline-block shrink-0 object-cover ${rounded} ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`} style={{ fontSize: Math.round(size * 0.82) }}>
      {icon || "✨"}
    </span>
  );
}

/* ---------------- Empty state ---------------- */

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center ${className}`}>
      {icon && <div className="glow-pulse mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-nude/10 text-xl text-nude">{icon}</div>}
      <p className="text-sm font-medium text-white">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-[var(--muted)]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
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
  size = "default",
  initialFocusRef,
  titleId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  size?: "default" | "wide" | "studio";
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  titleId?: string;
}) {
  const generatedTitleId = useId();
  const generatedDescriptionId = useId();
  const resolvedTitleId = titleId ?? generatedTitleId;
  const dialogRef = useRef<HTMLDivElement>(null);
  const portalHostRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const widthClass = size === "studio"
    ? "max-w-5xl"
    : size === "wide" || wide
      ? "max-w-2xl"
      : "max-w-md";

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (dialog) {
      const preferredFocus = initialFocusRef?.current;
      const target = preferredFocus && dialog.contains(preferredFocus)
        ? preferredFocus
        : focusableElements(dialog)[0] ?? dialog;
      target.focus();
    }
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [initialFocusRef, open]);

  useEffect(() => {
    if (!open) return;
    // defaultPrevented: a popover inside the modal (IconPicker/TimePicker) already
    // consumed this Escape to close itself — don't also close the modal.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            aria-hidden="true"
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={resolvedTitleId}
            aria-describedby={description ? generatedDescriptionId : undefined}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (dialogRef.current) containTabFocus(event, dialogRef.current);
            }}
            className={`relative z-10 w-full ${widthClass}`}
          >
            <DialogPortalHostContext.Provider value={portalHostRef}>
              <motion.div
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
                transition={{ duration: reducedMotion ? 0.12 : 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="glass flex max-h-[calc(100dvh-1rem)] w-full flex-col rounded-2xl shadow-pop sm:max-h-[calc(100dvh-2rem)]"
              >
                <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
                  <div>
                    <h2 id={resolvedTitleId} className="text-lg font-semibold text-white">{title}</h2>
                    {description ? <p id={generatedDescriptionId} className="mt-0.5 text-xs text-[var(--muted)]">{description}</p> : null}
                  </div>
                  <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--muted)] transition hover:text-white" aria-label="Cerrar">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 max-h-[calc(100dvh-9rem)] overflow-y-auto p-4 sm:p-5">{children}</div>
                {footer ? <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">{footer}</div> : null}
              </motion.div>
              <div ref={portalHostRef} data-dialog-portal-host="true" />
            </DialogPortalHostContext.Provider>
          </div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
