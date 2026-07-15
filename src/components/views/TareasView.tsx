"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Instagram } from "lucide-react";
import { PageHeader, Card, StatePill, taskStateClass, Button, Modal, Field, Input, Select } from "@/components/ui";
import { DAILY_TASKS, type DailyTask, type TaskState } from "@/lib/data";
import type { Role } from "@/lib/brand";

const NEXT: Record<TaskState, TaskState> = { todo: "doing", doing: "done", done: "todo" };
const PROFILES = ["bryan", "cielo", "elizabeth"];

export default function TareasView({ role, username }: { role: Role; username: string }) {
  const [tasks, setTasks] = useState<DailyTask[]>(DAILY_TASKS);
  const [tab, setTab] = useState<"mias" | "equipo">("mias");
  const [stories, setStories] = useState(3);
  const [modal, setModal] = useState(false);
  const [draft, setDraft] = useState({ name: "", icon: "✨", assignee: PROFILES[0] });
  const isAdmin = role === "admin";
  const MIN = 2, MAX = 5;

  const shown = useMemo(() => (tab === "mias" ? tasks.filter((t) => t.assignee === username) : tasks), [tasks, tab, username]);

  const cycle = (id: string) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, state: NEXT[t.state] } : t)));

  function addTask() {
    if (!draft.name.trim()) return;
    setTasks((prev) => [
      { id: "n" + Date.now(), name: draft.name.trim(), icon: draft.icon || "✨", assignee: draft.assignee, state: "todo" },
      ...prev,
    ]);
    setDraft({ name: "", icon: "✨", assignee: PROFILES[0] });
    setModal(false);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Rutina diaria"
        title="Tareas Diarias"
        description="Tareas recurrentes por perfil. Un clic cambia el estado al instante (Sin empezar → En curso → Listo). El color de fondo indica el estado."
        action={isAdmin && <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Nueva tarea</Button>}
      />

      <div className="mb-6 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
        {(["mias", "equipo"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition ${tab === t ? "bg-white text-black" : "text-[var(--muted)] hover:text-white"}`}
          >
            {t === "mias" ? "Mis tareas" : "Equipo"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2.5 lg:col-span-2">
          {shown.map((t) => (
            <button
              key={t.id}
              onClick={() => cycle(t.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors duration-150 hover:brightness-125 ${taskStateClass(t.state)}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/25 text-lg">
                  {t.state === "done" ? <Check className="h-5 w-5 text-emerald-400" /> : t.icon}
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-sm ${t.state === "done" ? "text-[var(--muted)] line-through" : "text-white"}`}>{t.name}</span>
                  {t.note && <span className="block text-[11px] text-[var(--faint)]">{t.note}</span>}
                  {tab === "equipo" && <span className="block text-[11px] capitalize text-nude/70">@{t.assignee}</span>}
                </span>
              </span>
              <StatePill state={t.state} />
            </button>
          ))}
          {shown.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 py-12 text-center text-sm text-[var(--muted)]">
              No tenés tareas asignadas hoy 🎉
            </div>
          )}
        </div>

        {/* IG Stories — segmented tracker */}
        <Card className="h-fit p-6" hover={false}>
          <div className="mb-1 flex items-center gap-2">
            <Instagram className="h-5 w-5 text-nude" />
            <h2 className="text-lg font-semibold text-white">Historias de hoy</h2>
          </div>
          <p className="mb-4 text-xs text-[var(--muted)]">Instagram · objetivo mínimo {MIN}, máximo {MAX}.</p>

          <div className="mb-3 flex gap-1.5">
            {Array.from({ length: MAX }).map((_, i) => (
              <div
                key={i}
                className={`relative h-2.5 flex-1 rounded-full transition-colors ${i < stories ? "bg-nude" : "bg-white/10"}`}
              >
                {i + 1 === MIN && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-[var(--faint)]">mín</span>}
              </div>
            ))}
          </div>

          <div className="mb-4 flex items-baseline justify-between">
            <span className="font-display text-3xl font-semibold text-white">{stories}<span className="text-base text-[var(--faint)]">/{MAX}</span></span>
            <span className={`text-xs ${stories >= MIN ? "text-emerald-300" : "text-amber-300"}`}>
              {stories >= MIN ? "Objetivo cumplido" : `Faltan ${MIN - stories}`}
            </span>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStories((s) => Math.max(0, s - 1))} className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-[var(--muted)] transition hover:text-white active:scale-95">−</button>
            <button onClick={() => setStories((s) => Math.min(MAX, s + 1))} disabled={stories >= MAX} className="flex-[2] rounded-lg bg-white/10 py-2 text-sm text-white transition hover:bg-white/15 active:scale-95 disabled:opacity-40">+ Subir historia</button>
          </div>
          <p className="mt-3 text-[11px] text-[var(--faint)]">Horarios sugeridos: 09:00 · 13:00 · 18:00</p>
        </Card>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Nueva tarea diaria"
        description="Asignala a un perfil. Podés elegir un ícono (emoji)."
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={addTask}>Crear tarea</Button></>}
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-20">
              <Field label="Ícono"><Input value={draft.icon} onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))} className="text-center text-lg" /></Field>
            </div>
            <div className="flex-1">
              <Field label="Nombre"><Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Ej: Subir Reel del día" /></Field>
            </div>
          </div>
          <Field label="Asignar a">
            <Select value={draft.assignee} onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}>
              {PROFILES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
