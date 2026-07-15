"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, Users, FolderKanban, TrendingUp, ArrowUpRight, CalendarDays, Clock, Check } from "lucide-react";
import { Card, Reveal, StatCard, StatePill, taskStateClass } from "@/components/ui";
import { DAILY_TASKS, PROJECTS, SPECIAL_DATES, WEEKLY_REQS, STORY_CONFIG, type DailyTask, type TaskState } from "@/lib/data";
import type { Role } from "@/lib/brand";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const NEXT: Record<TaskState, TaskState> = { todo: "doing", doing: "done", done: "todo" };

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export default function DashboardView({ name, username, role }: { name: string; username: string; role: Role }) {
  const [tasks, setTasks] = useState<DailyTask[]>(DAILY_TASKS);
  const cycle = (id: string) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, state: NEXT[t.state] } : t)));

  const mine = tasks.filter((t) => t.assignee === username);
  const team = tasks.filter((t) => t.assignee !== username);
  const myDone = mine.filter((t) => t.state === "done").length;
  const teamDone = team.filter((t) => t.state === "done").length;
  const activeProjects = PROJECTS.filter((p) => p.status === "doing" && !p.archived).length;
  const wkDone = WEEKLY_REQS.reduce((a, r) => a + r.done, 0);
  const wkTarget = WEEKLY_REQS.reduce((a, r) => a + r.target, 0);
  const compliance = Math.round((wkDone / wkTarget) * 100);
  const myStories = STORY_CONFIG.filter((s) => s.assignee === username);
  const today = new Date().toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long" });
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <div>
      <motion.header initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
        <p className="eyebrow mb-2 capitalize">{today}</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">{greeting()}, <span className="text-nude">{name.split(" ")[0]}</span></h1>
        <p className="mt-3 text-sm text-[var(--muted)]">Tocá tus tareas para cambiar su estado. Cada clic también mueve el fondo.</p>
      </motion.header>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Reveal><StatCard label="Mis tareas" value={`${myDone}/${mine.length || 0}`} hint="listas hoy" icon={<CheckCircle2 className="h-5 w-5" />} /></Reveal>
        <Reveal delay={0.05}><StatCard label="Equipo" value={`${teamDone}/${team.length}`} hint="listas hoy" icon={<Users className="h-5 w-5" />} /></Reveal>
        <Reveal delay={0.1}><StatCard label="Proyectos" value={String(activeProjects)} hint="en progreso" icon={<FolderKanban className="h-5 w-5" />} /></Reveal>
        <Reveal delay={0.15}><StatCard label="Cumplimiento" value={`${compliance}%`} hint={`${wkDone}/${wkTarget} esta semana`} icon={<TrendingUp className="h-5 w-5" />} /></Reveal>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Reveal delay={0.1}>
          <Card className="flex h-full flex-col p-6" hover={false}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Mis tareas</h2>
              <Link href="/tareas" className="flex items-center gap-1 text-xs text-nude transition hover:text-white">Ver todas <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </div>
            <div className="space-y-2">
              {mine.length ? mine.map((t) => (
                <button key={t.id} onClick={() => cycle(t.id)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-150 hover:brightness-125 ${taskStateClass(t.state)}`}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-black/25 text-sm">{t.state === "done" ? <Check className="h-4 w-4 text-emerald-400" /> : t.icon}</span>
                    <span className={`truncate text-sm ${t.state === "done" ? "text-[var(--muted)] line-through" : "text-white"}`}>{t.name}</span>
                  </span>
                  <StatePill state={t.state} />
                </button>
              )) : <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-[var(--muted)]">Sin tareas asignadas hoy 🎉</p>}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.15}>
          <Card className="flex h-full flex-col p-6" hover={false}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Tareas del equipo</h2><span className="text-xs text-[var(--faint)]">{teamDone}/{team.length} listas</span></div>
            <div className="space-y-2">
              {team.slice(0, 6).map((t) => (
                <div key={t.id} className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 ${taskStateClass(t.state)}`}>
                  <span className="flex min-w-0 items-center gap-2.5"><span className="text-base">{t.icon}</span><span className="min-w-0"><span className={`block truncate text-sm ${t.state === "done" ? "text-[var(--muted)] line-through" : "text-white"}`}>{t.name}</span><span className="text-[11px] capitalize text-[var(--faint)]">@{t.assignee}</span></span></span>
                  <StatePill state={t.state} />
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      {/* Story schedules for me */}
      {myStories.length > 0 && (
        <Reveal delay={0.1} className="mb-6">
          <Card className="p-6" hover={false}>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-white"><Clock className="h-5 w-5 text-nude" /> Tus horarios de historias hoy</h2>
            <p className="mb-4 text-xs text-[var(--muted)]">Te toca subir historias en estos horarios.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {myStories.map((s) => (
                <div key={s.platform} className="rounded-xl border border-white/8 bg-black/20 p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><span>{s.icon}</span> {s.platform}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.schedules.map((h) => <span key={h} className="rounded-full border border-nude/30 bg-nude/10 px-2.5 py-1 text-xs text-nude">{h}</span>)}
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--faint)]">Mín {s.min} · máx {s.max}</p>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Reveal delay={0.1} className="lg:col-span-2">
          <Card className="p-6" hover={false}>
            <h2 className="mb-4 text-lg font-semibold text-white">Cumplimiento semanal</h2>
            <div className="space-y-4">
              {WEEKLY_REQS.map((r) => {
                const pct = Math.round((r.done / r.target) * 100);
                return (
                  <div key={r.platform + r.format}>
                    <div className="mb-1.5 flex items-center justify-between text-xs"><span className="text-white">{r.platform} · <span className="text-[var(--muted)]">{r.format}</span></span><span className="text-[var(--muted)]">{r.done}/{r.target} · {r.freq}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/8"><motion.div initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-400" : pct >= 60 ? "bg-blue-400" : "bg-amber-400"}`} /></div>
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
                {DIAS.map((d, i) => <div key={d} className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] ${i === todayIdx ? "bg-white/10 text-white" : "text-[var(--faint)]"}`}><span>{d}</span><span className={`h-1.5 w-1.5 rounded-full ${i <= todayIdx ? "bg-nude" : "bg-white/15"}`} /></div>)}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.2}>
            <Card className="p-6" hover={false}>
              <div className="mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-nude" /><h2 className="text-lg font-semibold text-white">Próximas fechas</h2></div>
              <ul className="space-y-3">
                {SPECIAL_DATES.slice(0, 3).map((s) => (
                  <li key={s.date} className="flex items-center gap-3"><span className="text-xl">{s.emoji}</span><div className="min-w-0"><p className="truncate text-sm text-white">{s.label}</p><p className="text-[11px] text-[var(--faint)]">{new Date(s.date + "T00:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "long" })}{s.kind === "festivo" ? " · Feriado" : " · Marketing"}</p></div></li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
