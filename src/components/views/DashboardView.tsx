"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, animate, useMotionValue } from "framer-motion";
import { CheckCircle2, Users, FolderKanban, TrendingUp, ArrowUpRight, CalendarDays, Check } from "lucide-react";
import { Card, Reveal, StatePill, taskStateClass, stateCursorProps, EmptyState, IconGlyph, Modal, Field, Input, Button } from "@/components/ui";
import { Avatar, AvatarStack, OwnerPicker } from "@/components/Avatar";
import { StoryCard } from "@/components/StoryCard";
import { TimeListEditor } from "@/components/TimePicker";
import { SPECIAL_DATES, storyDoneToday, taskAppliesToday, taskAssigneeToday, taskMineToday, todayIso, todayWeekday, type StoryPlatform, type TaskState } from "@/lib/data";
import { useDailyTasks, useProjects, useStoryConfig } from "@/lib/db";
import { useProfiles } from "@/lib/profiles";
import { useToday } from "@/lib/useToday";
import type { Role } from "@/lib/brand";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const NEXT: Record<TaskState, TaskState> = { todo: "doing", doing: "done", done: "todo" };
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

/** Número que cuenta hacia arriba con framer-motion (tabular via .num). */
function AnimatedNumber({ value, className = "" }: { value: number; className?: string }) {
  const mv = useMotionValue(0);
  const [text, setText] = useState("0");
  useEffect(() => {
    const unsub = mv.on("change", (v) => setText(String(Math.round(v))));
    const controls = animate(mv, value, { duration: 0.9, ease: EASE });
    return () => {
      unsub();
      controls.stop();
    };
  }, [value, mv]);
  return <span className={`num ${className}`}>{text}</span>;
}

/** StatCard local con valor animado (misma anatomía que StatCard de ui). */
function Stat({
  label,
  icon,
  value,
  hint,
  delay = 0,
}: {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <Card className="card-sheen h-full p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow">{label}</span>
          <span className="text-[var(--muted)]">{icon}</span>
        </div>
        <p className="font-display text-3xl font-semibold text-white">{value}</p>
        {hint}
      </Card>
    </Reveal>
  );
}

const countdownLabel = (days: number) => (days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`);

export default function DashboardView({ name, username, role }: { name: string; username: string; role: Role }) {
  // Cambia cuando arranca un nuevo día (aunque la pestaña quede abierta):
  // re-renderiza y los filtros/turnos diarios se recalculan solos.
  const hoy = useToday();
  const { items: tasks, update: updateTask } = useDailyTasks();
  const { items: projects } = useProjects();
  const { items: stories, update: updateStory } = useStoryConfig();
  const { profiles } = useProfiles();
  const [cfg, setCfg] = useState<StoryPlatform | null>(null);
  const cycle = (id: string) => { const t = tasks.find((x) => x.id === id); if (t) updateTask(id, { state: NEXT[t.state] }); };

  // El contador de historias es DIARIO: si `doneDate` no es hoy, arranca de 0.
  const bumpStory = (platform: string, d: number) => {
    const s = stories.find((x) => x.platform === platform);
    if (!s) return;
    const next = Math.max(0, Math.min(s.max, storyDoneToday(s) + d));
    updateStory(platform, { done: next, doneDate: todayIso() });
  };

  function saveCfg() {
    if (!cfg) return;
    const max = Math.max(1, cfg.max);
    const min = Math.max(0, Math.min(cfg.min, max));
    updateStory(cfg.platform, { ...cfg, max, min, done: Math.min(storyDoneToday(cfg), max), doneDate: todayIso() });
    setCfg(null);
  }

  // Solo las tareas diarias que tocan hoy (según sus días configurados).
  // Las rotativas pertenecen a TODOS los del grupo (cualquiera puede cubrirlas);
  // el chip de turno marca a quién le toca hoy.
  const todays = tasks.filter(taskAppliesToday);
  const mine = todays.filter((t) => taskMineToday(t, username));
  const team = todays.filter((t) => !taskMineToday(t, username));
  const myDone = mine.filter((t) => t.state === "done").length;
  const teamDone = team.filter((t) => t.state === "done").length;
  const teamMembers = Array.from(new Set(team.map((t) => taskAssigneeToday(t))));
  const activeProjects = projects.filter((p) => p.status === "doing" && !p.archived).length;
  // Cumplimiento del DÍA: tareas listas hoy sobre el total que aplica hoy.
  const todaysDone = myDone + teamDone;
  const dayPct = todays.length ? Math.round((todaysDone / todays.length) * 100) : 0;
  const today = new Date(hoy + "T00:00:00").toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long" });
  const todayIdx = todayWeekday();

  // Próximas fechas: solo desde hoy, ordenadas, con cuenta regresiva
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const upcoming = SPECIAL_DATES
    .map((s) => ({ ...s, when: new Date(s.date + "T00:00:00") }))
    .filter((s) => s.when.getTime() >= startToday.getTime())
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .slice(0, 4);
  const daysUntil = (d: Date) => Math.round((d.getTime() - startToday.getTime()) / 86400000);

  return (
    <div>
      <motion.header initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="mb-8">
        <p className="eyebrow mb-2 capitalize">{today}</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">
          {greeting()}, <span className="glow-text">{name.split(" ")[0]}</span>
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">Tocá una tarea para pasarla de estado. Hoy solo aparecen las que tocan hoy.</p>
      </motion.header>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Mis tareas"
          icon={<CheckCircle2 className="h-5 w-5" />}
          value={<><AnimatedNumber value={myDone} /><span className="mx-0.5 text-xl text-[var(--faint)]">/</span><AnimatedNumber value={mine.length} /></>}
          hint={<p className="mt-1 text-xs text-[var(--muted)]">listas hoy</p>}
        />
        <Stat
          delay={0.05}
          label="Equipo"
          icon={<Users className="h-5 w-5" />}
          value={<><AnimatedNumber value={teamDone} /><span className="mx-0.5 text-xl text-[var(--faint)]">/</span><AnimatedNumber value={team.length} /></>}
          hint={<p className="mt-1 text-xs text-[var(--muted)]">listas hoy</p>}
        />
        <Stat
          delay={0.1}
          label="Proyectos"
          icon={<FolderKanban className="h-5 w-5" />}
          value={<AnimatedNumber value={activeProjects} />}
          hint={<p className="mt-1 text-xs text-[var(--muted)]">en progreso</p>}
        />
        <Stat
          delay={0.15}
          label="Cumplimiento"
          icon={<TrendingUp className="h-5 w-5" />}
          value={<><AnimatedNumber value={dayPct} /><span className="text-xl text-[var(--muted)]">%</span></>}
          hint={
            <div className="mt-2.5">
              <div className="h-1 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full animate-shimmer rounded-full"
                  style={{
                    width: `${Math.min(dayPct, 100)}%`,
                    background: "linear-gradient(90deg, #b98a76, #ffe4d3, #d6ab99, #b98a76)",
                    backgroundSize: "200% 100%",
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs text-[var(--muted)]">del día completado</p>
            </div>
          }
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Punto focal de la vista */}
        <Reveal delay={0.1}>
          <Card className="ring-glow flex h-full flex-col p-6" hover={false}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Mis tareas</h2>
              <Link href="/tareas" data-cursor-label="Abrir" className="glow-link flex items-center gap-1 text-xs text-nude transition hover:text-white">
                Ver todas <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-2">
              {mine.length ? (
                mine.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => cycle(t.id)}
                    {...stateCursorProps(t.state)}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className={`press animate-fade-up flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-150 hover:brightness-125 ${taskStateClass(t.state)}`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/25 text-sm">
                        {t.state === "done" ? <Check className="h-4 w-4 text-emerald-400" /> : <IconGlyph icon={t.icon} size={t.icon.startsWith("data:") || t.icon.startsWith("http") ? 28 : 16} rounded="rounded-md" />}
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate text-sm ${t.state === "done" ? "text-[var(--muted)] line-through" : "text-white"}`}>{t.name}</span>
                        {t.rotation && t.rotation.length > 1 && (
                          <span
                            className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                              taskAssigneeToday(t) === username
                                ? "border-nude/50 bg-nude/15 text-nude"
                                : "border-white/10 bg-white/5 text-[var(--muted)]"
                            }`}
                          >
                            <Avatar username={taskAssigneeToday(t)} size={12} />
                            {taskAssigneeToday(t) === username ? "te toca hoy" : <>hoy: <span className="capitalize">{taskAssigneeToday(t)}</span></>}
                          </span>
                        )}
                      </span>
                    </span>
                    <StatePill state={t.state} pulse />
                  </button>
                ))
              ) : (
                <EmptyState icon="🌙" title="Sin tareas para hoy" hint="Nada de lo tuyo toca hoy. Aprovechá para adelantar un proyecto." />
              )}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.15}>
          <Card className="card-sheen flex h-full flex-col p-6" hover={false}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-semibold text-white">Tareas del equipo</h2>
                {teamMembers.length > 0 && <AvatarStack usernames={teamMembers} size={20} />}
              </div>
              <span className="num text-xs text-[var(--faint)]">{teamDone}/{team.length} listas</span>
            </div>
            <div className="space-y-2">
              {team.length ? (
                team.slice(0, 6).map((t, i) => (
                  <div
                    key={t.id}
                    {...stateCursorProps(t.state)}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className={`animate-fade-up flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 ${taskStateClass(t.state)}`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <IconGlyph icon={t.icon} size={t.icon.startsWith("data:") || t.icon.startsWith("http") ? 26 : 18} rounded="rounded-md" />
                      <span className="min-w-0">
                        <span className={`block truncate text-sm ${t.state === "done" ? "text-[var(--muted)] line-through" : "text-white"}`}>{t.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] capitalize text-[var(--faint)]">
                          <Avatar username={taskAssigneeToday(t)} size={14} /> {taskAssigneeToday(t)}
                        </span>
                      </span>
                    </span>
                    <StatePill state={t.state} pulse />
                  </div>
                ))
              ) : (
                <EmptyState icon="🫧" title="El equipo está libre hoy" hint="Ninguna tarea del resto del equipo toca hoy." />
              )}
            </div>
          </Card>
        </Reveal>
      </div>

      {/* Historias de hoy — contador diario por plataforma */}
      {stories.length > 0 && (
        <section className="mb-6">
          <Reveal delay={0.05}>
            <p className="eyebrow glow-text mb-3">Historias de hoy</p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((s, i) => (
              <Reveal key={s.platform} delay={0.08 + i * 0.05}>
                <StoryCard
                  s={s}
                  isAdmin={role === "admin"}
                  onCfg={() => setCfg({ ...s })}
                  onBump={(d) => bumpStory(s.platform, d)}
                />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Reveal delay={0.1} className="lg:col-span-2">
          <Card className="card-sheen h-full p-6" hover={false}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">El equipo hoy</h2>
              <span className="num text-xs text-[var(--faint)]">tareas del día</span>
            </div>

            {/* Total del día, grande */}
            <p className="font-display text-4xl font-semibold text-white">
              <AnimatedNumber value={todaysDone} />
              <span className="mx-1 text-2xl text-[var(--faint)]">/</span>
              <AnimatedNumber value={todays.length} />
              <span className="ml-2 text-sm font-normal text-[var(--muted)]">listas</span>
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full animate-shimmer rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(dayPct, 100)}%`,
                  background: "linear-gradient(90deg, #b98a76, #ffe4d3, #d6ab99, #b98a76)",
                  backgroundSize: "200% 100%",
                }}
              />
            </div>

            {/* Una fila por perfil */}
            <div className="mt-6 space-y-3.5">
              {profiles.map((p, i) => {
                const pTasks = todays.filter((t) => taskMineToday(t, p.username));
                const pDone = pTasks.filter((t) => t.state === "done").length;
                const pPct = pTasks.length ? Math.round((pDone / pTasks.length) * 100) : 0;
                const none = pTasks.length === 0;
                return (
                  <div
                    key={p.username}
                    style={{ animationDelay: `${i * 50}ms` }}
                    className={`animate-fade-up flex items-center gap-3 ${none ? "opacity-45" : ""}`}
                  >
                    <Avatar username={p.username} size={24} ring={!none && pPct >= 100} />
                    <span className="w-24 shrink-0 truncate text-sm capitalize text-white">{p.fullName || p.username}</span>
                    {none ? (
                      <span className="text-xs text-[var(--faint)]">sin tareas hoy</span>
                    ) : (
                      <>
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${Math.min(pPct, 100)}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease: EASE }}
                            className={`h-full rounded-full ${pPct >= 100 ? "bg-emerald-400" : "bg-nude"}`}
                          />
                        </div>
                        <span className={`num w-12 shrink-0 text-right text-xs ${pPct >= 100 ? "text-emerald-300" : "text-[var(--muted)]"}`}>
                          {pDone}/{pTasks.length}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </Reveal>

        <div className="space-y-6">
          <Reveal delay={0.15}>
            <Card className="p-6" hover={false}>
              <h2 className="mb-4 text-lg font-semibold text-white">Semana</h2>
              <div className="grid grid-cols-7 gap-1.5">
                {DIAS.map((d, i) => (
                  <div
                    key={d}
                    className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] transition ${
                      i === todayIdx
                        ? "border border-nude/30 bg-nude/15 font-semibold text-nude shadow-[0_0_22px_-6px_rgba(214,171,153,0.8)]"
                        : "text-[var(--faint)]"
                    }`}
                  >
                    <span>{d}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${i === todayIdx ? "glow-pulse bg-nude" : i < todayIdx ? "bg-nude/70" : "bg-white/15"}`} />
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.2}>
            <Card className="card-sheen p-6" hover={false}>
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-nude" />
                <h2 className="text-lg font-semibold text-white">Próximas fechas</h2>
              </div>
              {upcoming.length ? (
                <ul className="space-y-3.5">
                  {upcoming.map((s, i) => {
                    const days = daysUntil(s.when);
                    return (
                      <li key={s.date} style={{ animationDelay: `${i * 50}ms` }} className="animate-fade-up flex items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-nude/10 text-lg ${i === 0 ? "glow-pulse" : ""}`}>
                          {s.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-white">{s.label}</p>
                          <p className="text-[11px] text-[var(--faint)]">
                            {s.when.toLocaleDateString("es-PY", { day: "numeric", month: "long" })}
                            {s.kind === "festivo" ? " · Feriado" : " · Marketing"}
                          </p>
                        </div>
                        <span className={`num shrink-0 text-[11px] font-medium ${i === 0 ? "glow-text" : "text-[var(--muted)]"}`}>
                          {countdownLabel(days)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState icon="🗓️" title="Sin fechas próximas" hint="No hay fechas especiales en el horizonte." />
              )}
            </Card>
          </Reveal>
        </div>
      </div>

      {/* -------- Config de historias (solo admin) -------- */}
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
