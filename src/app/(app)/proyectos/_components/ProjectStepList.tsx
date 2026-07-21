"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Circle, Loader2, MoreHorizontal } from "lucide-react";
import type { Project } from "@/lib/data";
import { cursorIntentProps } from "@/lib/cursor-intent";

const MOTION_EASE = [0.23, 1, 0.32, 1] as const;

export function ProjectStepList({
  project,
  variant = "compact",
  disabled = false,
  pendingIndex = null,
  readOnly = false,
  onToggle,
  onOpen,
}: {
  project: Project;
  variant?: "compact" | "detail";
  disabled?: boolean;
  pendingIndex?: number | null;
  readOnly?: boolean;
  onToggle?: (index: number) => void;
  onOpen?: () => void;
}): React.ReactNode {
  const reducedMotion = useReducedMotion();
  const visibleSteps = variant === "compact" ? project.steps.slice(0, 4) : project.steps;
  const remaining = project.steps.length - visibleSteps.length;

  return (
    <div className={variant === "detail" ? "space-y-3" : "space-y-2"}>
      <ol aria-label={`Pasos de ${project.name}`} className={variant === "detail" ? "space-y-1.5" : "space-y-0.5"}>
        {visibleSteps.map((step, index) => {
          const pending = pendingIndex === index;
          const interactionDisabled = disabled || readOnly || pending || !onToggle;
          const actionName = step.done
            ? `Marcar pendiente: ${step.label}`
            : `Completar paso: ${step.label}`;
          const cursorProps = interactionDisabled
            ? {}
            : cursorIntentProps(step.done ? "edit" : "complete", step.done ? "Marcar pendiente" : "Completar");

          return (
            <li
              key={`${step.label}-${index}`}
              className={`group relative grid min-h-11 grid-cols-[2rem_2.75rem_minmax(0,1fr)_4.25rem] items-center gap-2 rounded-xl border border-transparent px-2 transition-colors duration-200 hover:border-[#d6ab99]/15 hover:bg-[#d6ab99]/[0.055] focus-within:border-[#d6ab99]/25 focus-within:bg-[#d6ab99]/[0.07] ${
                variant === "detail" ? "sm:grid-cols-[2.25rem_2.75rem_minmax(0,1fr)_4.25rem] sm:px-3" : ""
              } ${pending ? "bg-white/[0.025]" : ""}`}
            >
              <span className="num text-[10px] font-semibold tracking-[0.12em] text-[var(--faint)]" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>

              <span className="relative flex h-full items-center justify-center">
                {index < visibleSteps.length - 1 ? (
                  <span
                    className={`absolute left-1/2 top-[calc(50%+1.35rem)] h-[calc(100%-1.15rem)] w-px -translate-x-1/2 transition-colors duration-200 group-hover:bg-[#d6ab99]/35 group-focus-within:bg-[#d6ab99]/45 ${
                      step.done ? "bg-emerald-300/25" : "bg-white/10"
                    }`}
                    aria-hidden="true"
                  />
                ) : null}
                <button
                  type="button"
                  aria-label={actionName}
                  aria-pressed={step.done}
                  disabled={interactionDisabled}
                  onClick={() => onToggle?.(index)}
                  {...cursorProps}
                  className={`pointer-events-auto relative z-10 flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full border transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                    step.done
                      ? "border-emerald-300/35 bg-emerald-300/[0.09] text-emerald-300"
                      : "border-[#d6ab99]/30 bg-[#d6ab99]/[0.075] text-[#dec2ad] hover:border-[#d6ab99]/55 hover:bg-[#d6ab99]/[0.13]"
                  }`}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <motion.span
                      initial={false}
                      animate={reducedMotion
                        ? { opacity: step.done ? 1 : 0.76 }
                        : { scale: step.done ? 1 : 0.9, opacity: step.done ? 1 : 0.76 }}
                      transition={{ duration: reducedMotion ? 0 : 0.18, ease: MOTION_EASE }}
                      className="flex items-center justify-center"
                      aria-hidden="true"
                    >
                      {step.done ? <Check className="h-4 w-4" strokeWidth={2.2} /> : <Circle className="h-3.5 w-3.5" strokeWidth={1.6} />}
                    </motion.span>
                  )}
                </button>
              </span>

              <span className={`min-w-0 text-sm leading-5 ${step.done ? "text-[var(--muted)] line-through decoration-emerald-300/35" : "text-zinc-100"}`}>
                {step.label}
              </span>

              <span className="w-[68px] text-right text-[10px] font-medium text-[var(--faint)]" aria-live="polite">
                {pending ? "Guardando" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      {variant === "compact" && remaining > 0 ? (
        <button
          type="button"
          onClick={onOpen}
          disabled={!onOpen}
          {...(onOpen ? cursorIntentProps("open") : {})}
          className="pointer-events-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#d6ab99]/20 bg-[#d6ab99]/[0.025] px-3 text-xs font-medium text-[#dec2ad] transition-colors hover:border-[#d6ab99]/40 hover:bg-[#d6ab99]/[0.07] disabled:opacity-60"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          +{remaining} pasos más
        </button>
      ) : null}

      {readOnly ? (
        <p className="rounded-lg border border-[#d6ab99]/15 bg-[#d6ab99]/[0.045] px-3 py-2 text-xs text-[var(--muted)]">
          Reabrí el proyecto para modificar sus pasos
        </p>
      ) : null}
    </div>
  );
}
