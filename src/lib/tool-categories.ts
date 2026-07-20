import { isManagedAssetUrl, removeAssetByPublicUrl, uploadAsset } from "@/lib/storage";

export type ToolPresentationKind = "prompt" | "link";

export interface ToolCategoryRow {
  id: string;
  name: string;
  icon: string;
  accent: string;
  kind: ToolPresentationKind;
  sort: number;
  createdAt: string;
}

export interface CategoryToolRef {
  categoryId?: string;
}

export const UNCATEGORIZED_ID = "uncategorized";
export const UNCATEGORIZED_CATEGORY: ToolCategoryRow = {
  id: UNCATEGORIZED_ID,
  name: "Sin categoría",
  icon: "❔",
  accent: "#a1a1aa",
  kind: "link",
  sort: Number.MAX_SAFE_INTEGER,
  createdAt: "",
};

export const DEFAULT_TOOL_CATEGORIES: ToolCategoryRow[] = [
  { id: "prompts", name: "Prompts", icon: "💬", accent: "#d6ab99", kind: "prompt", sort: 0, createdAt: "" },
  { id: "ia", name: "IA", icon: "🤖", accent: "#818cf8", kind: "link", sort: 1, createdAt: "" },
  { id: "apps", name: "Apps", icon: "📲", accent: "#22d3ee", kind: "link", sort: 2, createdAt: "" },
  { id: "ads", name: "Ads", icon: "📢", accent: "#f59e0b", kind: "link", sort: 3, createdAt: "" },
  { id: "enlaces", name: "Enlaces", icon: "🔗", accent: "#34d399", kind: "link", sort: 4, createdAt: "" },
  { id: "redes-sociales", name: "Redes Sociales", icon: "📱", accent: "#f472b6", kind: "link", sort: 5, createdAt: "" },
];

export interface SeedToolItem {
  id: string;
  category: string;
  categoryId: string;
  kind: ToolPresentationKind;
  title: string;
  note: string;
  href: string;
  image: string;
  icon: string;
  steps: string;
}

export const LINKS_DOWNLOADER_TOOL: SeedToolItem = {
  id: "links-downloader",
  category: "apps",
  categoryId: "apps",
  kind: "link",
  title: "Links Downloader",
  note: "Descarga videos públicos de TikTok e Instagram sin registro.",
  href: "https://links-downloader.vercel.app/",
  image: "",
  icon: "⬇️",
  steps: "",
};

function comparable(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

export function normalizeLegacyCategory(category: string) {
  const original = category.trim();
  const normalized = comparable(original);
  if (normalized === "gems" || normalized === "gems de gemini") return "ia";
  if (normalized === "links" || normalized === "enlaces oficiales") return "redes-sociales";
  return original;
}

export function resolveCategoryId(categoryId: string | undefined, categories: ToolCategoryRow[]) {
  const normalized = categoryId ? normalizeLegacyCategory(categoryId) : "";
  return categories.some((category) => category.id === normalized) ? normalized : UNCATEGORIZED_ID;
}

export function canDeleteCategory(categoryId: string, tools: CategoryToolRef[]) {
  const count = tools.filter((tool) => tool.categoryId === categoryId).length;
  return count > 0 ? { ok: false as const, count } : { ok: true as const, count: 0 };
}

export function validateCategoryName(name: string, categories: ToolCategoryRow[], excludeId?: string) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "El nombre es obligatorio." };
  const duplicate = categories.some((category) => category.id !== excludeId && comparable(category.name) === comparable(trimmed));
  if (duplicate) return { ok: false as const, error: "Ya existe una categoría con ese nombre." };
  return { ok: true as const, name: trimmed };
}

export function safeExternalUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function ensureLinksDownloader<T extends SeedToolItem>(items: T[]): Array<T | SeedToolItem> {
  const exists = items.some((tool) => tool.id === LINKS_DOWNLOADER_TOOL.id
    || tool.title.trim().toLocaleLowerCase("es") === LINKS_DOWNLOADER_TOOL.title.toLocaleLowerCase("es")
    || safeExternalUrl(tool.href) === LINKS_DOWNLOADER_TOOL.href);
  return exists ? items : [...items, LINKS_DOWNLOADER_TOOL];
}

export function categoryIdFromName(name: string, categories: ToolCategoryRow[]) {
  const base = comparable(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "categoria";
  let id = base;
  let suffix = 2;
  while (categories.some((category) => category.id === id)) id = `${base}-${suffix++}`;
  return id;
}

export function assetFileFromDataUrl(dataUrl: string, baseName = "categoria") {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("El ícono personalizado no es válido.");
  const mime = match[1];
  const binary = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const extension = mime.split("/")[1]?.replace("svg+xml", "svg") || "png";
  return new File([bytes], `${baseName}.${extension}`, { type: mime });
}

type MutationResult = { ok: true } | { ok: false; error: string };
type CategoryAssetDeps = {
  upload: typeof uploadAsset;
  remove: typeof removeAssetByPublicUrl;
};

const DEFAULT_ASSET_DEPS: CategoryAssetDeps = { upload: uploadAsset, remove: removeAssetByPublicUrl };

export async function persistCategoryWithAssets(
  category: ToolCategoryRow,
  previous: ToolCategoryRow | null,
  persist: (category: ToolCategoryRow) => Promise<MutationResult>,
  assets: CategoryAssetDeps = DEFAULT_ASSET_DEPS,
): Promise<MutationResult> {
  let next = category;
  let uploadedUrl: string | null = null;
  if (category.icon.startsWith("data:")) {
    let file: File;
    try {
      file = assetFileFromDataUrl(category.icon);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "El ícono personalizado no es válido." };
    }
    const uploaded = await assets.upload(file, "tools");
    if (!uploaded.ok) return uploaded;
    uploadedUrl = uploaded.url;
    next = { ...category, icon: uploaded.url };
  }

  const result = await persist(next);
  if (!result.ok) {
    if (uploadedUrl) await assets.remove(uploadedUrl);
    return result;
  }
  if (previous?.icon && previous.icon !== next.icon && isManagedAssetUrl(previous.icon)) {
    await assets.remove(previous.icon);
  }
  return { ok: true };
}
