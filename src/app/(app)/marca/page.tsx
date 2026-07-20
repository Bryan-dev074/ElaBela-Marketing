"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, FileType2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Button, Card, Field, Input, Modal, PageHeader, Reveal } from "@/components/ui";
import {
  BRAND_COLORS,
  brandFontFaceRule,
  brandFontFamily,
  fontFormatFromFileName,
  storagePathFromPublicUrl,
} from "@/lib/brand";
import { type BrandAsset, useBrandAssets } from "@/lib/db";
import { removeAssetByPublicUrl, uploadAsset, validateFontFile } from "@/lib/storage";

interface Swatch { name: string; role: string; hex: string }
type FontLoadState = "legacy" | "loading" | "loaded" | "error";
type EditorState = { mode: "create" } | { mode: "edit"; asset: BrandAsset };

const MAX_FONT_BYTES = 5 * 1024 * 1024;
const DEFAULT_SAMPLE = "ElaBela — belleza que brilla";

function useRuntimeBrandFont(asset: BrandAsset) {
  const descriptor = brandFontFaceRule(asset);
  const family = brandFontFamily(asset.id);
  const [state, setState] = useState<FontLoadState>(descriptor ? "loading" : "legacy");

  useEffect(() => {
    const rule = brandFontFaceRule(asset);
    if (!rule) {
      setState("legacy");
      return;
    }

    let active = true;
    setState("loading");
    const style = document.createElement("style");
    style.dataset.brandFontId = asset.id;
    style.textContent = rule;
    document.head.appendChild(style);

    const fontSet = document.fonts;
    if (!fontSet?.load) {
      setState("error");
      return () => {
        active = false;
        style.remove();
      };
    }
    void Promise.resolve().then(() => fontSet.load(`1em "${brandFontFamily(asset.id)}"`)).then(
      (matches) => { if (active) setState(matches.length > 0 ? "loaded" : "error"); },
      () => { if (active) setState("error"); },
    );

    return () => {
      active = false;
      style.remove();
    };
  }, [asset.fileFormat, asset.fileUrl, asset.id]);

  return { family: state === "loaded" ? `"${family}", var(--font-sans)` : "var(--font-sans)", state };
}

function FontCard({
  asset,
  onEdit,
  onDelete,
  disabled,
}: {
  asset: BrandAsset;
  onEdit: (asset: BrandAsset) => void;
  onDelete: (asset: BrandAsset) => void;
  disabled: boolean;
}) {
  const { family, state } = useRuntimeBrandFont(asset);
  const [sample, setSample] = useState(DEFAULT_SAMPLE);
  const [fontSize, setFontSize] = useState(36);
  const [letterSpacing, setLetterSpacing] = useState(0);

  return (
    <article aria-label={`Fuente ${asset.name}`}>
      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/10 bg-gradient-to-br from-white/[0.07] to-nude/[0.04] p-5">
          <p
            aria-label={`Vista previa de ${asset.name}`}
            className="min-h-16 break-words text-white transition-[font-size,letter-spacing]"
            style={{ fontFamily: family, fontSize, letterSpacing }}
          >
            {sample || "Escribí una muestra"}
          </p>
          {state === "loading" ? <p role="status" className="mt-2 text-[11px] text-[var(--faint)]">Cargando archivo de fuente…</p> : null}
          {state === "error" ? <p role="alert" className="mt-2 text-[11px] text-amber-300">No se pudo cargar; se muestra la fuente de interfaz.</p> : null}
          {state === "legacy" ? <p className="mt-2 text-[11px] text-amber-300">Sin archivo cargado (registro heredado).</p> : null}
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem]">
            <Field label="Texto de muestra">
              <Input aria-label={`Texto de muestra de ${asset.name}`} value={sample} onChange={(event) => setSample(event.target.value)} />
            </Field>
            <Field label={`Tamaño · ${fontSize}px`}>
              <input aria-label={`Tamaño de ${asset.name}`} className="mt-2 w-full accent-[#d6ab99]" type="range" min="18" max="72" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} />
            </Field>
            <Field label={`Espaciado · ${letterSpacing}px`}>
              <input aria-label={`Espaciado de ${asset.name}`} className="mt-2 w-full accent-[#d6ab99]" type="range" min="-1" max="4" step="0.1" value={letterSpacing} onChange={(event) => setLetterSpacing(Number(event.target.value))} />
            </Field>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-4" style={{ fontFamily: family }}>
            <p className="text-xl text-white">Aa Bb Cc 123 · ÁÉÍÓÚ ñ</p>
            <p className="text-sm leading-relaxed text-[var(--muted)]">ElaBela crea experiencias de belleza que combinan cuidado, confianza y un brillo auténtico en cada detalle.</p>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">{asset.name}</h3>
              <p className="text-[11px] text-[var(--faint)]">{asset.role || "Sin rol definido"}</p>
              <p className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-nude">
                <FileType2 className="h-3 w-3" /> {asset.fileFormat ? asset.fileFormat.toUpperCase() : "Registro heredado"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={disabled} className="px-3 py-2 text-xs" aria-label={`Editar ${asset.name}`} onClick={() => onEdit(asset)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
              <Button type="button" variant="ghost" disabled={disabled} className="border-red-400/25 px-3 py-2 text-xs text-red-300 hover:border-red-400/50" aria-label={`Eliminar ${asset.name}`} onClick={() => onDelete(asset)}><Trash2 className="h-3.5 w-3.5" /> Eliminar</Button>
            </div>
          </div>
        </div>
      </Card>
    </article>
  );
}

function InterfaceFontCard() {
  const [sample, setSample] = useState(DEFAULT_SAMPLE);
  return (
    <article aria-label="Fuente Inter (UI)">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/10 bg-gradient-to-br from-white/[0.07] to-nude/[0.04] p-5">
          <p className="min-h-16 break-words text-4xl text-white" style={{ fontFamily: "var(--font-sans)" }}>{sample || "Escribí una muestra"}</p>
        </div>
        <div className="space-y-4 p-5">
          <Field label="Texto de muestra"><Input aria-label="Texto de muestra de Inter (UI)" value={sample} onChange={(event) => setSample(event.target.value)} /></Field>
          <div><h3 className="text-sm font-semibold text-white">Inter (UI)</h3><p className="text-[11px] text-[var(--faint)]">Interfaz del sistema</p></div>
        </div>
      </Card>
    </article>
  );
}

export default function MarcaPage() {
  const { items: assets, add, addAsync, updateAsync, removeAsync, error: collectionError, clearError, ready } = useBrandAssets();
  const [copied, setCopied] = useState<string | null>(null);
  const [newColor, setNewColor] = useState({ name: "", hex: "#d6ab99" });
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BrandAsset | null>(null);
  const [draft, setDraft] = useState({ name: "", role: "" });
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const mutationLock = useRef(false);

  const colors: Swatch[] = [
    ...BRAND_COLORS.map((color) => ({ ...color })),
    ...assets.filter((asset) => asset.kind === "color").map((asset) => ({ name: asset.name, role: asset.role || "Nuevo", hex: asset.value })),
  ];
  const fonts = assets.filter((asset) => asset.kind === "font");

  const addColor = () => {
    if (!ready || !newColor.name.trim()) return;
    add({ id: `ba${Date.now()}`, kind: "color", name: newColor.name.trim(), value: newColor.hex, role: "Nuevo" });
    setNewColor({ name: "", hex: "#d6ab99" });
  };
  const copyHex = (hex: string) => navigator.clipboard?.writeText(hex).then(() => {
    setCopied(hex);
    setTimeout(() => setCopied(null), 1200);
  });

  const openCreate = () => {
    if (!ready || mutationLock.current) return;
    clearError();
    setNotice("");
    setDialogError("");
    setDraft({ name: "", role: "" });
    setFontFile(null);
    setEditor({ mode: "create" });
  };
  const openEdit = (asset: BrandAsset) => {
    if (!ready || mutationLock.current) return;
    clearError();
    setNotice("");
    setDialogError("");
    setDraft({ name: asset.name, role: asset.role });
    setFontFile(null);
    setEditor({ mode: "edit", asset });
  };

  const compensateUpload = async (url: string, persistenceError: string) => {
    try {
      const cleanup = await removeAssetByPublicUrl(url);
      return cleanup.ok
        ? persistenceError
        : `${persistenceError} Además, no se pudo revertir el archivo nuevo: ${cleanup.error}`;
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "Error inesperado.";
      return `${persistenceError} Además, no se pudo revertir el archivo nuevo: ${reason}`;
    }
  };

  const saveFont = async () => {
    if (!editor || mutationLock.current || !ready) return;
    const operationEditor = editor;
    const operationDraft = { ...draft };
    const operationFile = fontFile;
    const name = operationDraft.name.trim();
    if (!name) {
      setDialogError("Ingresá un nombre visible para la fuente.");
      return;
    }
    if (operationEditor.mode === "create" && !operationFile) {
      setDialogError("Seleccioná un archivo de fuente.");
      return;
    }
    mutationLock.current = true;
    setPending(true);
    clearError();
    setDialogError("");
    setNotice("");
    let uploadedUrl: string | undefined;
    let uploadedFormat: ReturnType<typeof fontFormatFromFileName> = null;
    let persisted = false;

    try {
      if (operationFile) {
        const validation = await validateFontFile(operationFile, MAX_FONT_BYTES);
        if (!validation.ok) {
          setDialogError(validation.error);
          return;
        }
        uploadedFormat = fontFormatFromFileName(operationFile.name);
        const uploaded = await uploadAsset(operationFile, "brand/fonts");
        if (!uploaded.ok) {
          setDialogError(uploaded.error);
          return;
        }
        uploadedUrl = uploaded.url;
      }

      if (operationEditor.mode === "create") {
        const id = `ba${Date.now()}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
        const result = await addAsync({
          id,
          kind: "font",
          name,
          value: name,
          role: operationDraft.role.trim(),
          fileUrl: uploadedUrl,
          fileFormat: uploadedFormat ?? undefined,
          storagePath: uploadedUrl ? storagePathFromPublicUrl(uploadedUrl) : undefined,
        });
        if (!result.ok) {
          setDialogError(uploadedUrl ? await compensateUpload(uploadedUrl, result.error) : result.error);
          uploadedUrl = undefined;
          return;
        }
        persisted = true;
        setEditor(null);
        return;
      }

      const previousUrl = operationEditor.asset.fileUrl;
      const patch: Partial<BrandAsset> = { name, role: operationDraft.role.trim(), value: name };
      if (uploadedUrl && uploadedFormat) {
        patch.fileUrl = uploadedUrl;
        patch.fileFormat = uploadedFormat;
        patch.storagePath = storagePathFromPublicUrl(uploadedUrl);
      }
      const result = await updateAsync(operationEditor.asset.id, patch);
      if (!result.ok) {
        setDialogError(uploadedUrl ? await compensateUpload(uploadedUrl, result.error) : result.error);
        uploadedUrl = undefined;
        return;
      }

      persisted = true;
      setEditor(null);
      if (uploadedUrl && previousUrl) {
        const cleanup = await removeAssetByPublicUrl(previousUrl);
        if (!cleanup.ok) setNotice(`La fuente se guardó, pero no se pudo limpiar el archivo anterior: ${cleanup.error}`);
      }
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "Error inesperado.";
      if (uploadedUrl && !persisted) {
        setDialogError(await compensateUpload(uploadedUrl, `No se pudo completar la operación: ${reason}`));
      } else if (persisted) {
        setNotice(`La fuente se guardó, pero una limpieza posterior falló: ${reason}`);
      } else {
        setDialogError(`No se pudo completar la operación: ${reason}`);
      }
    } finally {
      mutationLock.current = false;
      setPending(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || mutationLock.current || !ready) return;
    mutationLock.current = true;
    clearError();
    setPending(true);
    setDialogError("");
    setNotice("");
    const target = deleteTarget;
    let rowDeleted = false;
    try {
      const result = await removeAsync(target.id);
      if (!result.ok) {
        setDialogError(result.error);
        return;
      }
      rowDeleted = true;
      setDeleteTarget(null);
      if (target.fileUrl) {
        const cleanup = await removeAssetByPublicUrl(target.fileUrl);
        if (!cleanup.ok) setNotice(`La fuente se eliminó, pero no se pudo limpiar su archivo: ${cleanup.error}`);
      }
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "Error inesperado.";
      if (rowDeleted) {
        setNotice(`La fuente se eliminó, pero no se pudo limpiar su archivo: ${reason}`);
      } else {
        setDialogError(`No se pudo completar la eliminación: ${reason}`);
      }
    } finally {
      mutationLock.current = false;
      setPending(false);
    }
  };

  const closeEditor = () => {
    if (!mutationLock.current) setEditor(null);
  };
  const closeDelete = () => {
    if (!mutationLock.current) setDeleteTarget(null);
  };

  return (
    <div>
      <PageHeader eyebrow="Identidad" title="Manual de Marca" description="Paleta y tipografías oficiales de ElaBela, siempre con ejemplo visual real. Cualquier perfil puede agregar; la grilla crece sin límite." />

      {collectionError ? <p role="alert" className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{collectionError}</p> : null}
      {notice ? <p role="status" className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{notice}</p> : null}
      {!ready ? <p role="status" className="mb-4 text-xs text-[var(--muted)]">Cargando recursos de marca…</p> : null}

      <h2 className="mb-4 text-lg font-semibold text-white">Paleta</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {colors.map((color, index) => (
          <Reveal key={color.name + index} delay={index * 0.03}>
            <Card className="overflow-hidden p-0">
              <div className="h-24 w-full" style={{ background: color.hex }} />
              <div className="p-4">
                <p className="text-sm font-semibold text-white">{color.name}</p>
                <p className="text-[11px] text-[var(--faint)]">{color.role}</p>
                <button onClick={() => copyHex(color.hex)} className="mt-2 flex items-center gap-1.5 font-mono text-xs text-[var(--muted)] transition hover:text-white">
                  {copied === color.hex ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}{color.hex}
                </button>
              </div>
            </Card>
          </Reveal>
        ))}
        <Card className="flex flex-col justify-center gap-2 p-4" hover={false}>
          <Input value={newColor.name} onChange={(event) => setNewColor((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre del color" />
          <div className="flex items-center gap-2">
            <input type="color" value={newColor.hex} onChange={(event) => setNewColor((current) => ({ ...current, hex: event.target.value }))} className="h-9 w-11 cursor-pointer rounded border border-white/10 bg-transparent" aria-label="Elegir color" />
            <Button variant="subtle" className="flex-1" disabled={!ready} onClick={addColor}><Plus className="h-3.5 w-3.5" /> Agregar</Button>
          </div>
        </Card>
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Tipografías</h2>
        <Button type="button" variant="subtle" disabled={!ready} onClick={openCreate}><Upload className="h-4 w-4" /> Agregar fuente</Button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Reveal><InterfaceFontCard /></Reveal>
        {fonts.map((font, index) => (
          <Reveal key={font.id} delay={(index + 1) * 0.04}>
            <FontCard asset={font} disabled={!ready} onEdit={openEdit} onDelete={(asset) => {
              if (!ready || mutationLock.current) return;
              clearError();
              setDialogError("");
              setNotice("");
              setDeleteTarget(asset);
            }} />
          </Reveal>
        ))}
      </div>

      <Modal
        open={editor !== null}
        onClose={closeEditor}
        title={editor?.mode === "edit" ? "Editar fuente" : "Agregar fuente"}
        description={editor?.mode === "edit" ? "Podés actualizar los datos o reemplazar el archivo." : "Subí una fuente real de hasta 5 MB."}
        footer={<>
          <Button type="button" variant="ghost" disabled={pending} onClick={closeEditor}>Cancelar</Button>
          <Button type="button" disabled={pending || !ready} onClick={saveFont}>{pending ? "Guardando…" : editor?.mode === "edit" ? "Guardar cambios" : "Guardar fuente"}</Button>
        </>}
      >
        <div className="space-y-4">
          {dialogError ? <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{dialogError}</p> : null}
          <Field label="Nombre visible"><Input aria-label="Nombre visible" disabled={pending} value={draft.name} onChange={(event) => { if (!mutationLock.current) setDraft((current) => ({ ...current, name: event.target.value })); }} placeholder="Ej: ElaBela Display" /></Field>
          <Field label="Rol o uso"><Input aria-label="Rol o uso" disabled={pending} value={draft.role} onChange={(event) => { if (!mutationLock.current) setDraft((current) => ({ ...current, role: event.target.value })); }} placeholder="Ej: Títulos y campañas" /></Field>
          <Field label={editor?.mode === "edit" ? "Reemplazar archivo (opcional)" : "Archivo de fuente"}>
            <input aria-label="Archivo de fuente" disabled={pending} type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" onChange={(event) => { if (!mutationLock.current) setFontFile(event.target.files?.[0] ?? null); }} className="field file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-white" />
          </Field>
          <p className="text-[11px] text-[var(--faint)]">Formatos: WOFF2, WOFF, TTF u OTF. Máximo 5 MB.</p>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={closeDelete}
        title="Eliminar fuente"
        description={deleteTarget ? `Se eliminará “${deleteTarget.name}” del Manual de Marca.` : undefined}
        footer={<>
          <Button type="button" variant="ghost" disabled={pending} onClick={closeDelete}>Cancelar</Button>
          <Button type="button" disabled={pending || !ready} className="bg-red-400 text-black hover:bg-red-300" onClick={confirmDelete}>{pending ? "Eliminando…" : "Sí, eliminar"}</Button>
        </>}
      >
        {dialogError ? <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{dialogError}</p> : null}
        <p className="text-sm leading-relaxed text-[var(--muted)]">Primero se borrará el registro. Después se intentará limpiar el archivo almacenado.</p>
      </Modal>
    </div>
  );
}
