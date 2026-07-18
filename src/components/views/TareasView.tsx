"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Check, ChevronDown, Pencil, Pin, Plus, Repeat, Trash2 } from "lucide-react";
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
import { Avatar, AvatarChip, AvatarStack, OwnerPicker } from "@/components/Avatar";
import {
  WEEKDAYS, fmtShortDate, taskAppliesToday, taskAssigneeToday, taskBelongsTo, taskIsPerDay, taskMineToday,
  todayIso, todayWeekday,
  type DailyTask, type PostType, type TaskState, type WeeklyTask,
} from "@/lib/data";
import { useDailyTasks, usePostTypes, useWeeklyTasks } from "@/lib/db";
import { useProfiles } from "@/lib/profiles";
import { useToday } from "@/lib/useToday";
import type { Role } from "@/lib/brand";

const NEXT: Record<TaskState, TaskState> = { todo: "doing", doing: "done", done: "todo" };
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Una imagen/GIF llena el tile; un emoji conserva su tamaño de texto anterior. */
const isImgIcon = (icon: string) => icon.startsWith("data:") || icon.startsWith("http");

type TaskDraft = {
  id: string; name: string; icon: string;
  mode: "fixed" | "perday" | "rotate";
  users: string[]; days: number[];
  /** Modo «Por día»: dueño por día de la semana (7 posiciones, "" = no se hace). */
  dayOwners: string[];
  /** Id del tipo de post ("" = ninguno). */
  postType: string;
};
const emptyTask = (): TaskDraft => ({ id: "", name: "", icon: "✨", mode: "fixed", users: ["cielo"], days: [], dayOwners: Array(7).fill(""), postType: "" });

type WeeklyDraft = { id: string; name: string; icon: string; assignee: string; postType: string };
const emptyWeekly = (): WeeklyDraft => ({ id: "", name: "", icon: "🗓️", assignee: "cielo", postType: "" });

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

/* ---------------- Tipo de post: chip mini + selector de chips ---------------- */

function PostTypeChip({ pt }: { pt: PostType }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ background: `${pt.accent}14`, borderColor: `${pt.accent}40`, color: pt.accent }}
      title={pt.desc}
    >
      <span>{pt.icon}</span> {pt.name}
    </span>
  );
}

function PostTypePicker({ postTypes, value, onChange }: { postTypes: PostType[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange("")}
        className={`press flex min-h-9 items-center rounded-full border px-3.5 text-[11px] transition ${
          value === "" ? "border-white/30 bg-white/10 font-semibold text-white" : "border-white/10 text-[var(--muted)] hover:border-white/25 hover:text-white"
        }`}
      >
        Ninguno
      </button>
      {postTypes.map((p) => {
        const on = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(on ? "" : p.id)}
            data-cursor-color={p.accent}
            data-cursor-label={p.name}
            className={`press flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[11px] transition ${
              on ? "font-semibold text-white" : "border-white/10 text-[var(--muted)] hover:border-white/25 hover:text-white"
            }`}
            style={on ? { borderColor: `${p.accent}80`, background: `${p.accent}1f`, boxShadow: `0 0 16px -6px ${p.accent}` } : undefined}
          >
            <span>{p.icon}</span> {p.name}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Weekly task row (columna derecha) ---------------- */

function WeeklyRow({
  w, i, pt, isAdmin, onCycle, onEdit, onRemove,
}: {
  w: WeeklyTask; i: number; pt?: PostType; isAdmin: boolean; onCycle: () => void; onEdit: () => void; onRemove: () => void;
}) {
  const [armDelete, setArmDelete] = useState(false);
  const done = w.state === "done";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
      transition={{ duration: 0.28, ease: EASE, delay: i * 0.03 }}
      onMouseLeave={() => setArmDelete(false)}
      {...stateCursorProps(w.state)}
      className={`group rounded-xl border px-3.5 py-3 transition-colors duration-150 ${taskStateClass(w.state)}`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base transition-colors ${
            done ? "bg-emerald-500/15 shadow-[0_0_16px_-5px_rgba(52,211,153,0.5)]" : "bg-black/25"
          }`}
        >
          <IconGlyph icon={w.icon} size={isImgIcon(w.icon) ? 36 : 20} rounded="rounded-xl" />
        </span>
        <p className={`min-w-0 flex-1 truncate text-sm transition-colors ${done ? "text-[var(--muted)] line-through" : "text-white"}`}>{w.name}</p>
        <button type="button" onClick={onCycle} className="press shrink-0" data-cursor-label="Cambiar estado" aria-label={`Cambiar estado de ${w.name}`}>
          <StatePill state={w.state} pulse />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[46px] text-[11px] text-[var(--faint)]">
        <AvatarChip username={w.assignee} size={16} />
        {w.date ? (
          <span className="num inline-flex items-center gap-1 rounded-full border border-nude/40 bg-nude/10 px-1.5 py-0.5 text-[10px] font-semibold text-nude">
            <CalendarDays className="h-3 w-3" /> {fmtShortDate(w.date)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-[var(--faint)] opacity-60">
            <CalendarDays className="h-3 w-3" /> sin agendar
          </span>
        )}
        {pt && <PostTypeChip pt={pt} />}
        {isAdmin && (
          <span className="ml-auto flex items-center gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              onClick={onEdit}
              data-cursor-label="Editar"
              className="press flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[var(--faint)] transition hover:border-white/25 hover:text-white"
              aria-label={`Editar ${w.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => (armDelete ? onRemove() : setArmDelete(true))}
              data-cursor-color="#f87171"
              data-cursor-label={armDelete ? "Confirmar" : "Eliminar"}
              className={`press flex h-9 items-center justify-center rounded-lg border text-[10px] font-semibold transition ${
                armDelete
                  ? "border-red-400/60 bg-red-500/10 px-2.5 text-red-300"
                  : "w-9 border-white/10 text-[var(--faint)] hover:border-red-400/40 hover:text-red-300"
              }`}
              aria-label={armDelete ? `Confirmar eliminación de ${w.name}` : `Eliminar ${w.name}`}
            >
              {armDelete ? "¿Seguro?" : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ---------------- Fila de gestión de tareas diarias (solo admin) ---------------- */

function ManageRow({
  t, pt, onEdit, onConvert, onRemove,
}: {
  t: DailyTask; pt?: PostType; onEdit: () => void; onConvert: () => void; onRemove: () => void;
}) {
  const [armConvert, setArmConvert] = useState(false);
  const [armDelete, setArmDelete] = useState(false);
  const perDay = taskIsPerDay(t);
  const rotates = !perDay && !!t.rotation && t.rotation.length > 1;
  const hasDays = !perDay && !!t.days && t.days.length > 0 && t.days.length < 7;
  const dayOwners = perDay ? Array.from(new Set(t.dayAssignees!.filter(Boolean))) : [];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
      transition={{ duration: 0.22, ease: EASE }}
      onMouseLeave={() => {
        setArmConvert(false);
        setArmDelete(false);
      }}
      className="group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 transition-colors hover:border-white/15"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/25 text-base">
        <IconGlyph icon={t.icon} size={isImgIcon(t.icon) ? 36 : 20} rounded="rounded-xl" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white">{t.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--faint)]">
          {perDay ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 font-semibold">
              <CalendarDays className="h-3 w-3 text-nude" /> Por día <AvatarStack usernames={dayOwners} size={14} />
            </span>
          ) : rotates ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 font-semibold">
              <Repeat className="h-3 w-3 text-nude" /> Rota <AvatarStack usernames={t.rotation!} size={14} />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 font-semibold">
              <Pin className="h-3 w-3" /> Fija <Avatar username={t.assignee} size={14} /> <span className="capitalize">{t.assignee}</span>
            </span>
          )}
          {hasDays && <span className="num">{t.days!.map((d) => WEEKDAYS[d]).join(" · ")}</span>}
          {pt && <PostTypeChip pt={pt} />}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          data-cursor-label="Editar"
          className="press flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[var(--faint)] transition hover:border-white/25 hover:text-white"
          aria-label={`Editar ${t.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => (armConvert ? onConvert() : setArmConvert(true))}
          data-cursor-color="#a78bfa"
          data-cursor-label="Convertir en semanal"
          className={`press flex h-9 items-center gap-1 rounded-lg border px-2.5 text-[10px] font-semibold transition ${
            armConvert
              ? "border-violet-400/60 bg-violet-500/10 text-violet-300"
              : "border-white/10 text-[var(--faint)] hover:border-violet-400/40 hover:text-violet-300"
          }`}
          aria-label={armConvert ? `Confirmar conversión de ${t.name} en semanal` : `Convertir ${t.name} en tarea semanal`}
          title="Crea una tarea semanal igual y elimina esta diaria"
        >
          {armConvert ? "¿Convertir y borrar la diaria?" : "→ Semanal"}
        </button>
        <button
          type="button"
          onClick={() => (armDelete ? onRemove() : setArmDelete(true))}
          data-cursor-color="#f87171"
          data-cursor-label={armDelete ? "Confirmar" : "Eliminar"}
          className={`press flex h-9 items-center justify-center rounded-lg border text-[10px] font-semibold transition ${
            armDelete
              ? "border-red-400/60 bg-red-500/10 px-2.5 text-red-300"
              : "w-9 border-white/10 text-[var(--faint)] hover:border-red-400/40 hover:text-red-300"
          }`}
          aria-label={armDelete ? `Confirmar eliminación de ${t.name}` : `Eliminar ${t.name}`}
        >
          {armDelete ? "¿Seguro?" : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </motion.div>
  );
}

/* ---------------- Task rows ---------------- */

function TaskRow({ t, i, pt, isAdmin, me, onCycle, onEdit }: { t: DailyTask; i: number; pt?: PostType; isAdmin: boolean; me: string; onCycle: () => void; onEdit: () => void }) {
  const perDay = taskIsPerDay(t);
  const rotates = !perDay && !!t.rotation && t.rotation.length > 1;
  const hasDays = !perDay && !!t.days && t.days.length > 0 && t.days.length < 7;
  const done = t.state === "done";
  const assigneeToday = taskAssigneeToday(t);
  const myTurn = assigneeToday === me;
  const wdToday = todayWeekday();
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
            {perDay ? (
              <>
                <CalendarDays className="h-3 w-3 text-nude" />
                {t.dayAssignees!.map((u, d) =>
                  u ? (
                    <span
                      key={d}
                      title={`${WEEKDAYS[d]}: ${u}`}
                      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                        d === wdToday
                          ? myTurn
                            ? "border-nude/50 bg-nude/15 text-nude shadow-[0_0_12px_-4px_rgba(214,171,153,0.7)]"
                            : "border-white/20 bg-white/10 text-white"
                          : "border-white/10 bg-white/5 text-[var(--muted)]"
                      }`}
                    >
                      {WEEKDAYS[d]} <Avatar username={u} size={12} />
                    </span>
                  ) : null,
                )}
                {t.dayAssignees![wdToday] && (
                  <span className={`text-[10px] font-semibold ${myTurn ? "glow-text" : "text-[var(--faint)]"}`}>
                    {myTurn ? "· te toca hoy" : <>· hoy: <span className="capitalize">{assigneeToday}</span></>}
                  </span>
                )}
              </>
            ) : rotates ? (
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
            {pt && (
              <>
                <span className="text-white/15">·</span>
                <PostTypeChip pt={pt} />
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
  const { items: weekly, add: addWeekly, update: updateWeekly, remove: removeWeekly } = useWeeklyTasks();
  const { items: postTypes } = usePostTypes();
  const { profiles } = useProfiles();
  const [tab, setTab] = useState<"mias" | "equipo">("mias");
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyDraft | null>(null);
  const [confirmDeleteWeekly, setConfirmDeleteWeekly] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const isAdmin = role === "admin";
  const postTypeById = useMemo(() => new Map(postTypes.map((p) => [p.id, p])), [postTypes]);
  const ptOf = (id?: string) => (id ? postTypeById.get(id) : undefined);
  // Cambia de valor cuando arranca un nuevo día (aunque la app quede abierta):
  // re-renderiza y los turnos/contadores del día se recalculan.
  const hoy = useToday();

  // «Mis tareas»: rotativas = de todo el grupo (cualquiera cubre); «por día» =
  // hoy solo del dueño del día, y en «Otros días» ve las suyas de otros días.
  const inTab = useMemo(() => (tab === "mias" ? tasks.filter((t) => taskBelongsTo(t, username)) : tasks), [tasks, tab, username]);
  const todayTasks = useMemo(
    () => (tab === "mias" ? tasks.filter((t) => taskMineToday(t, username)) : tasks.filter(taskAppliesToday)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, tab, username, hoy],
  );
  const otherTasks = useMemo(
    () => inTab.filter((t) => (tab === "mias" ? !taskMineToday(t, username) : !taskAppliesToday(t))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inTab, tab, username, hoy],
  );
  const doneCount = todayTasks.filter((t) => t.state === "done").length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const myTodayCount = useMemo(() => tasks.filter((t) => taskMineToday(t, username)).length, [tasks, username, hoy]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const teamTodayCount = useMemo(() => tasks.filter(taskAppliesToday).length, [tasks, hoy]);
  const dayName = new Date(hoy + "T00:00:00").toLocaleDateString("es-PY", { weekday: "long" });

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
      mode: taskIsPerDay(t) ? "perday" : t.rotation && t.rotation.length > 1 ? "rotate" : "fixed",
      users: t.rotation && t.rotation.length > 1 ? t.rotation : [t.assignee],
      days: t.days ?? [],
      dayOwners: Array.from({ length: 7 }, (_, d) => t.dayAssignees?.[d] ?? ""),
      postType: t.postType ?? "",
    });
  };
  const closeTaskModal = () => {
    setTaskDraft(null);
    setConfirmDelete(false);
  };

  function saveTask() {
    if (!taskDraft || !taskDraft.name.trim()) return;
    const perDay = taskDraft.mode === "perday";
    const dayAssignees = perDay && taskDraft.dayOwners.some(Boolean) ? [...taskDraft.dayOwners] : undefined;
    if (perDay && !dayAssignees) return; // sin días asignados no hay tarea
    const rotation = taskDraft.mode === "rotate" && taskDraft.users.length > 1 ? taskDraft.users : undefined;
    const assignee = perDay ? dayAssignees!.find(Boolean)! : taskDraft.users[0] ?? "cielo";
    const days = !perDay && taskDraft.days.length > 0 && taskDraft.days.length < 7 ? taskDraft.days : undefined;
    const postType = taskDraft.postType || undefined;
    if (taskDraft.id) {
      updateTask(taskDraft.id, { name: taskDraft.name.trim(), icon: taskDraft.icon, assignee, rotation, days, dayAssignees, postType });
    } else {
      addTask({ id: "n" + Date.now(), name: taskDraft.name.trim(), icon: taskDraft.icon || "✨", assignee, state: "todo", rotation, days, dayAssignees, postType });
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

  /* ----- Tareas semanales ----- */

  const openNewWeekly = () => {
    setConfirmDeleteWeekly(false);
    setWeeklyDraft(emptyWeekly());
  };
  const editWeekly = (w: WeeklyTask) => {
    setConfirmDeleteWeekly(false);
    setWeeklyDraft({ id: w.id, name: w.name, icon: w.icon, assignee: w.assignee, postType: w.postType ?? "" });
  };
  const closeWeeklyModal = () => {
    setWeeklyDraft(null);
    setConfirmDeleteWeekly(false);
  };

  function saveWeekly() {
    if (!weeklyDraft || !weeklyDraft.name.trim()) return;
    const patch = {
      name: weeklyDraft.name.trim(),
      icon: weeklyDraft.icon || "🗓️",
      assignee: weeklyDraft.assignee,
      postType: weeklyDraft.postType || undefined,
    };
    if (weeklyDraft.id) updateWeekly(weeklyDraft.id, patch);
    else addWeekly({ id: "w" + Date.now(), ...patch, state: "todo", createdAt: todayIso() });
    closeWeeklyModal();
  }

  function deleteWeekly() {
    if (!weeklyDraft?.id) return;
    if (!confirmDeleteWeekly) {
      setConfirmDeleteWeekly(true);
      return;
    }
    removeWeekly(weeklyDraft.id);
    closeWeeklyModal();
  }

  const cycleWeekly = (id: string) => {
    const w = weekly.find((x) => x.id === id);
    if (w) updateWeekly(id, { state: NEXT[w.state] });
  };

  /** Convierte una diaria en semanal (misma tarea, responsable de hoy) y borra la diaria. */
  const convertToWeekly = (t: DailyTask) => {
    addWeekly({
      id: "w" + Date.now(),
      name: t.name,
      icon: t.icon,
      assignee: taskAssigneeToday(t),
      state: "todo",
      postType: t.postType,
      createdAt: todayIso(),
    });
    removeTask(t.id);
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
                <TaskRow key={t.id} t={t} i={i} pt={ptOf(t.postType)} isAdmin={isAdmin} me={username} onCycle={() => cycle(t.id)} onEdit={() => editTask(t)} />
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

        {/* -------- Weekly tasks (columna derecha) -------- */}
        <div>
          <p className="eyebrow mb-3">
            <span className="glow-text">Tareas semanales</span>
          </p>
          <Reveal>
            <Card className="card-sheen p-5" hover={false}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">Proyectos de la semana</h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--faint)]">
                    Viven acá sin fecha fija; arrastralas a un día del calendario para agendarlas.
                  </p>
                </div>
                <span className="num shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-[var(--faint)]">
                  {weekly.length}
                </span>
              </div>

              {weekly.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <AnimatePresence mode="popLayout">
                    {weekly.map((w, i) => (
                      <WeeklyRow
                        key={w.id}
                        w={w}
                        i={i}
                        pt={ptOf(w.postType)}
                        isAdmin={isAdmin}
                        onCycle={() => cycleWeekly(w.id)}
                        onEdit={() => editWeekly(w)}
                        onRemove={() => removeWeekly(w.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <EmptyState
                  icon="🗓️"
                  title="Sin tareas semanales"
                  hint={
                    isAdmin
                      ? "Creá la primera: son como proyectos chicos que después arrastrás al calendario."
                      : "Cuando el equipo cargue tareas semanales, las vas a ver acá."
                  }
                  className="!py-8"
                />
              )}

              {isAdmin && (
                <Button variant="subtle" onClick={openNewWeekly} className="mt-4 w-full">
                  <Plus className="h-4 w-4" /> Nueva semanal
                </Button>
              )}
            </Card>
          </Reveal>
        </div>
      </div>

      {/* -------- Gestión de tareas diarias (solo admin) -------- */}
      {isAdmin && (
        <div className="mt-10">
          <button
            type="button"
            onClick={() => setShowManage((v) => !v)}
            aria-expanded={showManage}
            className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left transition hover:opacity-90"
            data-cursor-label={showManage ? "Colapsar" : "Expandir"}
          >
            <ChevronDown className={`h-4 w-4 text-[var(--faint)] transition-transform duration-200 ${showManage ? "" : "-rotate-90"}`} />
            <span className="eyebrow">Gestión de tareas diarias</span>
            <span className="num rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-[10px] text-[var(--faint)]">{tasks.length}</span>
            <span className="h-px flex-1 bg-white/5" />
          </button>
          <AnimatePresence initial={false}>
            {showManage && (
              <motion.div
                key="manage"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <p className="mb-3 mt-1 pl-6 text-[11px] text-[var(--faint)]">
                  Todas las tareas diarias del equipo, sin filtrar por día ni pestaña. Editá, convertí en semanal o eliminá.
                </p>
                {tasks.length > 0 ? (
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {tasks.map((t) => (
                        <ManageRow
                          key={t.id}
                          t={t}
                          pt={ptOf(t.postType)}
                          onEdit={() => editTask(t)}
                          onConvert={() => convertToWeekly(t)}
                          onRemove={() => removeTask(t.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <EmptyState icon="🌸" title="No hay tareas diarias" hint="Creá la primera con «Nueva tarea»." />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

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

            {taskDraft.mode !== "perday" && (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Días de la semana</span>
                <WeekdayPicker value={taskDraft.days} onChange={(days) => setTaskDraft({ ...taskDraft, days })} />
              </div>
            )}

            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Asignación</span>
              <Segmented
                value={taskDraft.mode}
                onChange={(mode) =>
                  setTaskDraft(
                    mode === "fixed"
                      ? { ...taskDraft, mode, users: [taskDraft.users[0] ?? "cielo"] }
                      : mode === "perday"
                        ? { ...taskDraft, mode }
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
                    value: "perday",
                    label: (
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" /> Por día
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
            ) : taskDraft.mode === "perday" ? (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                  Dueño fijo por día <span className="font-normal text-[var(--faint)]">— los días sin perfil no se hacen</span>
                </span>
                <div className="space-y-1.5">
                  {WEEKDAYS.map((w, d) => (
                    <div key={d} className="flex items-center gap-2.5">
                      <span className={`num w-9 shrink-0 text-[11px] font-bold uppercase tracking-wider ${taskDraft.dayOwners[d] ? "text-nude" : "text-[var(--faint)]"}`}>
                        {w}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {profiles.map((p) => {
                          const on = taskDraft.dayOwners[d] === p.username;
                          return (
                            <button
                              key={p.username}
                              type="button"
                              data-cursor-label={on ? "Quitar" : `${w}: ${p.username}`}
                              onClick={() => {
                                const dayOwners = [...taskDraft.dayOwners];
                                dayOwners[d] = on ? "" : p.username;
                                setTaskDraft({ ...taskDraft, dayOwners });
                              }}
                              className={`press flex h-8 items-center gap-1.5 rounded-full border pl-1.5 pr-3 text-[11px] capitalize transition ${
                                on
                                  ? "border-nude/60 bg-nude/15 text-white shadow-[0_0_14px_-5px_rgba(214,171,153,0.7)]"
                                  : "border-white/10 text-[var(--muted)] hover:border-white/25 hover:text-white"
                              }`}
                            >
                              <Avatar username={p.username} size={18} ring={on} /> {p.username}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {taskDraft.dayOwners.some(Boolean) ? (
                  <p className="mt-2.5 text-[11px] text-[var(--faint)]">
                    {taskDraft.dayOwners
                      .map((u, d) => (u ? `${WEEKDAYS[d]} ${u}` : null))
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : (
                  <p className="mt-2.5 text-[11px] text-amber-300">Asigná al menos un día para poder guardar.</p>
                )}
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

            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                Tipo de publicación <span className="font-normal text-[var(--faint)]">(opcional)</span>
              </span>
              <PostTypePicker postTypes={postTypes} value={taskDraft.postType} onChange={(postType) => setTaskDraft({ ...taskDraft, postType })} />
            </div>
          </div>
        )}
      </Modal>

      {/* -------- New / edit weekly task -------- */}
      <Modal
        open={!!weeklyDraft}
        onClose={closeWeeklyModal}
        title={weeklyDraft?.id ? "Editar tarea semanal" : "Nueva tarea semanal"}
        description="Un proyecto chico de la semana: elegí ícono, nombre y responsable."
        footer={
          <>
            {weeklyDraft?.id && (
              <Button
                variant="ghost"
                onClick={deleteWeekly}
                data-cursor-color="#f87171"
                data-cursor-label="Eliminar"
                className={`mr-auto ${
                  confirmDeleteWeekly
                    ? "!border-red-400/60 bg-red-500/10 !text-red-300"
                    : "!text-red-300/70 hover:!border-red-400/40 hover:!text-red-300"
                }`}
              >
                <Trash2 className="h-4 w-4" /> {confirmDeleteWeekly ? "¿Seguro? Sí, eliminar" : "Eliminar"}
              </Button>
            )}
            <Button variant="ghost" onClick={closeWeeklyModal}>
              Cancelar
            </Button>
            <Button onClick={saveWeekly} disabled={!weeklyDraft?.name.trim()}>
              Guardar
            </Button>
          </>
        }
      >
        {weeklyDraft && (
          <div className="space-y-5">
            <div className="flex items-end gap-3">
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Ícono</span>
                <IconPicker value={weeklyDraft.icon} onChange={(icon) => setWeeklyDraft({ ...weeklyDraft, icon })} size={44} />
              </div>
              <div className="flex-1">
                <Field label="Nombre">
                  <Input
                    value={weeklyDraft.name}
                    onChange={(e) => setWeeklyDraft({ ...weeklyDraft, name: e.target.value })}
                    placeholder="Ej: Sesión de fotos de la línea nueva"
                    autoFocus
                  />
                </Field>
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Responsable</span>
              <OwnerPicker value={weeklyDraft.assignee} onChange={(u) => setWeeklyDraft({ ...weeklyDraft, assignee: u })} />
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                Tipo de publicación <span className="font-normal text-[var(--faint)]">(opcional)</span>
              </span>
              <PostTypePicker postTypes={postTypes} value={weeklyDraft.postType} onChange={(postType) => setWeeklyDraft({ ...weeklyDraft, postType })} />
            </div>

            <p className="flex items-center gap-2 rounded-lg border border-nude/20 bg-nude/[0.06] px-3 py-2 text-[11px] text-nude/90">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" /> Arrastrala a un día del calendario para agendarla.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
