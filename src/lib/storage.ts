import { createClient } from "@/lib/supabase/client";

const BUCKET = "elabela-assets";
const IMAGE_TYPES = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/svg+xml", "image/webp"]);
const FONT_EXTENSIONS = new Set(["woff2", "woff", "ttf", "otf"]);
const FONT_TYPES_BY_EXTENSION: Record<string, Set<string>> = {
  woff2: new Set(["application/font-woff2", "font/woff2"]),
  woff: new Set(["application/font-woff", "font/woff"]),
  ttf: new Set(["font/ttf"]),
  otf: new Set(["font/otf"]),
};

export type AssetFolder = "publications" | "tools" | "brand/fonts";
export type AssetValidationRules = { kind: "image" | "font"; maxBytes: number };
export type AssetValidationResult = { ok: true } | { ok: false; error: string };
export type AssetMutationResult = { ok: true; url: string } | { ok: false; error: string };

const FONT_SIGNATURES: Record<string, number[][]> = {
  woff2: [[0x77, 0x4f, 0x46, 0x32]],
  woff: [[0x77, 0x4f, 0x46, 0x46]],
  otf: [[0x4f, 0x54, 0x54, 0x4f]],
  ttf: [
    [0x00, 0x01, 0x00, 0x00],
    [0x74, 0x72, 0x75, 0x65],
    [0x74, 0x79, 0x70, 0x31],
  ],
};

export function validateAssetFile(file: File, rules: AssetValidationRules): AssetValidationResult {
  const maxMegabytes = rules.maxBytes / 1024 / 1024;
  if (file.size > rules.maxBytes) {
    return { ok: false, error: `${file.name} supera el límite de ${maxMegabytes} MB.` };
  }

  if (rules.kind === "font") {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !FONT_EXTENSIONS.has(extension)) {
      return { ok: false, error: `${file.name} no es un archivo de fuente compatible.` };
    }
    if (file.type && !FONT_TYPES_BY_EXTENSION[extension].has(file.type)) {
      return { ok: false, error: `${file.name} no coincide con el tipo de fuente declarado.` };
    }
    return { ok: true };
  }

  if (!IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: `${file.name} no es un archivo ${rules.kind === "image" ? "de imagen" : "de fuente"} compatible.` };
  }

  return { ok: true };
}

function readFileBuffer(file: File) {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo."));
    reader.onload = () => reader.result instanceof ArrayBuffer
      ? resolve(reader.result)
      : reject(new Error("No se pudo leer el archivo."));
    reader.readAsArrayBuffer(file);
  });
}

function hasFontSignature(bytes: Uint8Array, extension: string) {
  return FONT_SIGNATURES[extension]?.some((signature) => signature.every((byte, index) => bytes[index] === byte)) ?? false;
}

export async function validateFontFile(file: File, maxBytes = 5 * 1024 * 1024): Promise<AssetValidationResult> {
  const basic = validateAssetFile(file, { kind: "font", maxBytes });
  if (!basic.ok) return basic;
  const extension = file.name.split(".").pop()!.toLowerCase();
  let buffer: ArrayBuffer;
  try {
    buffer = await readFileBuffer(file);
  } catch {
    return { ok: false, error: `${file.name} no pudo leerse para validar su contenido.` };
  }
  if (!hasFontSignature(new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength)), extension)) {
    return { ok: false, error: `${file.name} no contiene una firma binaria ${extension.toUpperCase()} válida.` };
  }

  if (typeof FontFace === "function") {
    try {
      const face = new FontFace(`ElaBelaValidation-${crypto.randomUUID?.() ?? Date.now()}`, buffer);
      await face.load();
    } catch {
      return { ok: false, error: `${file.name} no pudo decodificarse como una fuente válida.` };
    }
  }
  return { ok: true };
}

function sanitizedExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension || "bin";
}

function pathFromPublicUrl(url: string) {
  const publicPrefix = `/storage/v1/object/public/${BUCKET}/`;
  const publicUrl = new URL(url);
  const projectUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (publicUrl.origin !== projectUrl.origin) return null;
  const pathname = publicUrl.pathname;
  return pathname.startsWith(publicPrefix) ? decodeURIComponent(pathname.slice(publicPrefix.length)) : null;
}

export function isManagedAssetUrl(url: string) {
  try {
    return pathFromPublicUrl(url) !== null;
  } catch {
    return false;
  }
}

export async function uploadAsset(file: File, folder: AssetFolder): Promise<AssetMutationResult> {
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}.${sanitizedExtension(file)}`;
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });

  if (error) return { ok: false, error: error.message };

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return { ok: true, url: publicData.publicUrl };
}

export async function removeAssetByPublicUrl(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let path: string | null;
  try {
    path = pathFromPublicUrl(url);
  } catch {
    path = null;
  }

  if (!path) return { ok: false, error: "La URL del recurso no pertenece al almacenamiento de ElaBela." };

  const { error } = await createClient().storage.from(BUCKET).remove([path]);
  return error ? { ok: false, error: error.message } : { ok: true };
}
