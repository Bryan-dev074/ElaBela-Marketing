"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";
import { Lightbox } from "@/components/Lightbox";
import { Markdown } from "@/components/Markdown";
import { MediaCarousel } from "@/components/MediaCarousel";
import {
  Button,
  Card,
  EmptyState,
  Field,
  IconGlyph,
  Input,
  Modal,
  PageHeader,
  Reveal,
  Textarea,
} from "@/components/ui";
import { IconPicker } from "@/components/IconPicker";
import { WEEKLY_REQS, type PostType } from "@/lib/data";
import { type ToolItem, usePostTypes, useToolItems } from "@/lib/db";
import { fileToImage } from "@/lib/profiles";
import {
  MAX_PUBLICATION_IMAGE_BYTES,
  MAX_PUBLICATION_IMAGES,
  normalizePublicationImages,
  resolveGuideTools,
  safeExternalHref,
  validatePublicationImages,
} from "@/lib/publications";
import { removeAssetByPublicUrl, uploadAsset, validateAssetFile } from "@/lib/storage";

type DraftImage = {
  id: string;
  preview: string;
  sourceUrl?: string;
  file?: File;
};

type PublicationDraft = Omit<PostType, "exampleImage" | "exampleImages"> & {
  images: DraftImage[];
};

type LightboxState = { post: PostType; index: number };

function emptyPublicationDraft(): PublicationDraft {
  return {
    id: "",
    name: "",
    icon: "✨",
    desc: "",
    accent: "#d6ab99",
    example: "",
    guide: "",
    toolIds: [],
    images: [],
  };
}

function publicationDraft(post: PostType): PublicationDraft {
  return {
    ...post,
    toolIds: [...post.toolIds],
    images: normalizePublicationImages(post.exampleImages, post.exampleImage).map((sourceUrl, index) => ({
      id: `saved-${index}-${sourceUrl}`,
      preview: sourceUrl,
      sourceUrl,
    })),
  };
}

function compressedFile(dataUrl: string, originalName: string) {
  const [, encoded = ""] = dataUrl.split(",", 2);
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  const stem = originalName.replace(/\.[^.]+$/, "") || "imagen";
  return new File([bytes], `${stem}.jpg`, { type: "image/jpeg" });
}

function status(pct: number) {
  if (pct >= 100) return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Cumplido", pill: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" };
  if (pct >= 60) return { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "Parcial", pill: "border-amber-400/25 bg-amber-400/10 text-amber-300" };
  return { icon: <XCircle className="h-3.5 w-3.5" />, label: "No cumplido", pill: "border-red-400/25 bg-red-500/10 text-red-300" };
}

function TypeCard({
  post,
  onEdit,
  onDelete,
  onGuide,
  onOpenImage,
}: {
  post: PostType;
  onEdit: () => void;
  onDelete: () => void;
  onGuide: () => void;
  onOpenImage: (index: number) => void;
}) {
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const images = normalizePublicationImages(post.exampleImages, post.exampleImage);

  useEffect(() => () => {
    if (armTimer.current) clearTimeout(armTimer.current);
  }, []);

  const handleDelete = () => {
    if (armed) {
      if (armTimer.current) clearTimeout(armTimer.current);
      onDelete();
      return;
    }
    setArmed(true);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmed(false), 2600);
  };

  return (
    <Card className="card-sheen group flex h-full flex-col overflow-hidden p-0">
      <div className="h-52 border-b border-white/8">
        {images.length > 0 ? (
          <MediaCarousel images={images} alt={`Ejemplo de ${post.name}`} onOpen={onOpenImage} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-black/25 text-[var(--faint)]">
            <ImagePlus className="h-6 w-6" aria-hidden="true" />
            <span className="text-[11px] font-medium uppercase tracking-[0.12em]">Sin referencias</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <button
          type="button"
          onClick={onGuide}
          className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nude/70"
          aria-label={`Abrir guía de ${post.name}`}
        >
          <div className="mb-3 flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-[0_8px_30px_-12px_var(--tile)]"
              style={{ background: `${post.accent}22`, "--tile": post.accent } as React.CSSProperties}
            >
              <IconGlyph icon={post.icon} size={26} />
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 className="text-lg font-semibold text-white text-balance">{post.name}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)] text-pretty">{post.desc}</p>
            </div>
          </div>
          {post.example ? (
            <div className="rounded-xl border border-white/8 bg-black/25 p-3">
              <span
                className="mb-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
                style={{ background: `${post.accent}18`, color: post.accent, border: `1px solid ${post.accent}33` }}
              >
                Ejemplo
              </span>
              <p className="text-xs leading-relaxed text-[var(--muted)] text-pretty">{post.example}</p>
            </div>
          ) : null}
        </button>

        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <button
            type="button"
            onClick={onGuide}
            className="press inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-medium text-[var(--muted)] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nude"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            Ver guía
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="press flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-[var(--faint)] transition-colors hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nude"
              aria-label={`Editar ${post.name}`}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className={`press flex h-10 items-center justify-center rounded-xl border text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
                armed
                  ? "border-red-400/40 bg-red-500/15 px-3 font-medium text-red-300"
                  : "w-10 border-white/10 text-[var(--faint)] hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300"
              }`}
              aria-label={armed ? `Confirmar eliminación de ${post.name}` : `Eliminar ${post.name}`}
            >
              {armed ? "¿Seguro?" : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function GuideContent({ post, tools }: { post: PostType; tools: ToolItem[] }) {
  const relatedTools = resolveGuideTools(post.toolIds, tools);

  return (
    <div className="space-y-6">
      {post.guide.trim() ? (
        <Markdown>{post.guide}</Markdown>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center">
          <BookOpen className="mx-auto h-6 w-6 text-[var(--faint)]" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-white">Guía todavía sin contenido</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Editá esta publicación para documentar el proceso de producción.</p>
        </div>
      )}

      {relatedTools.length > 0 ? (
        <section aria-labelledby="related-tools-title">
          <div className="mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-nude" aria-hidden="true" />
            <h3 id="related-tools-title" className="text-sm font-semibold text-white">Tools relacionados</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {relatedTools.map((tool) => {
              const href = safeExternalHref(tool.href);
              const content = (
                <>
                  <IconGlyph icon={tool.icon || (tool.kind === "prompt" ? "💬" : "🔗")} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">{tool.title}</span>
                    {tool.note ? <span className="mt-0.5 block line-clamp-2 text-xs text-[var(--muted)]">{tool.note}</span> : null}
                  </span>
                  {href ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--faint)]" aria-hidden="true" /> : null}
                </>
              );

              return href ? (
                <a
                  key={tool.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press flex min-h-16 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-white/20 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nude"
                >
                  {content}
                </a>
              ) : (
                <div key={tool.id} className="flex min-h-16 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  {content}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function PublicacionesPage() {
  const {
    items: types,
    addAsync,
    updateAsync,
    removeAsync,
    error: collectionError,
    clearError,
  } = usePostTypes();
  const { items: tools } = useToolItems();
  const [editing, setEditing] = useState<PublicationDraft | null>(null);
  const [guidePost, setGuidePost] = useState<PostType | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [processingFiles, setProcessingFiles] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const originalImagesRef = useRef<string[]>([]);
  const editorSessionRef = useRef(0);

  const closeEditor = () => {
    editorSessionRef.current += 1;
    setEditing(null);
    setEditorError(null);
    setProcessingFiles(false);
  };

  const beginCreate = () => {
    clearError();
    setPageError(null);
    setEditorError(null);
    originalImagesRef.current = [];
    editorSessionRef.current += 1;
    setEditing(emptyPublicationDraft());
  };

  const beginEdit = (post: PostType) => {
    clearError();
    setPageError(null);
    setEditorError(null);
    const images = normalizePublicationImages(post.exampleImages, post.exampleImage);
    originalImagesRef.current = [...images];
    editorSessionRef.current += 1;
    setEditing(publicationDraft(post));
  };

  const onImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!editing || files.length === 0) return;

    const countError = validatePublicationImages([
      ...editing.images.map((image) => image.preview),
      ...files.map((file) => file.name),
    ]);
    if (countError) {
      setEditorError(countError);
      return;
    }
    for (const file of files) {
      const validation = validateAssetFile(file, { kind: "image", maxBytes: MAX_PUBLICATION_IMAGE_BYTES });
      if (!validation.ok) {
        setEditorError(validation.error);
        return;
      }
    }

    const session = editorSessionRef.current;
    setEditorError(null);
    setProcessingFiles(true);
    try {
      const compressed = await Promise.all(files.map(async (file) => {
        const preview = await fileToImage(file, 1600, 0.84);
        return {
          id: `new-${crypto.randomUUID()}`,
          preview,
          file: compressedFile(preview, file.name),
        } satisfies DraftImage;
      }));
      if (session !== editorSessionRef.current) return;
      setEditing((current) => current ? { ...current, images: [...current.images, ...compressed] } : current);
    } catch {
      if (session === editorSessionRef.current) setEditorError("No se pudieron preparar las imágenes seleccionadas.");
    } finally {
      if (session === editorSessionRef.current) setProcessingFiles(false);
    }
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setEditing((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.images.length) return current;
      const images = [...current.images];
      [images[index], images[target]] = [images[target], images[index]];
      return { ...current, images };
    });
  };

  const removeImage = (id: string) => {
    setEditing((current) => current ? { ...current, images: current.images.filter((image) => image.id !== id) } : current);
  };

  const toggleTool = (toolId: string) => {
    setEditing((current) => {
      if (!current) return current;
      const toolIds = current.toolIds.includes(toolId)
        ? current.toolIds.filter((id) => id !== toolId)
        : [...current.toolIds, toolId];
      return { ...current, toolIds };
    });
  };

  const save = async () => {
    if (!editing || saving || processingFiles) return;
    const name = editing.name.trim();
    if (!name) {
      setEditorError("Escribí un nombre para la publicación.");
      return;
    }
    const countError = validatePublicationImages(editing.images.map((image) => image.preview));
    if (countError) {
      setEditorError(countError);
      return;
    }

    setSaving(true);
    setEditorError(null);
    clearError();
    const pending = editing.images.filter((image): image is DraftImage & { file: File } => !!image.file);
    let uploadedUrls: string[] = [];

    try {
      const uploadResults = await Promise.all(pending.map(async (image) => {
        try {
          return { id: image.id, result: await uploadAsset(image.file, "publications") };
        } catch {
          return { id: image.id, result: { ok: false as const, error: `No se pudo subir ${image.file.name}.` } };
        }
      }));
      uploadedUrls = uploadResults.flatMap(({ result }) => result.ok ? [result.url] : []);
      const failedUpload = uploadResults.find(({ result }) => !result.ok);
      if (failedUpload && !failedUpload.result.ok) {
        await Promise.allSettled(uploadedUrls.map((url) => removeAssetByPublicUrl(url)));
        setEditorError(failedUpload.result.error);
        return;
      }

      const urlById = new Map(uploadResults.flatMap(({ id, result }) => result.ok ? [[id, result.url] as const] : []));
      const exampleImages = editing.images.flatMap((image) => {
        const url = image.sourceUrl ?? urlById.get(image.id);
        return url ? [url] : [];
      });
      const publication: PostType = {
        id: editing.id || `p-${crypto.randomUUID()}`,
        name,
        icon: editing.icon,
        desc: editing.desc.trim(),
        accent: editing.accent,
        example: editing.example?.trim() ?? "",
        exampleImage: exampleImages[0] ?? "",
        exampleImages,
        guide: editing.guide,
        toolIds: editing.toolIds,
      };
      const mutation = editing.id
        ? await updateAsync(editing.id, publication)
        : await addAsync(publication);
      if (!mutation.ok) {
        await Promise.allSettled(uploadedUrls.map((url) => removeAssetByPublicUrl(url)));
        setEditorError(mutation.error);
        return;
      }

      const removedImages = originalImagesRef.current.filter((url) => !exampleImages.includes(url));
      await Promise.allSettled(removedImages.map((url) => removeAssetByPublicUrl(url)));
      closeEditor();
    } catch {
      await Promise.allSettled(uploadedUrls.map((url) => removeAssetByPublicUrl(url)));
      setEditorError("No se pudo guardar la publicación. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const deletePublication = async (post: PostType) => {
    setPageError(null);
    clearError();
    const result = await removeAsync(post.id);
    if (!result.ok) {
      setPageError(result.error);
      return;
    }
    const images = normalizePublicationImages(post.exampleImages, post.exampleImage);
    await Promise.allSettled(images.map((url) => removeAssetByPublicUrl(url)));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Contenido"
        title="Publicaciones"
        description="Consultá referencias, seguí la guía de producción y vinculá las Tools que necesita cada formato."
        action={<Button onClick={beginCreate}><Plus className="h-4 w-4" /> Nuevo tipo</Button>}
      />

      {pageError || collectionError ? (
        <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{pageError || collectionError}</span>
        </div>
      ) : null}

      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="text-lg font-semibold text-white">Tipos de post</h2>
        <span className="glow-text num text-sm font-semibold tabular-nums">{types.length}</span>
      </div>
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((post, index) => (
          <Reveal key={post.id} delay={index * 0.04} className="h-full">
            <TypeCard
              post={post}
              onEdit={() => beginEdit(post)}
              onDelete={() => { void deletePublication(post); }}
              onGuide={() => setGuidePost(post)}
              onOpenImage={(imageIndex) => setLightbox({ post, index: imageIndex })}
            />
          </Reveal>
        ))}
        {types.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState
              icon={<Sparkles className="h-5 w-5" />}
              title="Sin tipos de post"
              hint="Creá el primero para documentar su referencia visual y proceso de producción."
              action={<Button onClick={beginCreate}><Plus className="h-4 w-4" /> Nuevo tipo</Button>}
            />
          </div>
        ) : null}
      </div>

      <h2 className="mb-4 text-lg font-semibold text-white">Cumplimiento semanal</h2>
      <Card className="overflow-hidden" hover={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/8 text-[var(--muted)]">
                <th className="px-5 py-3 font-medium">Plataforma</th>
                <th className="px-5 py-3 font-medium">Formato</th>
                <th className="px-5 py-3 font-medium">Meta</th>
                <th className="px-5 py-3 font-medium">Avance</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {WEEKLY_REQS.map((requirement, index) => {
                const pct = Math.round((requirement.done / requirement.target) * 100);
                const currentStatus = status(pct);
                return (
                  <motion.tr
                    key={requirement.platform + requirement.format}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.06 }}
                    className="border-b border-white/6 transition-colors last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-4 font-medium text-white">{requirement.platform}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{requirement.format}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{requirement.freq}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${Math.min(100, pct)}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: index * 0.06 + 0.15 }}
                            className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-400" : pct >= 60 ? "bg-blue-400" : "bg-amber-400"}`}
                          />
                        </div>
                        <span className="num text-xs tabular-nums text-[var(--faint)]">{requirement.done}/{requirement.target}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${currentStatus.pill}`}>
                        {currentStatus.icon}{currentStatus.label}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!editing}
        onClose={saving ? () => {} : closeEditor}
        title={editing?.id ? "Editar tipo de post" : "Nuevo tipo de post"}
        description="Hasta 8 imágenes de 8 MB cada una. Podés ordenar las referencias antes de guardar."
        wide
        footer={(
          <>
            <Button variant="ghost" onClick={closeEditor} disabled={saving}>Cancelar</Button>
            <Button onClick={() => { void save(); }} disabled={saving || processingFiles}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        )}
      >
        {editing ? (
          <div className="space-y-5">
            {editorError ? (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{editorError}</span>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_7rem]">
              <Field label="Ícono">
                <IconPicker value={editing.icon} onChange={(icon) => setEditing((current) => current ? { ...current, icon } : current)} />
              </Field>
              <Field label="Nombre">
                <Input value={editing.name} onChange={(event) => setEditing((current) => current ? { ...current, name: event.target.value } : current)} placeholder="Ej: Reel Tutorial" />
              </Field>
              <Field label="Color">
                <div className="field flex h-[42px] items-center gap-2 px-2 py-0">
                  <input
                    type="color"
                    value={editing.accent}
                    onChange={(event) => setEditing((current) => current ? { ...current, accent: event.target.value } : current)}
                    className="h-6 w-7 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0"
                    aria-label="Color del tipo de post"
                  />
                  <span className="num font-mono text-[10px] uppercase text-[var(--muted)]">{editing.accent}</span>
                </div>
              </Field>
            </div>

            <Field label="Descripción">
              <Input value={editing.desc} onChange={(event) => setEditing((current) => current ? { ...current, desc: event.target.value } : current)} />
            </Field>
            <Field label="Ejemplo breve">
              <Textarea rows={2} value={editing.example ?? ""} onChange={(event) => setEditing((current) => current ? { ...current, example: event.target.value } : current)} placeholder="Qué debería mostrar un buen post de este tipo…" />
            </Field>

            <section aria-labelledby="publication-images-title">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 id="publication-images-title" className="text-xs font-medium text-[var(--muted)]">Imágenes de ejemplo</h3>
                  <p className="mt-0.5 text-[10px] text-[var(--faint)]">{editing.images.length} / {MAX_PUBLICATION_IMAGES}</p>
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={(event) => { void onImages(event); }} className="hidden" />
                <Button
                  variant="subtle"
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={processingFiles || editing.images.length >= MAX_PUBLICATION_IMAGES}
                >
                  {processingFiles ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
                  {processingFiles ? "Preparando…" : "Agregar imágenes"}
                </Button>
              </div>

              {editing.images.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {editing.images.map((image, index) => (
                    <div key={image.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/25">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.preview} alt={`Referencia ${index + 1}`} className="h-32 w-full object-contain" />
                      <div className="flex items-center justify-between border-t border-white/8 px-2 py-1.5">
                        <span className="num pl-1 text-[10px] tabular-nums text-[var(--faint)]">{index + 1}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveImage(index, -1)}
                            disabled={index === 0}
                            aria-label={`Mover imagen ${index + 1} a la izquierda`}
                            className="press flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveImage(index, 1)}
                            disabled={index === editing.images.length - 1}
                            aria-label={`Mover imagen ${index + 1} a la derecha`}
                            className="press flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30"
                          >
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeImage(image.id)}
                            aria-label={`Quitar imagen ${index + 1}`}
                            className="press flex h-9 w-9 items-center justify-center rounded-lg text-[var(--faint)] transition-colors hover:bg-red-500/10 hover:text-red-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-[var(--faint)]">
                  Agregá referencias para mostrar cómo debería verse este formato.
                </div>
              )}
            </section>

            <Field label="Guía de producción (Markdown)">
              <Textarea
                rows={8}
                value={editing.guide}
                onChange={(event) => setEditing((current) => current ? { ...current, guide: event.target.value } : current)}
                placeholder={"## Objetivo\n\n1. Prepará el producto…\n2. Grabá o diseñá…\n3. Revisá el CTA…"}
              />
            </Field>

            <section aria-labelledby="publication-tools-title">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 id="publication-tools-title" className="text-xs font-medium text-[var(--muted)]">Tools relacionados</h3>
                <span className="text-[10px] text-[var(--faint)]">{editing.toolIds.length} seleccionados</span>
              </div>
              {tools.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {tools.map((tool) => {
                    const selected = editing.toolIds.includes(tool.id);
                    return (
                      <label
                        key={tool.id}
                        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                          selected ? "border-nude/40 bg-nude/10" : "border-white/10 bg-white/[0.02] hover:border-white/20"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleTool(tool.id)}
                          className="h-4 w-4 accent-[#d6ab99]"
                        />
                        <IconGlyph icon={tool.icon || (tool.kind === "prompt" ? "💬" : "🔗")} size={24} />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-white">{tool.title}</span>
                          <span className="mt-0.5 block text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">{tool.kind === "prompt" ? "Prompt" : "Enlace"}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-[var(--faint)]">Todavía no hay Tools disponibles.</p>
              )}
            </section>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!guidePost}
        onClose={() => setGuidePost(null)}
        title={guidePost?.name ?? "Guía de producción"}
        description="Referencia y pasos para producir este tipo de publicación."
        wide
      >
        {guidePost ? <GuideContent post={guidePost} tools={tools} /> : null}
      </Modal>

      <Lightbox
        images={lightbox ? normalizePublicationImages(lightbox.post.exampleImages, lightbox.post.exampleImage) : []}
        initialIndex={lightbox?.index ?? 0}
        alt={lightbox ? `Ejemplo de ${lightbox.post.name}` : ""}
        caption={lightbox?.post.name}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
