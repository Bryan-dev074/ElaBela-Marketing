"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, Film, FolderKanban, CheckSquare, Sparkles } from "lucide-react";
import { PageHeader, Card, Modal, Field, Input, Select, Button } from "@/components/ui";
import { SPECIAL_DATES, POST_TYPES, PROJECTS, GUIONES, DAILY_TASKS } from "@/lib/data";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const OWNERS = ["bryan", "cielo", "elizabeth"];

interface CalEvent { id: string; date: string; kind: "tarea" | "proyecto"; title: string; owner: string }

function useAgenda(events: CalEvent[]) {
  return (date: string) => ({
    special: SPECIAL_DATES.filter((s) => s.date === date),
    projects: PROJECTS.filter((p) => p.due === date && !p.archived),
    guiones: GUIONES.filter((g) => g.publish === date),
    events: events.filter((e) => e.date === date),
  });
}

export default function CalendarioPage() {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ kind: "tarea" | "proyecto" } | null>(null);
  const [draft, setDraft] = useState({ title: "", owner: "cielo" });
  const agenda = useAgenda(events);

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

  const todayIso = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const anchor = selected ? new Date(selected + "T00:00:00") : now;
  const weekDays = useMemo(() => {
    const base = new Date(anchor);
    const dow = (base.getDay() + 6) % 7;
    base.setDate(base.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(base.getDate() + i); return iso(d.getFullYear(), d.getMonth(), d.getDate()); });
  }, [anchor]);

  function addEvent() {
    if (!selected || !draft.title.trim() || !adding) return;
    setEvents((prev) => [...prev, { id: "e" + Date.now(), date: selected, kind: adding.kind, title: draft.title.trim(), owner: draft.owner }]);
    setDraft({ title: "", owner: "cielo" });
    setAdding(null);
  }
  const dayLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <PageHeader eyebrow="Programación" title="Calendario"
        description="Tocá un día para ver y agregar sus tareas, proyectos y guiones. Debajo, la semana ampliada."
        action={<div className="flex items-center gap-2">
          <button onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 }))} className="rounded-lg border border-white/10 p-2 text-[var(--muted)] transition hover:text-white" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[9rem] text-center text-sm font-medium text-white">{MESES[cursor.m]} {cursor.y}</span>
          <button onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 }))} className="rounded-lg border border-white/10 p-2 text-[var(--muted)] transition hover:text-white" aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
        </div>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <Card className="p-4 sm:p-6" hover={false}>
          <div className="mb-2 grid grid-cols-7 gap-2">{DIAS.map((d) => <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-2">
            {grid.map((d, i) => {
              if (d === null) return <div key={i} />;
              const dateIso = iso(cursor.y, cursor.m, d);
              const a = agenda(dateIso);
              const count = a.special.length + a.projects.length + a.guiones.length + a.events.length;
              const isToday = dateIso === todayIso;
              const isSel = dateIso === selected;
              const post = POST_TYPES[(d - 1) % POST_TYPES.length];
              return (
                <motion.button key={i} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.18, delay: i * 0.003 }} onClick={() => setSelected(dateIso)}
                  className={`relative flex aspect-square flex-col rounded-xl border p-2 text-left transition ${isSel ? "border-nude bg-nude/15" : isToday ? "border-nude/50 bg-nude/10" : "border-white/8 bg-white/[0.02] hover:border-white/25"}`}>
                  <span className={`text-xs ${isToday || isSel ? "font-bold text-white" : "text-[var(--faint)]"}`}>{d}</span>
                  {a.special[0] && <span className="mt-0.5 text-sm leading-none">{a.special[0].emoji}</span>}
                  <div className="mt-auto flex items-center gap-1">
                    {count > 0 ? (
                      <span className="flex flex-wrap gap-0.5">
                        {a.projects.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
                        {a.guiones.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                        {a.events.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-nude" />}
                      </span>
                    ) : <span className="h-1.5 w-1.5 rounded-full" style={{ background: post.accent }} />}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </Card>

        <Card className="p-6" hover={false}>
          <h2 className="mb-4 text-lg font-semibold text-white">Rotación de contenido</h2>
          <ul className="space-y-2.5">{POST_TYPES.map((p) => <li key={p.id} className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg text-base" style={{ background: `${p.accent}22` }}>{p.icon}</span><div><p className="text-sm text-white">{p.name}</p><p className="text-[11px] text-[var(--faint)]">{p.desc}</p></div></li>)}</ul>
          <div className="divider my-5" />
          <p className="text-[11px] text-[var(--faint)]"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-400 align-middle" />Proyecto <span className="mx-1 inline-block h-2 w-2 rounded-full bg-emerald-400 align-middle" />Guion <span className="mx-1 inline-block h-2 w-2 rounded-full bg-nude align-middle" />Evento</p>
        </Card>
      </div>

      {/* Week strip */}
      <h2 className="mb-3 mt-8 text-lg font-semibold text-white">Semana ampliada</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {weekDays.map((d) => {
          const a = agenda(d);
          const isToday = d === todayIso;
          return (
            <button key={d} onClick={() => setSelected(d)} className={`min-h-[9rem] rounded-xl border p-3 text-left transition ${isToday ? "border-nude/50 bg-nude/10" : "border-white/8 bg-white/[0.02] hover:border-white/25"}`}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{new Date(d + "T00:00:00").toLocaleDateString("es-PY", { weekday: "short", day: "numeric" })}</p>
              <div className="space-y-1.5">
                {a.special.map((s) => <p key={s.date} className="truncate rounded-md bg-white/5 px-1.5 py-1 text-[11px] text-nude">{s.emoji} {s.label}</p>)}
                {a.projects.map((p) => <p key={p.id} className="truncate rounded-md bg-blue-500/15 px-1.5 py-1 text-[11px] text-blue-200">📁 {p.name}</p>)}
                {a.guiones.map((g) => <p key={g.id} className="truncate rounded-md bg-emerald-500/15 px-1.5 py-1 text-[11px] text-emerald-200">🎬 {g.name}</p>)}
                {a.events.map((e) => <p key={e.id} className="truncate rounded-md bg-nude/15 px-1.5 py-1 text-[11px] text-nude">{e.kind === "tarea" ? "✔️" : "📌"} {e.title}</p>)}
                {a.special.length + a.projects.length + a.guiones.length + a.events.length === 0 && <p className="text-[11px] text-[var(--faint)]">—</p>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Day detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} wide title={selected ? dayLabel(selected) : ""}
        footer={<div className="flex w-full justify-end gap-2"><Button variant="subtle" onClick={() => { setAdding({ kind: "tarea" }); setDraft({ title: "", owner: "cielo" }); }}><CheckSquare className="h-4 w-4" /> Tarea</Button><Button onClick={() => { setAdding({ kind: "proyecto" }); setDraft({ title: "", owner: "cielo" }); }}><FolderKanban className="h-4 w-4" /> Proyecto</Button></div>}>
        {selected && (() => {
          const a = agenda(selected);
          const empty = a.special.length + a.projects.length + a.guiones.length + a.events.length === 0;
          return (
            <div className="space-y-4">
              {a.special.length > 0 && <div><p className="eyebrow mb-2">Fecha especial</p>{a.special.map((s) => <div key={s.date} className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm text-white"><span className="text-lg">{s.emoji}</span>{s.label}<span className="ml-auto text-[11px] text-[var(--faint)]">{s.kind}</span></div>)}</div>}
              {a.projects.length > 0 && <div><p className="eyebrow mb-2">Proyectos (entrega)</p><div className="space-y-1.5">{a.projects.map((p) => <div key={p.id} className="flex items-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-sm text-white"><FolderKanban className="h-4 w-4 text-blue-300" />{p.name}<span className="ml-auto text-[11px] capitalize text-[var(--faint)]">@{p.owner}</span></div>)}</div></div>}
              {a.guiones.length > 0 && <div><p className="eyebrow mb-2">Guiones (publicación)</p><div className="space-y-1.5">{a.guiones.map((g) => <div key={g.id} className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-white"><Film className="h-4 w-4 text-emerald-300" />{g.name}<span className="ml-auto text-[11px] capitalize text-[var(--faint)]">@{g.responsible}</span></div>)}</div></div>}
              {a.events.length > 0 && <div><p className="eyebrow mb-2">Agregado en el calendario</p><div className="space-y-1.5">{a.events.map((e) => <div key={e.id} className="flex items-center gap-2 rounded-xl border border-nude/30 bg-nude/10 px-3 py-2 text-sm text-white">{e.kind === "tarea" ? <CheckSquare className="h-4 w-4 text-nude" /> : <FolderKanban className="h-4 w-4 text-nude" />}{e.title}<span className="ml-auto text-[11px] capitalize text-[var(--faint)]">@{e.owner}</span></div>)}</div></div>}
              <div><p className="eyebrow mb-2">Rutina diaria</p><div className="flex flex-wrap gap-1.5">{DAILY_TASKS.slice(0, 8).map((t) => <span key={t.id} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-[var(--muted)]">{t.icon} {t.name}</span>)}</div></div>
              {empty && <p className="flex items-center gap-2 text-sm text-[var(--muted)]"><Sparkles className="h-4 w-4 text-nude" /> Nada agendado. Agregá una tarea o proyecto para este día.</p>}
            </div>
          );
        })()}
      </Modal>

      {/* Add task/project for the selected date */}
      <Modal open={!!adding} onClose={() => setAdding(null)} title={adding?.kind === "tarea" ? "Nueva tarea" : "Nuevo proyecto"} description={selected ? dayLabel(selected) : ""}
        footer={<><Button variant="ghost" onClick={() => setAdding(null)}>Cancelar</Button><Button onClick={addEvent}>Agregar</Button></>}>
        <div className="space-y-4">
          <Field label="Título"><Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder={adding?.kind === "tarea" ? "Ej: Grabar reel" : "Ej: Sesión de fotos"} /></Field>
          <Field label="Responsable"><Select value={draft.owner} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}>{OWNERS.map((o) => <option key={o} value={o} className="capitalize">{o}</option>)}</Select></Field>
        </div>
      </Modal>
    </div>
  );
}
