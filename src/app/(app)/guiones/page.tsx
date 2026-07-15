"use client";

import { useRef, useState } from "react";
import { Film, CalendarClock, ArrowUpRight, Plus, Link2, ExternalLink, Download, Eye, Pencil, FileUp } from "lucide-react";
import { PageHeader, Card, Button, Modal, Field, Input, Textarea, Select } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { GUIONES, type Guion } from "@/lib/data";
import { parseGuionInput } from "@/lib/guion-import";

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
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [newG, setNewG] = useState({ name: "", product: "", brand: "", responsible: "cielo", publish: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const current = guiones.find((g) => g.id === openId) || null;
  const update = (id: string, patch: Partial<Guion>) => setGuiones((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  function createGuion() {
    if (!newG.name.trim()) return;
    const g: Guion = { id: "g" + Date.now(), name: newG.name.trim(), state: "falta", product: newG.product || "—", brand: newG.brand || "—", record: "", publish: newG.publish, responsible: newG.responsible, types: [], body: "" };
    setGuiones((prev) => [g, ...prev]);
    setNewG({ name: "", product: "", brand: "", responsible: "cielo", publish: "" });
    setCreating(false);
    setOpenId(g.id);
    setMode("view");
  }

  function doImport() {
    const parsed = parseGuionInput(importText);
    if (!parsed) { setImportErr("Pegá el JSON o el Markdown del guion."); return; }
    const g: Guion = {
      id: "g" + Date.now(), name: parsed.name!, state: parsed.state ?? "listo", product: parsed.product ?? "—", brand: parsed.brand ?? "ElaBela",
      record: "", publish: "", responsible: "cielo", types: parsed.types ?? [], body: parsed.body ?? "",
    };
    setGuiones((prev) => [g, ...prev]);
    setImportText(""); setImportErr(null); setImporting(false);
    setOpenId(g.id); setMode("view");
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result));
    reader.readAsText(f);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Producción de video"
        title="Guiones"
        description="Tablero por estado con color. Tocá una tarjeta para leer el guion completo con formato. Importá guiones creados en Content Studio IA."
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setImporting(true)}><Download className="h-4 w-4" /> Importar</Button>
            <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nuevo</Button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const cards = guiones.filter((g) => g.state === col.key);
          return (
            <div key={col.key}>
              <div className="mb-3 flex items-center justify-between px-1"><span className="flex items-center gap-2 text-sm font-semibold text-white"><span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} /> {col.label}</span><span className="text-xs text-[var(--faint)]">{cards.length}</span></div>
              <div className="space-y-3">
                {cards.map((g) => (
                  <button key={g.id} onClick={() => { setOpenId(g.id); setMode("view"); }} className={`w-full rounded-xl border p-4 text-left transition hover:brightness-125 ${bgOf(g.state)}`}>
                    <div className="mb-2 flex items-start justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Film className="h-4 w-4 text-nude" /> {g.name}</h3><ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--faint)]" /></div>
                    <p className="mb-2 text-xs text-[var(--muted)]">{g.product} · <span className="text-nude">{g.brand}</span></p>
                    <div className="mb-2 flex flex-wrap gap-1.5">{g.types.map((t) => <span key={t} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-[var(--muted)]">{t}</span>)}</div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--faint)]"><span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{g.publish ? new Date(g.publish + "T00:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "short" }) : "sin fecha"}</span><span className="capitalize">@{g.responsible}</span></div>
                  </button>
                ))}
                {cards.length === 0 && <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-[var(--faint)]">Sin guiones</div>}
              </div>
            </div>
          );
        })}
      </div>

      <a href="https://content-studio-ia.vercel.app/" target="_blank" rel="noopener noreferrer" className="glass glass-hover mt-8 flex items-center justify-between gap-3 rounded-2xl border border-nude/25 p-5">
        <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-nude/15"><Link2 className="h-5 w-5 text-nude" /></span><span><span className="block text-sm font-semibold text-white">Content Studio IA</span><span className="block text-xs text-[var(--muted)]">Crear guiones con IA · <span className="text-emerald-400">🟢 Producción</span></span></span></span>
        <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white">Abrir <ExternalLink className="h-3.5 w-3.5" /></span>
      </a>

      {/* Detail modal (view/edit) */}
      <Modal open={!!current} onClose={() => setOpenId(null)} wide title={current?.name ?? ""} description={current ? `${current.product} · ${current.brand}` : ""}
        footer={current && (
          <div className="flex w-full items-center justify-between">
            <div className="flex gap-1.5">{STATES.map((s) => <button key={s} onClick={() => update(current.id, { state: s })} className={`rounded-lg border px-3 py-1.5 text-xs capitalize transition ${current.state === s ? bgOf(s) + " text-white" : "border-white/10 text-[var(--muted)] hover:text-white"}`}>{s}</button>)}</div>
            <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
              <button onClick={() => setMode("view")} className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs ${mode === "view" ? "bg-white text-black" : "text-[var(--muted)]"}`}><Eye className="h-3.5 w-3.5" /> Vista</button>
              <button onClick={() => setMode("edit")} className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs ${mode === "edit" ? "bg-white text-black" : "text-[var(--muted)]"}`}><Pencil className="h-3.5 w-3.5" /> Editar</button>
            </div>
          </div>
        )}>
        {current && (mode === "view" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              {current.publish && <span>📅 Publica {new Date(current.publish + "T00:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "short" })}</span>}
              {current.link && <a href={current.link} target="_blank" rel="noopener noreferrer" className="text-nude underline">Ver recurso</a>}
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              {current.body ? <Markdown>{current.body}</Markdown> : <p className="text-sm text-[var(--muted)]">Sin guion escrito todavía. Tocá «Editar».</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Grabación"><Input type="date" value={current.record} onChange={(e) => update(current.id, { record: e.target.value })} /></Field>
              <Field label="Publicación"><Input type="date" value={current.publish} onChange={(e) => update(current.id, { publish: e.target.value })} /></Field>
            </div>
            <Field label="Responsable"><Select value={current.responsible} onChange={(e) => update(current.id, { responsible: e.target.value })}>{["bryan", "cielo", "elizabeth"].map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}</Select></Field>
            <Field label="Link del recurso"><Input value={current.link ?? ""} onChange={(e) => update(current.id, { link: e.target.value })} placeholder="https://…" /></Field>
            <Field label="Guion (Markdown)"><Textarea rows={9} value={current.body ?? ""} onChange={(e) => update(current.id, { body: e.target.value })} placeholder="Escribí el guion… (soporta Markdown)" /></Field>
          </div>
        ))}
      </Modal>

      {/* Import modal */}
      <Modal open={importing} onClose={() => setImporting(false)} wide title="Importar guion" description="Pegá el JSON o el Markdown exportado desde Content Studio IA, o subí el archivo."
        footer={<><Button variant="ghost" onClick={() => setImporting(false)}>Cancelar</Button><Button onClick={doImport}>Importar</Button></>}>
        <div className="space-y-3">
          <input ref={fileRef} type="file" accept=".json,.md,.txt" onChange={onFile} className="hidden" />
          <Button variant="subtle" type="button" onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4" /> Subir archivo (.json / .md)</Button>
          <Textarea rows={10} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='Pegá acá el JSON del guion (ScriptResult / SavedScript) o el Markdown exportado…' className="font-mono text-xs" />
          {importErr && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{importErr}</p>}
          <p className="text-[11px] text-[var(--faint)]">En Content Studio IA: descargá el guion (Markdown) o su JSON y pegalo acá. Se mapea a nombre, producto, marca y cuerpo con formato.</p>
        </div>
      </Modal>

      {/* Create modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo guion"
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button><Button onClick={createGuion}>Crear</Button></>}>
        <div className="space-y-4">
          <Field label="Nombre"><Input value={newG.name} onChange={(e) => setNewG((s) => ({ ...s, name: e.target.value }))} placeholder="Ej: Tutorial de labial" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Producto"><Input value={newG.product} onChange={(e) => setNewG((s) => ({ ...s, product: e.target.value }))} /></Field><Field label="Marca"><Input value={newG.brand} onChange={(e) => setNewG((s) => ({ ...s, brand: e.target.value }))} /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Responsable"><Select value={newG.responsible} onChange={(e) => setNewG((s) => ({ ...s, responsible: e.target.value }))}>{["bryan", "cielo", "elizabeth"].map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}</Select></Field><Field label="Publicación"><Input type="date" value={newG.publish} onChange={(e) => setNewG((s) => ({ ...s, publish: e.target.value }))} /></Field></div>
        </div>
      </Modal>
    </div>
  );
}
