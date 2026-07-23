"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Eye, EyeOff, ExternalLink, Globe, Lock, Pencil, Plus, Settings2, ShieldCheck, Trash2 } from "lucide-react";
import { CredentialCategoryManager } from "@/components/CredentialCategoryManager";
import { IconPicker } from "@/components/IconPicker";
import { Button, Card, Field, IconGlyph, Input, Modal, PageHeader, Select } from "@/components/ui";
import { cursorIntentProps } from "@/lib/cursor-intent";
import {
  categoryIdAfterScopeChange,
  groupCredentials,
  isCategoryCompatible,
  reorderCredentialCategoriesLocally,
  UNCATEGORIZED_CREDENTIAL_CATEGORY_ID,
  type CredentialCategory,
  type CredentialScope,
} from "@/lib/credential-categories";
import {
  deleteEmptyCredentialCategory,
  reorderCredentialCategories,
  useCredentialCategories,
  useCredentials,
  type CollectionMutationResult,
  type CredRow,
} from "@/lib/db";
import type { Role } from "@/lib/brand";

type Cred = CredRow;
const empty = (scope: CredentialScope): Cred => ({ id: "", platform: "", icon: "🔑", idType: "email", identifier: "", secret: "", url: "", scope });

function getSafeCredentialUrl(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function nextCredentialId() {
  return crypto.randomUUID?.() ?? `credential-${Date.now()}`;
}

function RevealValue({ show, value, hidden }: { show: boolean; value: string; hidden: string }) {
  return (
    <span className="relative inline-flex">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={show ? "visible" : "hidden"}
          initial={{ opacity: 0, filter: "blur(7px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(7px)" }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block"
        >
          {show ? value || "—" : hidden}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function CopyIcon({ done }: { done: boolean }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={done ? "check" : "copy"}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.4, opacity: 0 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="inline-flex"
      >
        {done ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </motion.span>
    </AnimatePresence>
  );
}

function Row({
  credential,
  disabled,
  onEdit,
  onDelete,
}: {
  credential: Cred;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => Promise<CollectionMutationResult>;
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    if (armTimer.current) clearTimeout(armTimer.current);
  }, []);

  const configured = credential.identifier || credential.secret;
  const safeUrl = getSafeCredentialUrl(credential.url);
  const copy = async (value: string, key: string) => {
    if (!value || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1400);
    } catch {
      // Clipboard permission failures leave the credential unchanged.
    }
  };
  const handleDelete = async () => {
    if (disabled || deleting) return;
    if (!armed) {
      setArmed(true);
      if (armTimer.current) clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmed(false), 2600);
      return;
    }
    if (armTimer.current) clearTimeout(armTimer.current);
    setDeleting(true);
    const result = await onDelete();
    setDeleting(false);
    if (!result.ok) setArmed(false);
  };

  const iconButton = "press flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-[var(--faint)] transition hover:border-white/20 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <div data-credential-row className="card-sheen group flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3 transition-colors duration-200 hover:border-nude/20 hover:bg-black/30">
      <IconGlyph icon={credential.icon} size={22} rounded="rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{credential.platform}</p>
        {configured ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs text-[var(--muted)]">
            <span className="capitalize text-[var(--faint)]">{credential.idType}:</span>
            <span className="inline-flex items-center gap-1 rounded">
              <RevealValue show={show} value={credential.identifier} hidden={"•".repeat(Math.min(10, (credential.identifier || "······").length))} />
            </span>
            <span className="text-[var(--faint)]">clave:</span>
            <RevealValue show={show} value={credential.secret} hidden="••••••••" />
          </div>
        ) : (
          <p className="font-mono text-xs text-[var(--faint)]">— sin configurar —</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {configured ? (
          <>
            <button type="button" onClick={() => setShow((current) => !current)} className={iconButton} aria-label={show ? "Ocultar valores" : "Mostrar valores"} {...cursorIntentProps("open", show ? "Ocultar" : "Mostrar")}>
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button type="button" onClick={() => void copy(credential.identifier, `id-${credential.id}`)} disabled={!credential.identifier} className={iconButton} aria-label={`Copiar ${credential.idType === "email" ? "correo" : "usuario"}`} {...cursorIntentProps("copy")}>
              <CopyIcon done={copied === `id-${credential.id}`} />
            </button>
            <button type="button" onClick={() => void copy(credential.secret, `sec-${credential.id}`)} className={iconButton} aria-label="Copiar contraseña" {...cursorIntentProps("copy")}>
              <CopyIcon done={copied === `sec-${credential.id}`} />
            </button>
          </>
        ) : null}
        {safeUrl ? <a href={safeUrl} target="_blank" rel="noreferrer" className={iconButton} aria-label={`Abrir enlace de ${credential.platform}`} title="Abrir enlace" {...cursorIntentProps("open", "Abrir enlace")}><ExternalLink className="h-3.5 w-3.5" /></a> : null}
        <button type="button" onClick={onEdit} disabled={disabled || deleting} className={iconButton} aria-label="Editar acceso" {...cursorIntentProps("edit")}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={disabled || deleting}
          className={`press flex h-8 items-center justify-center rounded-lg border text-xs transition disabled:cursor-not-allowed disabled:opacity-35 ${
            armed || deleting
              ? "border-red-400/40 bg-red-500/15 px-2.5 font-medium text-red-300"
              : "w-8 border-white/10 text-[var(--faint)] opacity-0 hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
          }`}
          aria-label={deleting ? "Eliminando acceso" : armed ? "Confirmar eliminación" : "Eliminar acceso"}
          {...cursorIntentProps("danger", deleting ? "Eliminando" : armed ? "Confirmar" : "Eliminar")}
        >
          {deleting ? "Eliminando…" : armed ? "¿Seguro?" : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function CredentialGroups({
  scope,
  groups,
  ready,
  onEdit,
  onDelete,
}: {
  scope: CredentialScope;
  groups: ReturnType<typeof groupCredentials<Cred>>;
  ready: boolean;
  onEdit: (credential: Cred) => void;
  onDelete: (credentialId: string) => Promise<CollectionMutationResult>;
}) {
  return (
    <div className="space-y-5">
      {groups.map(({ category, credentials }) => {
        const uncategorized = category.id === UNCATEGORIZED_CREDENTIAL_CATEGORY_ID;
        const label = uncategorized
          ? `Credenciales ${scope === "shared" ? "compartidas" : "privadas"} sin categoría`
          : `Categoría ${scope === "shared" ? "compartida" : "privada"} ${category.name}`;
        return (
          <section key={category.id} role="region" aria-label={label} className="space-y-2.5">
            <div className="flex items-center gap-2 border-b border-white/8 pb-2">
              <IconGlyph icon={category.icon} size={20} rounded="rounded-md" />
              <h3 className="text-sm font-semibold text-white">{category.name}</h3>
              <span className="text-[11px] text-[var(--faint)]">{credentials.length}</span>
            </div>
            {credentials.map((credential) => (
              <Row key={credential.id} credential={credential} disabled={!ready} onEdit={() => onEdit(credential)} onDelete={() => onDelete(credential.id)} />
            ))}
            {credentials.length === 0 ? <p className="rounded-xl border border-dashed border-white/8 py-4 text-center text-xs text-[var(--faint)]">Sin accesos en esta categoría.</p> : null}
          </section>
        );
      })}
    </div>
  );
}

export default function CredencialesView({ role, ownerId }: { role: Role; ownerId: string }) {
  void role;
  const credentialsStore = useCredentials(ownerId);
  const categoriesStore = useCredentialCategories(ownerId);
  const [editing, setEditing] = useState<Cred | null>(null);
  const [managingScope, setManagingScope] = useState<CredentialScope | null>(null);
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const sharedGroups = useMemo(
    () => groupCredentials(credentialsStore.items, categoriesStore.items, "shared", ownerId),
    [categoriesStore.items, credentialsStore.items, ownerId],
  );
  const privateGroups = useMemo(
    () => groupCredentials(credentialsStore.items, categoriesStore.items, "private", ownerId),
    [categoriesStore.items, credentialsStore.items, ownerId],
  );
  const sharedCount = credentialsStore.items.filter((credential) => credential.scope === "shared").length;
  const privateCount = credentialsStore.items.filter((credential) => credential.scope === "private" && (!credential.ownerId || credential.ownerId === ownerId)).length;
  const collectionsReady = credentialsStore.ready && categoriesStore.ready;
  const displayedError = editing ? null : mutationError || credentialsStore.error || categoriesStore.error;

  const openEditor = (credential: Cred) => {
    setMutationError(null);
    credentialsStore.clearError();
    setEditing({ ...credential });
  };

  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setMutationError(null);
    credentialsStore.clearError();
  };

  const setScope = (scope: CredentialScope) => {
    if (!editing || saving) return;
    setEditing({
      ...editing,
      scope,
      ownerId: scope === "private" ? ownerId : undefined,
      categoryId: categoryIdAfterScopeChange(editing.categoryId, scope, categoriesStore.items, ownerId),
    });
  };

  async function saveCredential() {
    if (!editing || saving || !editing.platform.trim()) return;
    const credential: Cred = {
      ...editing,
      id: editing.id || nextCredentialId(),
      platform: editing.platform.trim(),
      ownerId: editing.scope === "private" ? ownerId : undefined,
      categoryId: categoryIdAfterScopeChange(editing.categoryId, editing.scope, categoriesStore.items, ownerId),
    };
    if (editing.url?.trim() && !getSafeCredentialUrl(editing.url)) {
      setMutationError("La URL debe comenzar con http:// o https://.");
      return;
    }
    credential.url = editing.url?.trim() || undefined;
    setSaving(true);
    setMutationError(null);
    credentialsStore.clearError();
    const result = editing.id
      ? await credentialsStore.updateAsync(editing.id, credential)
      : await credentialsStore.addAsync(credential);
    setSaving(false);
    if (!result.ok) {
      setMutationError(result.error);
      return;
    }
    setEditing(null);
  }

  async function removeCredential(credentialId: string) {
    setMutationError(null);
    credentialsStore.clearError();
    const result = await credentialsStore.removeAsync(credentialId);
    if (!result.ok) setMutationError(result.error);
    return result;
  }

  const compatibleEditorCategories = editing
    ? categoriesStore.items
      .filter((category) => isCategoryCompatible(category, editing, ownerId))
      .sort((left, right) => left.sort - right.sort)
    : [];
  const managedCategories = managingScope
    ? categoriesStore.items.filter((category) => category.scope === managingScope
      && (managingScope === "shared" ? !category.ownerId : category.ownerId === ownerId))
    : [];
  const managedCredentials = managingScope
    ? credentialsStore.items.filter((credential) => credential.scope === managingScope
      && (managingScope === "shared" || !credential.ownerId || credential.ownerId === ownerId))
    : [];

  async function addCategory(category: CredentialCategory) {
    categoriesStore.clearError();
    return categoriesStore.addAsync(category);
  }

  async function updateCategory(category: CredentialCategory) {
    categoriesStore.clearError();
    return categoriesStore.updateAsync(category.id, category);
  }

  async function reorderCategories(categoryIds: string[]) {
    if (!managingScope) return { ok: false as const, error: "No se pudo determinar el alcance de las categorías." };
    categoriesStore.clearError();
    const result = await reorderCredentialCategories(managingScope, categoryIds);
    if (result.ok) {
      categoriesStore.setItems((current) => reorderCredentialCategoriesLocally(current, managingScope, categoryIds, ownerId));
    }
    return result;
  }

  async function deleteCategory(categoryId: string) {
    categoriesStore.clearError();
    const result = await deleteEmptyCredentialCategory(categoryId);
    if (result.ok) categoriesStore.setItems((current) => current.filter((category) => category.id !== categoryId));
    return result;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Seguridad"
        title="Credenciales"
        description="Dos niveles bien claros: las compartidas las ve todo el equipo; las privadas solo vos."
        action={<Button disabled={!collectionsReady} onClick={() => openEditor(empty("private"))}><Plus className="h-4 w-4" /> Agregar acceso</Button>}
      />

      <Card className="mb-6 flex items-center gap-3.5 border-amber-400/15 bg-gradient-to-r from-amber-400/[0.07] via-amber-400/[0.03] to-transparent p-4" hover={false}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10">
          <ShieldCheck className="h-4 w-4 text-amber-300" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-amber-200">Guardado seguro</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-200/60">Los valores se cifran en producción y nunca tocan el repositorio. Cargalos acá, mostralos y copialos cuando los necesités.</p>
        </div>
      </Card>

      {displayedError ? <p role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{displayedError}</p> : null}

      <Card className="mb-6 p-6" hover={false}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Globe className="h-5 w-5 text-emerald-300" />
          <h2 className="text-lg font-semibold text-white">Compartidas del equipo</h2>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 shadow-[0_0_18px_-6px_rgba(52,211,153,0.6)]">Todos las ven</span>
          <Button variant="ghost" className="ml-auto min-h-11" disabled={!collectionsReady} onClick={() => setManagingScope("shared")}><Settings2 className="h-4 w-4" /> Gestionar categorías</Button>
        </div>
        <p className="mb-4 text-xs text-[var(--muted)]">Cuentas y herramientas que usa todo el equipo.</p>
        {sharedCount ? (
          <CredentialGroups scope="shared" groups={sharedGroups} ready={collectionsReady} onEdit={openEditor} onDelete={removeCredential} />
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 py-6 text-center text-sm text-[var(--muted)]">Todavía no hay accesos compartidos. Creá uno y elegí «Compartida».</div>
        )}
      </Card>

      <Card className="p-6" hover={false}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Lock className="h-5 w-5 text-nude" />
          <h2 className="text-lg font-semibold text-white">Mis credenciales privadas</h2>
          <span className="glow-pulse inline-flex items-center rounded-full border border-nude/30 bg-nude/10 px-2 py-0.5 text-[10px] font-medium"><span className="glow-text">Solo vos</span></span>
          <Button variant="ghost" className="ml-auto min-h-11" disabled={!collectionsReady} onClick={() => setManagingScope("private")}><Settings2 className="h-4 w-4" /> Gestionar categorías privadas</Button>
        </div>
        <p className="mb-4 text-xs text-[var(--muted)]">Solo vos ves estas. Nadie más del equipo tiene acceso.</p>
        {privateCount ? (
          <CredentialGroups scope="private" groups={privateGroups} ready={collectionsReady} onEdit={openEditor} onDelete={removeCredential} />
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 py-6 text-center text-sm text-[var(--muted)]">Sin credenciales privadas. Agregá una con «Agregar acceso».</div>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={closeEditor}
        title={editing?.id ? "Editar acceso" : "Nuevo acceso"}
        description="Elegí si es compartida (todos) o privada (solo vos), y si el identificador es correo o usuario."
        footer={(
          <>
            <Button variant="ghost" onClick={closeEditor} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void saveCredential()} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </>
        )}
      >
        {editing ? (
          <div className="space-y-4">
            {mutationError ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{mutationError}</p> : null}
            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Visibilidad</span>
              <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                <button type="button" disabled={saving} aria-label="Compartida" onClick={() => setScope("shared")} className={`press flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${editing.scope === "shared" ? "bg-white text-black" : "text-[var(--muted)] hover:text-white"}`}><Globe className="h-3.5 w-3.5" /> Compartida</button>
                <button type="button" disabled={saving} aria-label="Privada" onClick={() => setScope("private")} className={`press flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${editing.scope === "private" ? "bg-white text-black" : "text-[var(--muted)] hover:text-white"}`}><Lock className="h-3.5 w-3.5" /> Privada</button>
              </div>
            </div>
            <div className="flex gap-3">
              <div className={saving ? "pointer-events-none opacity-50" : ""}>
                <Field label="Ícono"><IconPicker value={editing.icon} onChange={(icon) => setEditing({ ...editing, icon })} /></Field>
              </div>
              <div className="flex-1"><Field label="Plataforma"><Input disabled={saving} value={editing.platform} onChange={(event) => setEditing({ ...editing, platform: event.target.value })} placeholder="Ej: Instagram" /></Field></div>
            </div>
            <Field label="Categoría">
              <Select aria-label="Categoría" disabled={saving} value={editing.categoryId ?? ""} onChange={(event) => setEditing({ ...editing, categoryId: event.target.value || undefined })}>
                <option value="">Sin categoría</option>
                {compatibleEditorCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </Select>
            </Field>
            <Field label="Tipo de identificador"><Select disabled={saving} value={editing.idType} onChange={(event) => setEditing({ ...editing, idType: event.target.value as Cred["idType"] })}><option value="email">Correo</option><option value="usuario">Usuario</option></Select></Field>
            <Field label={editing.idType === "email" ? "Correo" : "Usuario"}><Input disabled={saving} value={editing.identifier} onChange={(event) => setEditing({ ...editing, identifier: event.target.value })} placeholder={editing.idType === "email" ? "correo@ejemplo.com" : "@usuario"} /></Field>
            <Field label="Contraseña"><Input disabled={saving} value={editing.secret} onChange={(event) => setEditing({ ...editing, secret: event.target.value })} placeholder="••••••••" /></Field>
            <Field label="URL de acceso (opcional)"><Input disabled={saving} type="url" value={editing.url ?? ""} onChange={(event) => setEditing({ ...editing, url: event.target.value })} placeholder="https://app.ejemplo.com" /></Field>
          </div>
        ) : null}
      </Modal>

      <CredentialCategoryManager
        open={!!managingScope}
        onClose={() => setManagingScope(null)}
        scope={managingScope ?? "shared"}
        ownerId={ownerId}
        categories={managedCategories}
        credentials={managedCredentials}
        onAdd={addCategory}
        onUpdate={updateCategory}
        onReorder={reorderCategories}
        onDelete={deleteCategory}
      />
    </div>
  );
}
