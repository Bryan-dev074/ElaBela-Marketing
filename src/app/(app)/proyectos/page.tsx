"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Clock, CheckCircle2, Circle, Pencil, Trash2, Archive, ArchiveRestore, CalendarPlus, FileText, ListChecks } from "lucide-react";
import { PageHeader, Card, Reveal, StatePill, Button, Modal, Field, Input, Select, Textarea } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { PROJECTS, type Project } from "@/lib/data";

const OWNERS = ["bryan", "cielo", "elizabeth"];
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d?: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "short" }) : null);

type Draft = {
  id: string; name: string; owner: string; due: string;
  contentMode: "steps" | "note"; steps: string; note: string;
};
const toDraft = (p?: Project): Draft =>
  p
    ? { id: p.id, name: p.name, owner: p.owner, due: p.due ?? "", contentMode: p.contentMode, steps: p.steps.map((s) => s.label).join("\n"), note: p.note ?? "" }
    : { id: "", name: "", owner: "cielo", due: "", contentMode: "steps", steps: "", note: "" };

export default function ProyectosPage() {
  const [projects, setProjects] = useState<Project[]>(PROJECTS);
  const [tab, setTab] = useState<"activos" | "archivados">("activos");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const open = projects.find((p) => p.id === openId) || null;
  const shown = useMemo(() => projects.filter((p) => (tab === "archivados" ? p.archived : !p.archived)), [projects, tab]);

  function toggleStep(pid: string, idx: number) {
    setProjects((prev) => prev.map((p) => {
      if (p.id !== pid) return p;
      const steps = p.steps.map((s, i) => (i === idx ? { ...s, done: !s.done } : s));
      const allDone = steps.length > 0 && steps.every((s) => s.done);
      return { ...p, steps, status: allDone ? "done" : steps.some((s) => s.done) ? "doing" : "todo" };
    }));
  }
  const patch = (id: string, up: Partial<Project>) => setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...up } : p)));
  const del = (id: string) => { setProjects((prev) => prev.filter((p) => p.id !== id)); if (openId === id) setOpenId(null); };

  function save() {
    if (!draft || !draft.name.trim()) return;
    const steps = draft.contentMode === "steps" ? draft.steps.split("\n").map((s) => s.trim()).filter(Boolean).map((label) => ({ label, done: false })) : [];
    if (draft.id) {
      setProjects((prev) => prev.map((p) => (p.id === draft.id ? { ...p, name: draft.name.trim(), owner: draft.owner, due: draft.due || undefined, contentMode: draft.contentMode, note: draft.note, steps: draft.contentMode === "steps" ? mergeSteps(p.steps, steps) : p.steps } : p)));
    } else {
      setProjects((prev) => [{ id: "pr" + Date.now(), name: draft.name.trim(), owner: draft.owner, status: "todo", createdAt: today(), due: draft.due || undefined, contentMode: draft.contentMode, steps, note: draft.note }, ...prev]);
    }
    setDraft(null);
  }
  // keep done-state of steps that still exist by label
  function mergeSteps(oldS: Project["steps"], newS: Project["steps"]) {
    return newS.map((s) => ({ label: s.label, done: oldS.find((o) => o.label === s.label)?.done ?? false }));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Iniciativas"
        title="Proyectos"
        description="Creá proyectos con checklist rápido o una nota extensa en Markdown. Editá, archivá los completos y seguí el progreso."
        action={<Button onClick={() => setDraft(toDraft())}><Plus className="h-4 w-4" /> Nuevo proyecto</Button>}
      />

      <div className="mb-6 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
        {(["activos", "archivados"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-5 py-2 text-sm font-medium capitalize transition ${tab === t ? "bg-white text-black" : "text-[var(--muted)] hover:text-white"}`}>
            {t} <span className="opacity-60">{projects.filter((p) => (t === "archivados" ? p.archived : !p.archived)).length}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((p, i) => {
          const doneSteps = p.steps.filter((s) => s.done).length;
          const pct = p.steps.length ? Math.round((doneSteps / p.steps.length) * 100) : p.status === "done" ? 100 : 0;
          return (
            <Reveal key={p.id} delay={i * 0.04}>
              <Card className="group flex h-full flex-col p-6">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <button onClick={() => setOpenId(p.id)} className="text-left text-lg font-semibold leading-tight text-white hover:text-nude">{p.name}</button>
                  <StatePill state={p.status} />
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                  <span className="flex items-center gap-1"><CalendarPlus className="h-3.5 w-3.5" /> {fmt(p.createdAt)}</span>
                  {p.due && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {fmt(p.due)}</span>}
                  <span className="capitalize text-[var(--faint)]">@{p.owner}</span>
                  <span className="flex items-center gap-1 text-[var(--faint)]">{p.contentMode === "note" ? <FileText className="h-3.5 w-3.5" /> : <ListChecks className="h-3.5 w-3.5" />}</span>
                </div>

                {p.contentMode === "steps" ? (
                  <>
                    <div className="mb-3">
                      <div className="mb-1.5 flex justify-between text-[11px] text-[var(--faint)]"><span>Progreso</span><span>{pct}%</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-nude to-nude-soft transition-all" style={{ width: `${pct}%` }} /></div>
                    </div>
                    <ul className="mb-4 space-y-1">
                      {p.steps.slice(0, 4).map((s, idx) => (
                        <li key={idx}><button onClick={() => toggleStep(p.id, idx)} className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left text-sm transition hover:bg-white/5">{s.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <Circle className="h-4 w-4 shrink-0 text-[var(--faint)]" />}<span className={s.done ? "text-[var(--faint)] line-through" : "text-[var(--muted)]"}>{s.label}</span></button></li>
                      ))}
                      {p.steps.length > 4 && <li className="pl-6 text-[11px] text-[var(--faint)]">+{p.steps.length - 4} más</li>}
                    </ul>
                  </>
                ) : (
                  <button onClick={() => setOpenId(p.id)} className="mb-4 line-clamp-3 rounded-xl border border-white/8 bg-black/20 p-3 text-left text-xs text-[var(--muted)]">{(p.note || "Sin contenido").replace(/[#*>`-]/g, "").slice(0, 140)}…</button>
                )}

                <div className="mt-auto flex items-center gap-1 border-t border-white/6 pt-3 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => setDraft(toDraft(p))} className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-[var(--muted)] hover:text-white"><Pencil className="h-3 w-3" /> Editar</button>
                  <button onClick={() => patch(p.id, { archived: !p.archived })} className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-[var(--muted)] hover:text-white">{p.archived ? <><ArchiveRestore className="h-3 w-3" /> Restaurar</> : <><Archive className="h-3 w-3" /> Archivar</>}</button>
                  <button onClick={() => del(p.id)} className="ml-auto rounded-lg border border-white/10 p-1.5 text-[var(--faint)] hover:text-red-300" aria-label="Eliminar"><Trash2 className="h-3 w-3" /></button>
                </div>
              </Card>
            </Reveal>
          );
        })}
        {shown.length === 0 && <p className="col-span-full py-12 text-center text-sm text-[var(--muted)]">{tab === "archivados" ? "Sin proyectos archivados." : "Sin proyectos activos. Creá uno."}</p>}
      </div>

      {/* View modal */}
      <Modal open={!!open} onClose={() => setOpenId(null)} wide title={open?.name ?? ""} description={open ? `Creado ${fmt(open.createdAt)}${open.due ? ` · entrega ${fmt(open.due)}` : ""} · @${open.owner}` : ""}
        footer={open && <div className="flex w-full items-center justify-between"><StatePill state={open.status} /><Button variant="ghost" onClick={() => { setOpenId(null); setDraft(toDraft(open)); }}><Pencil className="h-4 w-4" /> Editar</Button></div>}>
        {open && (open.contentMode === "note" ? <Markdown>{open.note || "_Sin contenido._"}</Markdown> : (
          <ul className="space-y-1.5">
            {open.steps.map((s, idx) => (
              <li key={idx}><button onClick={() => toggleStep(open.id, idx)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5">{s.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : <Circle className="h-5 w-5 shrink-0 text-[var(--faint)]" />}<span className={s.done ? "text-[var(--faint)] line-through" : "text-white"}>{s.label}</span></button></li>
            ))}
            {open.steps.length === 0 && <li className="text-sm text-[var(--muted)]">Sin pasos.</li>}
          </ul>
        ))}
      </Modal>

      {/* Create / edit modal */}
      <Modal open={!!draft} onClose={() => setDraft(null)} wide title={draft?.id ? "Editar proyecto" : "Nuevo proyecto"}
        footer={<><Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}>
        {draft && (
          <div className="space-y-4">
            <Field label="Nombre"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ej: Campaña Día de la Madre" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Responsable"><Select value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })}>{OWNERS.map((o) => <option key={o} value={o} className="capitalize">{o}</option>)}</Select></Field>
              <Field label="Fecha de entrega (opcional)"><Input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></Field>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Contenido</span>
              <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                <button type="button" onClick={() => setDraft({ ...draft, contentMode: "steps" })} className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${draft.contentMode === "steps" ? "bg-white text-black" : "text-[var(--muted)]"}`}><ListChecks className="h-3.5 w-3.5" /> Pasos</button>
                <button type="button" onClick={() => setDraft({ ...draft, contentMode: "note" })} className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${draft.contentMode === "note" ? "bg-white text-black" : "text-[var(--muted)]"}`}><FileText className="h-3.5 w-3.5" /> Nota / Markdown</button>
              </div>
            </div>
            {draft.contentMode === "steps" ? (
              <Field label="Pasos (uno por línea) — vista rápida de checklist"><Textarea rows={5} value={draft.steps} onChange={(e) => setDraft({ ...draft, steps: e.target.value })} placeholder={"Definir concepto\nDiseñar piezas\nProgramar publicaciones"} /></Field>
            ) : (
              <Field label="Nota (podés pegar Markdown; se renderiza con formato al abrir)"><Textarea rows={8} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder={"## Objetivo\nDescribí el proyecto…\n\n- idea 1\n- idea 2"} /></Field>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
