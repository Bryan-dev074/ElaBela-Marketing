"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  FolderKanban,
  Instagram,
  TrendingUp,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";
import { Card, Reveal, StatCard, StatePill } from "@/components/ui";
import { DAILY_TASKS, PROJECTS, SPECIAL_DATES, WEEKLY_REQS } from "@/lib/data";
import type { Role } from "@/lib/brand";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export default function DashboardView({ name, role }: { name: string; role: Role }) {
  const done = DAILY_TASKS.filter((t) => t.state === "done").length;
  const doing = DAILY_TASKS.filter((t) => t.state === "doing").length;
  const inProgress = PROJECTS.filter((p) => p.status === "doing").length;
  const today = new Date().toLocaleDateString("es-PY", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <div>
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <p className="eyebrow mb-2 capitalize">{today}</p>
        <h1 className="text-4xl sm:text-5xl">
          {greeting()}, <span className="text-gradient">{name.split(" ")[0]}</span>
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Este es el pulso de ElaBela hoy. Cada clic también mueve el fondo ✨
        </p>
      </motion.header>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Reveal delay={0}>
          <StatCard label="Tareas listas" value={`${done}/${DAILY_TASKS.length}`} hint={`${doing} en curso`} icon={<CheckCircle2 className="h-5 w-5" />} />
        </Reveal>
        <Reveal delay={0.05}>
          <StatCard label="Proyectos activos" value={String(inProgress)} hint="en progreso" icon={<FolderKanban className="h-5 w-5" />} />
        </Reveal>
        <Reveal delay={0.1}>
          <StatCard label="Historias IG" value="3/2" hint="mín. cumplido · máx 5" icon={<Instagram className="h-5 w-5" />} />
        </Reveal>
        <Reveal delay={0.15}>
          <StatCard label="Cumplimiento" value="78%" hint="semana en curso" icon={<TrendingUp className="h-5 w-5" />} />
        </Reveal>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's tasks */}
        <Reveal delay={0.1} className="lg:col-span-2">
          <Card className="p-6" hover={false}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl text-cream">Tareas de hoy</h2>
              <Link href="/tareas" className="flex items-center gap-1 text-xs text-terra hover:text-cream">
                Ver todas <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ul className="space-y-2">
              {DAILY_TASKS.slice(0, 7).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-black/15 px-4 py-3 transition hover:border-terra/30"
                >
                  <span className="flex items-center gap-3 text-sm text-[var(--text)]">
                    <span className="text-lg">{t.icon}</span>
                    {t.name}
                  </span>
                  <StatePill state={t.state} />
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>

        {/* Weekly strip + special dates */}
        <div className="space-y-6">
          <Reveal delay={0.15}>
            <Card className="p-6" hover={false}>
              <h2 className="mb-4 text-xl text-cream">Panel semanal</h2>
              <div className="grid grid-cols-7 gap-1.5">
                {DIAS.map((d, i) => (
                  <div
                    key={d}
                    className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] ${
                      i === todayIdx
                        ? "bg-gradient-to-b from-terra/30 to-transparent text-cream"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    <span>{d}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${i <= todayIdx ? "bg-terra" : "bg-white/15"}`} />
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.2}>
            <Card className="p-6" hover={false}>
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-terra" />
                <h2 className="text-xl text-cream">Próximas fechas</h2>
              </div>
              <ul className="space-y-3">
                {SPECIAL_DATES.slice(0, 3).map((s) => (
                  <li key={s.date} className="flex items-center gap-3">
                    <span className="text-xl">{s.emoji}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--text)]">{s.label}</p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {new Date(s.date + "T00:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "long" })}
                        {s.kind === "festivo" ? " · Feriado" : " · Marketing"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </div>

      {/* Weekly compliance mini */}
      <Reveal delay={0.15} className="mt-6">
        <Card className="p-6" hover={false}>
          <h2 className="mb-4 text-xl text-cream">Requisitos de publicación</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WEEKLY_REQS.map((r) => (
              <div key={r.platform + r.format} className="rounded-2xl border border-[var(--border)] bg-black/15 p-4">
                <p className="text-sm font-semibold text-cream">{r.platform}</p>
                <p className="text-xs text-[var(--muted)]">{r.format} · {r.freq}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-terra to-nude"
                    style={{ width: `${Math.round(r.progress * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
