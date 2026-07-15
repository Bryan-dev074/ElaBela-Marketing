"use client";

import { useRef, useState } from "react";
import { ExternalLink, Copy, Check, Plus, Pencil, Trash2, ImagePlus } from "lucide-react";
import { PageHeader, Card, Reveal, Button, Modal, Field, Input, Textarea, Select } from "@/components/ui";
import { TOOL_CATEGORIES } from "@/lib/data";

interface Item { id: string; category: string; title: string; note: string; href: string; image: string }

const seed: Item[] = TOOL_CATEGORIES.flatMap((c) =>
  c.items.map((it, i) => ({ id: `${c.id}-${i}`, category: c.id, title: it.label, note: it.note ?? "", href: it.href ?? "", image: "" })),
);
const CATS = TOOL_CATEGORIES.map((c) => ({ id: c.id, title: c.title, emoji: c.emoji }));
const emptyItem = (): Item => ({ id: "", category: CATS[0].id, title: "", note: "", href: "", image: "" });

export default function ToolsPage() {
  const [items, setItems] = useState<Item[]>(seed);
  const [editing, setEditing] = useState<Item | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function copy(text: string, id: string) {
    navigator.clipboard?.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(null), 1300); });
  }
  function save() {
    if (!editing || !editing.title.trim()) return;
    setItems((prev) => (editing.id ? prev.map((i) => (i.id === editing.id ? editing : i)) : [...prev, { ...editing, id: "it" + Date.now() }]));
    setEditing(null);
  }
  function remove(id: string) { setItems((prev) => prev.filter((i) => i.id !== id)); }
  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !editing) return;
    const reader = new FileReader();
    reader.onload = () => setEditing((cur) => (cur ? { ...cur, image: String(reader.result) } : cur));
    reader.readAsDataURL(f);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Recursos del equipo"
        title="Tools"
        description="Prompts, GEMS, apps, IA, ads y enlaces. Agregá cualquier recurso con título, descripción, link e imagen de ejemplo. Todo editable."
        action={<Button onClick={() => setEditing(emptyItem())}><Plus className="h-4 w-4" /> Agregar recurso</Button>}
      />

      <div className="grid gap-5 md:grid-cols-2">
        {CATS.map((cat, ci) => {
          const list = items.filter((i) => i.category === cat.id);
          return (
            <Reveal key={cat.id} delay={ci * 0.04}>
              <Card className="flex h-full flex-col p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-xl">{cat.emoji}</span>
                    <h3 className="text-lg font-semibold text-white">{cat.title}</h3>
                  </div>
                  <button onClick={() => setEditing({ ...emptyItem(), category: cat.id })} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] transition hover:text-white" aria-label="Agregar"><Plus className="h-4 w-4" /></button>
                </div>
                <ul className="mt-auto space-y-2">
                  {list.map((item) => (
                    <li key={item.id} className="group flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 p-2.5">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[var(--faint)]"><ImagePlus className="h-4 w-4" /></span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{item.title}</p>
                        {item.note && <p className="truncate text-[11px] text-[var(--muted)]">{item.note}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        {item.href ? (
                          <a href={item.href} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] hover:text-white" aria-label="Abrir"><ExternalLink className="h-3.5 w-3.5" /></a>
                        ) : (
                          <button onClick={() => copy(item.note || item.title, item.id)} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] hover:text-white" aria-label="Copiar">{copied === item.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}</button>
                        )}
                        <button onClick={() => setEditing(item)} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] hover:text-white" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove(item.id)} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] hover:text-red-300" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </li>
                  ))}
                  {list.length === 0 && <li className="rounded-xl border border-dashed border-white/10 py-4 text-center text-xs text-[var(--faint)]">Sin recursos</li>}
                </ul>
              </Card>
            </Reveal>
          );
        })}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Editar recurso" : "Agregar recurso"}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Categoría">
              <Select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                {CATS.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.title}</option>)}
              </Select>
            </Field>
            <Field label="Título"><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Ej: Prompt de hook viral" /></Field>
            <Field label="Descripción"><Textarea rows={2} value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} /></Field>
            <Field label="Link (opcional)"><Input value={editing.href} onChange={(e) => setEditing({ ...editing, href: e.target.value })} placeholder="https://…" /></Field>
            <Field label="Imagen de ejemplo (opcional)">
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
