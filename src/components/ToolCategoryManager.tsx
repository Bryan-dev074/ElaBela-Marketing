"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { IconPicker } from "@/components/IconPicker";
import { Button, Field, IconGlyph, Input, Modal, Select } from "@/components/ui";
import {
  canDeleteCategory,
  categoryIdFromName,
  persistCategoryWithAssets,
  validateCategoryName,
  type CategoryToolRef,
  type ToolCategoryRow,
} from "@/lib/tool-categories";

type MutationResult = { ok: true } | { ok: false; error: string };

type Props = {
  open: boolean;
  onClose: () => void;
  categories: ToolCategoryRow[];
  tools: CategoryToolRef[];
  onAdd: (category: ToolCategoryRow) => Promise<MutationResult>;
  onUpdate: (category: ToolCategoryRow) => Promise<MutationResult>;
  onReorder: (categories: ToolCategoryRow[]) => Promise<MutationResult>;
  onDelete: (categoryId: string, destinationId?: string) => Promise<MutationResult>;
};

type View = { type: "list" } | { type: "edit"; draft: ToolCategoryRow; previous: ToolCategoryRow | null } | { type: "delete"; category: ToolCategoryRow };

export function ToolCategoryManager({ open, onClose, categories, tools, onAdd, onUpdate, onReorder, onDelete }: Props) {
  const sorted = useMemo(() => [...categories].sort((a, b) => a.sort - b.sort), [categories]);
  const [view, setView] = useState<View>({ type: "list" });
  const [destinationId, setDestinationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setView({ type: "list" });
    setDestinationId("");
    setError(null);
  }, [open]);

  const title = view.type === "list" ? "Gestionar categorías" : view.type === "delete" ? `Eliminar ${view.category.name}` : view.previous ? `Editar ${view.previous.name}` : "Nueva categoría";

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const withSort = reordered.map((category, sort) => ({ ...category, sort }));
    setError(null);
    const result = await onReorder(withSort);
    if (!result.ok) setError(result.error);
  }

  async function saveDraft() {
    if (view.type !== "edit") return;
    const validName = validateCategoryName(view.draft.name, categories, view.previous?.id);
    if (!validName.ok) {
      setError(validName.error);
      return;
    }
    const draft = {
      ...view.draft,
      id: view.previous?.id ?? categoryIdFromName(validName.name, categories),
      name: validName.name,
      icon: view.draft.icon || "✨",
    };
    setBusy(true);
    setError(null);
    const result = await persistCategoryWithAssets(draft, view.previous, view.previous ? onUpdate : onAdd);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setView({ type: "list" });
  }

  async function confirmDelete() {
    if (view.type !== "delete") return;
    const deletion = canDeleteCategory(view.category.id, tools);
    if (!deletion.ok && !destinationId) return;
    setBusy(true);
    setError(null);
    const result = await onDelete(view.category.id, destinationId || undefined);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDestinationId("");
    setView({ type: "list" });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description="Creá, presentá y ordená las familias de recursos del equipo."
      wide
      footer={view.type === "list" ? (
        <Button variant="ghost" onClick={onClose}>Cerrar</Button>
      ) : view.type === "edit" ? (
        <>
          <Button variant="ghost" onClick={() => setView({ type: "list" })}>Volver</Button>
          <Button onClick={saveDraft} disabled={busy}>{busy ? "Guardando…" : "Guardar categoría"}</Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={() => setView({ type: "list" })}>Cancelar</Button>
          <Button
            onClick={confirmDelete}
            disabled={busy || (!canDeleteCategory(view.category.id, tools).ok && !destinationId)}
            className="border-red-400/30 bg-red-500/15 text-red-100 hover:bg-red-500/25"
            aria-label={canDeleteCategory(view.category.id, tools).ok ? "Eliminar definitivamente" : "Mover y eliminar"}
          >
            {canDeleteCategory(view.category.id, tools).ok ? "Eliminar definitivamente" : "Mover y eliminar"}
          </Button>
        </>
      )}
    >
      {error ? <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p> : null}

      {view.type === "list" ? (
        <div className="space-y-3">
          <Button
            variant="subtle"
            className="w-full"
            onClick={() => setView({
              type: "edit",
              previous: null,
              draft: { id: "", name: "", icon: "✨", accent: "#d6ab99", kind: "link", sort: sorted.length, createdAt: "" },
            })}
          >
            <Plus className="h-4 w-4" /> Nueva categoría
          </Button>
          {sorted.map((category, index) => (
            <div key={category.id} className="glass flex min-h-14 items-center gap-3 rounded-xl px-3 py-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border" style={{ borderColor: `${category.accent}55`, background: `${category.accent}12` }}>
                <IconGlyph icon={category.icon} size={26} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{category.name}</p>
                <p className="text-[11px] text-[var(--faint)]">{category.kind === "prompt" ? "Presentación prompt" : "Presentación enlace"}</p>
              </div>
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Subir ${category.name}`} className="press flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-white/5 hover:text-white disabled:opacity-25">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === sorted.length - 1} aria-label={`Bajar ${category.name}`} className="press flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-white/5 hover:text-white disabled:opacity-25">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setView({ type: "edit", draft: { ...category }, previous: category })} aria-label={`Editar ${category.name}`} className="press flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-white/5 hover:text-white">
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => { setDestinationId(""); setView({ type: "delete", category }); }} aria-label={`Eliminar ${category.name}`} className="press flex h-11 w-11 items-center justify-center rounded-lg text-[var(--faint)] hover:bg-red-500/10 hover:text-red-300">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {view.type === "edit" ? (
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Ícono</span>
              <IconPicker value={view.draft.icon} onChange={(icon) => setView({ ...view, draft: { ...view.draft, icon } })} />
            </div>
            <Field label="Nombre">
              <Input value={view.draft.name} onChange={(event) => setView({ ...view, draft: { ...view.draft, name: event.target.value } })} autoFocus />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Color de acento">
              <div className="flex items-center gap-2">
                <input aria-label="Color de acento" type="color" value={view.draft.accent} onChange={(event) => setView({ ...view, draft: { ...view.draft, accent: event.target.value } })} className="h-11 w-14 rounded-lg border border-white/10 bg-black/30 p-1" />
                <Input value={view.draft.accent} onChange={(event) => setView({ ...view, draft: { ...view.draft, accent: event.target.value } })} />
              </div>
            </Field>
            <Field label="Presentación">
              <Select value={view.draft.kind} onChange={(event) => setView({ ...view, draft: { ...view.draft, kind: event.target.value as ToolCategoryRow["kind"] } })}>
                <option value="link">Enlace / app</option>
                <option value="prompt">Prompt copiable</option>
              </Select>
            </Field>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--faint)]">Las imágenes y GIF elegidos se suben al guardar. Cambiar la presentación actualiza los recursos de esta categoría.</p>
        </div>
      ) : null}

      {view.type === "delete" ? (() => {
        const deletion = canDeleteCategory(view.category.id, tools);
        return deletion.ok ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            <p className="font-medium">Esta categoría está vacía.</p>
            <p className="mt-1 text-xs text-amber-100/70">Confirmá la eliminación permanente para continuar.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">Mover {deletion.count} {deletion.count === 1 ? "recurso" : "recursos"} antes de eliminar</p>
            <Field label="Categoría de destino">
              <Select aria-label="Categoría de destino" value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
                <option value="">Elegí una categoría…</option>
                {sorted.filter((category) => category.id !== view.category.id).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </Select>
            </Field>
          </div>
        );
      })() : null}
    </Modal>
  );
}
