"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText, FolderKanban, ListChecks, Plus,
} from "lucide-react";
import {
  Button, EmptyState, Field, Input, Modal, PageHeader, Reveal, Segmented,
  Select, StateSelector, Textarea,
} from "@/components/ui";
import { OwnerPicker } from "@/components/Avatar";
import { ProjectResponsiblePicker } from "@/components/ProjectResponsiblePicker";
import { ProjectCard } from "@/app/(app)/proyectos/_components/ProjectCard";
import { ProjectDetailModal } from "@/app/(app)/proyectos/_components/ProjectDetailModal";
import { ProjectStepsEditor } from "@/app/(app)/proyectos/_components/ProjectStepsEditor";
import {
  PROJECT_PRIORITIES, PROJECT_TYPES,
} from "@/app/(app)/proyectos/_components/project-meta";
import type {
  ProjectPendingOperation, ProjectPendingOperations, ProjectSection,
} from "@/app/(app)/proyectos/_components/project-view-types";
import {
  classifyProject, filterCompletedByResponsible, normalizeAdditionalResponsibles,
  toggleProjectStep, transitionProjectStatus,
} from "@/lib/projects";
import {
  type Project, type ProjectPriority, type ProjectType, type TaskState,
} from "@/lib/data";
import { useProjects } from "@/lib/db";
import { useProfiles } from "@/lib/profiles";
import { useUser } from "@/lib/user-context";

const today = () => new Date().toISOString().slice(0, 10);

const displayUsername = (username: string) => username.charAt(0).toUpperCase() + username.slice(1);

function ProgressRing({ pct, size = 52, stroke = 4 }: { pct: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Progreso ${clamped}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={clamped === 100 ? "#34d399" : "#d6ab99"} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped / 100) }}
        />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-nude">{clamped}%</span>
    </div>
  );
}

type ProjectTab = ProjectSection;
type Draft = {
  id: string; name: string; owner: string; responsibleUsernames: string[];
  projectType: ProjectType; priority: ProjectPriority; objective: string;
  startDate: string; due: string; status: TaskState;
  contentMode: "steps" | "note"; steps: Project["steps"]; note: string;
};

const toDraft = (project?: Project, defaultOwner = ""): Draft => project ? {
  id: project.id,
  name: project.name,
  owner: project.owner,
  responsibleUsernames: project.responsibleUsernames,
  projectType: project.projectType,
  priority: project.priority,
  objective: project.objective ?? "",
  startDate: project.startDate ?? "",
  due: project.due ?? "",
  status: project.status,
  contentMode: project.contentMode,
  steps: project.steps.map((step) => ({ ...step })),
  note: project.note ?? "",
} : {
  id: "", name: "", owner: defaultOwner, responsibleUsernames: [],
  projectType: "other", priority: "normal", objective: "", startDate: today(), due: "",
  status: "todo", contentMode: "steps", steps: [{ label: "", done: false }], note: "",
};

const mergeSteps = (oldSteps: Project["steps"], nextSteps: Project["steps"]) => nextSteps.map((step) => ({
  ...step,
  done: oldSteps.find(({ label }) => label.trim() === step.label)?.done ?? false,
}));

export default function ProjectsPage() {
  const { items: projects, addAsync, updateAsync, removeAsync } = useProjects();
  const user = useUser();
  const { profiles } = useProfiles();
  const [tab, setTab] = useState<ProjectTab>("active");
  const [completedResponsible, setCompletedResponsible] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusProjectId, setStatusProjectId] = useState<string | null>(null);
  const [pendingOperations, setPendingOperations] = useState<ProjectPendingOperations>({});
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSequence = useRef(0);

  const active = projects.filter((project) => classifyProject(project) === "active");
  const completed = filterCompletedByResponsible(projects, completedResponsible || undefined);
  const previous = projects.filter((project) => classifyProject(project) === "previous");
  const shown = tab === "active" ? active : tab === "completed" ? completed : previous;
  const open = projects.find(({ id }) => id === openId) ?? null;
  const historicalResponsibles = [...new Set([
    ...profiles.map(({ username }) => username),
    ...projects.flatMap(({ completedResponsibleUsernames }) => completedResponsibleUsernames ?? []),
  ].filter(Boolean))].sort();
  const profileName = new Map(profiles.map(({ username, fullName }) => [username, fullName]));
  const allSteps = active.flatMap(({ steps }) => steps);
  const globalPct = allSteps.length
    ? Math.round((allSteps.filter(({ done }) => done).length / allSteps.length) * 100)
    : 0;
  const draftProjectId = draft?.id || "new";
  const savingDraft = pendingOperations[draftProjectId]?.kind === "save";

  function beginPending(operation: Exclude<ProjectPendingOperation, null>) {
    setPendingOperations((current) => ({ ...current, [operation.projectId]: operation }));
  }

  function clearPending(operation: Exclude<ProjectPendingOperation, null>) {
    setPendingOperations((current) => {
      if (current[operation.projectId]?.operationId !== operation.operationId) return current;
      const { [operation.projectId]: _cleared, ...remaining } = current;
      return remaining;
    });
  }

  async function persistStatus(project: Project, nextStatus: TaskState) {
    setError("");
    const operation = {
      projectId: project.id,
      kind: "status",
      operationId: ++pendingSequence.current,
      sourceSection: classifyProject(project),
      targetStatus: nextStatus,
    } as const;
    beginPending(operation);
    try {
      const transitioned = transitionProjectStatus(project, nextStatus, user.id, new Date());
      const patch = project.status === "done" && nextStatus !== "done"
        ? { ...transitioned, completedAt: undefined, completedBy: undefined, completedResponsibleUsernames: undefined }
        : transitioned;
      const result = await updateAsync(project.id, patch);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatusProjectId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cambiar el estado.");
    } finally {
      clearPending(operation);
    }
  }

  async function persistStep(project: Project, index: number) {
    setError("");
    const operation = {
      projectId: project.id,
      kind: "step",
      operationId: ++pendingSequence.current,
      stepIndex: index,
      sourceSection: classifyProject(project),
    } as const;
    beginPending(operation);
    try {
      const next = toggleProjectStep(project, index, user.id, new Date());
      const result = await updateAsync(project.id, next);
      if (!result.ok) setError(result.error);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el paso.");
    } finally {
      clearPending(operation);
    }
  }

  async function save() {
    if (!draft || !draft.name.trim()) return;
    setError("");
    const existing = draft.id ? projects.find(({ id }) => id === draft.id) : undefined;
    if (draft.id && !existing) {
      setError("El proyecto ya no está disponible.");
      return;
    }
    const operation = {
      projectId: draft.id || "new",
      kind: "save",
      operationId: ++pendingSequence.current,
      sourceSection: existing ? classifyProject(existing) : undefined,
    } as const;
    beginPending(operation);
    const additions = normalizeAdditionalResponsibles(draft.owner, draft.responsibleUsernames);
    const parsedSteps = draft.contentMode === "steps"
      ? draft.steps
        .map((step) => ({ label: step.label.trim(), done: false }))
        .filter((step) => Boolean(step.label))
      : [];
    try {
      if (draft.id) {
        const current = existing!;
        const edited: Project = {
          ...current,
          name: draft.name.trim(), owner: draft.owner, responsibleUsernames: additions,
          projectType: draft.projectType, priority: draft.priority, objective: draft.objective.trim() || undefined,
          startDate: draft.startDate || undefined, due: draft.due || undefined,
          contentMode: draft.contentMode, note: draft.note,
          steps: draft.contentMode === "steps" ? mergeSteps(current.steps, parsedSteps) : current.steps,
        };
        const persisted = transitionProjectStatus(edited, draft.status, user.id, new Date());
        const result = await updateAsync(draft.id, persisted);
        if (!result.ok) {
          setError(result.error);
          return;
        }
      } else {
        const base: Project = {
          id: `pr${Date.now()}`, name: draft.name.trim(), owner: draft.owner,
          responsibleUsernames: additions, projectType: draft.projectType, priority: draft.priority,
          objective: draft.objective.trim() || undefined, status: "todo", createdAt: today(),
          startDate: draft.startDate || undefined, due: draft.due || undefined,
          contentMode: draft.contentMode, steps: parsedSteps, note: draft.note,
        };
        const persisted = transitionProjectStatus(base, draft.status, user.id, new Date());
        const result = await addAsync(persisted);
        if (!result.ok) {
          setError(result.error);
          return;
        }
      }
      setDraft(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el proyecto.");
    } finally {
      clearPending(operation);
    }
  }

  function askDelete(id: string) {
    setConfirmDel(id);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setConfirmDel(null), 3200);
  }

  async function removeProject(id: string) {
    const project = projects.find((item) => item.id === id);
    const operation = {
      projectId: id,
      kind: "delete",
      operationId: ++pendingSequence.current,
      sourceSection: project ? classifyProject(project) : undefined,
    } as const;
    beginPending(operation);
    setError("");
    const result = await removeAsync(id);
    clearPending(operation);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirmDel(null);
    if (openId === id) setOpenId(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Iniciativas"
        title="Proyectos"
        description="Gestioná iniciativas activas, consultá los trabajos completados y conservá el historial anterior."
        action={<Button disabled={pendingOperations.new?.kind === "save"} onClick={() => { setError(""); setDraft(toDraft(undefined, user.username)); }}><Plus className="h-4 w-4" /> Nuevo proyecto</Button>}
      />

      {error && !draft && !open && <p role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <Reveal className="mb-8">
        <div className="ring-glow glass grid grid-cols-2 rounded-2xl md:grid-cols-4">
          <div className="p-5">
            <p className="eyebrow mb-2 flex items-center gap-1.5"><FolderKanban className="h-3 w-3 text-nude" /> Activos</p>
            <p className="num font-display text-3xl font-semibold text-white">{active.length}</p>
            <p className="mt-0.5 text-[11px] text-[var(--faint)]">proyectos en juego</p>
          </div>
          <div className="border-l border-white/5 p-5">
            <p className="eyebrow mb-2">En curso</p>
            <p className="num font-display text-3xl font-semibold text-blue-300">{active.filter(({ status }) => status === "doing").length}</p>
            <p className="mt-0.5 text-[11px] text-[var(--faint)]">avanzando ahora</p>
          </div>
          <div className="border-t border-white/5 p-5 md:border-l md:border-t-0">
            <p className="eyebrow mb-2">Completados</p>
            <p className="num font-display text-3xl font-semibold text-emerald-300">{filterCompletedByResponsible(projects).length}</p>
            <p className="mt-0.5 text-[11px] text-[var(--faint)]">con auditoría</p>
          </div>
          <div className="flex items-center gap-4 border-l border-t border-white/5 p-5 md:border-t-0">
            <ProgressRing pct={globalPct} size={48} />
            <div><p className="eyebrow mb-1">Pasos</p><p className="num text-xl font-semibold text-nude">{allSteps.length ? `${globalPct}%` : "—"}</p></div>
          </div>
        </div>
      </Reveal>

      <Segmented
        value={tab}
        onChange={(next) => { setTab(next); setError(""); }}
        className="mb-6"
        options={[
          { value: "active", label: "Activos", badge: active.length },
          { value: "completed", label: "Completados", badge: filterCompletedByResponsible(projects).length },
          { value: "previous", label: "Anteriores", badge: previous.length },
        ]}
      />

      {tab === "completed" && (
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Filtrar completados por responsable">
          <button
            type="button"
            aria-pressed={!completedResponsible}
            onClick={() => setCompletedResponsible("")}
            className={`press min-h-11 rounded-xl border px-3 py-2 text-xs transition-colors ${
              !completedResponsible ? "border-nude/50 bg-nude/10 text-white" : "border-white/10 text-[var(--muted)] hover:border-white/20 hover:text-white"
            }`}
          >Todos</button>
          {historicalResponsibles.map((username) => (
            <button
              key={username} type="button" aria-pressed={completedResponsible === username}
              onClick={() => setCompletedResponsible(username)}
              className={`press min-h-11 rounded-xl border px-3 py-2 text-xs transition-colors ${
                completedResponsible === username ? "border-nude/50 bg-nude/10 text-white" : "border-white/10 text-[var(--muted)] hover:border-white/20 hover:text-white"
              }`}
            >
              {profileName.get(username) || displayUsername(username)}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            section={tab}
            index={index}
            pendingOperation={pendingOperations[project.id] ?? null}
            statusMenuOpen={statusProjectId === project.id}
            deleteConfirmOpen={confirmDel === project.id}
            onOpen={() => { setError(""); setOpenId(project.id); }}
            onToggleStatusMenu={() => setStatusProjectId(statusProjectId === project.id ? null : project.id)}
            onStatusChange={(status) => void persistStatus(project, status)}
            onStepChange={(stepIndex) => void persistStep(project, stepIndex)}
            onEdit={() => { setError(""); setDraft(toDraft(project, user.username)); }}
            onDelete={() => confirmDel === project.id ? void removeProject(project.id) : askDelete(project.id)}
            onReopen={() => void persistStatus(project, "doing")}
          />
        ))}

        {shown.length === 0 && (
          <div className="col-span-full"><EmptyState icon="✨" title={`Sin proyectos ${tab === "active" ? "activos" : tab === "completed" ? "completados" : "anteriores"}`} hint="No hay proyectos para mostrar en esta sección." /></div>
        )}
      </div>

      <ProjectDetailModal
        project={open}
        pendingOperation={open ? pendingOperations[open.id] ?? null : null}
        error={open ? error : ""}
        onClose={() => setOpenId(null)}
        onStatusChange={(status) => { if (open) void persistStatus(open, status); }}
        onStepChange={(stepIndex) => { if (open) void persistStep(open, stepIndex); }}
        onEdit={() => {
          if (!open) return;
          setError("");
          setOpenId(null);
          setDraft(toDraft(open, user.username));
        }}
        onReopen={() => { if (open) void persistStatus(open, "doing"); }}
      />

      <Modal
        open={!!draft}
        onClose={() => { if (!savingDraft) setDraft(null); }}
        wide
        title={draft?.id ? "Editar proyecto" : "Nuevo proyecto"}
        description="Definí responsables, alcance, fechas y contenido del proyecto."
        footer={<><Button variant="ghost" disabled={savingDraft} onClick={() => setDraft(null)}>Cancelar</Button><Button disabled={!draft?.name.trim() || savingDraft} onClick={() => void save()}>Guardar</Button></>}
      >
        {draft && (
          <div className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
            <Field label="Nombre"><Input disabled={savingDraft} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo"><Select disabled={savingDraft} value={draft.projectType} onChange={(event) => setDraft({ ...draft, projectType: event.target.value as ProjectType })}>{PROJECT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
              <Field label="Prioridad"><Select disabled={savingDraft} value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as ProjectPriority })}>{PROJECT_PRIORITIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
            </div>
            <Field label="Objetivo"><Textarea disabled={savingDraft} rows={3} value={draft.objective} onChange={(event) => setDraft({ ...draft, objective: event.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha de inicio"><Input disabled={savingDraft} type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></Field>
              <Field label="Fecha de entrega"><Input disabled={savingDraft} type="date" value={draft.due} onChange={(event) => setDraft({ ...draft, due: event.target.value })} /></Field>
            </div>
            <fieldset disabled={savingDraft} className="m-0 min-w-0 space-y-5 border-0 p-0">
              <div><span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Líder</span><OwnerPicker value={draft.owner} onChange={(owner) => { if (!savingDraft) setDraft({ ...draft, owner, responsibleUsernames: normalizeAdditionalResponsibles(owner, draft.responsibleUsernames) }); }} /></div>
              <div><span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Responsables adicionales</span><ProjectResponsiblePicker disabled={savingDraft} owner={draft.owner} value={draft.responsibleUsernames} onChange={(responsibleUsernames) => setDraft({ ...draft, responsibleUsernames })} /></div>
              <div><span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Estado</span><StateSelector value={draft.status} onChange={(status) => { if (!savingDraft) setDraft({ ...draft, status }); }} /></div>
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Contenido</span>
                <Segmented value={draft.contentMode} onChange={(contentMode) => { if (!savingDraft) setDraft({ ...draft, contentMode }); }} options={[{ value: "steps", label: <><ListChecks className="h-3.5 w-3.5" /> Pasos</> }, { value: "note", label: <><FileText className="h-3.5 w-3.5" /> Nota</> }]} />
              </div>
            </fieldset>
            {draft.contentMode === "steps" ? (
              <ProjectStepsEditor
                value={draft.steps}
                onChange={(steps) => setDraft({ ...draft, steps })}
                disabled={savingDraft}
              />
            ) : <Field label="Nota"><Textarea disabled={savingDraft} rows={8} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></Field>}
          </div>
        )}
      </Modal>
    </div>
  );
}
