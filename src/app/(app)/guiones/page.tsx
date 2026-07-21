"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Film,
  CalendarClock,
  Clapperboard,
  Plus,
  Link2,
  ExternalLink,
  Download,
  Eye,
  Pencil,
  FileUp,
  Trash2,
  Check,
} from "lucide-react";
import {
  PageHeader,
  Button,
  Modal,
  Field,
  Input,
  Textarea,
  StateSelector,
  EmptyState,
} from "@/components/ui";
import { cursorIntentProps } from "@/lib/cursor-intent";
import { Avatar, AvatarChip, OwnerPicker } from "@/components/Avatar";
import { Markdown } from "@/components/Markdown";
import { type Guion, type TaskState, fmtShortDate } from "@/lib/data";
import { useGuiones } from "@/lib/db";
import { parseGuionInput } from "@/lib/guion-import";

/* ---------------- Column metadata ---------------- */

type GState = Guion["state"];

const COLUMNS: { key: GState; label: string; hint: string; dot: string; bg: string; color: string; task: TaskState }[] = [
  { key: "falta", label: "Falta grabar", hint: "Arrastrá acá lo pendiente de filmar", dot: "bg-amber-400", bg: "state-amber", color: "#f59e0b", task: "todo" },
  { key: "editando", label: "Editando", hint: "En posproducción", dot: "bg-blue-400", bg: "state-doing", color: "#3b82f6", task: "doing" },
  { key: "listo", label: "Listo", hint: "Aprobado para publicar", dot: "bg-emerald-400", bg: "state-done", color: "#22c55e", task: "done" },
];
const META = Object.fromEntries(COLUMNS.map((c) => [c.key, c])) as Record<GState, (typeof COLUMNS)[number]>;
const TASK_TO_G: Record<TaskState, GState> = { todo: "falta", doing: "editando", done: "listo" };

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Local editable copy of a guion while the modal is in edit mode. */
type Draft = {
  name: string;
  product: string;
  brand: string;
  record: string;
  publish: string;
  responsible: string;
  link: string;
  body: string;
};

const dragCursorProps = () => cursorIntentProps("drag", "Arrastrar");

/* ---------------- Page ---------------- */

export default function GuionesPage() {
  const { items: guiones, add, update, remove } = useGuiones();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newG, setNewG] = useState({ name: "", product: "", brand: "", responsible: "cielo", publish: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  /* drag & drop */
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<GState | null>(null);

  /* two-click delete (shared between card + modal, keyed by id) */
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  useEffect(() => {
    if (!confirmDel) return;
    const t = setTimeout(() => setConfirmDel(null), 3200);
    return () => clearTimeout(t);
  }, [confirmDel]);

  const current = guiones.find((g) => g.id === openId) || null;

  function openGuion(id: string) {
    setOpenId(id);
    setMode("view");
    setDraft(null);
  }

  /** Enter edit mode with a LOCAL copy — nothing hits the network until «Guardar». */
  function startEdit() {
    if (!current) return;
    setDraft({
      name: current.name,
      product: current.product,
      brand: current.brand,
      record: current.record,
      publish: current.publish,
      responsible: current.responsible,
      link: current.link ?? "",
      body: current.body ?? "",
    });
    setMode("edit");
  }

  /** Persist the draft in ONE update() call, then drop it. */
  function saveDraft() {
    if (openId && draft) {
      update(openId, {
        name: draft.name.trim() || current?.name || "Sin nombre",
        product: draft.product,
        brand: draft.brand,
        record: draft.record,
        publish: draft.publish,
        responsible: draft.responsible,
        link: draft.link.trim() ? draft.link.trim() : undefined,
        body: draft.body,
      });
    }
    setDraft(null);
  }

  function closeModal() {
    if (mode === "edit") saveDraft(); // don't lose typed changes on close
    setOpenId(null);
    setMode("view");
  }

  function deleteGuion(id: string) {
    if (confirmDel === id) {
      remove(id);
      setConfirmDel(null);
      if (openId === id) {
        setOpenId(null);
        setMode("view");
        setDraft(null);
      }
    } else {
      setConfirmDel(id);
    }
  }

  function dropOn(col: GState, e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (id) {
      const g = guiones.find((x) => x.id === id);
      if (g && g.state !== col) update(id, { state: col });
    }
    setDragId(null);
    setOverCol(null);
  }

  function createGuion() {
    if (!newG.name.trim()) return;
    const g: Guion = { id: "g" + Date.now(), name: newG.name.trim(), state: "falta", product: newG.product || "—", brand: newG.brand || "—", record: "", publish: newG.publish, responsible: newG.responsible, types: [], body: "" };
    add(g);
    setNewG({ name: "", product: "", brand: "", responsible: "cielo", publish: "" });
    setCreating(false);
    openGuion(g.id);
  }

  function doImport() {
    const parsed = parseGuionInput(importText);
    if (!parsed) { setImportErr("Pegá el JSON o el Markdown del guion."); return; }
    const g: Guion = {
      id: "g" + Date.now(), name: parsed.name!, state: parsed.state ?? "listo", product: parsed.product ?? "—", brand: parsed.brand ?? "ElaBela",
      record: "", publish: "", responsible: "cielo", types: parsed.types ?? [], body: parsed.body ?? "",
    };
    add(g);
    setImportText(""); setImportErr(null); setImporting(false);
    openGuion(g.id);
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
        description="Arrastrá las tarjetas entre columnas para mover un guion de estado. Tocá una para leerlo completo con formato, o importá lo que creaste en Content Studio IA."
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setImporting(true)}><Download className="h-4 w-4" /> Importar</Button>
            <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nuevo guion</Button>
          </div>
        }
      />

      {/* ---------------- Kanban board ---------------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        {COLUMNS.map((col, ci) => {
          const cards = guiones.filter((g) => g.state === col.key);
          const isOver = overCol === col.key;
          return (
            <motion.section
              key={col.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE, delay: ci * 0.06 }}
              aria-label={`Columna ${col.label}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overCol !== col.key) setOverCol(col.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setOverCol((c) => (c === col.key ? null : c));
                }
              }}
              onDrop={(e) => dropOn(col.key, e)}
              className={`kanban-col flex min-h-[440px] flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 ${isOver ? "drag-over" : ""}`}
            >
              <header className="mb-3 flex items-center justify-between px-2 pt-1.5">
                <span className="flex items-center gap-2.5 text-sm font-semibold text-white">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${col.dot} ${col.key === "editando" && cards.length > 0 ? "animate-pulse" : ""}`}
                    style={{ boxShadow: `0 0 12px ${col.color}66` }}
                  />
                  {col.label}
                </span>
                <span className="num rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-[var(--muted)]">
                  {cards.length}
                </span>
              </header>

              <div className="flex flex-1 flex-col gap-3">
                <AnimatePresence initial={false}>
                  {cards.map((g) => (
                    <motion.div
                      key={g.id}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.3, ease: EASE }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", g.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(g.id);
                        }}
                        onDragEnd={() => { setDragId(null); setOverCol(null); }}
                        onClick={() => openGuion(g.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openGuion(g.id); }
                        }}
                        {...dragCursorProps()}
                        className={`kanban-card card-sheen group relative w-full rounded-xl border p-4 text-left transition hover:brightness-110 ${META[g.state].bg} ${dragId === g.id ? "dragging" : ""}`}
                      >
                        {/* delete (2-click confirm), appears on hover */}
                        <button
                          type="button"
                          aria-label={confirmDel === g.id ? `Confirmar eliminación de ${g.name}` : `Eliminar ${g.name}`}
                          {...cursorIntentProps("danger", confirmDel === g.id ? "Tocá de nuevo" : "Eliminar")}
                          onClick={(e) => { e.stopPropagation(); deleteGuion(g.id); }}
                          className={`press absolute right-2 top-2 z-10 flex h-9 items-center justify-center gap-1 rounded-lg border text-[11px] transition ${
                            confirmDel === g.id
                              ? "border-red-400/50 bg-red-500/20 px-2.5 font-semibold text-red-300 opacity-100"
                              : "w-9 border-transparent text-[var(--faint)] opacity-0 hover:border-red-400/40 hover:bg-red-500/15 hover:text-red-300 focus-visible:opacity-100 group-hover:opacity-100"
                          }`}
                        >
                          {confirmDel === g.id ? "¿Seguro?" : <Trash2 className="h-3.5 w-3.5" />}
                        </button>

                        <div className="mb-2 flex items-start gap-2 pr-9">
                          <Film className="mt-0.5 h-4 w-4 shrink-0 text-nude" />
                          <h3 className="text-sm font-semibold leading-snug text-white">{g.name}</h3>
                        </div>
                        <p className="mb-2.5 text-xs text-[var(--muted)]">
                          {g.product} · <span className="text-nude">{g.brand}</span>
                        </p>
                        {g.types.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {g.types.map((t) => (
                              <span key={t} className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-[var(--muted)]">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--faint)]">
                          <span className="flex items-center gap-1.5">
                            <CalendarClock className="h-3 w-3" />
                            {fmtShortDate(g.publish) ?? "Sin fecha"}
                          </span>
                          <Avatar username={g.responsible} size={20} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {cards.length === 0 && (
                  <EmptyState
                    title="Nada por acá"
                    hint={col.hint}
                    className="flex-1 !border-white/[0.07] !py-8"
                  />
                )}
              </div>
            </motion.section>
          );
        })}
      </div>

      <p className="mt-3 px-1 text-[11px] text-[var(--faint)] lg:hidden">
        En el teléfono no hay arrastre: abrí la tarjeta y cambiá el estado desde el selector.
      </p>

      {/* ---------------- Content Studio IA (featured link) ---------------- */}
      <motion.a
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.2 }}
        href="https://content-studio-ia.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        {...cursorIntentProps("external")}
        className="ring-glow glass mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 transition hover:bg-white/[0.04]"
      >
        <span className="flex items-center gap-4">
          <span className="glow-pulse flex h-11 w-11 items-center justify-center rounded-xl bg-nude/15">
            <Link2 className="h-5 w-5 text-nude" />
          </span>
          <span>
            <span className="glow-text block text-sm font-semibold">Content Studio IA</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Generá guiones con IA y traelos con «Importar» · <span className="text-emerald-400">● Producción</span>
            </span>
          </span>
        </span>
        <span className="flex items-center gap-1.5 rounded-lg border border-nude/25 bg-nude/10 px-3.5 py-2 text-xs font-medium text-nude">
          Abrir <ExternalLink className="h-3.5 w-3.5" />
        </span>
      </motion.a>

      {/* ---------------- Detail modal (view / edit) ---------------- */}
      <Modal
        open={!!current}
        onClose={closeModal}
        wide
        title={current?.name ?? ""}
        description={current ? `${current.product} · ${current.brand}` : ""}
        footer={current && (
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <StateSelector
              size="sm"
              value={META[current.state].task}
              onChange={(s) => update(current.id, { state: TASK_TO_G[s] })}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => deleteGuion(current.id)}
                {...cursorIntentProps("danger", confirmDel === current.id ? "Tocá de nuevo" : "Eliminar")}
                className={`press flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition ${
                  confirmDel === current.id
                    ? "border-red-400/50 bg-red-500/20 text-red-300"
                    : "border-white/10 text-[var(--muted)] hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmDel === current.id ? "¿Seguro?" : "Eliminar"}
              </button>
              <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
                <button
                  onClick={() => { saveDraft(); setMode("view"); }}
                  className={`press flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${mode === "view" ? "bg-white text-black" : "text-[var(--muted)] hover:text-white"}`}
                >
                  <Eye className="h-3.5 w-3.5" /> Vista
                </button>
                <button
                  onClick={() => { if (mode !== "edit") startEdit(); }}
                  className={`press flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${mode === "edit" ? "bg-white text-black" : "text-[var(--muted)] hover:text-white"}`}
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
              </div>
              {mode === "edit" && (
                <Button onClick={() => { saveDraft(); setMode("view"); }}>
                  <Check className="h-3.5 w-3.5" /> Guardar
                </Button>
              )}
            </div>
          </div>
        )}
      >
        {current && (mode === "view" ? (
          <div className="space-y-4">
            {/* meta chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {current.record && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[var(--muted)]">
                  <Clapperboard className="h-3.5 w-3.5 text-nude" /> Graba {fmtShortDate(current.record)}
                </span>
              )}
              {current.publish && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[var(--muted)]">
                  <CalendarClock className="h-3.5 w-3.5 text-nude" /> Publica {fmtShortDate(current.publish)}
                </span>
              )}
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[var(--muted)]">
                <AvatarChip username={current.responsible} size={18} />
              </span>
              {current.link && (
                <a
                  href={current.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...cursorIntentProps("external", "Abrir recurso")}
                  className="glow-link inline-flex items-center gap-1.5 px-1 py-1.5 font-medium text-nude"
                >
                  Ver recurso <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {current.types.map((t) => (
                <span key={t} className="rounded-full border border-nude/25 bg-nude/10 px-2.5 py-1 text-[10px] text-nude">
                  {t}
                </span>
              ))}
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-black/25 p-5">
              {current.body ? (
                <Markdown>{current.body}</Markdown>
              ) : (
                <p className="text-sm text-[var(--muted)]">Sin guion escrito todavía. Tocá «Editar» y escribilo en Markdown.</p>
              )}
            </div>
          </div>
        ) : draft && (
          <div className="space-y-4">
            <Field label="Nombre"><Input value={draft.name} onChange={(e) => setDraft((d) => d && { ...d, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Producto"><Input value={draft.product} onChange={(e) => setDraft((d) => d && { ...d, product: e.target.value })} /></Field>
              <Field label="Marca"><Input value={draft.brand} onChange={(e) => setDraft((d) => d && { ...d, brand: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Grabación"><Input type="date" value={draft.record} onChange={(e) => setDraft((d) => d && { ...d, record: e.target.value })} /></Field>
              <Field label="Publicación"><Input type="date" value={draft.publish} onChange={(e) => setDraft((d) => d && { ...d, publish: e.target.value })} /></Field>
            </div>
            <Field label="Responsable">
              <OwnerPicker value={draft.responsible} onChange={(u) => setDraft((d) => d && { ...d, responsible: u })} size="sm" />
            </Field>
            <Field label="Link del recurso"><Input value={draft.link} onChange={(e) => setDraft((d) => d && { ...d, link: e.target.value })} placeholder="https://…" /></Field>
            <Field label="Guion (Markdown)"><Textarea rows={9} value={draft.body} onChange={(e) => setDraft((d) => d && { ...d, body: e.target.value })} placeholder="Escribí el guion… (soporta Markdown)" /></Field>
          </div>
        ))}
      </Modal>

      {/* ---------------- Import modal ---------------- */}
      <Modal
        open={importing}
        onClose={() => setImporting(false)}
        wide
        title="Importar guion"
        description="Pegá el JSON o el Markdown exportado desde Content Studio IA, o subí el archivo."
        footer={<><Button variant="ghost" onClick={() => setImporting(false)}>Cancelar</Button><Button onClick={doImport}>Importar</Button></>}
      >
        <div className="space-y-3">
          <input ref={fileRef} type="file" accept=".json,.md,.txt" onChange={onFile} className="hidden" />
          <Button variant="subtle" type="button" onClick={() => fileRef.current?.click()}>
            <FileUp className="h-4 w-4" /> Subir archivo (.json / .md)
          </Button>
          <Textarea
            rows={10}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Pegá acá el JSON del guion (ScriptResult / SavedScript) o el Markdown exportado…"
            className="font-mono text-xs"
          />
          {importErr && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{importErr}</p>}
          <p className="text-[11px] text-[var(--faint)]">
            En <span className="text-nude">Content Studio IA</span>: descargá el guion (Markdown) o su JSON y pegalo acá. Se mapea a nombre, producto, marca y cuerpo con formato.
          </p>
        </div>
      </Modal>

      {/* ---------------- Create modal ---------------- */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nuevo guion"
        description="Entra a «Falta grabar»; después lo movés arrastrándolo."
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button><Button onClick={createGuion} disabled={!newG.name.trim()}>Crear</Button></>}
      >
        <div className="space-y-4">
          <Field label="Nombre"><Input value={newG.name} onChange={(e) => setNewG((s) => ({ ...s, name: e.target.value }))} placeholder="Ej: Tutorial de labial" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Producto"><Input value={newG.product} onChange={(e) => setNewG((s) => ({ ...s, product: e.target.value }))} /></Field>
            <Field label="Marca"><Input value={newG.brand} onChange={(e) => setNewG((s) => ({ ...s, brand: e.target.value }))} /></Field>
          </div>
          <Field label="Responsable">
            <OwnerPicker value={newG.responsible} onChange={(u) => setNewG((s) => ({ ...s, responsible: u }))} size="sm" />
          </Field>
          <Field label="Publicación"><Input type="date" value={newG.publish} onChange={(e) => setNewG((s) => ({ ...s, publish: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
