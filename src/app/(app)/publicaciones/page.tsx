"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Plus, Pencil, Trash2, ImagePlus, Sparkles } from "lucide-react";
import { PageHeader, Card, Reveal, Button, Modal, Field, Input, Textarea, EmptyState } from "@/components/ui";
import { IconPicker } from "@/components/IconPicker";
import { WEEKLY_REQS, type PostType } from "@/lib/data";
import { usePostTypes } from "@/lib/db";
import { fileToImage } from "@/lib/profiles";

const EMPTY: PostType = { id: "", name: "", icon: "✨", desc: "", accent: "#d6ab99", example: "", exampleImage: "" };

function status(pct: number) {
  if (pct >= 100) return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Cumplido", pill: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" };
  if (pct >= 60) return { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "Parcial", pill: "border-amber-400/25 bg-amber-400/10 text-amber-300" };
  return { icon: <XCircle className="h-3.5 w-3.5" />, label: "No cumplido", pill: "border-red-400/25 bg-red-500/10 text-red-300" };
}

function TypeCard({ p, onEdit, onDelete }: { p: PostType; onEdit: () => void; onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (armTimer.current) clearTimeout(armTimer.current); }, []);

  const handleDelete = () => {
    if (armed) {
      if (armTimer.current) clearTimeout(armTimer.current);
      onDelete();
      return;
    }
    setArmed(true);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmed(false), 2600);
  };

  return (
    <Card className="card-sheen group flex h-full flex-col overflow-hidden p-0">
      {p.exampleImage && (
        <div className="h-36 w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.exampleImage} alt="" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shadow-[0_8px_30px_-12px_var(--tile)] transition-shadow duration-300 group-hover:shadow-[0_10px_48px_-8px_var(--tile)]"
            style={{ background: `${p.accent}22`, "--tile": p.accent } as React.CSSProperties}
          >
            {p.icon}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="press rounded-lg border border-white/10 p-1.5 text-[var(--faint)] opacity-0 transition hover:border-white/20 hover:text-white group-hover:opacity-100"
              aria-label="Editar tipo de post"
              data-cursor-label="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className={`press flex items-center justify-center rounded-lg border text-xs transition ${
                armed
                  ? "border-red-400/40 bg-red-500/15 px-2 py-1 font-medium text-red-300 opacity-100"
                  : "border-white/10 p-1.5 text-[var(--faint)] opacity-0 hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
              }`}
              aria-label={armed ? "Confirmar eliminación" : "Eliminar tipo de post"}
              data-cursor-label={armed ? "Confirmar" : "Eliminar"}
              data-cursor-color="#f87171"
            >
              {armed ? "¿Seguro?" : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-white">{p.name}</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">{p.desc}</p>
        {p.example && (
          <div className="mt-3 rounded-xl border border-white/8 bg-black/25 p-3">
            <span
              className="mb-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
              style={{ background: `${p.accent}18`, color: p.accent, border: `1px solid ${p.accent}33` }}
            >
              Ejemplo
            </span>
            <p className="text-xs leading-relaxed text-[var(--muted)]">{p.example}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function PublicacionesPage() {
  const { items: types, add, update, remove } = usePostTypes();
  const [editing, setEditing] = useState<PostType | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function save() {
    if (!editing || !editing.name.trim()) return;
    if (editing.id) update(editing.id, editing);
    else add({ ...editing, id: "p" + Date.now() });
    setEditing(null);
  }
  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !editing) return;
    fileToImage(f, 800)
      .then((img) => setEditing((cur) => (cur ? { ...cur, exampleImage: img } : cur)))
      .catch(() => {
        // Fallback: si la compresión falla, se guarda el data URL original sin comprimir.
        const reader = new FileReader();
        reader.onload = () => setEditing((cur) => (cur ? { ...cur, exampleImage: String(reader.result) } : cur));
        reader.readAsDataURL(f);
      });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Contenido"
        title="Publicaciones"
        description="El motor de programación decide qué tipo de post toca cada día. Creá tipos nuevos, editalos y subí una imagen de ejemplo real como referencia."
        action={<Button onClick={() => setEditing({ ...EMPTY })}><Plus className="h-4 w-4" /> Nuevo tipo</Button>}
      />

      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="text-lg font-semibold text-white">Tipos de post</h2>
        <span className="glow-text num text-sm font-semibold">{types.length}</span>
      </div>
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.04}>
            <TypeCard p={p} onEdit={() => setEditing(p)} onDelete={() => remove(p.id)} />
          </Reveal>
        ))}
        {types.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState
              icon={<Sparkles className="h-5 w-5" />}
              title="Sin tipos de post"
              hint="Creá el primero para que el motor sepa qué programar cada día."
              action={<Button onClick={() => setEditing({ ...EMPTY })}><Plus className="h-4 w-4" /> Nuevo tipo</Button>}
            />
          </div>
        )}
      </div>

      <h2 className="mb-4 text-lg font-semibold text-white">Cumplimiento semanal</h2>
      <Card className="overflow-hidden" hover={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead><tr className="border-b border-white/8 text-[var(--muted)]"><th className="px-5 py-3 font-medium">Plataforma</th><th className="px-5 py-3 font-medium">Formato</th><th className="px-5 py-3 font-medium">Meta</th><th className="px-5 py-3 font-medium">Avance</th><th className="px-5 py-3 font-medium">Estado</th></tr></thead>
            <tbody>
              {WEEKLY_REQS.map((r, i) => {
                const pct = Math.round((r.done / r.target) * 100);
                const s = status(pct);
                return (
                  <motion.tr key={r.platform + r.format} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="border-b border-white/6 transition-colors last:border-0 hover:bg-white/[0.02]">
                    <td className="px-5 py-4 font-medium text-white">{r.platform}</td><td className="px-5 py-4 text-[var(--muted)]">{r.format}</td><td className="px-5 py-4 text-[var(--muted)]">{r.freq}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${Math.min(100, pct)}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 + 0.15 }}
                            className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-400" : pct >= 60 ? "bg-blue-400" : "bg-amber-400"}`}
                          />
                        </div>
                        <span className="num text-xs text-[var(--faint)]">{r.done}/{r.target}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${s.pill}`}>{s.icon}{s.label}</span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar tipo de post" : "Nuevo tipo de post"}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}>
        {editing && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div>
                <Field label="Ícono">
                  <IconPicker value={editing.icon} onChange={(icon) => setEditing({ ...editing, icon })} />
                </Field>
              </div>
              <div className="flex-1"><Field label="Nombre"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ej: Reel Tutorial" /></Field></div>
              <div className="w-28">
                <Field label="Color">
                  <div className="field flex h-[42px] items-center gap-2 px-2 py-0">
                    <input
                      type="color"
                      value={editing.accent}
                      onChange={(e) => setEditing({ ...editing, accent: e.target.value })}
                      className="h-6 w-7 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0"
                      aria-label="Color del tipo de post"
                    />
                    <span className="num font-mono text-[10px] uppercase text-[var(--muted)]">{editing.accent}</span>
                  </div>
                </Field>
              </div>
            </div>
            <Field label="Descripción"><Input value={editing.desc} onChange={(e) => setEditing({ ...editing, desc: e.target.value })} /></Field>
            <Field label="Ejemplo (texto)"><Textarea rows={2} value={editing.example ?? ""} onChange={(e) => setEditing({ ...editing, example: e.target.value })} placeholder="Cómo se ve un buen post de este tipo…" /></Field>
            <Field label="Imagen de ejemplo (propia)">
              <div className="flex items-center gap-3">
                {editing.exampleImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.exampleImage} alt="" className="h-16 w-24 rounded-lg border border-white/10 object-cover" />
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={onImage} className="hidden" />
                <Button variant="subtle" type="button" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" /> {editing.exampleImage ? "Cambiar" : "Subir imagen"}</Button>
                {editing.exampleImage && <button type="button" onClick={() => setEditing({ ...editing, exampleImage: "" })} className="text-xs text-[var(--faint)] transition hover:text-red-300" data-cursor-label="Quitar" data-cursor-color="#f87171">Quitar</button>}
              </div>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
