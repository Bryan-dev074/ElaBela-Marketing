"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Clock, CheckCircle2, Circle } from "lucide-react";
import { PageHeader, Card, Reveal, StatePill, Button, Modal, Field, Input, Select, Textarea } from "@/components/ui";
import { PROJECTS, type Project } from "@/lib/data";

const OWNERS = ["bryan", "cielo", "elizabeth"];

export default function ProyectosPage() {
  const [projects, setProjects] = useState<Project[]>(PROJECTS);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", owner: "cielo", due: "", steps: "" });

  function toggleStep(pid: string, idx: number) {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== pid) return p;
        const steps = p.steps.map((s, i) => (i === idx ? { ...s, done: !s.done } : s));
        const allDone = steps.length > 0 && steps.every((s) => s.done);
        return { ...p, steps, status: allDone ? "done" : steps.some((s) => s.done) ? "doing" : "todo" };
      }),
    );
  }

  function create() {
    if (!draft.name.trim()) return;
    const steps = draft.steps.split("\n").map((s) => s.trim()).filter(Boolean).map((label) => ({ label, done: false }));
    setProjects((prev) => [
      { id: "pr" + Date.now(), name: draft.name.trim(), owner: draft.owner, status: "todo", due: draft.due, steps },
      ...prev,
    ]);
    setDraft({ name: "", owner: "cielo", due: "", steps: "" });
    setCreating(false);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Iniciativas"
        title="Proyectos"
        description="Cualquier perfil puede crear un proyecto. El checklist deja ver qué se hizo y qué falta, para que otro perfil pueda continuarlo."
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nuevo proyecto</Button>}
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p, i) => {
          const doneSteps = p.steps.filter((s) => s.done).length;
          const pct = p.steps.length ? Math.round((doneSteps / p.steps.length) * 100) : 0;
          return (
            <Reveal key={p.id} delay={i * 0.05}>
              <Card className="flex h-full flex-col p-6">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold leading-tight text-white">{p.name}</h3>
                  <StatePill state={p.status} />
                </div>
                <div className="mb-4 flex items-center gap-2 text-xs text-[var(--muted)]">
                  <Clock className="h-3.5 w-3.5" />
                  {p.due ? "Entrega " + new Date(p.due + "T00:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "short" }) : "Sin fecha"}
                  <span className="text-white/20">·</span>
                  <span className="capitalize">@{p.owner}</span>
                </div>
                <div className="mb-4">
                  <div className="mb-1.5 flex justify-between text-[11px] text-[var(--faint)]"><span>Progreso</span><span>{pct}%</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-nude to-nude-soft" animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                  </div>
                </div>
                <ul className="mt-auto space-y-1">
                  {p.steps.length === 0 && <li className="text-xs text-[var(--faint)]">Sin pasos aún.</li>}
                  {p.steps.map((s, idx) => (
                    <li key={idx}>
                      <button onClick={() => toggleStep(p.id, idx)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm transition hover:bg-white/5">
                        {s.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <Circle className="h-4 w-4 shrink-0 text-[var(--faint)]" />}
                        <span className={s.done ? "text-[var(--faint)] line-through" : "text-[var(--muted)]"}>{s.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          );
        })}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nuevo proyecto"
        description="Definí el objetivo y los pasos. Podés marcarlos luego."
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button><Button onClick={create}>Crear proyecto</Button></>}
      >
        <div className="space-y-4">
          <Field label="Nombre"><Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Ej: Campaña Día de la Madre" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Responsable">
              <Select value={draft.owner} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}>
                {OWNERS.map((o) => <option key={o} value={o} className="capitalize">{o}</option>)}
              </Select>
            </Field>
            <Field label="Fecha límite"><Input type="date" value={draft.due} onChange={(e) => setDraft((d) => ({ ...d, due: e.target.value }))} /></Field>
          </div>
          <Field label="Pasos (uno por línea)">
            <Textarea rows={4} value={draft.steps} onChange={(e) => setDraft((d) => ({ ...d, steps: e.target.value }))} placeholder={"Definir concepto\nDiseñar piezas\nProgramar publicaciones"} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
