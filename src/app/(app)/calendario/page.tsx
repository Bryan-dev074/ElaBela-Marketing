"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Plus, Film, FolderKanban, CheckSquare, Sparkles,
  CalendarPlus, CalendarX2, Trash2, GripVertical,
} from "lucide-react";
import { PageHeader, Card, Modal, Field, Input, Button, EmptyState, StatePill, Reveal, IconGlyph, stateCursorProps } from "@/components/ui";
import { Avatar, OwnerPicker } from "@/components/Avatar";
import { SPECIAL_DATES, dayOfYear, fmtShortDate, type SpecialDate, type Project, type Guion, type WeeklyTask, type TaskState } from "@/lib/data";
import { useProjects, useGuiones, useCalendarEvents, usePostTypes, useWeeklyTasks, type CalEventRow } from "@/lib/db";
import { useProfiles } from "@/lib/profiles";
import { useToday } from "@/lib/useToday";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const dayLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Agenda de un día: todo lo que cae en esa fecha, agrupado por origen. */
type DayAgenda = { special: SpecialDate[]; projects: Project[]; guiones: Guion[]; events: CalEventRow[]; weekly: WeeklyTask[] };
const EMPTY_AGENDA: DayAgenda = { special: [], projects: [], guiones: [], events: [], weekly: [] };

/** Ciclo de estado al tocar la pill: sin empezar → en curso → listo → sin empezar. */
const NEXT_STATE: Record<TaskState, TaskState> = { todo: "doing", doing: "done", done: "todo" };

const monthVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 42 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -42 }),
};

export default function CalendarioPage() {
  // Se actualiza solo cuando arranca un nuevo día (resalta el día correcto
  // y recalcula la rotación aunque la pestaña quede abierta).
  const todayIso = useToday();
  const now = new Date(todayIso + "T00:00:00");

  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [dir, setDir] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", owner: "cielo" });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickId, setPickId] = useState<string | null>(null);
  const [pickOwner, setPickOwner] = useState("cielo");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const { items: projects, update: updateProject } = useProjects();
  const { items: guiones } = useGuiones();
  const { items: events, add: addEventDb, remove: removeEventDb } = useCalendarEvents();
  const { items: postTypes } = usePostTypes();
  const { items: weeklyTasks, update: updateWeekly, remove: removeWeekly } = useWeeklyTasks();
  const { profiles } = useProfiles();

  /** Tipo sugerido del día: el catálogo rota en orden según el DÍA DEL AÑO. */
  const typeFor = (y: number, m: number, d: number) =>
    postTypes.length ? postTypes[dayOfYear(new Date(y, m, d)) % postTypes.length] : undefined;
  const typeForIso = (date: string) => {
    const dt = new Date(date + "T00:00:00");
    return typeFor(dt.getFullYear(), dt.getMonth(), dt.getDate());
  };
  const todayType = typeFor(now.getFullYear(), now.getMonth(), now.getDate());

  /** Índice fecha → agenda armado en UNA pasada por colección (no 4 filter() por celda). */
  const agendaByDate = useMemo(() => {
    const map = new Map<string, DayAgenda>();
    const at = (date: string) => {
      let e = map.get(date);
      if (!e) { e = { special: [], projects: [], guiones: [], events: [], weekly: [] }; map.set(date, e); }
      return e;
    };
    for (const s of SPECIAL_DATES) at(s.date).special.push(s);
    for (const p of projects) if (p.due && !p.archived) at(p.due).projects.push(p);
    for (const g of guiones) if (g.publish) at(g.publish).guiones.push(g);
    for (const e of events) at(e.date).events.push(e);
    for (const w of weeklyTasks) if (w.date) at(w.date).weekly.push(w);
    return map;
  }, [projects, guiones, events, weeklyTasks]);

  const agenda = (date: string): DayAgenda => agendaByDate.get(date) ?? EMPTY_AGENDA;

  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);
  const trayProjects = useMemo(
    () => [...activeProjects].sort((a, b) => (a.due ? 1 : 0) - (b.due ? 1 : 0) || (a.due ?? "").localeCompare(b.due ?? "")),
    [activeProjects],
  );
  /** Tareas semanales en la bandeja: primero las sin agendar, después por fecha. */
  const trayWeekly = useMemo(
    () => [...weeklyTasks].sort((a, b) => (a.date ? 1 : 0) - (b.date ? 1 : 0) || (a.date ?? "").localeCompare(b.date ?? "")),
    [weeklyTasks],
  );

  /** El Avatar del modal cicla al siguiente perfil: así se elige responsable al agendar. */
  const cycleAssignee = (w: WeeklyTask) => {
    if (!profiles.length) return;
    const i = profiles.findIndex((p) => p.username.toLowerCase() === w.assignee.toLowerCase());
    updateWeekly(w.id, { assignee: profiles[(i + 1) % profiles.length].username });
  };

  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startPad = (first.getDay() + 6) % 7;
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const weekDays = useMemo(() => {
    const base = selected ? new Date(selected + "T00:00:00") : new Date();
    base.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return iso(d.getFullYear(), d.getMonth(), d.getDate());
    });
  }, [selected]);

  /** Semana ACTUAL (siempre la de hoy) para el panel de rotación. */
  const rotationWeek = useMemo(() => {
    const base = new Date(todayIso + "T00:00:00");
    base.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [todayIso]);

  const goMonth = (delta: 1 | -1) => {
    setDir(delta);
    setCursor((c) => {
      const m = c.m + delta;
      if (m < 0) return { y: c.y - 1, m: 11 };
      if (m > 11) return { y: c.y + 1, m: 0 };
      return { ...c, m };
    });
  };
  const goToday = () => {
    setDir(cursor.y * 12 + cursor.m > now.getFullYear() * 12 + now.getMonth() ? -1 : 1);
    setCursor({ y: now.getFullYear(), m: now.getMonth() });
  };

  const closeDay = () => {
    setSelected(null);
    setConfirmDel(null);
    setTaskOpen(false);
    setPickerOpen(false);
  };

  function addTask() {
    if (!selected || !draft.title.trim()) return;
    addEventDb({ id: "e" + Date.now(), date: selected, kind: "tarea", title: draft.title.trim(), owner: draft.owner });
    setDraft((d) => ({ ...d, title: "" }));
    setTaskOpen(false);
  }

  function schedulePick() {
    if (!selected || !pickId) return;
    updateProject(pickId, { due: selected, owner: pickOwner });
    setPickerOpen(false);
    setPickId(null);
  }

  /** Drag mixto: «p:id» agenda un proyecto (due) y «w:id» una tarea semanal (date). */
  function dropOn(date: string, e: React.DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain") || dragId;
    if (raw) {
      if (raw.startsWith("w:")) updateWeekly(raw.slice(2), { date });
      else if (raw.startsWith("p:")) updateProject(raw.slice(2), { due: date });
      else updateProject(raw, { due: date });
    }
    setDragOver(null);
    setDragId(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Programación"
        title="Calendario"
        description="Tocá un día para ver su agenda, arrastrá un proyecto hasta una celda para fijar su entrega y seguí la rotación de contenido sugerida."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        {/* ============ Mes ============ */}
        <Card className="p-4 sm:p-6" hover={false}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">
              <span className="text-gradient">{MESES[cursor.m]}</span>{" "}
              <span className="num text-lg font-medium text-[var(--faint)] sm:text-xl">{cursor.y}</span>
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => goMonth(-1)}
                aria-label="Mes anterior"
                data-cursor-label="Mes anterior"
                className="press flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[var(--muted)] transition hover:border-white/25 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={goToday}
                data-cursor-label="Ir a hoy"
                className="press h-9 rounded-lg border border-white/10 px-3 text-xs font-medium text-[var(--muted)] transition hover:border-nude/40 hover:text-nude"
              >
                Hoy
              </button>
              <button
                onClick={() => goMonth(1)}
                aria-label="Mes siguiente"
                data-cursor-label="Mes siguiente"
                className="press flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[var(--muted)] transition hover:border-white/25 hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1.5 sm:gap-2">
            {DIAS.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">{d}</div>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={`${cursor.y}-${cursor.m}`}
              custom={dir}
              variants={monthVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-7 gap-1.5 sm:gap-2"
            >
              {grid.map((d, i) => {
                if (d === null) return <div key={`pad-${i}`} />;
                const dateIso = iso(cursor.y, cursor.m, d);
                const a = agenda(dateIso);
                const isToday = dateIso === todayIso;
                const isSel = dateIso === selected;
                const isOver = dateIso === dragOver;
                const t = typeFor(cursor.y, cursor.m, d);
                return (
                  <button
                    key={dateIso}
                    onClick={() => setSelected(dateIso)}
                    onDragEnter={(e) => { e.preventDefault(); setDragOver(dateIso); }}
                    onDragOver={(e) => { e.preventDefault(); if (dragOver !== dateIso) setDragOver(dateIso); }}
                    onDragLeave={() => setDragOver((v) => (v === dateIso ? null : v))}
                    onDrop={(e) => dropOn(dateIso, e)}
                    data-cursor-label={dragId ? "Soltar acá" : "Ver día"}
                    className={`group relative flex aspect-square flex-col rounded-xl border p-1.5 text-left transition-all duration-200 sm:p-2 ${
                      isOver
                        ? "scale-[1.05] border-nude bg-nude/20 shadow-glow-nude"
                        : isSel
                          ? "border-nude/80 bg-nude/15 ring-1 ring-nude/50"
                          : isToday
                            ? "border-nude/50 bg-nude/10 shadow-glow-nude"
                            : "border-white/8 bg-white/[0.02] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="pointer-events-none flex h-full w-full flex-col">
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className={`num text-xs ${
                            isToday
                              ? "glow-pulse flex h-5 min-w-5 items-center justify-center rounded-full bg-nude px-1 font-bold text-[#2a1712]"
                              : isSel
                                ? "font-bold text-white"
                                : "text-[var(--faint)] transition group-hover:text-white"
                          }`}
                        >
                          {d}
                        </span>
                        {a.special[0] && <span className="text-sm leading-none">{a.special[0].emoji}</span>}
                      </div>
                      <div className="mt-auto flex items-end justify-between gap-1">
                        <span className="flex flex-wrap gap-0.5">
                          {a.projects.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
                          {a.guiones.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                          {a.weekly.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />}
                          {a.events.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-nude" />}
                        </span>
                        {t && (
                          <span className="text-[10px] leading-none opacity-30 transition-opacity group-hover:opacity-80">
                            {t.icon}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </Card>

        {/* ============ Panel lateral ============ */}
        <div className="space-y-6">
          {/* Bandeja de proyectos para arrastrar */}
          <Reveal>
            <Card className="card-sheen p-5" hover={false}>
              <p className="eyebrow mb-1">Agendá con drag &amp; drop</p>
              <h2 className="mb-1 text-base font-semibold text-white">Arrastrá un proyecto a un día</h2>
              <p className="mb-4 text-[11px] leading-relaxed text-[var(--faint)]">
                Soltalo sobre una celda del mes para fijar su <span className="text-blue-300">entrega</span>. Los que ya tienen fecha también se pueden mover a otro día.
              </p>
              {trayProjects.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-[var(--faint)]">
                  No hay proyectos activos. Creá uno en el módulo Proyectos.
                </p>
              ) : (
                <div className="space-y-2">
                  {trayProjects.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", "p:" + p.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId("p:" + p.id);
                      }}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      data-cursor-label="Arrastrar"
                      className={`kanban-card flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:border-nude/40 hover:bg-white/[0.06] ${
                        dragId === "p:" + p.id ? "dragging" : ""
                      }`}
                    >
                      <GripVertical className="h-3.5 w-3.5 shrink-0 text-[var(--faint)]" />
                      <Avatar username={p.owner} size={20} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-white">{p.name}</p>
                        <p className={`num text-[10px] ${p.due ? "text-blue-300" : "text-[var(--faint)]"}`}>
                          {p.due ? `Entrega ${fmtShortDate(p.due) ?? ""}` : "Sin fecha"}
                        </p>
                      </div>
                      {p.due ? (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      ) : (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-white/25" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tareas semanales: misma mecánica de drag, dot violeta */}
              <div className="divider my-4" />
              <h3 className="mb-1 text-sm font-semibold text-white">Tareas semanales</h3>
              <p className="mb-3 text-[11px] leading-relaxed text-[var(--faint)]">
                Arrastrá una hasta un día para <span className="text-violet-300">agendarla</span>. Las que ya tienen fecha se pueden mover igual.
              </p>
              {trayWeekly.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-[var(--faint)]">
                  No hay tareas semanales todavía.
                </p>
              ) : (
                <div className="space-y-2">
                  {trayWeekly.map((w) => (
                    <div
                      key={w.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", "w:" + w.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId("w:" + w.id);
                      }}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      data-cursor-label="Arrastrar"
                      className={`kanban-card flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:border-violet-400/40 hover:bg-white/[0.06] ${
                        dragId === "w:" + w.id ? "dragging" : ""
                      }`}
                    >
                      <GripVertical className="h-3.5 w-3.5 shrink-0 text-[var(--faint)]" />
                      <IconGlyph icon={w.icon} size={18} rounded="rounded-md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-white">{w.name}</p>
                        <p className={`num text-[10px] ${w.date ? "text-violet-300" : "text-[var(--faint)]"}`}>
                          {w.date ? `Agendada ${fmtShortDate(w.date) ?? ""}` : "Sin agendar"}
                        </p>
                      </div>
                      <Avatar username={w.assignee} size={20} />
                      {w.date ? (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                      ) : (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-white/25" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Reveal>

          {/* Rotación de contenido — la regla explicada */}
          <Reveal delay={0.05}>
            <Card className="p-5" hover={false}>
              <p className="eyebrow mb-1">Regla del calendario</p>
              <h2 className="mb-2 text-base font-semibold text-white">Rotación de contenido</h2>
              <p className="mb-4 text-[11px] leading-relaxed text-[var(--faint)]">
                Cada día tiene un <span className="text-white">tipo de post sugerido</span>: el catálogo rota en orden según el día del año, así la variedad se sostiene sola. Lo ves como mini emoji en cada celda.
              </p>

              {todayType && (
                <div className="ring-glow mb-4 flex items-center gap-3 rounded-xl bg-nude/10 px-3.5 py-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ background: `${todayType.accent}26` }}
                  >
                    {todayType.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="glow-text text-[10px] font-bold uppercase tracking-widest">Hoy toca</p>
                    <p className="truncate text-sm font-semibold text-white">{todayType.name}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {rotationWeek.map((dt, i) => {
                  const t = typeFor(dt.getFullYear(), dt.getMonth(), dt.getDate());
                  const isT = iso(dt.getFullYear(), dt.getMonth(), dt.getDate()) === todayIso;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition ${
                        isT ? "bg-nude/10 text-white" : "text-[var(--muted)]"
                      }`}
                    >
                      <span className={`num w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wider ${isT ? "text-nude" : "text-[var(--faint)]"}`}>
                        {DIAS[i]} {dt.getDate()}
                      </span>
                      <span className="text-sm leading-none">{t?.icon}</span>
                      <span className="truncate">{t?.name}</span>
                      {isT && <span className="glow-pulse ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-nude" />}
                    </div>
                  );
                })}
              </div>

              <div className="divider my-4" />
              <ul className="space-y-1.5 text-[11px] text-[var(--faint)]">
                <li className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full bg-blue-400" /> Proyecto con entrega ese día</li>
                <li className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" /> Guion que se publica</li>
                <li className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" /> Tarea semanal agendada</li>
                <li className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full bg-nude" /> Tarea o evento agregado a mano</li>
                <li className="flex items-center gap-2"><span className="text-xs leading-none">🤝</span> Emoji grande = fecha especial</li>
              </ul>
            </Card>
          </Reveal>
        </div>
      </div>

      {/* ============ Semana ampliada ============ */}
      <div className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow mb-1">Detalle</p>
          <h2 className="text-xl font-semibold text-white">Semana ampliada</h2>
        </div>
        <p className="num text-xs text-[var(--faint)]">{fmtShortDate(weekDays[0])} — {fmtShortDate(weekDays[6])}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {weekDays.map((d, i) => {
          const a = agenda(d);
          const isToday = d === todayIso;
          const t = typeForIso(d);
          const dt = new Date(d + "T00:00:00");
          return (
            <Reveal key={d} delay={i * 0.04} className="h-full">
              <button
                onClick={() => setSelected(d)}
                data-cursor-label="Ver día"
                className={`card-sheen glass flex h-full min-h-[11rem] w-full flex-col rounded-2xl p-4 text-left transition hover:border-white/20 ${
                  isToday ? "border-nude/50 shadow-glow-nude" : ""
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-1">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
                      {dt.toLocaleDateString("es-PY", { weekday: "short" })}
                    </p>
                    <p className={`num font-display text-xl font-semibold ${isToday ? "glow-text" : "text-white"}`}>{dt.getDate()}</p>
                  </div>
                  {t && <span className="text-xs opacity-40" title={t.name}>{t.icon}</span>}
                </div>
                <div className="w-full space-y-1.5">
                  {a.special.map((s) => (
                    <p key={s.date} className="flex items-center gap-1.5 rounded-lg border border-nude/20 bg-nude/10 px-2 py-1.5 text-[11px] text-nude">
                      <span className="shrink-0 leading-none">{s.emoji}</span>
                      <span className="truncate">{s.label}</span>
                    </p>
                  ))}
                  {a.projects.map((p) => (
                    <p key={p.id} className="flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-2 py-1.5 text-[11px] text-blue-200">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                      <span className="truncate">{p.name}</span>
                      <span className="ml-auto shrink-0"><Avatar username={p.owner} size={16} /></span>
                    </p>
                  ))}
                  {a.guiones.map((g) => (
                    <p key={g.id} className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2 py-1.5 text-[11px] text-emerald-200">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                      <span className="truncate">{g.name}</span>
                      <span className="ml-auto shrink-0"><Avatar username={g.responsible} size={16} /></span>
                    </p>
                  ))}
                  {a.weekly.map((w) => (
                    <p key={w.id} className="flex items-center gap-1.5 rounded-lg bg-violet-500/15 px-2 py-1.5 text-[11px] text-violet-200">
                      <span className="shrink-0 leading-none"><IconGlyph icon={w.icon} size={12} rounded="rounded-sm" /></span>
                      <span className="truncate">{w.name}</span>
                      <span className="ml-auto shrink-0"><Avatar username={w.assignee} size={16} /></span>
                    </p>
                  ))}
                  {a.events.map((e) => (
                    <p key={e.id} className="flex items-center gap-1.5 rounded-lg bg-nude/15 px-2 py-1.5 text-[11px] text-nude">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-nude" />
                      <span className="truncate">{e.title}</span>
                      <span className="ml-auto shrink-0"><Avatar username={e.owner} size={16} /></span>
                    </p>
                  ))}
                  {a.special.length + a.projects.length + a.guiones.length + a.events.length + a.weekly.length === 0 && (
                    <p className="text-[11px] text-[var(--faint)]">Libre</p>
                  )}
                </div>
              </button>
            </Reveal>
          );
        })}
      </div>

      {/* ============ Modal del día ============ */}
      <Modal
        open={!!selected}
        onClose={closeDay}
        wide
        title={selected ? cap(dayLabel(selected)) : ""}
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button variant="subtle" onClick={() => { setDraft((d) => ({ ...d, title: "" })); setTaskOpen(true); }}>
              <CheckSquare className="h-4 w-4" /> Nueva tarea
            </Button>
            <Button onClick={() => { setPickId(null); setPickerOpen(true); }}>
              <CalendarPlus className="h-4 w-4" /> Agendar proyecto
            </Button>
          </div>
        }
      >
        {selected && (() => {
          const a = agenda(selected);
          const t = typeForIso(selected);
          const empty = a.special.length + a.projects.length + a.guiones.length + a.events.length + a.weekly.length === 0;
          return (
            <div className="space-y-5">
              {t && (
                <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base" style={{ background: `${t.accent}22` }}>
                    {t.icon}
                  </span>
                  <p className="text-xs text-[var(--muted)]">
                    Tipo sugerido por rotación: <span className="font-medium text-white">{t.name}</span>
                  </p>
                </div>
              )}

              {a.special.length > 0 && (
                <div>
                  <p className="eyebrow mb-2">Fecha especial</p>
                  {a.special.map((s) => (
                    <div key={s.date} className="flex items-center gap-2.5 rounded-xl border border-nude/25 bg-nude/10 px-3 py-2.5 text-sm text-white">
                      <span className="text-lg leading-none">{s.emoji}</span>
                      {s.label}
                      <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--faint)]">{s.kind}</span>
                    </div>
                  ))}
                </div>
              )}

              {a.projects.length > 0 && (
                <div>
                  <p className="eyebrow mb-2">Proyectos (entrega)</p>
                  <div className="space-y-1.5">
                    {a.projects.map((p) => (
                      <div key={p.id} className="flex items-center gap-2.5 rounded-xl border border-blue-400/25 bg-blue-500/10 px-3 py-2">
                        <FolderKanban className="h-4 w-4 shrink-0 text-blue-300" />
                        <p className="min-w-0 flex-1 truncate text-sm text-white">{p.name}</p>
                        <StatePill state={p.status} />
                        <Avatar username={p.owner} size={22} />
                        <button
                          onClick={() => updateProject(p.id, { due: undefined })}
                          aria-label={`Desagendar ${p.name}`}
                          data-cursor-label="Desagendar"
                          data-cursor-color="#fbbf24"
                          className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--faint)] transition hover:bg-white/10 hover:text-amber-300"
                        >
                          <CalendarX2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[10px] text-[var(--faint)]">Desagendar solo le quita la fecha; el proyecto no se borra.</p>
                </div>
              )}

              {a.guiones.length > 0 && (
                <div>
                  <p className="eyebrow mb-2">Guiones (publicación)</p>
                  <div className="space-y-1.5">
                    {a.guiones.map((g) => (
                      <div key={g.id} className="flex items-center gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-sm text-white">
                        <Film className="h-4 w-4 shrink-0 text-emerald-300" />
                        <p className="min-w-0 flex-1 truncate">{g.name}</p>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] capitalize text-[var(--faint)]">{g.state}</span>
                        <Avatar username={g.responsible} size={22} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {a.weekly.length > 0 && (
                <div>
                  <p className="eyebrow mb-2">Tareas semanales</p>
                  <div className="space-y-1.5">
                    {a.weekly.map((w) => {
                      const armed = confirmDel === w.id;
                      return (
                        <div key={w.id} className="flex items-center gap-2.5 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2">
                          <IconGlyph icon={w.icon} size={18} rounded="rounded-md" />
                          <p className="min-w-0 flex-1 truncate text-sm text-white">{w.name}</p>
                          <button
                            type="button"
                            onClick={() => updateWeekly(w.id, { state: NEXT_STATE[w.state] })}
                            aria-label={`Cambiar estado de ${w.name}`}
                            {...stateCursorProps(w.state)}
                            className="press flex h-9 shrink-0 items-center"
                          >
                            <StatePill state={w.state} />
                          </button>
                          <button
                            type="button"
                            onClick={() => cycleAssignee(w)}
                            aria-label={`Cambiar responsable de ${w.name}`}
                            data-cursor-label="Cambiar responsable"
                            className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition hover:bg-white/10"
                          >
                            <Avatar username={w.assignee} size={22} />
                          </button>
                          <button
                            onClick={() => updateWeekly(w.id, { date: undefined })}
                            aria-label={`Desagendar ${w.name}`}
                            data-cursor-label="Desagendar"
                            data-cursor-color="#fbbf24"
                            className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--faint)] transition hover:bg-white/10 hover:text-amber-300"
                          >
                            <CalendarX2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (armed) { removeWeekly(w.id); setConfirmDel(null); }
                              else setConfirmDel(w.id);
                            }}
                            aria-label={armed ? `Confirmar eliminación de ${w.name}` : `Eliminar ${w.name}`}
                            data-cursor-color="#f87171"
                            data-cursor-label={armed ? "Confirmar" : "Eliminar"}
                            className={`press flex h-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition ${
                              armed
                                ? "border border-red-400/40 bg-red-500/20 px-2.5 text-red-300"
                                : "w-9 text-[var(--faint)] hover:bg-red-500/15 hover:text-red-300"
                            }`}
                          >
                            {armed ? "¿Seguro?" : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[10px] text-[var(--faint)]">Tocá la pill para cambiar el estado y el avatar para pasar el turno. Desagendar la devuelve a la bandeja; no la borra.</p>
                </div>
              )}

              {a.events.length > 0 && (
                <div>
                  <p className="eyebrow mb-2">Agregado a mano</p>
                  <div className="space-y-1.5">
                    {a.events.map((e) => {
                      const armed = confirmDel === e.id;
                      return (
                        <div key={e.id} className="flex items-center gap-2.5 rounded-xl border border-nude/25 bg-nude/10 px-3 py-2">
                          {e.kind === "tarea"
                            ? <CheckSquare className="h-4 w-4 shrink-0 text-nude" />
                            : <FolderKanban className="h-4 w-4 shrink-0 text-nude" />}
                          <p className="min-w-0 flex-1 truncate text-sm text-white">{e.title}</p>
                          <Avatar username={e.owner} size={22} />
                          <button
                            onClick={() => {
                              if (armed) { removeEventDb(e.id); setConfirmDel(null); }
                              else setConfirmDel(e.id);
                            }}
                            aria-label={armed ? `Confirmar eliminación de ${e.title}` : `Eliminar ${e.title}`}
                            data-cursor-color="#f87171"
                            data-cursor-label={armed ? "Confirmar" : "Eliminar"}
                            className={`press flex h-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition ${
                              armed
                                ? "border border-red-400/40 bg-red-500/20 px-2.5 text-red-300"
                                : "w-9 text-[var(--faint)] hover:bg-red-500/15 hover:text-red-300"
                            }`}
                          >
                            {armed ? "¿Seguro?" : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {empty && (
                <EmptyState
                  icon={<Sparkles className="h-5 w-5" />}
                  title="Nada agendado para este día"
                  hint="Creá una tarea rápida o traé un proyecto existente con los botones de abajo."
                />
              )}
            </div>
          );
        })()}
      </Modal>

      {/* ============ Modal: nueva tarea rápida ============ */}
      <Modal
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        title="Nueva tarea"
        description={selected ? cap(dayLabel(selected)) : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTaskOpen(false)}>Cancelar</Button>
            <Button onClick={addTask} disabled={!draft.title.trim()}>
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Título">
            <Input
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="Ej: Grabar reel del sérum"
            />
          </Field>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Responsable</span>
            <OwnerPicker value={draft.owner} onChange={(o) => setDraft((d) => ({ ...d, owner: o }))} />
          </div>
        </div>
      </Modal>

      {/* ============ Modal: agendar proyecto existente ============ */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Agendar proyecto"
        description={selected ? `Elegí qué proyecto entrega el ${dayLabel(selected)}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>Cancelar</Button>
            <Button onClick={schedulePick} disabled={!pickId}>
              <CalendarPlus className="h-4 w-4" /> Agendar
            </Button>
          </>
        }
      >
        {activeProjects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-5 w-5" />}
            title="No hay proyectos activos"
            hint="Creá uno en el módulo Proyectos y volvé acá para ponerle fecha de entrega."
          />
        ) : (
          <div className="space-y-4">
            <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {activeProjects.map((p) => {
                const on = pickId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setPickId(p.id); setPickOwner(p.owner); }}
                    data-cursor-label="Elegir"
                    className={`press flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                      on
                        ? "border-nude/70 bg-nude/15 shadow-glow-nude"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]"
                    }`}
                  >
                    <Avatar username={p.owner} size={22} ring={on} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{p.name}</p>
                      <p className="num text-[11px] text-[var(--faint)]">
                        {p.due ? `Entrega actual: ${fmtShortDate(p.due) ?? ""}` : "Sin fecha de entrega"}
                      </p>
                    </div>
                    <StatePill state={p.status} />
                  </button>
                );
              })}
            </div>
            {pickId && (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Responsable</span>
                <OwnerPicker value={pickOwner} onChange={setPickOwner} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
