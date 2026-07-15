"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, Instagram, Sparkles } from "lucide-react";
import { PageHeader, Card, StatePill } from "@/components/ui";
import { DAILY_TASKS, type DailyTask, type TaskState } from "@/lib/data";
import type { Role } from "@/lib/brand";

const NEXT: Record<TaskState, TaskState> = { todo: "doing", doing: "done", done: "todo" };
const PROFILES = ["bryan", "cielo", "elizabeth"];

export default function TareasView({ role, username }: { role: Role; username: string }) {
  const [tasks, setTasks] = useState<DailyTask[]>(DAILY_TASKS);
  const [tab, setTab] = useState<"mias" | "equipo">("mias");
  const [stories, setStories] = useState(3);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", icon: "✨", assignee: PROFILES[0] });
  const isAdmin = role === "admin";
  const MIN = 2, MAX = 5;

  const shown = useMemo(
    () => (tab === "mias" ? tasks.filter((t) => t.assignee === username) : tasks),
    [tasks, tab, username],
  );

  function cycle(id: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, state: NEXT[t.state] } : t)));
  }
  function addTask() {
    if (!draft.name.trim()) return;
    setTasks((prev) => [
      { id: "n" + Date.now(), name: draft.name.trim(), icon: draft.icon || "✨", assignee: draft.assignee, state: "todo" },
      ...prev,
    ]);
    setDraft({ name: "", icon: "✨", assignee: PROFILES[0] });
    setAdding(false);
  }

  const pct = Math.min(stories / MIN, 1) * 100;

  return (
    <div>
      <PageHeader
        eyebrow="Rutina diaria"
        title="Tareas Diarias"
        description="Tareas recurrentes por perfil. Marcá el estado con un clic; al llegar a «Listo» se guarda en el historial."
        action={
          isAdmin && (
            <button
              onClick={() => setAdding((v) => !v)}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-terra to-chocolate px-4 py-2.5 text-sm font-semibold text-cream shadow-glow-terra transition hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> Nueva tarea
            </button>
          )
        }
      />

      <AnimatePresence>
        {adding && isAdmin && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden">
            <Card className="flex flex-wrap items-center gap-3 p-4" hover={false}>
              <input
                value={draft.icon}
                onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
                className="w-14 rounded-lg border border-[var(--border)] bg-black/20 px-2 py-2 text-center text-lg outline-none focus:border-terra/50"
                aria-label="Ícono"
              />
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Nombre de la tarea diaria"
                className="min-w-[12rem] flex-1 rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-terra/50"
              />
              <select
                value={draft.assignee}
                onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}
                className="rounded-lg border border-[var(--border)] bg-espresso-card px-3 py-2 text-sm capitalize text-[var(--text)] outline-none focus:border-terra/50"
              >
                {PROFILES.map((p) => (
                  <option key={p} value={p} className="bg-espresso-card">{p}</option>
                ))}
              </select>
              <button onClick={addTask} className="rounded-lg bg-terra/20 px-4 py-2 text-sm text-cream transition hover:bg-terra/30">
                Agregar
              </button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-6 inline-flex rounded-2xl border border-[var(--border)] bg-black/20 p-1">
        {(["mias", "equipo"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
              tab === t ? "bg-gradient-to-r from-terra to-chocolate text-cream" : "text-[var(--muted)] hover:text-cream"
            }`}
          >
            {t === "mias" ? "Mis tareas" : "Equipo"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2.5 lg:col-span-2">
          {shown.map((t) => (
            <motion.button
              layout
              key={t.id}
              onClick={() => cycle(t.id)}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-black/15 px-4 py-3.5 text-left transition hover:border-terra/30"
            >
              <span className="flex items-center gap-3">
                <motion.span
                  key={t.state}
                  initial={t.state === "done" ? { scale: 0.4, rotate: -20 } : false}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 14 }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/25 text-lg"
                >
                  {t.state === "done" ? <Check className="h-5 w-5 text-emerald-400" /> : t.icon}
                </motion.span>
                <span className="text-sm">
                  <span className={t.state === "done" ? "text-[var(--muted)] line-through" : "text-[var(--text)]"}>{t.name}</span>
                  {t.note && <span className="block text-[11px] text-[var(--muted)]">{t.note}</span>}
                  {tab === "equipo" && <span className="block text-[11px] capitalize text-nude/70">@{t.assignee}</span>}
                </span>
              </span>
              <StatePill state={t.state} />
            </motion.button>
          ))}
          {shown.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--border)] py-12 text-center text-sm text-[var(--muted)]">
              No tenés tareas asignadas hoy 🎉
            </div>
          )}
        </div>

        {/* IG Stories module */}
        <Card className="h-fit p-6" hover={false}>
          <div className="mb-4 flex items-center gap-2">
            <Instagram className="h-5 w-5 text-terra" />
            <h2 className="text-lg text-cream">Historias IG</h2>
          </div>
          <div className="mb-2 flex items-end justify-between">
            <span className="font-display text-4xl text-cream">{stories}</span>
            <span className="text-xs text-[var(--muted)]">mín {MIN} · máx {MAX}</span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-terra to-nude" animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
          </div>
          {stories >= MIN && (
            <p className="mb-3 flex items-center gap-1.5 text-xs text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" /> Mínimo cumplido — tarea en «Listo»
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setStories((s) => Math.max(0, s - 1))}
              className="flex-1 rounded-xl border border-[var(--border)] py-2 text-sm text-[var(--muted)] transition hover:text-cream"
            >
              −
            </button>
            <button
              onClick={() => setStories((s) => Math.min(MAX, s + 1))}
              disabled={stories >= MAX}
              className="flex-1 rounded-xl bg-terra/20 py-2 text-sm text-cream transition hover:bg-terra/30 disabled:opacity-40"
            >
              + Subir historia
            </button>
          </div>
          <p className="mt-3 text-[11px] text-[var(--muted)]">Horarios sugeridos: 09:00 · 13:00 · 18:00</p>
        </Card>
      </div>
    </div>
  );
}
