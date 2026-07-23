"use client";

import React, { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FileText } from "lucide-react";
import type { Project } from "@/lib/data";

const MOTION_EASE = [0.23, 1, 0.32, 1] as const;

const PROJECT_STATE: Record<Project["status"], string> = {
  todo: "Pendiente",
  doing: "En curso",
  done: "Completado",
};

export function getProjectProgress(project: Project): {
  completed: number;
  total: number;
  percentage: number;
  determinate: boolean;
} {
  if (project.contentMode === "note") {
    return { completed: 0, total: 0, percentage: 0, determinate: false };
  }

  const total = project.steps.length;
  const completed = project.steps.filter(({ done }) => done).length;
  if (total === 0) {
    if (project.status === "doing") {
      return { completed: 0, total: 0, percentage: 50, determinate: true };
    }
    if (project.status === "done") {
      return { completed: 0, total: 0, percentage: 100, determinate: true };
    }
    return { completed: 0, total: 0, percentage: 0, determinate: true };
  }

  return {
    completed,
    total,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    determinate: true,
  };
}

export function ProjectProgress({ project, size = 68, compact = false }: {
  project: Project;
  size?: number;
  compact?: boolean;
}): React.ReactNode {
  const reducedMotion = useReducedMotion();
  const gradientId = `project-progress-${useId().replace(/:/g, "")}`;
  const progress = getProjectProgress(project);

  if (!progress.determinate) {
    return (
      <div className={`flex items-center ${compact ? "gap-2.5" : "gap-3"}`}>
        <span
          className="flex shrink-0 items-center justify-center rounded-full border border-[#d6ab99]/20 bg-[#d6ab99]/[0.07] text-[#dec2ad]"
          style={{ width: compact ? 44 : Math.max(48, size), height: compact ? 44 : Math.max(48, size) }}
          aria-hidden="true"
        >
          <FileText className={compact ? "h-4 w-4" : "h-5 w-5"} strokeWidth={1.7} />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-medium text-[#dec2ad]">Nota del proyecto</span>
          <span className="mt-0.5 block text-[11px] text-[var(--faint)]">{PROJECT_STATE[project.status]}</span>
        </span>
      </div>
    );
  }

  const { completed, total, percentage } = progress;
  const complete = project.status === "done" || (percentage === 100 && total > 0);
  const stroke = Math.max(3.5, Math.min(5, size * 0.065));
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const opacity = 0.55 + percentage * 0.0045;
  const haloOpacity = 0.12 + percentage * 0.0025;
  const visibleText = total === 0
    ? project.status === "done"
      ? "100%"
      : project.status === "doing"
        ? "50%"
        : "Sin pasos"
    : compact
      ? `${percentage}%`
      : `${completed} de ${total} · ${percentage} %`;

  return (
    <div
      role="progressbar"
      aria-label={`Progreso de ${project.name}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      aria-valuetext={total === 0
        ? project.status === "done"
          ? "100 por ciento"
          : project.status === "doing"
            ? "50 por ciento"
            : "Sin pasos"
        : `${completed} de ${total}, ${percentage} por ciento`}
      className={`flex items-center ${compact ? "gap-0" : "gap-3"}`}
    >
      <span className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90 overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              {complete ? (
                <>
                  <stop offset="0%" stopColor="#34d399" stopOpacity={opacity} />
                  <stop offset="100%" stopColor="#6ee7b7" stopOpacity={Math.min(1, opacity + 0.08)} />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#b98a76" stopOpacity={opacity} />
                  <stop offset="52%" stopColor="#d6ab99" stopOpacity={Math.min(1, opacity + 0.08)} />
                  <stop offset="100%" stopColor="#dec2ad" stopOpacity={opacity} />
                </>
              )}
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - percentage / 100) }}
            transition={{ duration: reducedMotion ? 0 : 0.24, ease: MOTION_EASE }}
            style={{
              filter: `drop-shadow(0 0 ${3 + percentage * 0.035}px ${complete ? `rgba(52, 211, 153, ${haloOpacity})` : `rgba(214, 171, 153, ${haloOpacity})`})`,
            }}
          />
        </svg>
        {compact ? (
          <span className={`num absolute inset-0 flex items-center justify-center px-1 text-center font-semibold ${total === 0 ? "text-[9px] leading-tight text-[var(--faint)]" : complete ? "text-[11px] text-emerald-300" : "text-[11px] text-[#dec2ad]"}`}>
            {visibleText}
          </span>
        ) : null}
      </span>
      {!compact ? (
        <span className={`num text-xs font-medium tabular-nums ${complete ? "text-emerald-300" : total === 0 ? "text-[var(--faint)]" : "text-[#dec2ad]"}`}>
          {visibleText}
        </span>
      ) : null}
    </div>
  );
}
