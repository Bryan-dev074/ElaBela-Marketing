"use client";

import { Fragment, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Clock, Pencil, Pin, Plus, Repeat, Settings2, Trash2 } from "lucide-react";
import {
  PageHeader,
  Card,
  Reveal,
  StatePill,
  taskStateClass,
  stateCursorProps,
  Segmented,
  WeekdayPicker,
  EmptyState,
  Button,
  Modal,
  Field,
  Input,
  IconGlyph,
} from "@/components/ui";
import { IconPicker } from "@/components/IconPicker";
import { TimeListEditor } from "@/components/TimePicker";
import { Avatar, AvatarChip, AvatarStack, OwnerPicker } from "@/components/Avatar";
import { WEEKDAYS, taskAppliesToday, taskAssigneeToday, taskBelongsTo, type DailyTask, type TaskState, type StoryPlatform } from "@/lib/data";
import { useDailyTasks, useStoryConfig } from "@/lib/db";
import { useProfiles } from "@/lib/profiles";
import type { Role } from "@/lib/brand";

const NEXT: Record<TaskState, TaskState> = { todo: "doing", doing: "done", done: "todo" };
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Una imagen/GIF llena el tile; un emoji conserva su tamaño de texto anterior. */
const isImgIcon = (icon: string) => icon.startsWith("data:") || icon.startsWith("http");

type TaskDraft = { id: string; name: string; icon: string; mode: "fixed" | "rotate"; users: string[]; days: number[] };
const emptyTask = (): TaskDraft => ({ id: "", name: "", icon: "✨", mode: "fixed", users: ["cielo"], days: [] });

/* ---------------- Day progress ring (header) ---------------- */

function DayProgress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? done / total : 0;
  const R = 16;
  const C = 2 * Math.PI * R;
  const complete = total > 0 && done >= total;
  return (
    <div className={`ring-glow glass flex items-center gap-3 rounded-2xl py-2.5 pl-3.5 pr-5 ${complete ? "glow-pulse" : ""}`}>
      <svg width="42" height="42" viewBox="0 0 42 42" className="-rotate-90" aria-hidden>
        <circle cx="21" cy="21" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
        <motion.circle
          cx="21"
          cy="21"
          r={R}
          fill="none"
          stroke="#d6ab99"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{ filter: "drop-shadow(0 0 6px rgba(214,171,153,0.65))" }}
        />
      </svg>
      <div>
        <p className="num font-display text-xl font-semibold leading-none text-white">
          {done}
          <span className="text-sm text-[var(--faint)]">/{total}</span>
        </p>
        <p className={`mt-1 text-[10px] ${complete ? "glow-text font-semibold" : "text-[var(--faint)]"}`}>
          {complete ? "¡Día completo!" : "listas hoy"}
        </p>
      </div>
    </div>
  );
}

/* ---------------- Profile chip (avatar toggle) ---------------- */

function ProfileChip({ username, on, onClick }: { username: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press flex min-h-9 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-xs capitalize transition ${
        on
          ? "border-nude/60 bg-nude/15 text-white shadow-[0_0_16px_-6px_rgba(214,171,153,0.7)]"
          : "border-white/10 text-[var(--muted)] hover:border-white/25 hover:text-white"
      }`}
    >
      <Avatar username={username} size={22} /> {username}
    </button>
  );
}

/* ---------------- Task rows ---------------- */

function TaskRow({ t, i, isAdmin, me, onCycle, onEdit }: { t: DailyTask; i: number; isAdmin: boolean; me: string; onCycle: () => void; onEdit: () => void }) {
  const rotates = !!t.rotation && t.rotation.length > 1;
  const hasDays = !!t.days && t.days.length > 0 && t.days.length < 7;
  const done = t.state === "done";
  const assigneeToday = taskAssigneeToday(t);
  const myTurn = assigneeToday === me;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15, delay: 0 } }}
      transition={{ duration: 0.32, ease: EASE, delay: i * 0.03 }}
      {...stateCursorProps(t.state)}
      className={`group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors duration-150 ${taskStateClass(t.state)}`}
    >
      <button type="button" onClick={onCycle} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Cambiar estado de ${t.name}`}>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition-all duration-300 ${
            done ? "bg-emerald-500/15 shadow-[0_0_18px_-4px_rgba(52,211,153,0.55)]" : "bg-black/25"
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.span
                key="check"
                initial={{ scale: 0, rotate: -120 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90, opacity: 0 }}
                transition={{ type: "spring", stiffness: 480, damping: 24 }}
                className="flex"
              >
                <Check className="h-5 w-5 text-emerald-400" strokeWidth={3} />
              </motion.span>
            ) : (
              <motion.span
                key="icon"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="flex"
              >
                <IconGlyph icon={t.icon} size={isImgIcon(t.icon) ? 40 : 22} rounded="rounded-xl" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span className="min-w-0">
          <span className={`block truncate text-sm transition-colors ${done ? "text-[var(--muted)] line-through" : "text-white"}`}>{t.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--faint)]">
            {rotates ? (
              <>
                <Repeat className="h-3 w-3 text-nude" />
                <AvatarStack usernames={t.rotation!} size={16} />
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                    myTurn
                      ? "border-nude/50 bg-nude/15 text-nude shadow-[0_0_12px_-4px_rgba(214,171,153,0.7)]"
                      : "border-white/10 bg-white/5 text-[var(--muted)]"
                  }`}
                  title={myTurn ? "Hoy es tu turno; si no podés, la puede cubrir cualquiera del grupo" : `Hoy le toca a ${assigneeToday}; podés cubrirla si hace falta`}
                >
                  <Avatar username={assigneeToday} size={12} />
                  {myTurn ? "te toca hoy" : <>hoy: <span className="capitalize">{assigneeToday}</span></>}
                </span>
              </>
            ) : (
              <>
                <Pin className="h-3 w-3" />
                <AvatarChip username={assigneeToday} size={16} />
              </>
            )}
            {hasDays && (
              <>
                <span className="text-white/15">·</span>
                <span className="num">{t.days!.map((d) => WEEKDAYS[d]).join(" · ")}</span>
              </>
            )}
          </span>
        </span>
      </button>
      <StatePill state={t.state} pulse />
      {isAdmin && (
        <button
          type="button"
          onClick={onEdit}
          data-cursor-label="Editar"
          className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[var(--faint)] opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100 hover:border-white/25 hover:text-white"
          aria-label={`Editar ${t.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}

function OtherDayRow({ t, isAdmin, onEdit }: { t: DailyTask; isAdmin: boolean; onEdit: () => void }) {
  const rotates = !!t.rotation && t.rotation.length > 1;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
      transition={{ duration: 0.22, ease: EASE }}
      className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 opacity-55 transition-opacity hover:opacity-90"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/25 text-base saturate-50">
          <IconGlyph icon={t.icon} size={isImgIcon(t.icon) ? 36 : 20} rounded="rounded-xl" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-[var(--muted)]">{t.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {(t.days ?? []).map((d) => (
              <span key={d} className="rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-[9px] font-medium text-[var(--faint)]">
                {WEEKDAYS[d]}
              </span>
            ))}
          </div>
        </div>
      </div>
      {rotates ? <AvatarStack usernames={t.rotation!} size={18} /> : <Avatar username={t.assignee} size={18} />}
      {isAdmin && (
        <button
          type="button"
          onClick={onEdit}
          data-cursor-label="Editar"
          className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[var(--faint)] opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100 hover:border-white/25 hover:text-white"
          aria-label={`Editar ${t.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}

/* ---------------- View ---------------- */

export default function TareasView({ role, username }: { role: Role; username: string }) {
  const { items: tasks, add: addTask, update: updateTask, remove: removeTask } = useDailyTasks();
  const { items: stories, update: updateStory } = useStoryConfig();
  const { profiles } = useProfiles();
  const [tab, setTab] = useState<"mias" | "equipo">("mias");
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const [cfg, setCfg] = useState<StoryPlatform | null>(null);
  const isAdmin = role === "admin";

  // «Mis tareas» incluye toda rotación donde participo (cualquiera del grupo puede cubrirla).
  const inTab = useMemo(() => (tab === "mias" ? tasks.filter((t) => taskBelongsTo(t, username)) : tasks), [tasks, tab, username]);
  const todayTasks = useMemo(() => inTab.filter(taskAppliesToday), [inTab]);
  const otherTasks = useMemo(() => inTab.filter((t) => !taskAppliesToday(t)), [inTab]);
  const doneCount = todayTasks.filter((t) => t.state === "done").length;
  const myTodayCount = useMemo(() => tasks.filter((t) => taskBelongsTo(t, username) && taskAppliesToday(t)).length, [tasks, username]);
  const teamTodayCount = useMemo(() => tasks.filter(taskAppliesToday).length, [tasks]);
  const dayName = new Date().toLocaleDateString("es-PY", { weekday: "long" });

  const cycle = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (t) updateTask(id, { state: NEXT[t.state] });
  };

  const openNew = () => {
    setConfirmDelete(false);
    setTaskDraft(emptyTask());
  };
  const editTask = (t: DailyTask) => {
    setConfirmDelete(false);
    setTaskDraft({
      id: t.id,
      name: t.name,
      icon: t.icon,
      mode: t.rotation && t.rotation.length > 1 ? "rotate" : "fixed",
      users: t.rotation && t.rotation.length > 1 ? t.rotation : [t.assignee],
      days: t.days ?? [],
    });
  };
  const closeTaskModal = () => {
    setTaskDraft(null);
    setConfirmDelete(false);
  };

  function saveTask() {
    if (!taskDraft || !taskDraft.name.trim()) return;
    const rotation = taskDraft.mode === "rotate" && taskDraft.users.length > 1 ? taskDraft.users : undefined;
    const assignee = taskDraft.users[0] ?? "cielo";
    const days = taskDraft.days.length > 0 && taskDraft.days.length < 7 ? taskDraft.days : undefined;
    if (taskDraft.id) {
      updateTask(taskDraft.id, { name: taskDraft.name.trim(), icon: taskDraft.icon, assignee, rotation, days });
    } else {
      addTask({ id: "n" + Date.now(), name: taskDraft.name.trim(), icon: taskDraft.icon || "✨", assignee, state: "todo", rotation, days });
    }
    closeTaskModal();
  }

  function deleteTask() {
    if (!taskDraft?.id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    removeTask(taskDraft.id);
    closeTaskModal();
  }

  function saveCfg() {
    if (!cfg) return;
    const max = Math.max(1, cfg.max);
    const min = Math.max(0, Math.min(cfg.min, max));
    updateStory(cfg.platform, { ...cfg, max, min, done: Math.min(cfg.done, max) });
    setCfg(null);
  }
  const bumpStory = (platform: string, d: number) => {
    const s = stories.find((x) => x.platform === platform);
    if (s) updateStory(platform, { done: Math.max(0, Math.min(s.max, s.done + d)) });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Rutina diaria"
        title="Tareas Diarias"
        description="Tocá una tarea para cambiar su estado al instante. Cada tarea puede ser fija de un perfil o rotar entre varios, y aplicar solo ciertos días de la semana."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <DayProgress done={doneCount} total={todayTasks.length} />
            {isAdmin && (
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> Nueva tarea
              </Button>
            )}
          </div>
        }
      />

      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-6"
        options={[
          { value: "mias", label: "Mis tareas", badge: myTodayCount },
          { value: "equipo", label: "Equipo", badge: teamTodayCount },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* -------- Task list -------- */}
        <div className="lg:col-span-2">
          <p className="eyebrow mb-3">
            Hoy · <span className="glow-text">{dayName}</span>
          </p>

          <div className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {todayTasks.map((t, i) => (
                <TaskRow key={t.id} t={t} i={i} isAdmin={isAdmin} me={username} onCycle={() => cycle(t.id)} onEdit={() => editTask(t)} />
              ))}
            </AnimatePresence>
          </div>

          {todayTasks.length === 0 && (
            <EmptyState
              icon="🌸"
              title={tab === "mias" ? "No tenés tareas para hoy" : "Sin tareas para hoy"}
              hint={
                tab === "mias"
                  ? "Nada asignado a tu perfil hoy. Aprovechá para adelantar contenido."
                  : "Creá la primera tarea diaria del equipo."
              }
              action={
                isAdmin ? (
                  <Button variant="subtle" onClick={openNew}>
                    <Plus className="h-4 w-4" /> Nueva tarea
                  </Button>
                ) : undefined
              }
            />
          )}

          {/* -------- Other days (collapsible) -------- */}
          {otherTasks.length > 0 && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowOthers((v) => !v)}
                aria-expanded={showOthers}
                className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-xs text-[var(--faint)] transition hover:text-white"
                data-cursor-label={showOthers ? "Colapsar" : "Expandir"}
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showOthers ? "" : "-rotate-90"}`} />
                Otros días
                <span className="num rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-[10px]">{otherTasks.length}</span>
                <span className="h-px flex-1 bg-white/5" />
              </button>
              <AnimatePresence initial={false}>
                {showOthers && (
                  <motion.div
                    key="others"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: EASE }}
                  >
                    <div className="space-y-2 pt-1.5">
                      <AnimatePresence mode="popLayout">
                        {otherTasks.map((t) => (
                          <OtherDayRow key={t.id} t={t} isAdmin={isAdmin} onEdit={() => editTask(t)} />
                        ))}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* -------- Stories per platform -------- */}
        <div>
          <p className="eyebrow mb-3">
            <span className="glow-text">Historias de hoy</span>
          </p>
          <div className="space-y-4">
            {stories.map((s, i) => {
              const ok = s.done >= s.min;
              return (
                <Reveal key={s.platform} delay={i * 0.06}>
                  <Card className="card-sheen p-5" hover={false}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{s.icon}</span>
                        <h2 className="text-sm font-semibold text-white">Historias · {s.platform}</h2>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setCfg({ ...s })}
                          data-cursor-label="Configurar"
                          className="press flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[var(--faint)] transition hover:border-white/25 hover:text-white"
                          aria-label={`Configurar historias de ${s.platform}`}
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Segmented progress bar with glow + clear min marker */}
                    <div className="mb-2 mt-6 flex items-center gap-1.5">
                      {Array.from({ length: s.max }).map((_, j) => (
                        <Fragment key={j}>
                          <div
                            className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                              j < s.done ? "bg-nude shadow-[0_0_10px_rgba(214,171,153,0.55)]" : "bg-white/10"
                            }`}
                          />
                          {j + 1 === s.min && s.min < s.max && (
                            <span className="relative -mx-0.5 h-4 w-0.5 shrink-0 rounded-full bg-nude/50">
                              <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-wider text-nude">
                                mín
                              </span>
                            </span>
                          )}
                        </Fragment>
                      ))}
                    </div>

                    <div className="mb-3 flex items-baseline justify-between">
                      <span className="num font-display text-2xl font-semibold text-white">
                        {s.done}
                        <span className="text-sm text-[var(--faint)]">/{s.max}</span>
                      </span>
                      <span className={`text-[11px] font-medium ${ok ? "text-emerald-300" : "text-amber-300"}`}>
                        {ok ? "Mínimo cumplido ✓" : `Faltan ${s.min - s.done}`}
                      </span>
                    </div>

                    <div className="mb-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => bumpStory(s.platform, -1)}
                        disabled={s.done <= 0}
                        className="press flex-1 rounded-lg border border-white/10 py-1.5 text-sm text-[var(--muted)] transition hover:text-white disabled:opacity-40"
                        aria-label={`Restar una historia de ${s.platform}`}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => bumpStory(s.platform, 1)}
                        disabled={s.done >= s.max}
                        className="press flex-[2] rounded-lg bg-white/10 py-1.5 text-sm text-white transition hover:bg-white/15 disabled:opacity-40"
                        data-cursor-label="+1 historia"
                      >
                        + Subir
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--faint)]">
                      <Clock className="h-3 w-3" />
                      {s.schedules.length > 0 ? (
                        s.schedules.map((h) => (
                          <span key={h} className="num rounded-full border border-white/10 bg-white/5 px-1.5 py-px">
                            {h}
                          </span>
                        ))
                      ) : (
                        <span>Sin horarios</span>
                      )}
                      <span className="text-white/15">·</span>
                      <AvatarChip username={s.assignee} size={16} />
                    </div>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>

      {/* -------- New / edit task -------- */}
      <Modal
        open={!!taskDraft}
        onClose={closeTaskModal}
        title={taskDraft?.id ? "Editar tarea" : "Nueva tarea diaria"}
        description="Elegí ícono, días de la semana y si es fija de un perfil o rota entre varios."
        footer={
          <>
            {taskDraft?.id && (
              <Button
                variant="ghost"
                onClick={deleteTask}
                data-cursor-color="#f87171"
                data-cursor-label="Eliminar"
                className={`mr-auto ${
                  confirmDelete
                    ? "!border-red-400/60 bg-red-500/10 !text-red-300"
                    : "!text-red-300/70 hover:!border-red-400/40 hover:!text-red-300"
                }`}
              >
                <Trash2 className="h-4 w-4" /> {confirmDelete ? "¿Seguro? Sí, eliminar" : "Eliminar"}
              </Button>
            )}
            <Button variant="ghost" onClick={closeTaskModal}>
              Cancelar
            </Button>
            <Button onClick={saveTask} disabled={!taskDraft?.name.trim()}>
              Guardar
            </Button>
          </>
        }
      >
        {taskDraft && (
          <div className="space-y-5">
            <div className="flex items-end gap-3">
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Ícono</span>
                <IconPicker value={taskDraft.icon} onChange={(icon) => setTaskDraft({ ...taskDraft, icon })} size={44} />
              </div>
              <div className="flex-1">
                <Field label="Nombre">
                  <Input
                    value={taskDraft.name}
                    onChange={(e) => setTaskDraft({ ...taskDraft, name: e.target.value })}
                    placeholder="Ej: Subir Reel del día"
                    autoFocus
                  />
                </Field>
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Días de la semana</span>
              <WeekdayPicker value={taskDraft.days} onChange={(days) => setTaskDraft({ ...taskDraft, days })} />
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Asignación</span>
              <Segmented
                value={taskDraft.mode}
                onChange={(mode) =>
                  setTaskDraft(
                    mode === "fixed"
                      ? { ...taskDraft, mode, users: [taskDraft.users[0] ?? "cielo"] }
                      : {
                          ...taskDraft,
                          mode,
                          users: taskDraft.users.length > 1 ? taskDraft.users : profiles.slice(0, 2).map((p) => p.username),
                        },
                  )
                }
                options={[
                  {
                    value: "fixed",
                    label: (
                      <span className="flex items-center gap-1.5">
                        <Pin className="h-3.5 w-3.5" /> Fija
                      </span>
                    ),
                  },
                  {
                    value: "rotate",
                    label: (
                      <span className="flex items-center gap-1.5">
                        <Repeat className="h-3.5 w-3.5" /> Rota
                      </span>
                    ),
                  },
                ]}
              />
            </div>

            {taskDraft.mode === "fixed" ? (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Perfil asignado</span>
                <OwnerPicker value={taskDraft.users[0] ?? ""} onChange={(u) => setTaskDraft({ ...taskDraft, users: [u] })} />
              </div>
            ) : (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Rota entre (en orden)</span>
                <div className="flex flex-wrap gap-2">
                  {profiles.map((p) => {
                    const on = taskDraft.users.includes(p.username);
                    return (
                      <ProfileChip
                        key={p.username}
                        username={p.username}
                        on={on}
                        onClick={() =>
                          setTaskDraft({
                            ...taskDraft,
                            users: on ? taskDraft.users.filter((u) => u !== p.username) : [...taskDraft.users, p.username],
                          })
                        }
                      />
                    );
                  })}
                </div>
                {taskDraft.users.length > 1 && (
                  <p className="mt-2.5 flex items-center gap-2 text-[11px] text-[var(--faint)]">
                    <AvatarStack usernames={taskDraft.users} size={16} />
                    <span>
                      Secuencia: <span className="capitalize text-[var(--muted)]">{taskDraft.users.join(" → ")}</span> → (repite)
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* -------- Story config (admin) -------- */}
      <Modal
        open={!!cfg}
        onClose={() => setCfg(null)}
        title={cfg ? `Configurar historias · ${cfg.platform}` : ""}
        description="Definí mínimo, máximo, horarios y quién sube hoy."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCfg(null)}>
              Cancelar
            </Button>
            <Button onClick={saveCfg}>Guardar</Button>
          </>
        }
      >
        {cfg && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mínimo">
                <Input type="number" min={0} value={cfg.min} onChange={(e) => setCfg({ ...cfg, min: Math.max(0, Number(e.target.value)) })} />
              </Field>
              <Field label="Máximo">
                <Input type="number" min={1} value={cfg.max} onChange={(e) => setCfg({ ...cfg, max: Math.max(1, Number(e.target.value)) })} />
              </Field>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Horarios sugeridos</span>
              <TimeListEditor times={cfg.schedules} onChange={(t) => setCfg({ ...cfg, schedules: t })} />
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Responsable de hoy</span>
              <OwnerPicker value={cfg.assignee} onChange={(u) => setCfg({ ...cfg, assignee: u })} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
