"use client";

import { useMemo, useRef, useState } from "react";
import { ExternalLink, Copy, Check, Plus, Pencil, Trash2, ImagePlus, ArrowUpRight, Quote } from "lucide-react";
import { PageHeader, Card, Button, Modal, Field, Input, Textarea, Select } from "@/components/ui";
import { TOOL_CATEGORIES } from "@/lib/data";

type Kind = "prompt" | "link";
interface Item { id: string; category: string; kind: Kind; title: string; note: string; href: string; image: string }

const CATS = TOOL_CATEGORIES.map((c) => ({ id: c.id, title: c.title, emoji: c.emoji, kind: c.kind }));
const kindOf = (cat: string): Kind => CATS.find((c) => c.id === cat)?.kind ?? "link";
const seed: Item[] = TOOL_CATEGORIES.flatMap((c) => c.items.map((it, i) => ({ id: `${c.id}-${i}`, category: c.id, kind: c.kind, title: it.label, note: it.note ?? "", href: it.href ?? "", image: "" })));
const emptyItem = (category = CATS[0].id): Item => ({ id: "", category, kind: kindOf(category), title: "", note: "", href: "", image: "" });

export default function ToolsPage() {
  const [items, setItems] = useState<Item[]>(seed);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Item | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => (filter === "all" ? items : items.filter((i) => i.category === filter)), [items, filter]);
  const copy = (text: string, id: string) => navigator.clipboard?.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(null), 1400); });
  function save() {
    if (!editing || !editing.title.trim()) return;
    const it = { ...editing, kind: kindOf(editing.category) };
    setItems((prev) => (editing.id ? prev.map((i) => (i.id === editing.id ? it : i)) : [...prev, { ...it, id: "it" + Date.now() }]));
    setEditing(null);
  }
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !editing) return;
    const r = new FileReader(); r.onload = () => setEditing((c) => (c ? { ...c, image: String(r.result) } : c)); r.readAsDataURL(f);
  }
  const catMeta = (id: string) => CATS.find((c) => c.id === id)!;

  return (
    <div>
      <PageHeader eyebrow="Recursos del equipo" title="Tools"
        description="Tu biblioteca de recursos: prompts listos para copiar, apps que se abren de un clic, GEMS, IA, ads y enlaces. Todo editable."
        action={<Button onClick={() => setEditing(emptyItem(filter === "all" ? CATS[0].id : filter))}><Plus className="h-4 w-4" /> Agregar recurso</Button>}
      />

      {/* Filter chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button onClick={() => setFilter("all")} className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${filter === "all" ? "border-white/40 bg-white text-black" : "border-white/10 text-[var(--muted)] hover:text-white"}`}>Todo <span className="opacity-60">{items.length}</span></button>
        {CATS.map((c) => {
          const n = items.filter((i) => i.category === c.id).length;
          return <button key={c.id} onClick={() => setFilter(c.id)} className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${filter === c.id ? "border-nude/50 bg-nude/15 text-white" : "border-white/10 text-[var(--muted)] hover:text-white"}`}>{c.emoji} {c.title} <span className="opacity-60">{n}</span></button>;
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item) => {
          const cat = catMeta(item.category);
          if (item.kind === "prompt") {
            return (
              <Card key={item.id} className="group flex flex-col p-5" hover={false}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 rounded-full bg-nude/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-nude"><Quote className="h-3 w-3" /> Prompt</span>
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => setEditing(item)} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] hover:text-white" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(item.id)} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] hover:text-red-300" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">{item.title}</h3>
                <div className="mb-4 flex-1 rounded-xl border border-white/8 bg-black/30 p-3 text-sm leading-relaxed text-[var(--muted)]">{item.note || "—"}</div>
                <button onClick={() => copy(item.note || item.title, item.id)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 active:scale-[0.98]">{copied === item.id ? <><Check className="h-4 w-4 text-emerald-400" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar prompt</>}</button>
              </Card>
            );
          }
          // link/app card — whole card clickable via overlay anchor
          return (
            <div key={item.id} className="glass glass-hover group relative flex flex-col overflow-hidden rounded-2xl p-5">
              {item.href && <a href={item.href} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-0" aria-label={`Abrir ${item.title}`} />}
              <div className="pointer-events-none relative z-[1] flex items-start gap-3">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xl">{cat.emoji}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--faint)]">{cat.title}</p>
                  <h3 className="truncate text-base font-semibold text-white">{item.title}</h3>
                  {item.note && <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">{item.note}</p>}
                </div>
              </div>
              <div className="relative z-[1] mt-4 flex items-center justify-between">
                {item.href ? (
                  <span className="pointer-events-none flex items-center gap-1 text-xs font-medium text-nude">Abrir <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
                ) : (
                  <button onClick={() => copy(item.note || item.title, item.id)} className="relative z-10 flex items-center gap-1 text-xs font-medium text-[var(--muted)] hover:text-white">{copied === item.id ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}</button>
                )}
                <div className="relative z-10 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => setEditing(item)} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] hover:text-white" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(item.id)} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] hover:text-red-300" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <p className="col-span-full py-12 text-center text-sm text-[var(--muted)]">Sin recursos en esta categoría. Agregá uno.</p>}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar recurso" : "Agregar recurso"}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}>
        {editing && (
          <div className="space-y-4">
            <Field label="Categoría"><Select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>{CATS.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.title}</option>)}</Select></Field>
            <Field label="Título"><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder={kindOf(editing.category) === "prompt" ? "Ej: Hook viral para Reels" : "Ej: Content Studio IA"} /></Field>
            <Field label={kindOf(editing.category) === "prompt" ? "Prompt (texto que se copia)" : "Descripción"}><Textarea rows={kindOf(editing.category) === "prompt" ? 4 : 2} value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} /></Field>
            {kindOf(editing.category) === "link" && <Field label="Link"><Input value={editing.href} onChange={(e) => setEditing({ ...editing, href: e.target.value })} placeholder="https://…" /></Field>}
            <Field label="Imagen (opcional)">
              <div className="flex items-center gap-3">
                {editing.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={onImage} className="hidden" />
                <Button variant="subtle" type="button" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" /> {editing.image ? "Cambiar" : "Subir imagen"}</Button>
                {editing.image && <button type="button" onClick={() => setEditing({ ...editing, image: "" })} className="text-xs text-[var(--faint)] hover:text-red-300">Quitar</button>}
              </div>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
