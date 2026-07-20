"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Copy, Check, Plus, Pencil, Trash2, ImagePlus, ArrowUpRight, Quote, Link2, Settings2 } from "lucide-react";
import { PageHeader, Button, Modal, Field, Input, Textarea, Select, EmptyState, IconGlyph } from "@/components/ui";
import { IconPicker } from "@/components/IconPicker";
import { Lightbox } from "@/components/Lightbox";
import { ToolCategoryManager } from "@/components/ToolCategoryManager";
import { moveAndDeleteToolCategory, reorderToolCategories, useToolCategories, useToolItems, type ToolItem } from "@/lib/db";
import { fileToImage } from "@/lib/profiles";
import { isManagedAssetUrl, removeAssetByPublicUrl, uploadAsset, validateAssetFile } from "@/lib/storage";
import {
  UNCATEGORIZED_CATEGORY,
  UNCATEGORIZED_ID,
  assetFileFromDataUrl,
  resolveCategoryId,
  safeExternalUrl,
  syncToolToCategory,
  type ToolCategoryRow,
} from "@/lib/tool-categories";

/* ---------------- Categorías + acentos ---------------- */

const NUDE = "#d6ab99";
const emptyItem = (category: ToolCategoryRow): ToolItem => ({ id: "", category: category.id, categoryId: category.id, kind: category.kind, title: "", note: "", href: "", image: "", icon: "", steps: "" });
const isImgSrc = (v: string) => v.startsWith("data:") || v.startsWith("http");

const hostOf = (href: string): string | null => {
  const safe = safeExternalUrl(href);
  return safe ? new URL(safe).hostname.replace(/^www\./, "") : null;
};
const faviconUrl = (host: string) => `https://www.google.com/s2/favicons?domain=${host}&sz=64`;

/* ---------------- Motion ---------------- */

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const cardMotion = (i: number) => ({
  layout: true,
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: EASE, delay: Math.min(i * 0.045, 0.4) } },
  exit: { opacity: 0, scale: 0.94, transition: { duration: 0.16 } },
  transition: { layout: { duration: 0.3, ease: EASE } },
});

/* ---------------- Piezas ---------------- */

/** Halo radial + hairline superior con el acento de la categoría (rompe la monotonía). */
function AccentBand({ accent }: { accent: string }) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{ background: `radial-gradient(110% 130% at 50% -30%, ${accent}26, transparent 72%)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}70, transparent)` }}
      />
    </>
  );
}

function CategoryChip({ category }: { category: ToolCategoryRow }) {
  const accent = category.accent;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{ color: accent, background: `${accent}14`, border: `1px solid ${accent}38`, boxShadow: `0 0 14px -6px ${accent}88` }}
    >
      <IconGlyph icon={category.icon} size={14} rounded="rounded-sm" /> {category.name}
    </span>
  );
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Editar recurso"
      data-cursor-label="Editar"
      className="press flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-[var(--faint)] backdrop-blur-sm transition hover:border-white/25 hover:text-white"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  );
}

/** Eliminar en 2 clics: el primero arma «¿Seguro?», el segundo confirma. Se desarma solo. */
function DeleteBtn({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2600);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      aria-label={armed ? "Confirmar eliminación" : "Eliminar recurso"}
      data-cursor-label={armed ? "Confirmar" : "Eliminar"}
      data-cursor-color="#f87171"
      className={`press flex h-9 items-center justify-center rounded-lg border backdrop-blur-sm transition ${
        armed
          ? "gap-1 border-red-400/60 bg-red-500/20 px-2.5 text-red-200 shadow-[0_0_16px_-6px_rgba(248,113,113,0.8)]"
          : "w-9 border-white/10 bg-black/30 text-[var(--faint)] hover:border-red-400/40 hover:text-red-300"
      }`}
    >
      {armed ? <span className="text-[10px] font-bold">¿Seguro?</span> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}

/** Visual compacto: ícono elegido > favicon del dominio > tile con inicial. */
function LinkVisual({ item, accent }: { item: ToolItem; accent: string }) {
  const host = item.href ? hostOf(item.href) : null;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [host, item.image]);

  let inner: React.ReactNode;
  if (item.icon) {
    inner = (
      <span
        className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
        style={{ boxShadow: `inset 0 0 20px -8px ${accent}55` }}
      >
        <IconGlyph icon={item.icon} size={isImgSrc(item.icon) ? 48 : 26} rounded="rounded-xl" />
      </span>
    );
  } else if (host && !failed) {
    inner = (
      <span
        className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]"
        style={{ boxShadow: `inset 0 0 20px -8px ${accent}55` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={faviconUrl(host)} alt="" loading="lazy" onError={() => setFailed(true)} className="h-7 w-7 rounded-md" />
      </span>
    );
  } else {
    const initial = (item.title.trim().charAt(0) || "•").toUpperCase();
    inner = (
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-xl font-display text-lg font-semibold"
        style={{
          background: `linear-gradient(135deg, ${accent}33, ${accent}0f)`,
          border: `1px solid ${accent}30`,
          color: accent,
          textShadow: `0 0 16px ${accent}90`,
        }}
      >
        {initial}
      </span>
    );
  }

  return <span className="shrink-0">{inner}</span>;
}

function ToolMedia({ item, onView }: { item: ToolItem; onView: () => void }) {
  if (!item.image) return null;
  return (
    <button
      type="button"
      onClick={onView}
      aria-label={`Ver imagen de ${item.title}`}
      data-cursor-label="Ver en grande"
      className="press pointer-events-auto relative z-[2] mt-3 block aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black/30"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image} alt="" className="h-full w-full object-contain p-1 transition duration-300 hover:brightness-110" />
    </button>
  );
}

/* ---------------- Página ---------------- */

export default function ToolsPage() {
  const toolStore = useToolItems();
  const categoryStore = useToolCategories();
  const { items, addAsync, updateAsync, removeAsync, setItems: setToolItems } = toolStore;
  const categories = useMemo(() => [...categoryStore.items].sort((a, b) => a.sort - b.sort), [categoryStore.items]);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ToolItem | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<ToolItem | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationNotice, setMutationNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryFor = (item: ToolItem) => {
    const resolved = resolveCategoryId(item.categoryId, categories);
    return resolved === UNCATEGORIZED_ID ? UNCATEGORIZED_CATEGORY : categories.find((category) => category.id === resolved) ?? UNCATEGORIZED_CATEGORY;
  };
  const categoryById = (id: string) => categories.find((category) => category.id === id);
  const hasUncategorized = items.some((item) => resolveCategoryId(item.categoryId, categories) === UNCATEGORIZED_ID);
  const filterCategories = hasUncategorized ? [...categories, UNCATEGORIZED_CATEGORY] : categories;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (filter === "all" || resolveCategoryId(i.categoryId, categories) === filter) &&
        (!q || i.title.toLowerCase().includes(q) || i.note.toLowerCase().includes(q))
    );
  }, [categories, items, filter, query]);
  const mediaItems = useMemo(() => shown.filter((item) => item.image), [shown]);
  const lightboxIndex = lightboxId ? mediaItems.findIndex((item) => item.id === lightboxId) : -1;
  const activeLightboxItem = lightboxIndex >= 0 ? mediaItems[lightboxIndex] : null;
  const isFiltering = filter !== "all" || query.trim() !== "";

  const copy = (text: string, id: string) =>
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1500);
    });

  function beginEdit(item: ToolItem) {
    setEditing({ ...item });
    setEditingOriginal(item.id ? item : null);
    setPendingImage(null);
    setImgErr(null);
    setMutationError(null);
    setMutationNotice(null);
  }

  async function cleanupUploads(urls: string[]) {
    const results = await Promise.all(urls.map((url) => removeAssetByPublicUrl(url)));
    const failures = results.flatMap((result) => result.ok ? [] : [result.error]);
    return failures.length > 0 ? failures.join(" ") : null;
  }

  async function errorWithRollback(primaryError: string, urls: string[]) {
    const cleanupError = await cleanupUploads(urls);
    return cleanupError
      ? `${primaryError} Además, no se pudo revertir el archivo nuevo: ${cleanupError}`
      : primaryError;
  }

  async function deleteTool(item: ToolItem) {
    setMutationError(null);
    const result = await removeAsync(item.id);
    if (!result.ok) {
      setMutationError(result.error);
      return;
    }
    const storedAssets = [item.image, item.icon].filter(isManagedAssetUrl);
    const cleanupResults = await Promise.all(storedAssets.map((url) => removeAssetByPublicUrl(url)));
    const cleanupFailure = cleanupResults.find((cleanup) => !cleanup.ok);
    if (cleanupFailure && !cleanupFailure.ok) setMutationError(`El recurso se eliminó, pero no se pudo limpiar un archivo: ${cleanupFailure.error}`);
  }

  async function save() {
    if (!editing || !editing.title.trim()) return;
    const category = categoryById(editing.categoryId);
    if (!category) {
      setMutationError("Elegí una categoría válida.");
      return;
    }
    const safeHref = editing.href.trim() ? safeExternalUrl(editing.href) : "";
    if (category.kind === "link" && editing.href.trim() && !safeHref) {
      setMutationError("Usá un enlace HTTP o HTTPS válido.");
      return;
    }

    setSaving(true);
    setMutationError(null);
    setMutationNotice(null);
    const uploadedUrls: string[] = [];
    let image = editing.image;
    let icon = editing.icon;
    if (pendingImage) {
      const uploaded = await uploadAsset(pendingImage, "tools");
      if (!uploaded.ok) {
        setMutationError(uploaded.error);
        setSaving(false);
        return;
      }
      image = uploaded.url;
      uploadedUrls.push(uploaded.url);
    }
    if (icon.startsWith("data:")) {
      let iconFile: File;
      try {
        iconFile = assetFileFromDataUrl(icon, "tool-icon");
      } catch (error) {
        const primaryError = error instanceof Error ? error.message : "El ícono personalizado no es válido.";
        setMutationError(await errorWithRollback(primaryError, uploadedUrls));
        setSaving(false);
        return;
      }
      const uploaded = await uploadAsset(iconFile, "tools");
      if (!uploaded.ok) {
        setMutationError(await errorWithRollback(uploaded.error, uploadedUrls));
        setSaving(false);
        return;
      }
      icon = uploaded.url;
      uploadedUrls.push(uploaded.url);
    }

    const it = syncToolToCategory<ToolItem>({
      ...editing,
      id: editing.id || `it-${crypto.randomUUID()}`,
      title: editing.title.trim(),
      href: category.kind === "link" ? safeHref || "" : editing.href,
      image,
      icon,
    }, category);
    const result = editing.id ? await updateAsync(editing.id, it) : await addAsync(it);
    if (!result.ok) {
      setMutationError(await errorWithRollback(result.error, uploadedUrls));
      setSaving(false);
      return;
    }
    const replacedAssets = [editingOriginal?.image, editingOriginal?.icon].filter((url): url is string => !!url && isManagedAssetUrl(url) && url !== image && url !== icon);
    const cleanupResults = await Promise.all(replacedAssets.map((url) => removeAssetByPublicUrl(url)));
    const cleanupFailure = cleanupResults.find((result) => !result.ok);
    if (cleanupFailure && !cleanupFailure.ok) setMutationNotice(`El recurso se guardó, pero no se pudo limpiar el archivo anterior: ${cleanupFailure.error}`);
    setEditing(null);
    setEditingOriginal(null);
    setPendingImage(null);
    setSaving(false);
  }

  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setImgErr(null);
    const validation = validateAssetFile(f, { kind: "image", maxBytes: 8 * 1024 * 1024 });
    if (!validation.ok) {
      setImgErr(validation.error);
      return;
    }
    setPendingImage(f);
    if (f.type === "image/gif") {
      const r = new FileReader();
      r.onload = () => setEditing((c) => (c ? { ...c, image: String(r.result) } : c));
      r.readAsDataURL(f);
      return;
    }
    fileToImage(f, 800)
      .then((data) => setEditing((c) => (c ? { ...c, image: data } : c)))
      .catch(() => {
        const r = new FileReader();
        r.onload = () => setEditing((c) => (c ? { ...c, image: String(r.result) } : c));
        r.readAsDataURL(f);
      });
  }

  const editingHost = editing?.href ? hostOf(editing.href) : null;

  async function addCategory(category: ToolCategoryRow) {
    return categoryStore.addAsync(category);
  }

  async function updateCategory(category: ToolCategoryRow) {
    const result = await categoryStore.updateAsync(category.id, category);
    if (result.ok) {
      setToolItems((current) => current.map((tool) => tool.categoryId === category.id
        ? syncToolToCategory(tool, category)
        : tool));
    }
    return result;
  }

  async function reorderCategories(reordered: ToolCategoryRow[]) {
    const result = await reorderToolCategories(reordered.map((category) => category.id));
    if (!result.ok) return result;
    categoryStore.setItems(reordered);
    return { ok: true as const };
  }

  async function deleteCategory(categoryId: string, destinationId?: string) {
    const deletedCategory = categoryById(categoryId);
    const result = await moveAndDeleteToolCategory(categoryId, destinationId);
    if (!result.ok) return result;
    categoryStore.setItems((current) => current.filter((category) => category.id !== categoryId));
    const destination = destinationId ? categoryById(destinationId) : undefined;
    setToolItems((current) => current.map((tool) => tool.categoryId === categoryId && destination
      ? syncToolToCategory(tool, destination)
      : tool));
    if (filter === categoryId) setFilter(destinationId ?? "all");
    if (deletedCategory && isManagedAssetUrl(deletedCategory.icon)) {
      const cleanup = await removeAssetByPublicUrl(deletedCategory.icon);
      if (!cleanup.ok) setMutationError(`La categoría se eliminó, pero no se pudo limpiar su ícono: ${cleanup.error}`);
    }
    return { ok: true as const };
  }

  return (
    <div>
      <PageHeader
        eyebrow="Recursos del equipo"
        title="Tools"
        description="Tu biblioteca viva: prompts listos para copiar, apps que se abren de un clic, GEMS, IA, ads y enlaces oficiales. Todo editable."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="subtle" onClick={() => setManagingCategories(true)}>
              <Settings2 className="h-4 w-4" /> Gestionar categorías
            </Button>
            <Button onClick={() => {
              const selected = filter !== "all" ? categoryById(filter) : undefined;
              const fallback = selected ?? categories[0];
              if (fallback) beginEdit(emptyItem(fallback));
            }} disabled={categories.length === 0}>
              <Plus className="h-4 w-4" /> Agregar recurso
            </Button>
          </div>
        }
      />

      {mutationError || toolStore.error || categoryStore.error ? (
        <div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {mutationError || toolStore.error || categoryStore.error}
        </div>
      ) : null}
      {mutationNotice ? (
        <div role="status" className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          {mutationNotice}
        </div>
      ) : null}

      {/* Barra superior: buscador + contador total */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscá por título o nota…"
            aria-label="Buscar recursos"
            className="pl-10 pr-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--faint)] transition hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-baseline gap-2">
          <span className="glow-text num font-display text-3xl font-semibold leading-none">{items.length}</span>
          <span className="text-[11px] uppercase tracking-wider text-[var(--faint)]">recursos</span>
          {isFiltering && <span className="num text-[11px] text-[var(--muted)]">· {shown.length} en vista</span>}
        </div>
      </div>

      {/* Rail dinámico de categorías con contador */}
      <div className="glass no-scrollbar mb-8 flex snap-x items-center gap-2 overflow-x-auto rounded-2xl p-2" role="navigation" aria-label="Filtros de categorías">
        <button
          type="button"
          onClick={() => setFilter("all")}
          aria-pressed={filter === "all"}
          className={`press inline-flex h-11 shrink-0 snap-start items-center gap-1.5 rounded-xl border px-4 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
            filter === "all"
              ? "border-white/40 bg-white text-black shadow-[0_4px_18px_-6px_rgba(255,255,255,0.4)]"
              : "border-white/10 text-[var(--muted)] hover:border-white/25 hover:text-white"
          }`}
        >
          Todo <span className="num opacity-60">{items.length}</span>
        </button>
        {filterCategories.map((category) => {
          const n = items.filter((item) => resolveCategoryId(item.categoryId, categories) === category.id).length;
          const active = filter === category.id;
          const accent = category.accent;
          return (
            <button
              type="button"
              key={category.id}
              onClick={() => setFilter(active ? "all" : category.id)}
              aria-pressed={active}
              data-cursor-color={accent}
              className={`press inline-flex h-11 shrink-0 snap-start items-center gap-1.5 rounded-xl border px-4 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                active ? "text-white" : "border-white/10 text-[var(--muted)] hover:border-white/25 hover:text-white"
              }`}
              style={active ? { borderColor: `${accent}66`, background: `${accent}1c`, boxShadow: `0 0 20px -8px ${accent}cc` } : undefined}
            >
              <IconGlyph icon={category.icon} size={16} rounded="rounded-sm" /> {category.name}{" "}
              <span className="num" style={active ? { color: accent } : { opacity: 0.5 }}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grilla con animaciones de layout al filtrar */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {shown.map((item, i) => {
            const category = categoryFor(item);
            const accent = category.accent;
            const isCopied = copied === item.id;

            /* ---------- Tarjeta PROMPT — cita / terminal ---------- */
            if (category.kind === "prompt") {
              const text = item.note || item.title;
              const steps = (item.steps || "").split("\n").map((s) => s.trim()).filter(Boolean);
              return (
                <motion.article
                  key={item.id}
                  {...cardMotion(i)}
                  className="glass card-sheen group relative flex flex-col overflow-hidden rounded-2xl p-5"
                >
                  <AccentBand accent={accent} />

                  <div className="relative z-[1] flex items-center justify-between gap-2">
                    <span className="glow-pulse inline-flex items-center gap-1.5 rounded-full border border-nude/40 bg-nude/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-nude">
                      <Quote className="h-3 w-3" /> Prompt
                    </span>
                    <div className="flex items-center gap-1.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                      <EditBtn onClick={() => beginEdit(item)} />
                      <DeleteBtn onConfirm={() => { void deleteTool(item); }} />
                    </div>
                  </div>

                  <ToolMedia item={item} onView={() => setLightboxId(item.id)} />

                  <h3 className="relative z-[1] mt-3 flex items-center gap-2 text-base font-semibold text-white">
                    {item.icon && <IconGlyph icon={item.icon} size={isImgSrc(item.icon) ? 26 : 18} rounded="rounded-md" />}
                    <span className="min-w-0 truncate">{item.title}</span>
                  </h3>

                  {/* Bloque terminal: clic en cualquier parte copia */}
                  <button
                    type="button"
                    onClick={() => copy(text, item.id)}
                    data-cursor-label="Copiar"
                    data-cursor-color={NUDE}
                    aria-label={`Copiar prompt ${item.title}`}
                    className="relative z-[1] mt-3 flex-1 overflow-hidden rounded-xl border border-white/[0.08] bg-black/40 text-left transition hover:border-nude/30"
                  >
                    <span className="flex items-center gap-1.5 border-b border-white/[0.06] bg-white/[0.03] px-3.5 py-2">
                      <span className="h-2 w-2 rounded-full bg-[#ff5f57]/60" />
                      <span className="h-2 w-2 rounded-full bg-[#febc2e]/60" />
                      <span className="h-2 w-2 rounded-full bg-[#28c840]/60" />
                      <span className="ml-1.5 font-mono text-[10px] tracking-wide text-[var(--faint)]">prompt.txt</span>
                    </span>
                    <span className="line-clamp-[7] block whitespace-pre-wrap px-3.5 py-3 font-mono text-xs leading-relaxed text-zinc-300">
                      {item.note || "Sin texto todavía — tocá Editar y pegá el prompt."}
                    </span>
                  </button>

                  {/* Pasos para aplicar el prompt */}
                  {steps.length > 0 && (
                    <div className="relative z-[1] mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-nude">Cómo usarlo</p>
                      <ol className="space-y-1.5">
                        {steps.map((s, n) => (
                          <li key={n} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--muted)]">
                            <span className="num mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-nude/30 bg-nude/10 text-[10px] font-semibold text-nude">
                              {n + 1}
                            </span>
                            <span className="min-w-0">{s}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Botón grande de copiar con feedback animado */}
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => copy(text, item.id)}
                    data-cursor-label="Copiar"
                    data-cursor-color={NUDE}
                    aria-label={`Copiar prompt ${item.title}`}
                    className={`relative z-[1] mt-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border py-3 text-sm font-semibold transition-colors duration-300 ${
                      isCopied
                        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300 shadow-[0_0_24px_-8px_rgba(52,211,153,0.7)]"
                        : "border-nude/30 bg-nude/10 text-nude hover:border-nude/50 hover:bg-nude/20"
                    }`}
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      {isCopied ? (
                        <motion.span
                          key="ok"
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.4, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 26 }}
                          className="flex items-center gap-2"
                        >
                          <Check className="h-4 w-4" /> ¡Copiado!
                        </motion.span>
                      ) : (
                        <motion.span
                          key="cp"
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          transition={{ duration: 0.18, ease: EASE }}
                          className="flex items-center gap-2"
                        >
                          <Copy className="h-4 w-4" /> Copiar prompt
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </motion.article>
              );
            }

            /* ---------- Tarjeta LINK / APP ---------- */
            const safeHref = item.href ? safeExternalUrl(item.href) : null;
            const host = safeHref ? hostOf(safeHref) : null;
            return (
              <motion.article
                key={item.id}
                {...cardMotion(i)}
                className="glass glass-hover card-sheen group relative flex flex-col overflow-hidden rounded-2xl p-5"
              >
                <AccentBand accent={accent} />
                {safeHref && (
                  <a
                    href={safeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 z-0"
                    aria-label={`Abrir ${item.title}`}
                    data-cursor-label="Abrir"
                    data-cursor-color={NUDE}
                  />
                )}

                <div className="pointer-events-none relative z-[1] flex items-center justify-between gap-2">
                  <CategoryChip category={category} />
                  <div className="pointer-events-auto flex items-center gap-1.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                    <EditBtn onClick={() => beginEdit(item)} />
                    <DeleteBtn onConfirm={() => { void deleteTool(item); }} />
                  </div>
                </div>

                <ToolMedia item={item} onView={() => setLightboxId(item.id)} />

                <div className="pointer-events-none relative z-[1] mt-4 flex items-start gap-3.5">
                  <LinkVisual item={item} accent={accent} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-white">{item.title}</h3>
                    {host ? (
                      <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--faint)]">{host}</p>
                    ) : (
                      <p className="mt-0.5 text-[11px] italic text-[var(--faint)]">Sin link todavía</p>
                    )}
                  </div>
                </div>

                {item.note && (
                  <p className="pointer-events-none relative z-[1] mt-2.5 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
                    {item.note}
                  </p>
                )}

                <div className="pointer-events-none relative z-[1] mt-auto flex items-center justify-between pt-4">
                  {safeHref ? (
                    <span className="glow-text text-xs font-semibold tracking-wide">Abrir recurso</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginEdit(item)}
                      data-cursor-label="Completar"
                      className="press pointer-events-auto flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-[var(--muted)] transition hover:border-nude/40 hover:text-nude"
                    >
                      <Link2 className="h-3.5 w-3.5" /> Agregar link
                    </button>
                  )}
                  {/* Doble flecha: sale por arriba-derecha y entra otra desde abajo-izquierda */}
                  <span
                    aria-hidden
                    className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border ${safeHref ? "" : "opacity-30"}`}
                    style={{ borderColor: `${accent}40`, color: accent, background: `${accent}0d` }}
                  >
                    <ArrowUpRight
                      className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-5 group-hover:translate-x-5"
                      style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
                    />
                    <ArrowUpRight
                      className="absolute h-4 w-4 -translate-x-5 translate-y-5 transition-transform duration-300 group-hover:translate-x-0 group-hover:translate-y-0"
                      style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
                    />
                  </span>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Estados vacíos */}
      {shown.length === 0 &&
        (query.trim() ? (
          <EmptyState
            icon="🔍"
            title={`Nada coincide con «${query.trim()}»`}
            hint="Probá con otra palabra o revisá el filtro de categoría."
            action={
              <Button
                variant="subtle"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={filter === "all" ? "🧰" : <IconGlyph icon={(filterCategories.find((category) => category.id === filter) ?? UNCATEGORIZED_CATEGORY).icon} size={24} />}
            title="Sin recursos por acá"
            hint="Agregá el primero: un prompt, una app o un enlace del equipo."
            action={
              <Button onClick={() => {
                const selected = filter !== "all" ? categoryById(filter) : undefined;
                const fallback = selected ?? categories[0];
                if (fallback) beginEdit(emptyItem(fallback));
              }} disabled={categories.length === 0}>
                <Plus className="h-4 w-4" /> Agregar recurso
              </Button>
            }
          />
        ))}

      {/* Modal agregar / editar */}
      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setEditingOriginal(null); setPendingImage(null); setMutationError(null); }}
        title={editing?.id ? "Editar recurso" : "Nuevo recurso"}
        description={
          editing
            ? categoryById(editing.categoryId)?.kind === "prompt"
              ? "Los prompts se copian con un clic desde la tarjeta."
              : "Los links se abren en una pestaña nueva."
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => { setEditing(null); setEditingOriginal(null); setPendingImage(null); setMutationError(null); }}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving || !editing?.title.trim() || !categoryById(editing.categoryId)}>
              {saving ? "Guardando…" : editing?.id ? "Guardar cambios" : "Agregar"}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Ícono</span>
                <IconPicker value={editing.icon} onChange={(icon) => setEditing((c) => (c ? { ...c, icon } : c))} size={42} />
              </div>
              <div className="min-w-0 flex-1">
                <Field label="Categoría">
                  <Select value={editing.categoryId} onChange={(e) => {
                    const category = categoryById(e.target.value);
                    if (category) setEditing({ ...editing, category: category.id, categoryId: category.id, kind: category.kind });
                  }}>
                    <option value="" disabled>Elegí una categoría…</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
            <Field label="Título">
              <Input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder={categoryById(editing.categoryId)?.kind === "prompt" ? "Ej: Hook viral para Reels" : "Ej: Content Studio IA"}
              />
            </Field>
            <Field label={categoryById(editing.categoryId)?.kind === "prompt" ? "Prompt (texto que se copia)" : "Descripción"}>
              <Textarea
                rows={categoryById(editing.categoryId)?.kind === "prompt" ? 6 : 2}
                value={editing.note}
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                className={categoryById(editing.categoryId)?.kind === "prompt" ? "font-mono text-xs leading-relaxed" : undefined}
                placeholder={categoryById(editing.categoryId)?.kind === "prompt" ? "Pegá acá el prompt completo…" : "Una línea que explique para qué sirve"}
              />
            </Field>
            {categoryById(editing.categoryId)?.kind === "prompt" && (
              <Field label="Pasos para aplicarlo (opcional — uno por línea)">
                <Textarea
                  rows={3}
                  value={editing.steps ?? ""}
                  onChange={(e) => setEditing({ ...editing, steps: e.target.value })}
                  placeholder={"Abrí ChatGPT o Gemini\nPegá el prompt y completá los [corchetes]\nRevisá el tono antes de publicar"}
                />
                <p className="mt-1.5 text-[11px] text-[var(--faint)]">Cada línea se muestra como un paso numerado en la tarjeta.</p>
              </Field>
            )}
            {categoryById(editing.categoryId)?.kind === "link" && (
              <Field label="Link">
                <div className="flex items-center gap-2">
                  <Input
                    value={editing.href}
                    onChange={(e) => setEditing({ ...editing, href: e.target.value })}
                    placeholder="https://…"
                    className="flex-1"
                  />
                  {editingHost && (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={faviconUrl(editingHost)} alt="" className="h-5 w-5 rounded" />
                    </span>
                  )}
                </div>
                {editingHost && <p className="mt-1.5 text-[11px] text-[var(--faint)]">Se detectó {editingHost} — ese favicon va a ilustrar la tarjeta.</p>}
              </Field>
            )}
            <Field label="Imagen (opcional)">
              <div className="flex items-center gap-3">
                {editing.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.image} alt="" className="h-16 w-16 rounded-lg border border-white/10 object-cover" />
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={onImage} className="hidden" />
                <Button variant="subtle" type="button" onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" /> {editing.image ? "Cambiar" : "Subir imagen"}
                </Button>
                {editing.image && (
                  <button
                    type="button"
                    onClick={() => { setPendingImage(null); setEditing({ ...editing, image: "" }); }}
                    className="text-xs text-[var(--faint)] transition hover:text-red-300"
                  >
                    Quitar
                  </button>
                )}
              </div>
              {imgErr && <p role="alert" className="mt-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">{imgErr}</p>}
              <p className="mt-1.5 text-[11px] text-[var(--faint)]">Los GIF conservan su animación. La imagen se ve en grande tocándola en la tarjeta.</p>
            </Field>
          </div>
        )}
      </Modal>

      <ToolCategoryManager
        open={managingCategories}
        onClose={() => setManagingCategories(false)}
        categories={categories}
        tools={items}
        onAdd={addCategory}
        onUpdate={updateCategory}
        onReorder={reorderCategories}
        onDelete={deleteCategory}
      />

      {/* Visor de imágenes dentro de la colección filtrada */}
      <Lightbox
        images={lightboxIndex >= 0 ? mediaItems.map((item) => item.image) : []}
        alts={lightboxIndex >= 0 ? mediaItems.map((item) => item.title) : []}
        captions={lightboxIndex >= 0 ? mediaItems.map((item) => item.title) : []}
        initialIndex={Math.max(0, lightboxIndex)}
        alt={activeLightboxItem?.title ?? "Imagen de recurso"}
        onClose={() => setLightboxId(null)}
      />
    </div>
  );
}
