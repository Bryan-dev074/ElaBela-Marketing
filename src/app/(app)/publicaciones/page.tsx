"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Plus, Pencil } from "lucide-react";
import { PageHeader, Card, Reveal, Button, Modal, Field, Input, Textarea } from "@/components/ui";
import { POST_TYPES, WEEKLY_REQS, type PostType } from "@/lib/data";

const EMPTY: PostType = { id: "", name: "", icon: "✨", desc: "", accent: "#d6ab99", example: "" };

function status(pct: number) {
  if (pct >= 100) return { icon: <CheckCircle2 className="h-4 w-4" />, label: "Cumplido", cls: "text-emerald-300" };
  if (pct >= 60) return { icon: <AlertTriangle className="h-4 w-4" />, label: "Parcial", cls: "text-amber-300" };
  return { icon: <XCircle className="h-4 w-4" />, label: "No cumplido", cls: "text-red-300" };
}

export default function PublicacionesPage() {
  const [types, setTypes] = useState<PostType[]>(POST_TYPES);
  const [editing, setEditing] = useState<PostType | null>(null);

  function save() {
    if (!editing || !editing.name.trim()) return;
    setTypes((prev) => {
      if (editing.id) return prev.map((t) => (t.id === editing.id ? editing : t));
      return [...prev, { ...editing, id: "p" + Date.now() }];
    });
    setEditing(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Contenido"
        title="Publicaciones"
        description="El motor de programación decide qué tipo de post toca cada día. Podés crear tipos nuevos, editarlos y guardar un ejemplo de referencia."
        action={<Button onClick={() => setEditing({ ...EMPTY })}><Plus className="h-4 w-4" /> Nuevo tipo</Button>}
      />

      <h2 className="mb-4 text-lg font-semibold text-white">Tipos de post</h2>
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.04}>
            <Card className="group flex h-full flex-col p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ background: `${p.accent}22`, boxShadow: `0 8px 30px -12px ${p.accent}` }}>{p.icon}</div>
                <button onClick={() => setEditing(p)} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] opacity-0 transition group-hover:opacity-100 hover:text-white" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button>
              </div>
              <h3 className="text-lg font-semibold text-white">{p.name}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{p.desc}</p>
              {p.example && (
                <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--faint)]">Ejemplo</p>
                  <p className="text-xs text-[var(--muted)]">{p.example}</p>
                </div>
              )}
            </Card>
          </Reveal>
        ))}
      </div>

      <h2 className="mb-4 text-lg font-semibold text-white">Cumplimiento semanal</h2>
      <Card className="overflow-hidden" hover={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/8 text-[var(--muted)]">
                <th className="px-5 py-3 font-medium">Plataforma</th><th className="px-5 py-3 font-medium">Formato</th>
                <th className="px-5 py-3 font-medium">Meta</th><th className="px-5 py-3 font-medium">Avance</th><th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {WEEKLY_REQS.map((r, i) => {
                const pct = Math.round((r.done / r.target) * 100);
                const s = status(pct);
                return (
                  <motion.tr key={r.platform + r.format} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="border-b border-white/6 last:border-0">
                    <td className="px-5 py-4 font-medium text-white">{r.platform}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{r.format}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{r.freq}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-400" : pct >= 60 ? "bg-blue-400" : "bg-amber-400"}`} style={{ width: `${pct}%` }} /></div>
                        <span className="text-xs text-[var(--faint)]">{r.done}/{r.target}</span>
                      </div>
                    </td>
                    <td className={`px-5 py-4 ${s.cls}`}><span className="inline-flex items-center gap-1.5">{s.icon}{s.label}</span></td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Editar tipo de post" : "Nuevo tipo de post"}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}
      >
        {editing && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-20"><Field label="Ícono"><Input value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} className="text-center text-lg" /></Field></div>
              <div className="flex-1"><Field label="Nombre"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ej: Reel Tutorial" /></Field></div>
              <div className="w-20"><Field label="Color"><input type="color" value={editing.accent} onChange={(e) => setEditing({ ...editing, accent: e.target.value })} className="h-[42px] w-full cursor-pointer rounded-lg border border-white/10 bg-transparent" /></Field></div>
            </div>
            <Field label="Descripción"><Input value={editing.desc} onChange={(e) => setEditing({ ...editing, desc: e.target.value })} /></Field>
            <Field label="Ejemplo de referencia"><Textarea rows={3} value={editing.example ?? ""} onChange={(e) => setEditing({ ...editing, example: e.target.value })} placeholder="Describí cómo se ve un buen post de este tipo…" /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
