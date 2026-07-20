"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CalendarDays, Check, ChevronDown, Pencil, Pin, Plus, Repeat, Trash2, UserPlus, X } from "lucide-react";
import {
  Button,
  EmptyState,
  Field,
  IconGlyph,
  Input,
  Modal,
  PageHeader,
  Segmented,
  StatePill,
  WeekdayPicker,
  stateCursorProps,
  taskStateClass,
} from "@/components/ui";
import { Avatar, AvatarChip, AvatarStack, OwnerPicker } from "@/components/Avatar";
import { IconPicker } from "@/components/IconPicker";
import { WEEKDAYS, type DailyTask, type PostType, type TaskState } from "@/lib/data";
import {
  assignedUserForDate,
  taskIsPerDay,
  taskMineForDate,
  tasksVisibleToTeam,
} from "@/lib/daily-tasks";
import { useDailyTaskLogs, useDailyTasks, usePostTypes } from "@/lib/db";
import { useProfiles } from "@/lib/profiles";
import { useToday } from "@/lib/useToday";
import type { Role } from "@/lib/brand";

const NEXT: Record<TaskState, TaskState> = { todo: "doing", doing: "done", done: "todo" };
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type TaskDraft = {
  id: string;
  name: string;
  icon: string;
  mode: "fixed" | "perday" | "rotate";
  users: string[];
  days: number[];
  dayOwners: string[];
  postType: string;
};

const emptyTask = (): TaskDraft => ({
  id: "",
  name: "",
  icon: "✨",
  mode: "fixed",
  users: [],
  days: [],
  dayOwners: Array(7).fill(""),
  postType: "",
});

const activityInstant = (dateKey: string) => new Date(`${dateKey}T12:00:00.000Z`);
const hasConfiguredAssignment = (task: DailyTask) => taskIsPerDay(task)
  ? !!task.dayAssignees?.some((owner) => owner.trim())
  : !!task.rotation?.some((owner) => owner.trim()) || !!task.assignee?.trim();
const isRotation = (task: DailyTask) => !taskIsPerDay(task) && (task.rotation?.filter(Boolean).length ?? 0) > 1;
const isFixed = (task: DailyTask) => !taskIsPerDay(task) && !isRotation(task) && hasConfiguredAssignment(task);

function DayProgress({ done, total }: { done: number; total: number }) {
  const ratio = total ? done / total : 0;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const complete = total > 0 && done === total;
  return (
    <div className={`ring-glow glass flex items-center gap-3 rounded-2xl py-2.5 pl-3.5 pr-5 ${complete ? "glow-pulse" : ""}`}>
      <svg width="42" height="42" viewBox="0 0 42 42" className="-rotate-90" aria-hidden>
        <circle cx="21" cy="21" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
        <motion.circle
          cx="21"
          cy="21"
          r={radius}
          fill="none"
          stroke="#d6ab99"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: circumference * (1 - ratio) }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{ filter: "drop-shadow(0 0 6px rgba(214,171,153,0.65))" }}
        />
      </svg>
      <div>
        <p className="num font-display text-xl font-semibold leading-none text-white">
          {done}<span className="text-sm text-[var(--faint)]">/{total}</span>
        </p>
        <p className={`mt-1 text-[10px] ${complete ? "glow-text font-semibold" : "text-[var(--faint)]"}`}>
          {complete ? "¡Día completo!" : "listas hoy"}
        </p>
      </div>
    </div>
  );
}

function PostTypeChip({ postType }: { postType: PostType }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ background: `${postType.accent}14`, borderColor: `${postType.accent}40`, color: postType.accent }}
    >
      <span>{postType.icon}</span> {postType.name}
    </span>
  );
}

function PostTypePicker({ postTypes, value, onChange }: { postTypes: PostType[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange("")}
        className={`press flex min-h-10 items-center rounded-full border px-3.5 text-[11px] transition ${
          !value ? "border-white/30 bg-white/10 font-semibold text-white" : "border-white/10 text-[var(--muted)] hover:border-white/25 hover:text-white"
        }`}
      >
        Ninguno
      </button>
      {postTypes.map((postType) => (
        <button
          key={postType.id}
          type="button"
          onClick={() => onChange(value === postType.id ? "" : postType.id)}
          className={`press flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[11px] transition ${
            value === postType.id ? "font-semibold text-white" : "border-white/10 text-[var(--muted)] hover:border-white/25 hover:text-white"
          }`}
          style={value === postType.id ? { borderColor: `${postType.accent}80`, background: `${postType.accent}1f` } : undefined}
        >
          <span>{postType.icon}</span> {postType.name}
        </button>
      ))}
    </div>
  );
}

function TaskRow({
  task,
  state,
  index,
  me,
  date,
  postType,
  isAdmin,
  pending,
  onCycle,
  onEdit,
}: {
  task: DailyTask;
  state: TaskState;
  index: number;
  me: string;
  date: Date;
  postType?: PostType;
  isAdmin: boolean;
  pending: boolean;
  onCycle: () => void;
  onEdit: () => void;
}) {
  const perDay = taskIsPerDay(task);
  const rotating = isRotation(task);
  const owner = assignedUserForDate(task, date);
  if (!owner) return null;
  const done = state === "done";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: EASE, delay: index * 0.03 }}
      {...stateCursorProps(state)}
      className={`group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${taskStateClass(state)}`}
    >
      <button
        type="button"
        onClick={onCycle}
        disabled={pending}
        className="flex min-h-10 min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-wait disabled:opacity-70"
        aria-label={`Cambiar estado de ${task.name}`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${done ? "bg-emerald-500/15" : "bg-black/25"}`}>
          {done ? <Check className="h-5 w-5 text-emerald-400" strokeWidth={3} /> : <IconGlyph icon={task.icon} size={task.icon.startsWith("data:") || task.icon.startsWith("http") ? 40 : 22} rounded="rounded-xl" />}
        </span>
        <span className="min-w-0">
          <span className={`block truncate text-sm ${done ? "text-[var(--muted)] line-through" : "text-white"}`}>{task.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--faint)]">
            {perDay ? <CalendarDays className="h-3 w-3 text-nude" /> : rotating ? <Repeat className="h-3 w-3 text-nude" /> : <Pin className="h-3 w-3" />}
            {rotating && <AvatarStack usernames={task.rotation ?? []} size={15} />}
            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${owner === me ? "border-nude/50 bg-nude/15 text-nude" : "border-white/10 bg-white/5"}`}>
              <Avatar username={owner} size={12} /> {owner === me ? "te toca hoy" : <span className="capitalize">hoy: {owner}</span>}
            </span>
            {postType && <PostTypeChip postType={postType} />}
          </span>
        </span>
      </button>
      <StatePill state={state} pulse />
      {isAdmin && (
        <button type="button" onClick={onEdit} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[var(--faint)] transition hover:border-white/25 hover:text-white" aria-label={`Editar ${task.name}`}>
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
}

function ManagementRow({
  task,
  state,
  date,
  postType,
  unassigned,
  onAssign,
  onEdit,
  onRemove,
}: {
  task: DailyTask;
  state: TaskState;
  date: Date;
  postType?: PostType;
  unassigned: boolean;
  onAssign: () => void;
  onEdit: () => void;
  onRemove: () => Promise<void>;
}) {
  const [armed, setArmed] = useState(false);
  const owner = assignedUserForDate(task, date);
  const schedule = taskIsPerDay(task)
    ? (task.dayAssignees ?? []).map((username, day) => username ? `${WEEKDAYS[day]} ${username}` : null).filter(Boolean).join(" · ") || "Sin días asignados"
    : task.days?.length ? task.days.map((day) => WEEKDAYS[day]).join(" · ") : "Todos los días";
  return (
    <motion.div layout className="group flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 transition hover:border-white/15">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/25">
        <IconGlyph icon={task.icon} size={task.icon.startsWith("data:") || task.icon.startsWith("http") ? 40 : 22} rounded="rounded-xl" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white">{task.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--faint)]">
          <span className="num rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{schedule}</span>
          {owner ? <AvatarChip username={owner} size={14} /> : <span className="font-semibold text-amber-300">No se realiza hoy</span>}
          {postType && <PostTypeChip postType={postType} />}
          <StatePill state={state} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {unassigned && (
          <button type="button" onClick={onAssign} className="press flex h-10 items-center gap-1.5 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 text-[11px] font-semibold text-amber-200 transition hover:border-amber-300/60" aria-label={`Asignar ${task.name}`}>
            <UserPlus className="h-4 w-4" /> Asignar
          </button>
        )}
        <button type="button" onClick={onEdit} className="press flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-[var(--faint)] transition hover:border-white/25 hover:text-white" aria-label={`Editar ${task.name}`}>
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => armed ? void onRemove() : setArmed(true)}
          onBlur={() => setArmed(false)}
          className={`press flex h-10 items-center justify-center rounded-lg border text-[11px] font-semibold transition ${armed ? "border-red-400/60 bg-red-500/10 px-3 text-red-300" : "w-10 border-white/10 text-[var(--faint)] hover:border-red-400/40 hover:text-red-300"}`}
          aria-label={armed ? `Confirmar eliminación de ${task.name}` : `Eliminar ${task.name}`}
        >
          {armed ? "¿Seguro?" : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
    </motion.div>
  );
}

export default function TareasView({ role, username, userId }: { role: Role; username: string; userId: string }) {
  const taskCollection = useDailyTasks();
  const { items: tasks, addAsync, updateAsync, removeAsync } = taskCollection;
  const { items: postTypes } = usePostTypes();
  const { profiles } = useProfiles();
  const todayKey = useToday();
  const date = useMemo(() => activityInstant(todayKey), [todayKey]);
  const dailyLogs = useDailyTaskLogs(todayKey);
  const [tab, setTab] = useState<"mias" | "equipo">("mias");
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const isAdmin = role === "admin";
  const postTypeById = useMemo(() => new Map(postTypes.map((postType) => [postType.id, postType])), [postTypes]);

  const visibleToday = useMemo(() => tasksVisibleToTeam(tasks, date), [tasks, date]);
  const todayTasks = useMemo(
    () => tab === "mias" ? visibleToday.filter((task) => taskMineForDate(task, username, date)) : visibleToday,
    [date, tab, username, visibleToday],
  );
  const doneCount = todayTasks.filter((task) => dailyLogs.stateFor(task.id) === "done").length;
  const myTodayCount = visibleToday.filter((task) => taskMineForDate(task, username, date)).length;
  const dayName = new Date(`${todayKey}T12:00:00.000Z`).toLocaleDateString("es-PY", { weekday: "long", timeZone: "America/Asuncion" });

  const groups = useMemo(() => [
    { key: "unassigned", title: "Sin asignar", hint: "Estas tareas solo viven en gestión hasta que elijas un perfil.", items: tasks.filter((task) => !hasConfiguredAssignment(task)) },
    { key: "fixed", title: "Tareas fijas", hint: "Responsable estable.", items: tasks.filter(isFixed) },
    { key: "rotation", title: "Rotación", hint: "Compartidas por un grupo, con turno diario.", items: tasks.filter(isRotation) },
    { key: "perday", title: "Por día", hint: "Un responsable distinto según el día.", items: tasks.filter((task) => taskIsPerDay(task) && hasConfiguredAssignment(task)) },
  ], [tasks]);

  const openNew = () => {
    setLocalError(null);
    setConfirmDelete(false);
    setTaskDraft(emptyTask());
  };

  const editTask = (task: DailyTask) => {
    setLocalError(null);
    setConfirmDelete(false);
    setTaskDraft({
      id: task.id,
      name: task.name,
      icon: task.icon,
      mode: taskIsPerDay(task) ? "perday" : isRotation(task) ? "rotate" : "fixed",
      users: isRotation(task) ? task.rotation ?? [] : task.assignee ? [task.assignee] : [],
      days: task.days ?? [],
      dayOwners: Array.from({ length: 7 }, (_, day) => task.dayAssignees?.[day] ?? ""),
      postType: task.postType ?? "",
    });
  };

  const closeModal = () => {
    if (saving) return;
    setTaskDraft(null);
    setConfirmDelete(false);
    setLocalError(null);
  };

  async function saveTask() {
    if (!taskDraft?.name.trim() || saving) return;
    if (taskDraft.mode === "rotate" && taskDraft.users.length < 2) {
      setLocalError("Elegí al menos dos perfiles para una rotación.");
      return;
    }
    setSaving(true);
    setLocalError(null);
    taskCollection.clearError();
    const perDay = taskDraft.mode === "perday";
    const rotation = taskDraft.mode === "rotate" ? taskDraft.users : undefined;
    const assignee = taskDraft.mode === "fixed" ? taskDraft.users[0] ?? null : null;
    const item: DailyTask = {
      id: taskDraft.id || `n${Date.now()}`,
      name: taskDraft.name.trim(),
      icon: taskDraft.icon || "✨",
      assignee,
      rotation,
      days: !perDay && taskDraft.days.length && taskDraft.days.length < 7 ? taskDraft.days : undefined,
      dayAssignees: perDay ? [...taskDraft.dayOwners] : undefined,
      postType: taskDraft.postType || undefined,
    };
    const result = taskDraft.id ? await updateAsync(taskDraft.id, item) : await addAsync(item);
    setSaving(false);
    if (!result.ok) {
      setLocalError(result.error);
      return;
    }
    setTaskDraft(null);
  }

  async function deleteDraft() {
    if (!taskDraft?.id || saving) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    const result = await removeAsync(taskDraft.id);
    setSaving(false);
    if (!result.ok) {
      setLocalError(result.error);
      return;
    }
    setTaskDraft(null);
  }

  const cycle = (task: DailyTask) => void dailyLogs.transition(task, NEXT[dailyLogs.stateFor(task.id)], userId);
  const visibleError = localError ?? dailyLogs.error ?? taskCollection.error;

  return (
    <div>
      <PageHeader
        eyebrow="Rutina diaria"
        title="Tareas Diarias"
        description="Cada estado pertenece al día actual de Paraguay. Las tareas sin responsable quedan en gestión hasta que decidas quién debe verlas."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <DayProgress done={doneCount} total={todayTasks.length} />
            {isAdmin && <Button onClick={openNew}><Plus className="h-4 w-4" /> Nueva tarea</Button>}
          </div>
        }
      />

      {visibleError && (
        <div role="alert" className="mb-5 flex items-center gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{visibleError}</span>
          <button type="button" onClick={() => { setLocalError(null); dailyLogs.clearError(); taskCollection.clearError(); }} aria-label="Cerrar error" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
      )}

      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-6"
        options={[
          { value: "mias", label: "Mis tareas", badge: myTodayCount },
          { value: "equipo", label: "Equipo", badge: visibleToday.length },
        ]}
      />

      <section>
        <p className="eyebrow mb-3">Hoy · <span className="glow-text">{dayName}</span></p>
        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {todayTasks.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                state={dailyLogs.stateFor(task.id)}
                index={index}
                me={username}
                date={date}
                postType={task.postType ? postTypeById.get(task.postType) : undefined}
                isAdmin={isAdmin}
                pending={dailyLogs.isPending?.(task.id) ?? false}
                onCycle={() => cycle(task)}
                onEdit={() => editTask(task)}
              />
            ))}
          </AnimatePresence>
        </div>
        {!todayTasks.length && !dailyLogs.loading && (
          <EmptyState
            icon="🌸"
            title={tab === "mias" ? "No tenés tareas para hoy" : "Sin tareas asignadas para hoy"}
            hint={tab === "mias" ? "Nada asignado a tu perfil hoy." : "Las definiciones sin responsable permanecen en Gestión de tareas diarias."}
            action={isAdmin ? <Button variant="subtle" onClick={openNew}><Plus className="h-4 w-4" /> Nueva tarea</Button> : undefined}
          />
        )}
      </section>

      {isAdmin && (
        <section className="mt-10">
          <button type="button" onClick={() => setShowManage((value) => !value)} aria-expanded={showManage} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-1 text-left transition hover:opacity-90">
            <ChevronDown className={`h-4 w-4 text-[var(--faint)] transition-transform ${showManage ? "" : "-rotate-90"}`} />
            <span className="eyebrow">Gestión de tareas diarias</span>
            <span className="num rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-[var(--faint)]">{tasks.length}</span>
            <span className="h-px flex-1 bg-white/5" />
          </button>
          <AnimatePresence>
            {showManage && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="mt-3 space-y-5">
                {groups.map((group) => (
                  <section key={group.key} data-testid="daily-management-group" aria-label={group.title} className={`rounded-2xl border p-4 ${group.key === "unassigned" ? "border-amber-300/25 bg-amber-300/[0.04]" : "border-white/[0.07] bg-white/[0.015]"}`}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div><h2 className={`text-sm font-semibold ${group.key === "unassigned" ? "text-amber-200" : "text-white"}`}>{group.title}</h2><p className="mt-0.5 text-[11px] text-[var(--faint)]">{group.hint}</p></div>
                      <span className="num rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-[var(--faint)]">{group.items.length}</span>
                    </div>
                    {group.items.length ? (
                      <div className="space-y-2">
                        {group.items.map((task) => (
                          <ManagementRow
                            key={task.id}
                            task={task}
                            state={dailyLogs.stateFor(task.id)}
                            date={date}
                            postType={task.postType ? postTypeById.get(task.postType) : undefined}
                            unassigned={group.key === "unassigned"}
                            onAssign={() => editTask(task)}
                            onEdit={() => editTask(task)}
                            onRemove={async () => {
                              const result = await removeAsync(task.id);
                              if (!result.ok) setLocalError(result.error);
                            }}
                          />
                        ))}
                      </div>
                    ) : <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-[var(--faint)]">No hay tareas en este grupo.</p>}
                  </section>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      <Modal
        open={!!taskDraft}
        onClose={closeModal}
        title={taskDraft?.id ? "Editar tarea" : "Nueva tarea diaria"}
        description="Podés dejarla sin asignar y decidir el responsable más adelante."
        footer={
          <>
            {taskDraft?.id && <Button variant="ghost" onClick={() => void deleteDraft()} disabled={saving} className={`mr-auto ${confirmDelete ? "!border-red-400/60 !text-red-300" : "!text-red-300/70"}`}><Trash2 className="h-4 w-4" /> {confirmDelete ? "¿Seguro? Sí, eliminar" : "Eliminar"}</Button>}
            <Button variant="ghost" onClick={closeModal} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void saveTask()} disabled={!taskDraft?.name.trim() || saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </>
        }
      >
        {taskDraft && (
          <div className="space-y-5">
            {localError && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{localError}</p>}
            <div className="flex items-end gap-3">
              <div><span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Ícono</span><IconPicker value={taskDraft.icon} onChange={(icon) => setTaskDraft({ ...taskDraft, icon })} size={44} /></div>
              <div className="flex-1"><Field label="Nombre"><Input value={taskDraft.name} onChange={(event) => setTaskDraft({ ...taskDraft, name: event.target.value })} placeholder="Ej: Subir Reel del día" autoFocus /></Field></div>
            </div>

            {taskDraft.mode !== "perday" && <div><span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Días de la semana</span><WeekdayPicker value={taskDraft.days} onChange={(days) => setTaskDraft({ ...taskDraft, days })} /></div>}

            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Asignación</span>
              <Segmented value={taskDraft.mode} onChange={(mode) => setTaskDraft({ ...taskDraft, mode, users: mode === "fixed" ? taskDraft.users.slice(0, 1) : taskDraft.users })} options={[
                { value: "fixed", label: <span className="flex items-center gap-1.5"><Pin className="h-3.5 w-3.5" /> Fija</span> },
                { value: "perday", label: <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Por día</span> },
                { value: "rotate", label: <span className="flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5" /> Rota</span> },
              ]} />
            </div>

            {taskDraft.mode === "fixed" ? (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Perfil asignado</span>
                <button type="button" aria-pressed={!taskDraft.users[0]} onClick={() => setTaskDraft({ ...taskDraft, users: [] })} className={`press mb-2 flex min-h-10 items-center rounded-xl border px-3 text-sm transition ${!taskDraft.users[0] ? "border-amber-300/50 bg-amber-300/10 font-semibold text-amber-200" : "border-white/10 text-[var(--muted)]"}`}>Sin asignar</button>
                <OwnerPicker value={taskDraft.users[0] ?? ""} onChange={(owner) => setTaskDraft({ ...taskDraft, users: [owner] })} />
              </div>
            ) : taskDraft.mode === "perday" ? (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Perfil por día <span className="font-normal text-[var(--faint)]">— un día vacío no hereda otro responsable</span></span>
                <div className="space-y-2">
                  {WEEKDAYS.map((weekday, day) => (
                    <div key={weekday} className="flex min-h-10 flex-wrap items-center gap-2">
                      <span className="num w-9 shrink-0 text-[11px] font-bold text-[var(--faint)]">{weekday}</span>
                      <button type="button" onClick={() => { const dayOwners = [...taskDraft.dayOwners]; dayOwners[day] = ""; setTaskDraft({ ...taskDraft, dayOwners }); }} className={`press h-9 rounded-full border px-3 text-[11px] ${!taskDraft.dayOwners[day] ? "border-amber-300/40 bg-amber-300/10 text-amber-200" : "border-white/10 text-[var(--faint)]"}`}>Sin asignar</button>
                      {profiles.map((profile) => (
                        <button key={profile.username} type="button" onClick={() => { const dayOwners = [...taskDraft.dayOwners]; dayOwners[day] = profile.username; setTaskDraft({ ...taskDraft, dayOwners }); }} className={`press flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[11px] capitalize ${taskDraft.dayOwners[day] === profile.username ? "border-nude/60 bg-nude/15 text-white" : "border-white/10 text-[var(--muted)]"}`}><Avatar username={profile.username} size={18} /> {profile.username}</button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Rota entre perfiles</span>
                <div className="flex flex-wrap gap-2">{profiles.map((profile) => { const selected = taskDraft.users.includes(profile.username); return <button key={profile.username} type="button" onClick={() => setTaskDraft({ ...taskDraft, users: selected ? taskDraft.users.filter((owner) => owner !== profile.username) : [...taskDraft.users, profile.username] })} className={`press flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs capitalize ${selected ? "border-nude/60 bg-nude/15 text-white" : "border-white/10 text-[var(--muted)]"}`}><Avatar username={profile.username} size={20} /> {profile.username}</button>; })}</div>
                {taskDraft.users.length < 2 && <p className="mt-2 text-[11px] text-amber-300">Elegí al menos dos perfiles.</p>}
              </div>
            )}

            <div><span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Tipo de publicación <span className="font-normal text-[var(--faint)]">(opcional)</span></span><PostTypePicker postTypes={postTypes} value={taskDraft.postType} onChange={(postType) => setTaskDraft({ ...taskDraft, postType })} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
