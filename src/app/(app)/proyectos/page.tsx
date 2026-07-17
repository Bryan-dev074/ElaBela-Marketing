"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Clock, CheckCircle2, Circle, Pencil, Trash2, Archive, ArchiveRestore,
  CalendarPlus, FileText, ListChecks, FolderKanban,
} from "lucide-react";
import {
  PageHeader, Reveal, Button, Modal, Field, Input, Textarea,
  StateSelector, Segmented, EmptyState, stateCursorProps,
} from "@/components/ui";
import { AvatarChip, OwnerPicker } from "@/components/Avatar";
import { Markdown } from "@/components/Markdown";
import { fmtShortDate, type Project, type TaskState } from "@/lib/data";
import { useProjects } from "@/lib/db";

const today = () => new Date().toISOString().slice(0, 10);

const projectPct = (p: Project) =>
  p.steps.length ? Math.round((p.steps.filter((s) => s.done).length / p.steps.length) * 100) : p.status === "done" ? 100 : 0;

/* ---------- Anillo SVG de progreso con % al centro ---------- */
function ProgressRing({ pct, size = 52, stroke = 4 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const full = clamped >= 100;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Progreso ${clamped}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={full ? "#34d399" : "#d6ab99"} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${full ? "rgba(52,211,153,0.5)" : "rgba(214,171,153,0.5)"})` }}
        />
      </svg>
      <span className={`num absolute inset-0 flex items-center justify-center font-display text-[11px] font-semibold ${full ? "text-emerald-300" : "text-nude"}`}>
        {clamped}%
      </span>
    </div>
  );
}

/* ---------- Barra de progreso nude con shimmer permanente ---------- */
function ShimmerBar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-white/[0.08] ${className}`}>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, transformOrigin: "left" }}
        className="h-full rounded-full bg-gradient-to-r from-nude-deep via-nude-soft to-nude-deep bg-[length:200%_100%] animate-shimmer transition-[width] duration-300"
      />
    </div>
  );
}

type Draft = {
  id: string; name: string; owner: string; due: string; status: TaskState;
  contentMode: "steps" | "note"; steps: string; note: string;
};
const toDraft = (p?: Project): Draft =>
  p
    ? { id: p.id, name: p.name, owner: p.owner, due: p.due ?? "", status: p.status, contentMode: p.contentMode, steps: p.steps.map((s) => s.label).join("\n"), note: p.note ?? "" }
    : { id: "", name: "", owner: "cielo", due: "", status: "todo", contentMode: "steps", steps: "", note: "" };

export default function ProyectosPage() {
  const { items: projects, add, update, remove } = useProjects();
  const [tab, setTab] = useState<"activos" | "archivados">("activos");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = projects.find((p) => p.id === openId) || null;
  const active = useMemo(() => projects.filter((p) => !p.archived), [projects]);
  const archived = useMemo(() => projects.filter((p) => p.archived), [projects]);
  const shown = tab === "archivados" ? archived : active;

  // Mini-stats (sobre proyectos activos)
  const nDoing = active.filter((p) => p.status === "doing").length;
  const nDone = active.filter((p) => p.status === "done").length;
  const allSteps = active.flatMap((p) => p.steps);
  const globalPct = allSteps.length ? Math.round((allSteps.filter((s) => s.done).length / allSteps.length) * 100) : 0;

  function toggleStep(pid: string, idx: number) {
    const p = projects.find((x) => x.id === pid);
    if (!p) return;
    const steps = p.steps.map((s, i) => (i === idx ? { ...s, done: !s.done } : s));
    const allDone = steps.length > 0 && steps.every((s) => s.done);
    update(pid, { steps, status: allDone ? "done" : steps.some((s) => s.done) ? "doing" : "todo" });
  }
  const patch = (id: string, up: Partial<Project>) => update(id, up);

  // Eliminación en 2 clics: el primero arma «¿Seguro?», el segundo borra.
  function askDelete(id: string) {
    setConfirmDel(id);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setConfirmDel(null), 3200);
  }
  function del(id: string) {
    if (armTimer.current) clearTimeout(armTimer.current);
    setConfirmDel(null);
    remove(id);
    if (openId === id) setOpenId(null);
  }

  function save() {
    if (!draft || !draft.name.trim()) return;
    const steps = draft.contentMode === "steps" ? draft.steps.split("\n").map((s) => s.trim()).filter(Boolean).map((label) => ({ label, done: false })) : [];
    if (draft.id) {
      const existing = projects.find((p) => p.id === draft.id);
      update(draft.id, {
        name: draft.name.trim(), owner: draft.owner, due: draft.due || undefined, status: draft.status,
        contentMode: draft.contentMode, note: draft.note,
        steps: draft.contentMode === "steps" ? mergeSteps(existing?.steps ?? [], steps) : existing?.steps ?? [],
      });
    } else {
      add({ id: "pr" + Date.now(), name: draft.name.trim(), owner: draft.owner, status: "todo", createdAt: today(), due: draft.due || undefined, contentMode: draft.contentMode, steps, note: draft.note });
    }
    setDraft(null);
  }
  // conserva el done de los pasos que siguen existiendo (por label)
  function mergeSteps(oldS: Project["steps"], newS: Project["steps"]) {
    return newS.map((s) => ({ label: s.label, done: oldS.find((o) => o.label === s.label)?.done ?? false }));
  }

  const viewPct = open ? projectPct(open) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Iniciativas"
        title="Proyectos"
        description="Checklist rápido o nota larga en Markdown. Tocá una tarjeta para abrirla y cambiá el estado a mano cuando quieras — el progreso también se calcula solo al marcar pasos."
        action={<Button onClick={() => setDraft(toDraft())}><Plus className="h-4 w-4" /> Nuevo proyecto</Button>}
      />

      {/* ---- Mini-stats ---- */}
      <Reveal className="mb-8">
        <div className="ring-glow glass grid grid-cols-2 rounded-2xl md:grid-cols-4">
          <div className="p-5">
            <p className="eyebrow mb-2 flex items-center gap-1.5">
              <FolderKanban className="h-3 w-3 text-nude" /> Activos
            </p>
            <p className="num font-display text-3xl font-semibold text-white">{active.length}</p>
            <p className="mt-0.5 text-[11px] text-[var(--faint)]">proyectos en juego</p>
          </div>
          <div className="border-l border-white/5 p-5">
            <p className="eyebrow mb-2 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" /> En curso
            </p>
            <p className="num font-display text-3xl font-semibold text-blue-300">{nDoing}</p>
            <p className="mt-0.5 text-[11px] text-[var(--faint)]">avanzando ahora</p>
          </div>
          <div className="border-t border-white/5 p-5 md:border-l md:border-t-0">
            <p className="eyebrow mb-2 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Listos
            </p>
            <p className="num font-display text-3xl font-semibold text-emerald-300">{nDone}</p>
            <p className="mt-0.5 text-[11px] text-[var(--faint)]">para archivar</p>
          </div>
          <div className="flex items-center gap-4 border-l border-t border-white/5 p-5 md:border-t-0">
            <ProgressRing pct={globalPct} size={48} />
            <div className="min-w-0">
              <p className="eyebrow mb-1">Pasos</p>
              <p className="glow-text num font-display text-xl font-semibold">{allSteps.length ? `${globalPct}%` : "—"}</p>
              <p className="mt-0.5 text-[11px] text-[var(--faint)]">progreso global</p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---- Tabs ---- */}
      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-6"
        options={[
          { value: "activos", label: "Activos", badge: active.length },
          { value: "archivados", label: "Archivados", badge: archived.length },
        ]}
      />

      {/* ---- Grid de tarjetas ---- */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((p, i) => {
          const pct = projectPct(p);
          const overdue = !!p.due && p.due < today() && p.status !== "done";
          const asking = confirmDel === p.id;
          return (
            <Reveal key={p.id} delay={i * 0.05} className="h-full">
              <div
                {...stateCursorProps(p.status)}
                className="glass glass-hover card-sheen group relative flex h-full flex-col rounded-2xl p-6"
              >
                {/* Header: anillo / insignia de nota + nombre + meta */}
                <div className="mb-4 flex items-start gap-4">
                  {p.contentMode === "steps" ? (
                    <ProgressRing pct={pct} />
                  ) : (
                    <button
                      onClick={() => setOpenId(p.id)}
                      data-cursor-color="#d6ab99" data-cursor-label="Abrir nota"
                      aria-label={`Abrir nota de ${p.name}`}
                      className="glow-pulse press flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-nude/10 text-nude"
                    >
                      <FileText className="h-5 w-5" />
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => setOpenId(p.id)}
                      data-cursor-color="#d6ab99" data-cursor-label="Abrir"
                      className="line-clamp-2 text-left text-lg font-semibold leading-snug text-white transition hover:text-nude"
                    >
                      {p.name}
                    </button>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                      <AvatarChip username={p.owner} size={16} />
                      <span className="flex items-center gap-1 text-[var(--faint)]" title="Creado">
                        <CalendarPlus className="h-3 w-3" /> {fmtShortDate(p.createdAt)}
                      </span>
                      {p.due && (
                        <span className={`flex items-center gap-1 ${overdue ? "font-medium text-amber-300" : "text-[var(--faint)]"}`} title="Entrega">
                          <Clock className="h-3 w-3" /> {fmtShortDate(p.due)}{overdue && " · vencido"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Estado a mano */}
                <div className="mb-4">
                  <StateSelector size="sm" value={p.status} onChange={(s) => patch(p.id, { status: s })} />
                </div>

                {/* Contenido */}
                {p.contentMode === "steps" ? (
                  <ul className="mb-4 space-y-0.5">
                    {p.steps.slice(0, 4).map((s, idx) => (
                      <li key={idx}>
                        <button
                          onClick={() => toggleStep(p.id, idx)}
                          data-cursor-label={s.done ? "Desmarcar" : "Completar"}
                          className="press flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm transition hover:bg-white/5"
                        >
                          {s.done
                            ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                            : <Circle className="h-4 w-4 shrink-0 text-[var(--faint)]" />}
                          <span className={`truncate ${s.done ? "text-[var(--faint)] line-through" : "text-[var(--muted)]"}`}>{s.label}</span>
                        </button>
                      </li>
                    ))}
                    {p.steps.length > 4 && (
                      <li>
                        <button onClick={() => setOpenId(p.id)} className="glow-link pl-8 text-[11px] font-medium text-nude/80 transition hover:text-nude">
                          +{p.steps.length - 4} pasos más
                        </button>
                      </li>
                    )}
                    {p.steps.length === 0 && <li className="text-xs italic text-[var(--faint)]">Sin pasos definidos todavía.</li>}
                  </ul>
                ) : (
                  <button
                    onClick={() => setOpenId(p.id)}
                    className="mb-4 rounded-xl border border-white/[0.08] bg-black/25 p-3.5 text-left transition hover:border-nude/25 hover:bg-black/35"
                  >
                    <p className="line-clamp-3 text-xs leading-relaxed text-[var(--muted)]">
                      {(p.note || "Sin contenido").replace(/[#*>`_-]/g, "").trim().slice(0, 160)}
                    </p>
                    <span className="glow-text mt-2 inline-block text-[10px] font-bold uppercase tracking-[0.14em]">Leer nota →</span>
                  </button>
                )}

                {/* Acciones (aparecen al hover) */}
                <div className="mt-auto flex items-center gap-1.5 border-t border-white/[0.06] pt-3 opacity-100 transition-opacity duration-200 md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
                  <button
                    onClick={() => setDraft(toDraft(p))}
                    data-cursor-label="Editar"
                    className="press flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[11px] text-[var(--muted)] transition hover:border-white/25 hover:text-white"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                  <button
                    onClick={() => patch(p.id, { archived: !p.archived })}
                    data-cursor-label={p.archived ? "Restaurar" : "Archivar"}
                    className="press flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[11px] text-[var(--muted)] transition hover:border-white/25 hover:text-white"
                  >
                    {p.archived ? <><ArchiveRestore className="h-3 w-3" /> Restaurar</> : <><Archive className="h-3 w-3" /> Archivar</>}
                  </button>
                  <button
                    onClick={() => (asking ? del(p.id) : askDelete(p.id))}
                    data-cursor-color="#f87171" data-cursor-label={asking ? "Confirmar" : "Eliminar"}
                    aria-label={asking ? `Confirmar eliminación de ${p.name}` : `Eliminar ${p.name}`}
                    className={`press ml-auto flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition ${
                      asking
                        ? "border-red-400/60 bg-red-500/15 text-red-300"
                        : "border-white/10 text-[var(--faint)] hover:border-red-400/40 hover:text-red-300"
                    }`}
                  >
                    <Trash2 className="h-3 w-3" /> {asking && "¿Seguro?"}
                  </button>
                </div>
              </div>
            </Reveal>
          );
        })}

        {shown.length === 0 && (
          <div className="col-span-full">
            <Reveal>
              {tab === "activos" ? (
                <EmptyState
                  icon="✨"
                  title="Sin proyectos activos"
                  hint="Creá el primero: checklist de pasos rápidos o una nota larga en Markdown."
                  action={<Button onClick={() => setDraft(toDraft())}><Plus className="h-4 w-4" /> Crear proyecto</Button>}
                />
              ) : (
                <EmptyState
                  icon="📦"
                  title="Nada archivado todavía"
                  hint="Cuando un proyecto esté listo, archivalo para despejar la vista sin perder nada."
                />
              )}
            </Reveal>
          </div>
        )}
      </div>

      {/* ---- Modal de vista ---- */}
      <Modal
        open={!!open}
        onClose={() => setOpenId(null)}
        wide
        title={open?.name ?? ""}
        description={open ? `Creado el ${fmtShortDate(open.createdAt) ?? ""}${open.due ? ` · entrega ${fmtShortDate(open.due) ?? ""}` : ""}` : ""}
        footer={open && (
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <StateSelector value={open.status} onChange={(s) => patch(open.id, { status: s })} />
            <Button variant="ghost" onClick={() => { setOpenId(null); setDraft(toDraft(open)); }}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          </div>
        )}
      >
        {open && (
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
              <AvatarChip username={open.owner} size={20} />
              {open.contentMode === "steps" && open.steps.length > 0 && (
                <span className="glow-text num font-semibold">
                  {open.steps.filter((s) => s.done).length}/{open.steps.length} pasos · {viewPct}%
                </span>
              )}
              {open.contentMode === "note" && (
                <span className="flex items-center gap-1 text-[var(--faint)]"><FileText className="h-3.5 w-3.5" /> Nota en Markdown</span>
              )}
            </div>
            {open.contentMode === "steps" && open.steps.length > 0 && <ShimmerBar pct={viewPct} className="mb-5" />}
            {open.contentMode === "note" ? (
              <Markdown>{open.note || "_Sin contenido._"}</Markdown>
            ) : (
              <ul className="space-y-1">
                {open.steps.map((s, idx) => (
                  <li key={idx}>
                    <button
                      onClick={() => toggleStep(open.id, idx)}
                      data-cursor-label={s.done ? "Desmarcar" : "Completar"}
                      className="press flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/5"
                    >
                      {s.done
                        ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                        : <Circle className="h-5 w-5 shrink-0 text-[var(--faint)]" />}
                      <span className={s.done ? "text-[var(--faint)] line-through" : "text-white"}>{s.label}</span>
                    </button>
                  </li>
                ))}
                {open.steps.length === 0 && <li className="text-sm text-[var(--muted)]">Sin pasos. Tocá «Editar» para agregar.</li>}
              </ul>
            )}
          </div>
        )}
      </Modal>

      {/* ---- Modal crear / editar ---- */}
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        wide
        title={draft?.id ? "Editar proyecto" : "Nuevo proyecto"}
        description={draft?.id ? "Ajustá lo que necesites; los pasos ya marcados conservan su estado." : "Elegí checklist de pasos o una nota larga en Markdown."}
        footer={<><Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button><Button onClick={save} disabled={!draft?.name.trim()}>Guardar</Button></>}
      >
        {draft && (
          <div className="space-y-5">
            <Field label="Nombre">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ej: Campaña Día de la Madre" autoFocus />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Responsable</span>
                <OwnerPicker value={draft.owner} onChange={(o) => setDraft({ ...draft, owner: o })} />
              </div>
              <Field label="Fecha de entrega (opcional)">
                <Input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} />
              </Field>
            </div>

            {draft.id && (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Estado</span>
                <StateSelector value={draft.status} onChange={(s) => setDraft({ ...draft, status: s })} />
                <p className="mt-1.5 text-[11px] text-[var(--faint)]">Lo que elijas acá pisa el cálculo automático por pasos.</p>
              </div>
            )}

            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Contenido</span>
              <Segmented
                value={draft.contentMode}
                onChange={(v) => setDraft({ ...draft, contentMode: v })}
                options={[
                  { value: "steps", label: <><ListChecks className="h-3.5 w-3.5" /> Pasos</> },
                  { value: "note", label: <><FileText className="h-3.5 w-3.5" /> Nota · Markdown</> },
                ]}
              />
            </div>

            {draft.contentMode === "steps" ? (
              <Field label="Pasos (uno por línea) — se ven como checklist en la tarjeta">
                <Textarea rows={5} value={draft.steps} onChange={(e) => setDraft({ ...draft, steps: e.target.value })} placeholder={"Definir concepto\nDiseñar piezas\nProgramar publicaciones"} />
              </Field>
            ) : (
              <Field label="Nota (podés pegar Markdown; se renderiza con formato al abrir)">
                <Textarea rows={8} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder={"## Objetivo\nDescribí el proyecto…\n\n- idea 1\n- idea 2"} />
              </Field>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
