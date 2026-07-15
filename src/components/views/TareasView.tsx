"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Repeat, Pin, Settings2, Clock, Pencil } from "lucide-react";
import { PageHeader, Card, StatePill, taskStateClass, Button, Modal, Field, Input, Select } from "@/components/ui";
import { DAILY_TASKS, STORY_CONFIG, type DailyTask, type TaskState, type StoryPlatform } from "@/lib/data";
import type { Role } from "@/lib/brand";

const NEXT: Record<TaskState, TaskState> = { todo: "doing", doing: "done", done: "todo" };
const PROFILES = ["bryan", "cielo", "elizabeth"];

type TaskDraft = { id: string; name: string; icon: string; mode: "fixed" | "rotate"; users: string[] };
const emptyTask = (): TaskDraft => ({ id: "", name: "", icon: "✨", mode: "fixed", users: ["cielo"] });

export default function TareasView({ role, username }: { role: Role; username: string }) {
  const [tasks, setTasks] = useState<DailyTask[]>(DAILY_TASKS);
  const [stories, setStories] = useState<StoryPlatform[]>(STORY_CONFIG.map((s) => ({ ...s })));
  const [tab, setTab] = useState<"mias" | "equipo">("mias");
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [cfg, setCfg] = useState<StoryPlatform | null>(null);
  const isAdmin = role === "admin";

  const shown = useMemo(() => (tab === "mias" ? tasks.filter((t) => t.assignee === username) : tasks), [tasks, tab, username]);
  const cycle = (id: string) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, state: NEXT[t.state] } : t)));

  function saveTask() {
    if (!taskDraft || !taskDraft.name.trim()) return;
    const rotation = taskDraft.mode === "rotate" && taskDraft.users.length > 1 ? taskDraft.users : undefined;
    const assignee = taskDraft.users[0] ?? "cielo";
    if (taskDraft.id) {
      setTasks((prev) => prev.map((t) => (t.id === taskDraft.id ? { ...t, name: taskDraft.name.trim(), icon: taskDraft.icon, assignee, rotation } : t)));
    } else {
      setTasks((prev) => [{ id: "n" + Date.now(), name: taskDraft.name.trim(), icon: taskDraft.icon || "✨", assignee, state: "todo", rotation }, ...prev]);
    }
    setTaskDraft(null);
  }
  const editTask = (t: DailyTask) => setTaskDraft({ id: t.id, name: t.name, icon: t.icon, mode: t.rotation && t.rotation.length > 1 ? "rotate" : "fixed", users: t.rotation && t.rotation.length > 1 ? t.rotation : [t.assignee] });

  function saveCfg() {
    if (!cfg) return;
    setStories((prev) => prev.map((s) => (s.platform === cfg.platform ? { ...cfg, done: Math.min(cfg.done, cfg.max) } : s)));
    setCfg(null);
  }
  const bumpStory = (platform: string, d: number) => setStories((prev) => prev.map((s) => (s.platform === platform ? { ...s, done: Math.max(0, Math.min(s.max, s.done + d)) } : s)));

  return (
    <div>
      <PageHeader
        eyebrow="Rutina diaria"
        title="Tareas Diarias"
        description="Un clic cambia el estado al instante. Las tareas pueden ser fijas de un perfil o rotar entre varios; el color de fondo indica el estado."
        action={isAdmin && <Button onClick={() => setTaskDraft(emptyTask())}><Plus className="h-4 w-4" /> Nueva tarea</Button>}
      />

      <div className="mb-6 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
        {(["mias", "equipo"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-5 py-2 text-sm font-medium transition ${tab === t ? "bg-white text-black" : "text-[var(--muted)] hover:text-white"}`}>{t === "mias" ? "Mis tareas" : "Equipo"}</button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2.5 lg:col-span-2">
          {shown.map((t) => {
            const rotates = t.rotation && t.rotation.length > 1;
            return (
              <div key={t.id} className={`group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors duration-150 ${taskStateClass(t.state)}`}>
                <button onClick={() => cycle(t.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/25 text-lg">{t.state === "done" ? <Check className="h-5 w-5 text-emerald-400" /> : t.icon}</span>
                  <span className="min-w-0">
                    <span className={`block truncate text-sm ${t.state === "done" ? "text-[var(--muted)] line-through" : "text-white"}`}>{t.name}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-[var(--faint)]">
                      {rotates ? <><Repeat className="h-3 w-3 text-nude" /> Rota: {t.rotation!.join(" → ")}</> : <><Pin className="h-3 w-3" /> <span className="capitalize">@{t.assignee}</span></>}
                    </span>
                  </span>
                </button>
                <StatePill state={t.state} />
                {isAdmin && <button onClick={() => editTask(t)} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] opacity-0 transition group-hover:opacity-100 hover:text-white" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button>}
              </div>
            );
          })}
          {shown.length === 0 && <div className="rounded-xl border border-dashed border-white/10 py-12 text-center text-sm text-[var(--muted)]">No tenés tareas asignadas hoy 🎉</div>}
        </div>

        {/* Multi-platform stories */}
        <div className="space-y-4">
          {stories.map((s) => {
            const ok = s.done >= s.min;
            return (
              <Card key={s.platform} className="p-5" hover={false}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="text-lg">{s.icon}</span><h2 className="text-sm font-semibold text-white">Historias · {s.platform}</h2></div>
                  {isAdmin && <button onClick={() => setCfg({ ...s })} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] transition hover:text-white" aria-label="Configurar"><Settings2 className="h-3.5 w-3.5" /></button>}
                </div>
                <div className="mb-2 flex gap-1.5">
                  {Array.from({ length: s.max }).map((_, i) => (
                    <div key={i} className={`relative h-2 flex-1 rounded-full transition-colors ${i < s.done ? "bg-nude" : "bg-white/10"}`}>
                      {i + 1 === s.min && s.min < s.max && <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[8px] text-[var(--faint)]">mín</span>}
                    </div>
                  ))}
                </div>
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="font-display text-2xl font-semibold text-white">{s.done}<span className="text-sm text-[var(--faint)]">/{s.max}</span></span>
                  <span className={`text-[11px] ${ok ? "text-emerald-300" : "text-amber-300"}`}>{ok ? "Cumplido" : `Faltan ${s.min - s.done}`}</span>
                </div>
                <div className="mb-2 flex gap-2">
                  <button onClick={() => bumpStory(s.platform, -1)} className="flex-1 rounded-lg border border-white/10 py-1.5 text-sm text-[var(--muted)] transition hover:text-white active:scale-95">−</button>
                  <button onClick={() => bumpStory(s.platform, 1)} disabled={s.done >= s.max} className="flex-[2] rounded-lg bg-white/10 py-1.5 text-sm text-white transition hover:bg-white/15 active:scale-95 disabled:opacity-40">+ Subir</button>
                </div>
                <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--faint)]"><Clock className="h-3 w-3" /> {s.schedules.join(" · ")} <span className="text-white/20">·</span> <span className="capitalize">@{s.assignee}</span></p>
              </Card>
            );
          })}
        </div>
      </div>

      {/* New / edit task */}
      <Modal open={!!taskDraft} onClose={() => setTaskDraft(null)} title={taskDraft?.id ? "Editar tarea" : "Nueva tarea diaria"} description="Elegí si es fija de un perfil o rota entre varios."
        footer={<><Button variant="ghost" onClick={() => setTaskDraft(null)}>Cancelar</Button><Button onClick={saveTask}>Guardar</Button></>}>
        {taskDraft && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-20"><Field label="Ícono"><Input value={taskDraft.icon} onChange={(e) => setTaskDraft({ ...taskDraft, icon: e.target.value })} className="text-center text-lg" /></Field></div>
              <div className="flex-1"><Field label="Nombre"><Input value={taskDraft.name} onChange={(e) => setTaskDraft({ ...taskDraft, name: e.target.value })} placeholder="Ej: Subir Reel del día" /></Field></div>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Asignación</span>
              <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                <button type="button" onClick={() => setTaskDraft({ ...taskDraft, mode: "fixed", users: [taskDraft.users[0] ?? "cielo"] })} className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${taskDraft.mode === "fixed" ? "bg-white text-black" : "text-[var(--muted)]"}`}><Pin className="h-3.5 w-3.5" /> Fija</button>
                <button type="button" onClick={() => setTaskDraft({ ...taskDraft, mode: "rotate", users: taskDraft.users.length > 1 ? taskDraft.users : ["cielo", "elizabeth"] })} className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${taskDraft.mode === "rotate" ? "bg-white text-black" : "text-[var(--muted)]"}`}><Repeat className="h-3.5 w-3.5" /> Rota</button>
              </div>
            </div>
            {taskDraft.mode === "fixed" ? (
              <Field label="Perfil asignado"><Select value={taskDraft.users[0]} onChange={(e) => setTaskDraft({ ...taskDraft, users: [e.target.value] })}>{PROFILES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}</Select></Field>
            ) : (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Rota entre (en orden)</span>
                <div className="flex flex-wrap gap-2">
                  {PROFILES.map((p) => {
                    const on = taskDraft.users.includes(p);
                    return <button key={p} type="button" onClick={() => setTaskDraft({ ...taskDraft, users: on ? taskDraft.users.filter((u) => u !== p) : [...taskDraft.users, p] })} className={`rounded-full border px-3.5 py-1.5 text-xs capitalize transition ${on ? "border-nude/50 bg-nude/15 text-white" : "border-white/10 text-[var(--muted)]"}`}>{p}</button>;
                  })}
                </div>
                {taskDraft.users.length > 1 && <p className="mt-2 text-[11px] text-[var(--faint)]">Secuencia: {taskDraft.users.join(" → ")} → (repite)</p>}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Story config (admin) */}
      <Modal open={!!cfg} onClose={() => setCfg(null)} title={cfg ? `Configurar historias · ${cfg.platform}` : ""} description="Mínimo, máximo, horarios y responsable de hoy."
        footer={<><Button variant="ghost" onClick={() => setCfg(null)}>Cancelar</Button><Button onClick={saveCfg}>Guardar</Button></>}>
        {cfg && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mínimo"><Input type="number" min={0} value={cfg.min} onChange={(e) => setCfg({ ...cfg, min: Math.max(0, Number(e.target.value)) })} /></Field>
              <Field label="Máximo"><Input type="number" min={1} value={cfg.max} onChange={(e) => setCfg({ ...cfg, max: Math.max(1, Number(e.target.value)) })} /></Field>
            </div>
            <Field label="Horarios (separados por coma)"><Input value={cfg.schedules.join(", ")} onChange={(e) => setCfg({ ...cfg, schedules: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="09:00, 13:00, 18:00" /></Field>
            <Field label="Responsable de hoy"><Select value={cfg.assignee} onChange={(e) => setCfg({ ...cfg, assignee: e.target.value })}>{PROFILES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}</Select></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
