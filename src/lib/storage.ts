import { createClient } from "@/lib/supabase/client";

const BUCKET = "elabela-assets";
const IMAGE_TYPES = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/svg+xml", "image/webp"]);
const FONT_TYPES = new Set(["application/font-woff", "application/font-woff2", "application/vnd.ms-fontobject", "font/otf", "font/ttf", "font/woff", "font/woff2"]);

export type AssetFolder = "publications" | "tools" | "brand/fonts";
export type AssetValidationRules = { kind: "image" | "font"; maxBytes: number };
export type AssetValidationResult = { ok: true } | { ok: false; error: string };
export type AssetMutationResult = { ok: true; url: string } | { ok: false; error: string };

export function validateAssetFile(file: File, rules: AssetValidationRules): AssetValidationResult {
  const maxMegabytes = rules.maxBytes / 1024 / 1024;
  if (file.size > rules.maxBytes) {
    return { ok: false, error: `${file.name} supera el límite de ${maxMegabytes} MB.` };
  }

  const allowedTypes = rules.kind === "image" ? IMAGE_TYPES : FONT_TYPES;
  if (!allowedTypes.has(file.type)) {
    return { ok: false, error: `${file.name} no es un archivo ${rules.kind === "image" ? "de imagen" : "de fuente"} compatible.` };
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
  const pathIndex = pathname.indexOf(publicPrefix);
  return pathIndex === -1 ? null : decodeURIComponent(pathname.slice(pathIndex + publicPrefix.length));
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
