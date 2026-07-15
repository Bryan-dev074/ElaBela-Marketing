"use client";

import { useState } from "react";
import { Film, CalendarClock, ArrowUpRight, Plus, Link2, ExternalLink } from "lucide-react";
import { PageHeader, Card, Button, Modal, Field, Input, Textarea, Select } from "@/components/ui";
import { GUIONES, type Guion } from "@/lib/data";

const COLUMNS: { key: Guion["state"]; label: string; dot: string; bg: string }[] = [
  { key: "falta", label: "Falta grabar", dot: "bg-amber-400", bg: "state-amber" },
  { key: "editando", label: "Editando", dot: "bg-blue-400", bg: "state-doing" },
  { key: "listo", label: "Listo", dot: "bg-emerald-400", bg: "state-done" },
];
const bgOf = (s: Guion["state"]) => COLUMNS.find((c) => c.key === s)!.bg;
const STATES: Guion["state"][] = ["falta", "editando", "listo"];

export default function GuionesPage() {
  const [guiones, setGuiones] = useState<Guion[]>(GUIONES);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newG, setNewG] = useState({ name: "", product: "", brand: "", responsible: "cielo", publish: "" });

  const current = guiones.find((g) => g.id === openId) || null;

  const update = (id: string, patch: Partial<Guion>) =>
    setGuiones((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  function createGuion() {
    if (!newG.name.trim()) return;
    const g: Guion = {
      id: "g" + Date.now(), name: newG.name.trim(), state: "falta",
      product: newG.product || "—", brand: newG.brand || "—", record: "", publish: newG.publish,
      responsible: newG.responsible, types: [], body: "",
    };
    setGuiones((prev) => [g, ...prev]);
    setNewG({ name: "", product: "", brand: "", responsible: "cielo", publish: "" });
    setCreating(false);
    setOpenId(g.id);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Producción de video"
        title="Guiones"
        description="Tablero por estado. Cada tarjeta cambia de color según su estado. Tocá una para abrir el guion completo y editarlo."
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nuevo guion</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const cards = guiones.filter((g) => g.state === col.key);
          return (
            <div key={col.key}>
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} /> {col.label}
                </span>
                <span className="text-xs text-[var(--faint)]">{cards.length}</span>
              </div>
              <div className="space-y-3">
                {cards.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setOpenId(g.id)}
                    className={`w-full rounded-xl border p-4 text-left transition hover:brightness-125 ${bgOf(g.state)}`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Film className="h-4 w-4 text-nude" /> {g.name}</h3>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--faint)]" />
                    </div>
                    <p className="mb-2 text-xs text-[var(--muted)]">{g.product} · <span className="text-nude">{g.brand}</span></p>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {g.types.map((t) => <span key={t} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-[var(--muted)]">{t}</span>)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--faint)]">
                      <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{g.publish ? new Date(g.publish + "T00:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "short" }) : "sin fecha"}</span>
                      <span className="capitalize">@{g.responsible}</span>
                    </div>
                  </button>
                ))}
                {cards.length === 0 && <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-[var(--faint)]">Sin guiones</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Content Studio — clearly a link */}
      <a
        href="https://content-studio-ia.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="glass glass-hover mt-8 flex items-center justify-between gap-3 rounded-2xl border border-nude/25 p-5"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-nude/15"><Link2 className="h-5 w-5 text-nude" /></span>
          <span>
            <span className="block text-sm font-semibold text-white">Content Studio IA</span>
            <span className="block text-xs text-[var(--muted)]">Automatización y control estético de marca · <span className="text-emerald-400">🟢 Producción</span></span>
          </span>
        </span>
        <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white">Abrir <ExternalLink className="h-3.5 w-3.5" /></span>
      </a>

      {/* Detail / edit modal */}
      <Modal
        open={!!current}
        onClose={() => setOpenId(null)}
        wide
        title={current?.name ?? ""}
        description={current ? `${current.product} · ${current.brand}` : ""}
        footer={current && (
          <div className="flex w-full items-center justify-between">
            <div className="flex gap-1.5">
              {STATES.map((s) => (
                <button
                  key={s}
                  onClick={() => update(current.id, { state: s })}
                  className={`rounded-lg border px-3 py-1.5 text-xs capitalize transition ${current.state === s ? bgOf(s) + " text-white" : "border-white/10 text-[var(--muted)] hover:text-white"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <Button onClick={() => setOpenId(null)}>Guardar</Button>
          </div>
        )}
      >
        {current && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Grabación"><Input type="date" value={current.record} onChange={(e) => update(current.id, { record: e.target.value })} /></Field>
              <Field label="Publicación"><Input type="date" value={current.publish} onChange={(e) => update(current.id, { publish: e.target.value })} /></Field>
            </div>
            <Field label="Responsable">
              <Select value={current.responsible} onChange={(e) => update(current.id, { responsible: e.target.value })}>
                {["bryan", "cielo", "elizabeth"].map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </Select>
            </Field>
            <Field label="Link del recurso (Drive, IG, etc.)">
              <Input value={current.link ?? ""} onChange={(e) => update(current.id, { link: e.target.value })} placeholder="https://…" />
            </Field>
            <Field label="Guion / notas">
              <Textarea rows={7} value={current.body ?? ""} onChange={(e) => update(current.id, { body: e.target.value })} placeholder="Escribí el guion completo…" />
            </Field>
          </div>
        )}
      </Modal>

      {/* Create modal */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nuevo guion"
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button><Button onClick={createGuion}>Crear</Button></>}
      >
        <div className="space-y-4">
          <Field label="Nombre"><Input value={newG.name} onChange={(e) => setNewG((s) => ({ ...s, name: e.target.value }))} placeholder="Ej: Tutorial de labial" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Producto"><Input value={newG.product} onChange={(e) => setNewG((s) => ({ ...s, product: e.target.value }))} /></Field>
            <Field label="Marca"><Input value={newG.brand} onChange={(e) => setNewG((s) => ({ ...s, brand: e.target.value }))} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Responsable">
              <Select value={newG.responsible} onChange={(e) => setNewG((s) => ({ ...s, responsible: e.target.value }))}>
                {["bryan", "cielo", "elizabeth"].map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </Select>
            </Field>
            <Field label="Publicación"><Input type="date" value={newG.publish} onChange={(e) => setNewG((s) => ({ ...s, publish: e.target.value }))} /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
