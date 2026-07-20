"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { IconPicker } from "@/components/IconPicker";
import { Button, Field, IconGlyph, Input, Modal } from "@/components/ui";
import {
  persistCredentialCategoryWithAssets,
  validateCredentialCategoryName,
  type CategorizedCredential,
  type CredentialCategory,
  type CredentialCategoryMutationResult,
  type CredentialScope,
} from "@/lib/credential-categories";

type Props = {
  open: boolean;
  onClose: () => void;
  scope: CredentialScope;
  ownerId: string;
  categories: CredentialCategory[];
  credentials: Array<Pick<CategorizedCredential, "categoryId">>;
  onAdd: (category: CredentialCategory) => Promise<CredentialCategoryMutationResult>;
  onUpdate: (category: CredentialCategory) => Promise<CredentialCategoryMutationResult>;
  onReorder: (categoryIds: string[]) => Promise<CredentialCategoryMutationResult>;
  onDelete: (categoryId: string) => Promise<CredentialCategoryMutationResult>;
};

type View =
  | { type: "list" }
  | { type: "edit"; draft: CredentialCategory; previous: CredentialCategory | null }
  | { type: "delete"; category: CredentialCategory };

function nextCategoryId() {
  return crypto.randomUUID?.() ?? `credential-category-${Date.now()}`;
}

export function CredentialCategoryManager({
  open,
  onClose,
  scope,
  ownerId,
  categories,
  credentials,
  onAdd,
  onUpdate,
  onReorder,
  onDelete,
}: Props) {
  const sorted = useMemo(() => [...categories].sort((left, right) => left.sort - right.sort), [categories]);
  const [view, setView] = useState<View>({ type: "list" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    if (!open) return;
    setView({ type: "list" });
    setError(null);
    setNotice(null);
    setBusy(false);
    setReordering(false);
  }, [open, scope]);

  const pending = busy || reordering;
  const title = view.type === "list"
    ? `Categorías ${scope === "shared" ? "compartidas" : "privadas"}`
    : view.type === "delete"
      ? `Eliminar ${view.category.name}`
      : view.previous
        ? `Editar ${view.previous.name}`
        : "Nueva categoría";

  function countCredentials(categoryId: string) {
    return credentials.filter((credential) => credential.categoryId === categoryId).length;
  }

  async function move(index: number, delta: number) {
    if (pending) return;
    const target = index + delta;
    if (target < 0 || target >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setError(null);
    setNotice(null);
    setReordering(true);
    const result = await onReorder(reordered.map((category) => category.id));
    setReordering(false);
    if (!result.ok) setError(result.error);
  }

  async function saveDraft() {
    if (view.type !== "edit" || pending) return;
    const validName = validateCredentialCategoryName(view.draft.name, categories, scope, ownerId, view.previous?.id);
    if (!validName.ok) {
      setError(validName.error);
      return;
    }
    const draft: CredentialCategory = {
      ...view.draft,
      id: view.previous?.id ?? nextCategoryId(),
      name: validName.name,
      icon: view.draft.icon || "🔑",
      scope,
      ownerId: scope === "private" ? ownerId : undefined,
    };
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await persistCredentialCategoryWithAssets(draft, view.previous, view.previous ? onUpdate : onAdd);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(result.warning ?? null);
    setView({ type: "list" });
  }

  async function confirmDelete() {
    if (view.type !== "delete" || pending || countCredentials(view.category.id) > 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await onDelete(view.category.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setView({ type: "list" });
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!pending) onClose(); }}
      title={title}
      description={scope === "shared"
        ? "Organizá los accesos que comparte todo el equipo."
        : "Organizá tus accesos privados sin mostrarlos al equipo."}
      wide
      footer={view.type === "list" ? (
        <Button variant="ghost" onClick={onClose} disabled={pending}>Cerrar</Button>
      ) : view.type === "edit" ? (
        <>
          <Button variant="ghost" onClick={() => setView({ type: "list" })} disabled={pending}>Volver</Button>
          <Button onClick={saveDraft} disabled={pending}>{busy ? "Guardando…" : "Guardar categoría"}</Button>
        </>
      ) : countCredentials(view.category.id) === 0 ? (
        <>
          <Button variant="ghost" onClick={() => setView({ type: "list" })} disabled={pending}>Cancelar</Button>
          <Button
            onClick={confirmDelete}
            disabled={pending}
            className="border-red-400/30 bg-red-500/15 text-red-100 hover:bg-red-500/25"
            aria-label="Eliminar definitivamente"
          >
            {busy ? "Eliminando…" : "Eliminar definitivamente"}
          </Button>
        </>
      ) : (
        <Button variant="ghost" onClick={() => setView({ type: "list" })}>Volver</Button>
      )}
    >
      {error ? <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p> : null}
      {notice ? <p role="status" className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">{notice}</p> : null}

      {view.type === "list" ? (
        <div className="space-y-3">
          <Button
            variant="subtle"
            className="min-h-11 w-full"
            disabled={pending}
            onClick={() => setView({
              type: "edit",
              previous: null,
              draft: {
                id: "",
                name: "",
                icon: "🔑",
                scope,
                ownerId: scope === "private" ? ownerId : undefined,
                sort: sorted.length,
                createdAt: "",
              },
            })}
          >
            <Plus className="h-4 w-4" /> Nueva categoría
          </Button>
          {sorted.map((category, index) => (
            <div key={category.id} className="glass flex min-h-14 items-center gap-3 rounded-xl px-3 py-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/25">
                <IconGlyph icon={category.icon} size={26} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{category.name}</p>
                <p className="text-[11px] text-[var(--faint)]">{countCredentials(category.id)} {countCredentials(category.id) === 1 ? "credencial" : "credenciales"}</p>
              </div>
              <button type="button" onClick={() => move(index, -1)} disabled={pending || index === 0} aria-label={`Subir ${category.name}`} className="press flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-white/5 hover:text-white disabled:opacity-25">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(index, 1)} disabled={pending || index === sorted.length - 1} aria-label={`Bajar ${category.name}`} className="press flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-white/5 hover:text-white disabled:opacity-25">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button type="button" disabled={pending} onClick={() => setView({ type: "edit", draft: { ...category }, previous: category })} aria-label={`Editar ${category.name}`} className="press flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-white/5 hover:text-white disabled:opacity-25">
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" disabled={pending} onClick={() => setView({ type: "delete", category })} aria-label={`Eliminar ${category.name}`} className="press flex h-11 w-11 items-center justify-center rounded-lg text-[var(--faint)] hover:bg-red-500/10 hover:text-red-300 disabled:opacity-25">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {sorted.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 py-6 text-center text-sm text-[var(--muted)]">Todavía no hay categorías en este espacio.</p> : null}
        </div>
      ) : null}

      {view.type === "edit" ? (
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className={pending ? "pointer-events-none opacity-50" : ""}>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Ícono</span>
              <IconPicker value={view.draft.icon} onChange={(icon) => setView({ ...view, draft: { ...view.draft, icon } })} />
            </div>
            <Field label="Nombre">
              <Input value={view.draft.name} disabled={pending} onChange={(event) => setView({ ...view, draft: { ...view.draft, name: event.target.value } })} autoFocus />
            </Field>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--faint)]">Las imágenes y GIF se suben recién al guardar. Los íconos de categorías nunca contienen valores de credenciales.</p>
        </div>
      ) : null}

      {view.type === "delete" ? countCredentials(view.category.id) === 0 ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          <p className="font-medium">Esta categoría está vacía.</p>
          <p className="mt-1 text-xs text-amber-100/70">Confirmá la eliminación permanente para continuar.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          <p className="font-medium">Mové sus credenciales antes de eliminarla.</p>
          <p className="mt-1 text-xs text-amber-100/70">Esta categoría contiene {countCredentials(view.category.id)} {countCredentials(view.category.id) === 1 ? "credencial" : "credenciales"}.</p>
        </div>
      ) : null}
    </Modal>
  );
}
