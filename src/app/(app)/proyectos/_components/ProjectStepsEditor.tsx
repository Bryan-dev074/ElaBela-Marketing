"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import type { Project } from "@/lib/data";

const blankStep = (): Project["steps"][number] => ({ label: "", done: false });

export function ProjectStepsEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: Project["steps"];
  onChange: (steps: Project["steps"]) => void;
  disabled?: boolean;
}): React.ReactNode {
  const reducedMotion = useReducedMotion();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const rowIds = useRef<string[]>([]);
  const nextRowId = useRef(0);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const steps = value.length ? value : [blankStep()];

  while (rowIds.current.length < steps.length) {
    rowIds.current.push(`project-step-${nextRowId.current++}`);
  }
  if (rowIds.current.length > steps.length) rowIds.current.splice(steps.length);

  useEffect(() => {
    if (focusIndex === null) return;
    inputRefs.current[focusIndex]?.focus();
    setFocusIndex(null);
  }, [focusIndex, steps.length]);

  function appendStep() {
    if (disabled) return;
    rowIds.current.push(`project-step-${nextRowId.current++}`);
    onChange([...steps, blankStep()]);
    setFocusIndex(steps.length);
  }

  function updateStep(index: number, label: string) {
    if (disabled) return;
    onChange(steps.map((step, currentIndex) => currentIndex === index ? { ...step, label } : { ...step }));
  }

  function deleteStep(index: number) {
    if (disabled) return;
    const nextSteps = steps.filter((_, currentIndex) => currentIndex !== index);
    if (nextSteps.length) rowIds.current.splice(index, 1);
    onChange(nextSteps.length ? nextSteps : [blankStep()]);
  }

  return (
    <section aria-label="Pasos del proyecto" className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:p-4">
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {steps.map((step, index) => {
            const stepName = `Paso ${String(index + 1).padStart(2, "0")}`;
            const rowId = rowIds.current[index];
            return (
              <motion.div
                key={rowId}
                data-row-id={rowId}
                data-motion={reducedMotion ? "reduced" : "full"}
                initial={reducedMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: reducedMotion ? 0 : 0.16 }}
                className="group relative grid grid-cols-[5rem_minmax(0,1fr)_2.75rem] items-center gap-2 rounded-xl border border-white/[0.07] bg-black/[0.08] p-2 focus-within:border-[#d6ab99]/45 focus-within:bg-[#d6ab99]/[0.04]"
              >
                {index < steps.length - 1 ? <span aria-hidden="true" className="absolute bottom-[-0.6rem] left-[3rem] z-10 h-3 w-px bg-[#d6ab99]/30" /> : null}
                <span className="num text-[11px] font-semibold tracking-[0.08em] text-[#dec2ad]">{stepName}</span>
                <input
                  ref={(node) => { inputRefs.current[index] = node; }}
                  type="text"
                  aria-label={stepName}
                  disabled={disabled}
                  value={step.label}
                  onChange={(event) => updateStep(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    if (index === steps.length - 1 && event.currentTarget.value.trim()) appendStep();
                  }}
                  className="min-h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-base text-white outline-none placeholder:text-[var(--faint)] transition focus-visible:border-[#d6ab99]/60 focus-visible:ring-2 focus-visible:ring-[#d6ab99]/35 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                  placeholder="Describí este paso…"
                />
                <button
                  type="button"
                  aria-label={`Eliminar ${stepName}`}
                  disabled={disabled}
                  onClick={() => deleteStep(index)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 text-[var(--muted)] transition hover:border-red-300/35 hover:bg-red-400/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6ab99]/45 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={appendStep}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#d6ab99]/30 px-3 text-sm font-medium text-[#dec2ad] transition hover:border-[#d6ab99]/60 hover:bg-[#d6ab99]/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6ab99]/45 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> Añadir paso
      </button>
    </section>
  );
}
