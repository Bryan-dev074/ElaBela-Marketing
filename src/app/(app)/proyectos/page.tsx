"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Clock, CheckCircle2, Circle } from "lucide-react";
import { PageHeader, Card, Reveal, StatePill } from "@/components/ui";
import { PROJECTS, type Project } from "@/lib/data";

export default function ProyectosPage() {
  const [projects, setProjects] = useState<Project[]>(PROJECTS);

  function toggleStep(pid: string, idx: number) {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== pid) return p;
        const steps = p.steps.map((s, i) => (i === idx ? { ...s, done: !s.done } : s));
        const allDone = steps.every((s) => s.done);
        return { ...p, steps, status: allDone ? "done" : steps.some((s) => s.done) ? "doing" : "todo" };
      }),
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Iniciativas"
        title="Proyectos"
        description="Cualquier perfil puede crear un proyecto. El checklist deja ver qué se hizo y qué falta, para que otro perfil pueda continuarlo."
        action={
          <button className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-terra to-chocolate px-4 py-2.5 text-sm font-semibold text-cream shadow-glow-terra transition hover:brightness-110">
            <Plus className="h-4 w-4" /> Nuevo proyecto
          </button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p, i) => {
          const doneSteps = p.steps.filter((s) => s.done).length;
          const pct = Math.round((doneSteps / p.steps.length) * 100);
          return (
            <Reveal key={p.id} delay={i * 0.06}>
              <Card className="flex h-full flex-col p-6">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="text-lg leading-tight text-cream">{p.name}</h3>
                  <StatePill state={p.status} />
                </div>
                <div className="mb-4 flex items-center gap-2 text-xs text-[var(--muted)]">
                  <Clock className="h-3.5 w-3.5" />
                  Entrega {new Date(p.due + "T00:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "short" })}
                  <span className="text-[var(--border)]">·</span>
                  <span className="capitalize">@{p.owner}</span>
                </div>

                <div className="mb-4">
                  <div className="mb-1.5 flex justify-between text-[11px] text-[var(--muted)]">
                    <span>Progreso</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-terra to-nude"
                      animate={{ width: `${pct}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    />
                  </div>
                </div>

                <ul className="mt-auto space-y-1.5">
                  {p.steps.map((s, idx) => (
                    <li key={idx}>
                      <button
                        onClick={() => toggleStep(p.id, idx)}
                        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm transition hover:bg-white/5"
                      >
                        {s.done ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                        )}
                        <span className={s.done ? "text-[var(--muted)] line-through" : "text-[var(--text)]"}>
                          {s.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
