"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Pencil, RotateCcw, Trash2,
} from "lucide-react";
import { AvatarStack } from "@/components/Avatar";
import { StateSelector, stateLabel } from "@/components/ui";
import { cursorIntentProps } from "@/lib/cursor-intent";
import { fmtShortDate, type Project, type TaskState } from "@/lib/data";
import { getProjectProgress, ProjectProgress } from "./ProjectProgress";
import { ProjectStepList } from "./ProjectStepList";
import {
  formatProjectAuditDate, projectPriorityLabel, projectTypeLabel,
} from "./project-meta";
import type { ProjectPendingOperation, ProjectSection } from "./project-view-types";

const EASE = [0.23, 1, 0.32, 1] as const;

export function ProjectCard({
  project,
  section,
  index,
  pendingOperation,
  statusMenuOpen,
  deleteConfirmOpen,
  onOpen,
  onToggleStatusMenu,
  onStatusChange,
  onStepChange,
  onEdit,
  onDelete,
  onReopen,
}: {
  project: Project;
  section: ProjectSection;
  index: number;
  pendingOperation: ProjectPendingOperation;
  statusMenuOpen: boolean;
  deleteConfirmOpen: boolean;
  onOpen: () => void;
  onToggleStatusMenu: () => void;
  onStatusChange: (status: TaskState) => void;
  onStepChange: (index: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  onReopen: () => void;
}): React.ReactNode {
  const reducedMotion = useReducedMotion();
  const progress = getProjectProgress(project);
  const belongsToProject = pendingOperation?.projectId === project.id;
  const statusPending = Boolean(belongsToProject && pendingOperation?.kind === "status");
  const savePending = Boolean(belongsToProject && pendingOperation?.kind === "save");
  const deletePending = Boolean(belongsToProject && pendingOperation?.kind === "delete");
  const pendingStepIndex = belongsToProject && pendingOperation?.kind === "step"
    ? pendingOperation.stepIndex ?? null
    : null;
  const team = section === "completed"
    ? project.completedResponsibleUsernames ?? [project.owner, ...project.responsibleUsernames]
    : [project.owner, ...project.responsibleUsernames];
  const railScale = project.contentMode === "note" ? 1 : progress.percentage / 100;
  const railOpacity = project.contentMode === "note"
    ? 0.24
    : Math.min(0.92, 0.22 + progress.percentage * 0.007);

  return (
    <motion.article
      aria-label={project.name}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      whileHover={reducedMotion ? undefined : { y: -3 }}
      transition={{
        duration: reducedMotion ? 0 : 0.2,
        ease: EASE,
        delay: reducedMotion ? 0 : Math.min(index, 6) * 0.045,
      }}
      className="glass card-sheen group relative isolate flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] p-5 transition-[border-color,box-shadow] duration-200 hover:border-[#d6ab99]/25 hover:shadow-[0_18px_45px_-28px_rgba(214,171,153,0.42)] has-[:focus-visible]:border-[#d6ab99]/45 has-[:focus-visible]:shadow-[0_0_0_2px_rgba(214,171,153,0.2)] sm:p-6"
    >
      <button
        type="button"
        aria-label={`Abrir proyecto ${project.name}`}
        onClick={onOpen}
        {...cursorIntentProps("open")}
        className="absolute inset-0 z-0 cursor-pointer rounded-2xl transition-colors duration-150 active:bg-white/[0.015] focus-visible:outline-none"
      >
        <span className="sr-only">Abrir proyecto {project.name}</span>
      </button>

      <motion.span
        data-project-progress-rail="true"
        aria-hidden="true"
        initial={false}
        animate={{ scaleX: railScale, opacity: railOpacity }}
        transition={{ duration: reducedMotion ? 0 : 0.24, ease: EASE }}
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-px origin-left ${
          project.status === "done"
            ? "bg-emerald-300"
            : project.contentMode === "note"
              ? "bg-[#d6ab99]"
              : "bg-gradient-to-r from-[#b98a76] via-[#d6ab99] to-[#dec2ad]"
        }`}
      />

      <div className="pointer-events-none relative z-10 flex min-w-0 items-start gap-4">
        <ProjectProgress project={project} compact size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2 className="line-clamp-2 text-balance text-lg font-semibold leading-snug text-white">
              {project.name}
            </h2>
            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 translate-y-1 text-[#dec2ad] opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transform-none motion-reduce:transition-none" aria-hidden="true" />
          </div>
          {project.objective ? (
            <p className="mt-2 line-clamp-2 text-pretty text-xs leading-5 text-[var(--muted)]">{project.objective}</p>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none relative z-10 mt-4 flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--faint)]">
        <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1">{projectTypeLabel(project.projectType)}</span>
        <span className="rounded-full border border-[#d6ab99]/15 bg-[#d6ab99]/[0.035] px-2.5 py-1 text-[#dec2ad]">{projectPriorityLabel(project.priority)}</span>
      </div>

      <div className="pointer-events-none relative z-10 mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--muted)]">
        <AvatarStack usernames={team} size={20} />
        {section === "completed" ? (
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> Completado el {formatProjectAuditDate(project.completedAt)}</span>
        ) : (
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {project.startDate ? `Inicia ${fmtShortDate(project.startDate)}` : `Creado ${fmtShortDate(project.createdAt)}`}</span>
        )}
        {project.due ? <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Entrega {fmtShortDate(project.due)}</span> : null}
      </div>

      {section === "active" ? (
        <div className="relative z-20 mt-4">
          <button
            type="button"
            disabled={statusPending}
            aria-label={`Cambiar estado de ${project.name}`}
            aria-expanded={statusMenuOpen}
            onClick={onToggleStatusMenu}
            {...cursorIntentProps("edit", "Cambiar estado")}
            className="press inline-flex min-h-11 items-center rounded-full border border-white/10 px-3 text-xs text-[var(--muted)] transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
          >
            {statusPending ? "Guardando estado…" : stateLabel(project.status)}
          </button>
          {statusMenuOpen ? (
            <fieldset disabled={statusPending} className="m-0 mt-2 min-w-0 border-0 p-0">
              <StateSelector value={project.status} onChange={onStatusChange} />
            </fieldset>
          ) : null}
        </div>
      ) : section === "previous" ? (
        <p className="pointer-events-none relative z-10 mt-4 text-xs text-[var(--muted)]">Estado: {stateLabel(project.status)}</p>
      ) : null}

      <div className="relative z-20 mt-4">
        {project.contentMode === "steps" ? (
          <ProjectStepList
            project={project}
            variant="compact"
            readOnly={section !== "active"}
            pendingIndex={pendingStepIndex}
            onToggle={section === "active" ? onStepChange : undefined}
            onOpen={onOpen}
          />
        ) : (
          <p className="pointer-events-none line-clamp-4 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-3 text-xs leading-5 text-[var(--muted)]">
            {project.note || "Sin contenido"}
          </p>
        )}
      </div>

      <div className="relative z-20 mt-auto flex items-center gap-2 border-t border-white/[0.06] pt-4">
        {section === "completed" ? (
          <button
            type="button"
            disabled={statusPending}
            aria-label={`Reabrir proyecto ${project.name}`}
            onClick={onReopen}
            {...cursorIntentProps("doing", "Reabrir")}
            className="press inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-[var(--muted)] transition-colors hover:border-blue-300/25 hover:text-blue-200 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {statusPending ? "Reabriendo…" : "Reabrir"}
          </button>
        ) : section === "active" ? (
          <>
            <button
              type="button"
              disabled={savePending}
              aria-label={`Editar ${project.name}`}
              onClick={onEdit}
              {...cursorIntentProps("edit")}
              className="press inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-[var(--muted)] transition-colors hover:border-[#d6ab99]/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Editar
            </button>
            <button
              type="button"
              disabled={deletePending}
              aria-label={deleteConfirmOpen ? `Confirmar eliminación de ${project.name}` : `Eliminar ${project.name}`}
              onClick={onDelete}
              {...cursorIntentProps("danger", deleteConfirmOpen ? "Confirmar" : "Eliminar")}
              className="press ml-auto inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-[var(--faint)] transition-colors hover:border-red-300/25 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {deleteConfirmOpen ? "¿Seguro?" : <span className="sr-only">Eliminar</span>}
            </button>
          </>
        ) : null}
      </div>
    </motion.article>
  );
}
