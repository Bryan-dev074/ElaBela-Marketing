"use client";

import React from "react";
import {
  CalendarDays, CheckCircle2, Clock3, FileText, Pencil, RotateCcw, Sparkles, UserRound,
} from "lucide-react";
import { AvatarChip } from "@/components/Avatar";
import { Markdown } from "@/components/Markdown";
import { Button, Modal, StatePill, StateSelector } from "@/components/ui";
import { cursorIntentProps } from "@/lib/cursor-intent";
import { fmtShortDate, type Project, type TaskState } from "@/lib/data";
import { classifyProject } from "@/lib/projects";
import { useProfiles } from "@/lib/profiles";
import { ProjectProgress } from "./ProjectProgress";
import { ProjectStepList } from "./ProjectStepList";
import {
  formatProjectAuditDate, projectPriorityLabel, projectTypeLabel,
} from "./project-meta";
import type { ProjectPendingOperation } from "./project-view-types";

function MetadataItem({ icon, label, value }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}): React.ReactNode {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl bg-white/[0.025] px-3 py-3">
      <span className="mt-0.5 text-[#d6ab99]" aria-hidden="true">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">{label}</span>
        <span className="mt-1 block text-sm text-zinc-100">{value}</span>
      </span>
    </div>
  );
}

export function ProjectDetailModal({
  project,
  pendingOperation,
  error,
  onClose,
  onStatusChange,
  onStepChange,
  onEdit,
  onReopen,
}: {
  project: Project | null;
  pendingOperation: ProjectPendingOperation;
  error: string;
  onClose: () => void;
  onStatusChange: (status: TaskState) => void;
  onStepChange: (index: number) => void;
  onEdit: () => void;
  onReopen: () => void;
}): React.ReactNode {
  const { profiles } = useProfiles();
  const currentPending = Boolean(project && pendingOperation?.projectId === project.id);
  const section = project
    ? currentPending
      ? pendingOperation?.sourceSection ?? classifyProject(project)
      : classifyProject(project)
    : null;
  const statusPending = Boolean(currentPending && pendingOperation?.kind === "status");
  const completing = Boolean(statusPending && pendingOperation?.targetStatus === "done");
  const pendingStepIndex = currentPending && pendingOperation?.kind === "step"
    ? pendingOperation.stepIndex ?? null
    : null;
  const completedByName = project?.completedBy
    ? profiles.find(({ id }) => id === project.completedBy)?.fullName ?? project.completedBy
    : null;
  const readOnly = section !== "active";

  const footer = project ? (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
      {section === "active" ? (
        <>
          <Button
            type="button"
            variant="ghost"
            disabled={currentPending}
            onClick={onEdit}
            {...cursorIntentProps("edit")}
            className="min-h-11"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" /> Editar proyecto
          </Button>
          <Button
            type="button"
            disabled={currentPending}
            onClick={() => onStatusChange("done")}
            {...cursorIntentProps("complete")}
            className="min-h-11"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {completing ? "Completando…" : statusPending ? "Guardando estado…" : "Completar proyecto"}
          </Button>
        </>
      ) : section === "completed" ? (
        <Button
          type="button"
          disabled={currentPending}
          onClick={onReopen}
          {...cursorIntentProps("doing", "Reabrir")}
          className="min-h-11"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {statusPending ? "Reabriendo…" : "Reabrir proyecto"}
        </Button>
      ) : null}
    </div>
  ) : undefined;

  return (
    <Modal
      open={Boolean(project)}
      onClose={onClose}
      size="studio"
      title={project?.name ?? "Detalle del proyecto"}
      description="Project Studio · avance, equipo y próximos pasos"
      footer={footer}
    >
      {project ? (
        <div data-project-studio="true" className="min-w-0 overflow-x-hidden">
          {error ? (
            <p role="alert" className="mb-5 rounded-xl border border-red-400/25 bg-red-500/[0.09] p-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <header className="border-b border-white/[0.06] pb-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                {projectTypeLabel(project.projectType)}
              </span>
              <span className="rounded-full border border-[#d6ab99]/15 bg-[#d6ab99]/[0.045] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#dec2ad]">
                {projectPriorityLabel(project.priority)}
              </span>
              <StatePill state={project.status} />
            </div>
            <h3 className="mt-4 text-balance font-display text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl">
              {project.name}
            </h3>
            {project.objective ? (
              <p className="mt-2 max-w-3xl text-pretty text-sm leading-6 text-[var(--muted)]">{project.objective}</p>
            ) : null}
            <div className="mt-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <ProjectProgress project={project} />
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">Estado del proyecto</p>
                <fieldset disabled={currentPending || readOnly} className="m-0 min-w-0 border-0 p-0">
                  <StateSelector value={project.status} onChange={onStatusChange} disabled={currentPending || readOnly} />
                </fieldset>
              </div>
            </div>
          </header>

          <div data-project-studio-grid="true" className="grid min-w-0 grid-cols-1 gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8">
            <main className="min-w-0">
              <div className="mb-4 flex items-center gap-2">
                {project.contentMode === "steps" ? <Sparkles className="h-4 w-4 text-[#d6ab99]" aria-hidden="true" /> : <FileText className="h-4 w-4 text-[#d6ab99]" aria-hidden="true" />}
                <h4 className="text-sm font-semibold text-white">{project.contentMode === "steps" ? "Ruta de trabajo" : "Nota editorial"}</h4>
              </div>
              {project.contentMode === "steps" ? (
                <ProjectStepList
                  project={project}
                  variant="detail"
                  disabled={currentPending}
                  readOnly={readOnly}
                  pendingIndex={pendingStepIndex}
                  onToggle={section === "active" ? onStepChange : undefined}
                />
              ) : (
                <div data-project-note="true" className="min-w-0 overflow-x-auto rounded-2xl border border-[#d6ab99]/15 bg-[#d6ab99]/[0.035] p-4 sm:p-5">
                  <Markdown>{project.note || "_Sin contenido._"}</Markdown>
                </div>
              )}
            </main>

            <aside className="min-w-0 space-y-5 lg:border-l lg:border-white/[0.06] lg:pl-6">
              <section aria-labelledby="project-team-heading">
                <h4 id="project-team-heading" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
                  <UserRound className="h-3.5 w-3.5 text-[#d6ab99]" aria-hidden="true" /> Equipo
                </h4>
                <div className="space-y-2">
                  <div className="rounded-xl bg-white/[0.025] px-3 py-2.5">
                    <span className="mb-1 block text-[10px] text-[var(--faint)]">Líder</span>
                    <AvatarChip username={project.owner} size={22} />
                  </div>
                  {project.responsibleUsernames.map((username) => (
                    <div key={username} className="rounded-xl bg-white/[0.025] px-3 py-2.5">
                      <span className="mb-1 block text-[10px] text-[var(--faint)]">Responsable</span>
                      <AvatarChip username={username} size={22} />
                    </div>
                  ))}
                </div>
              </section>

              <section aria-labelledby="project-dates-heading" className="space-y-2">
                <h4 id="project-dates-heading" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
                  <CalendarDays className="h-3.5 w-3.5 text-[#d6ab99]" aria-hidden="true" /> Fechas
                </h4>
                <MetadataItem icon={<CalendarDays className="h-4 w-4" />} label="Creado" value={fmtShortDate(project.createdAt) ?? "Sin fecha"} />
                {project.startDate ? <MetadataItem icon={<CalendarDays className="h-4 w-4" />} label="Inicio" value={fmtShortDate(project.startDate)} /> : null}
                {project.due ? <MetadataItem icon={<Clock3 className="h-4 w-4" />} label="Entrega" value={fmtShortDate(project.due)} /> : null}
              </section>

              {project.completedAt ? (
                <section className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] p-4" aria-label="Auditoría de finalización">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                  <p className="mt-2 text-xs font-medium text-emerald-200">Completado el {formatProjectAuditDate(project.completedAt)}</p>
                  {completedByName ? <p className="mt-1 text-xs text-[var(--muted)]">por {completedByName}</p> : null}
                </section>
              ) : null}
            </aside>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
