"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarPlus, CheckCircle2, Circle, Clock, FileText, FolderKanban,
  ListChecks, Pencil, Plus, RotateCcw, Trash2,
} from "lucide-react";
import {
  Button, EmptyState, Field, Input, Modal, PageHeader, Reveal, Segmented,
  Select, StateSelector, Textarea, stateCursorProps, stateLabel,
} from "@/components/ui";
import { AvatarChip, AvatarStack, OwnerPicker } from "@/components/Avatar";
import { Markdown } from "@/components/Markdown";
import { ProjectResponsiblePicker } from "@/components/ProjectResponsiblePicker";
import {
  classifyProject, filterCompletedByResponsible, normalizeAdditionalResponsibles,
  toggleProjectStep, transitionProjectStatus,
} from "@/lib/projects";
import {
  fmtShortDate, type Project, type ProjectPriority, type ProjectType, type TaskState,
} from "@/lib/data";
import { useProjects } from "@/lib/db";
import { useProfiles } from "@/lib/profiles";
import { useUser } from "@/lib/user-context";

const today = () => new Date().toISOString().slice(0, 10);

const projectPct = (project: Project) => project.steps.length
  ? Math.round((project.steps.filter(({ done }) => done).length / project.steps.length) * 100)
  : project.status === "done" ? 100 : 0;

const PROJECT_TYPES: Array<{ value: ProjectType; label: string }> = [
  { value: "campaign", label: "Campaña" },
  { value: "launch", label: "Lanzamiento" },
  { value: "content", label: "Contenido" },
  { value: "brand-design", label: "Marca y diseño" },
  { value: "web-ecommerce", label: "Web / e-commerce" },
  { value: "event", label: "Evento" },
  { value: "crm", label: "CRM" },
  { value: "operations", label: "Operaciones" },
  { value: "other", label: "Otro" },
];

const PRIORITIES: Array<{ value: ProjectPriority; label: string }> = [
  { value: "low", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const typeLabel = (type: ProjectType) => PROJECT_TYPES.find(({ value }) => value === type)?.label ?? type;
const priorityLabel = (priority: ProjectPriority) => PRIORITIES.find(({ value }) => value === priority)?.label ?? priority;
const displayUsername = (username: string) => username.charAt(0).toUpperCase() + username.slice(1);
const completedDate = (value?: string) => value
  ? new Date(value).toLocaleDateString("es-PY", { day: "numeric", month: "short", year: "numeric" })
  : "Sin fecha";

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

type ProjectTab = "active" | "completed" | "previous";
type Draft = {
  id: string; name: string; owner: string; responsibleUsernames: string[];
  projectType: ProjectType; priority: ProjectPriority; objective: string;
  startDate: string; due: string; status: TaskState;
  contentMode: "steps" | "note"; steps: string; note: string;
};

const toDraft = (project?: Project): Draft => project ? {
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
  steps: project.steps.map(({ label }) => label).join("\n"),
  note: project.note ?? "",
} : {
  id: "", name: "", owner: "cielo", responsibleUsernames: [],
  projectType: "other", priority: "normal", objective: "", startDate: today(), due: "",
  status: "todo", contentMode: "steps", steps: "", note: "",
};

const mergeSteps = (oldSteps: Project["steps"], nextSteps: Project["steps"]) => nextSteps.map((step) => ({
  ...step,
  done: oldSteps.find(({ label }) => label === step.label)?.done ?? false,
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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  async function persistStatus(project: Project, nextStatus: TaskState) {
    setError("");
    setPendingId(project.id);
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
      setPendingId(null);
    }
  }

  async function persistStep(project: Project, index: number) {
    setError("");
    setPendingId(project.id);
    try {
      const next = toggleProjectStep(project, index, user.id, new Date());
      const result = await updateAsync(project.id, next);
      if (!result.ok) setError(result.error);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el paso.");
    } finally {
      setPendingId(null);
    }
  }

  async function save() {
    if (!draft || !draft.name.trim()) return;
    setError("");
    setPendingId(draft.id || "new");
    const additions = normalizeAdditionalResponsibles(draft.owner, draft.responsibleUsernames);
    const parsedSteps = draft.contentMode === "steps"
      ? draft.steps.split("\n").map((label) => label.trim()).filter(Boolean).map((label) => ({ label, done: false }))
      : [];
    try {
      if (draft.id) {
        const existing = projects.find(({ id }) => id === draft.id);
        if (!existing) throw new Error("El proyecto ya no está disponible.");
        const edited: Project = {
          ...existing,
          name: draft.name.trim(), owner: draft.owner, responsibleUsernames: additions,
          projectType: draft.projectType, priority: draft.priority, objective: draft.objective.trim() || undefined,
          startDate: draft.startDate || undefined, due: draft.due || undefined,
          contentMode: draft.contentMode, note: draft.note,
          steps: draft.contentMode === "steps" ? mergeSteps(existing.steps, parsedSteps) : existing.steps,
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
      setPendingId(null);
    }
  }

  function askDelete(id: string) {
    setConfirmDel(id);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setConfirmDel(null), 3200);
  }

  async function removeProject(id: string) {
    setPendingId(id);
    setError("");
    const result = await removeAsync(id);
    setPendingId(null);
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
        action={<Button onClick={() => { setError(""); setDraft(toDraft()); }}><Plus className="h-4 w-4" /> Nuevo proyecto</Button>}
      />

      {error && !draft && <p role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

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
          <button type="button" aria-pressed={!completedResponsible} onClick={() => setCompletedResponsible("")} className="press rounded-xl border border-white/10 px-3 py-2 text-xs">Todos</button>
          {historicalResponsibles.map((username) => (
            <button
              key={username} type="button" aria-pressed={completedResponsible === username}
              onClick={() => setCompletedResponsible(username)}
              className="press rounded-xl border border-white/10 px-3 py-2 text-xs text-[var(--muted)]"
            >
              {profileName.get(username) || displayUsername(username)}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((project, index) => {
          const pending = pendingId === project.id;
          const asking = confirmDel === project.id;
          const responsibles = project.completedResponsibleUsernames ?? [project.owner, ...project.responsibleUsernames];
          return (
            <Reveal key={project.id} delay={index * 0.05} className="h-full">
              <article {...stateCursorProps(project.status)} className="glass glass-hover card-sheen group relative flex h-full flex-col rounded-2xl p-6">
                <div className="mb-4 flex items-start gap-4">
                  <ProgressRing pct={projectPct(project)} />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setOpenId(project.id)} className="line-clamp-2 text-left text-lg font-semibold text-white hover:text-nude">{project.name}</button>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--muted)]">
                      {tab === "completed" ? <AvatarStack usernames={responsibles} size={18} /> : <AvatarChip username={project.owner} size={16} />}
                      {tab === "completed" ? (
                        <span><CheckCircle2 className="mr-1 inline h-3 w-3" />{completedDate(project.completedAt)}</span>
                      ) : (
                        <span><CalendarPlus className="mr-1 inline h-3 w-3" />{fmtShortDate(project.createdAt)}</span>
                      )}
                      {project.due && <span><Clock className="mr-1 inline h-3 w-3" />{fmtShortDate(project.due)}</span>}
                    </div>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-[var(--faint)]">
                  <span className="rounded-full border border-white/10 px-2 py-1">{typeLabel(project.projectType)}</span>
                  <span className="rounded-full border border-white/10 px-2 py-1">{priorityLabel(project.priority)}</span>
                </div>

                {tab === "active" && (
                  <div className="mb-4">
                    <button
                      type="button" disabled={pending}
                      aria-label={`Cambiar estado de ${project.name}`}
                      onClick={() => setStatusProjectId(statusProjectId === project.id ? null : project.id)}
                      className="press rounded-full border border-white/10 px-3 py-1.5 text-xs text-[var(--muted)]"
                    >{stateLabel(project.status)}</button>
                    {statusProjectId === project.id && (
                      <div className="mt-2"><StateSelector value={project.status} onChange={(status) => void persistStatus(project, status)} /></div>
                    )}
                  </div>
                )}
                {tab === "previous" && <p className="mb-4 text-xs text-[var(--muted)]">Estado: {stateLabel(project.status)}</p>}

                {project.contentMode === "steps" ? (
                  <ul className="mb-4 space-y-1">
                    {project.steps.slice(0, 4).map((step, stepIndex) => (
                      <li key={`${step.label}-${stepIndex}`}>
                        <button
                          type="button" disabled={pending || tab !== "active"}
                          onClick={() => void persistStep(project, stepIndex)}
                          className="press flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm disabled:cursor-default"
                        >
                          {step.done ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-[var(--faint)]" />}
                          <span className={step.done ? "text-[var(--faint)] line-through" : "text-[var(--muted)]"}>{step.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mb-4 line-clamp-3 text-xs text-[var(--muted)]">{project.note || "Sin contenido"}</p>}

                <div className="mt-auto flex items-center gap-2 border-t border-white/[0.06] pt-3">
                  {tab === "completed" ? (
                    <button
                      type="button" disabled={pending} aria-label={`Reabrir ${project.name}`}
                      onClick={() => void persistStatus(project, "doing")}
                      className="press flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[11px] text-[var(--muted)]"
                    ><RotateCcw className="h-3 w-3" /> Reabrir</button>
                  ) : tab === "active" ? (
                    <>
                      <button
                        type="button" disabled={pending} aria-label={`Editar ${project.name}`}
                        onClick={() => { setError(""); setDraft(toDraft(project)); }}
                        className="press flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[11px] text-[var(--muted)]"
                      ><Pencil className="h-3 w-3" /> Editar</button>
                      <button
                        type="button" disabled={pending}
                        aria-label={asking ? `Confirmar eliminación de ${project.name}` : `Eliminar ${project.name}`}
                        onClick={() => asking ? void removeProject(project.id) : askDelete(project.id)}
                        className="press ml-auto flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[11px] text-[var(--faint)]"
                      ><Trash2 className="h-3 w-3" />{asking && "¿Seguro?"}</button>
                    </>
                  ) : null}
                </div>
              </article>
            </Reveal>
          );
        })}

        {shown.length === 0 && (
          <div className="col-span-full"><EmptyState icon="✨" title={`Sin proyectos ${tab === "active" ? "activos" : tab === "completed" ? "completados" : "anteriores"}`} hint="No hay proyectos para mostrar en esta sección." /></div>
        )}
      </div>

      <Modal
        open={!!open}
        onClose={() => setOpenId(null)}
        wide
        title={open?.name ?? ""}
        description={open ? `Creado el ${fmtShortDate(open.createdAt) ?? ""}` : ""}
        footer={open && classifyProject(open) === "active" ? (
          <div className="flex w-full justify-between gap-3">
            <button type="button" aria-label={`Cambiar estado de ${open.name}`} onClick={() => setStatusProjectId(open.id)} className="text-sm text-[var(--muted)]">{stateLabel(open.status)}</button>
            <Button variant="ghost" onClick={() => { setOpenId(null); setDraft(toDraft(open)); }}><Pencil className="h-4 w-4" /> Editar</Button>
          </div>
        ) : undefined}
      >
        {open && (
          <div>
            <AvatarStack usernames={[open.owner, ...open.responsibleUsernames]} />
            {open.objective && <p className="mt-4 text-sm text-[var(--muted)]">{open.objective}</p>}
            {open.contentMode === "note" ? <Markdown>{open.note || "_Sin contenido._"}</Markdown> : (
              <ul className="mt-4 space-y-1">
                {open.steps.map((step, index) => <li key={`${step.label}-${index}`}>{step.done ? "✓" : "○"} {step.label}</li>)}
              </ul>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!draft}
        onClose={() => { if (!pendingId) setDraft(null); }}
        wide
        title={draft?.id ? "Editar proyecto" : "Nuevo proyecto"}
        description="Definí responsables, alcance, fechas y contenido del proyecto."
        footer={<><Button variant="ghost" disabled={!!pendingId} onClick={() => setDraft(null)}>Cancelar</Button><Button disabled={!draft?.name.trim() || !!pendingId} onClick={() => void save()}>Guardar</Button></>}
      >
        {draft && (
          <div className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
            <Field label="Nombre"><Input disabled={!!pendingId} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo"><Select disabled={!!pendingId} value={draft.projectType} onChange={(event) => setDraft({ ...draft, projectType: event.target.value as ProjectType })}>{PROJECT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
              <Field label="Prioridad"><Select disabled={!!pendingId} value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as ProjectPriority })}>{PRIORITIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
            </div>
            <Field label="Objetivo"><Textarea disabled={!!pendingId} rows={3} value={draft.objective} onChange={(event) => setDraft({ ...draft, objective: event.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha de inicio"><Input disabled={!!pendingId} type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></Field>
              <Field label="Fecha de entrega"><Input disabled={!!pendingId} type="date" value={draft.due} onChange={(event) => setDraft({ ...draft, due: event.target.value })} /></Field>
            </div>
            <div><span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Líder</span><OwnerPicker value={draft.owner} onChange={(owner) => setDraft({ ...draft, owner, responsibleUsernames: normalizeAdditionalResponsibles(owner, draft.responsibleUsernames) })} /></div>
            <div><span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Responsables adicionales</span><ProjectResponsiblePicker disabled={!!pendingId} owner={draft.owner} value={draft.responsibleUsernames} onChange={(responsibleUsernames) => setDraft({ ...draft, responsibleUsernames })} /></div>
            <div><span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Estado</span><StateSelector value={draft.status} onChange={(status) => setDraft({ ...draft, status })} /></div>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Contenido</span>
              <Segmented value={draft.contentMode} onChange={(contentMode) => setDraft({ ...draft, contentMode })} options={[{ value: "steps", label: <><ListChecks className="h-3.5 w-3.5" /> Pasos</> }, { value: "note", label: <><FileText className="h-3.5 w-3.5" /> Nota</> }]} />
            </div>
            {draft.contentMode === "steps" ? <Field label="Pasos (uno por línea)"><Textarea disabled={!!pendingId} rows={5} value={draft.steps} onChange={(event) => setDraft({ ...draft, steps: event.target.value })} /></Field> : <Field label="Nota"><Textarea disabled={!!pendingId} rows={8} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></Field>}
          </div>
        )}
      </Modal>
    </div>
  );
}
