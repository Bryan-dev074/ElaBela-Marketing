import { assetFileFromDataUrl } from "@/lib/tool-categories";
import { isManagedAssetUrl, removeAssetByPublicUrl, uploadAsset } from "@/lib/storage";

export type CredentialScope = "shared" | "private";

export interface CredentialCategory {
  id: string;
  name: string;
  icon: string;
  scope: CredentialScope;
  ownerId?: string;
  sort: number;
  createdAt: string;
}

export interface CategorizedCredential {
  id: string;
  scope: CredentialScope;
  ownerId?: string;
  categoryId?: string;
}

export const UNCATEGORIZED_CREDENTIAL_CATEGORY_ID = "uncategorized";

function comparable(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function categoryBelongsToScope(category: CredentialCategory, scope: CredentialScope, ownerId: string) {
  return category.scope === scope
    && (scope === "shared" ? !category.ownerId : category.ownerId === ownerId);
}

export function isCategoryCompatible(
  category: CredentialCategory,
  credential: Pick<CategorizedCredential, "scope" | "ownerId">,
  ownerId: string,
) {
  if (!categoryBelongsToScope(category, credential.scope, ownerId)) return false;
  if (credential.scope === "shared") return true;
  return !credential.ownerId || credential.ownerId === ownerId;
}

export function groupCredentials<T extends CategorizedCredential>(
  credentials: T[],
  categories: CredentialCategory[],
  scope: CredentialScope,
  ownerId: string,
) {
  const visibleCategories = categories
    .filter((category) => categoryBelongsToScope(category, scope, ownerId))
    .sort((left, right) => left.sort - right.sort || left.createdAt.localeCompare(right.createdAt));
  const visibleCredentials = credentials.filter((credential) => credential.scope === scope
    && (scope === "shared" || !credential.ownerId || credential.ownerId === ownerId));
  const byId = new Map(visibleCategories.map((category) => [category.id, category]));
  const groups = visibleCategories.map((category) => ({
    category,
    credentials: visibleCredentials.filter((credential) => credential.categoryId === category.id
      && isCategoryCompatible(category, credential, ownerId)),
  }));
  const uncategorized = visibleCredentials.filter((credential) => {
    if (!credential.categoryId) return true;
    const category = byId.get(credential.categoryId);
    return !category || !isCategoryCompatible(category, credential, ownerId);
  });
  if (uncategorized.length) {
    groups.push({
      category: {
        id: UNCATEGORIZED_CREDENTIAL_CATEGORY_ID,
        name: "Sin categoría",
        icon: "❔",
        scope,
        ownerId: scope === "private" ? ownerId : undefined,
        sort: Number.MAX_SAFE_INTEGER,
        createdAt: "",
      },
      credentials: uncategorized,
    });
  }
  return groups;
}

export function categoryIdAfterScopeChange(
  categoryId: string | undefined,
  scope: CredentialScope,
  categories: CredentialCategory[],
  ownerId: string,
) {
  if (!categoryId) return undefined;
  const category = categories.find((candidate) => candidate.id === categoryId);
  return category && isCategoryCompatible(category, { scope }, ownerId) ? categoryId : undefined;
}

export function validateCredentialCategoryName(
  name: string,
  categories: CredentialCategory[],
  scope: CredentialScope,
  ownerId: string,
  excludeId?: string,
) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "El nombre es obligatorio." };
  const duplicate = categories.some((category) => category.id !== excludeId
    && categoryBelongsToScope(category, scope, ownerId)
    && comparable(category.name) === comparable(trimmed));
  return duplicate
    ? { ok: false as const, error: "Ya existe una categoría con ese nombre." }
    : { ok: true as const, name: trimmed };
}

export function reorderCredentialCategoriesLocally(
  categories: CredentialCategory[],
  scope: CredentialScope,
  categoryIds: string[],
  ownerId: string,
) {
  const scoped = categories.filter((category) => categoryBelongsToScope(category, scope, ownerId));
  if (new Set(categoryIds).size !== categoryIds.length
    || scoped.length !== categoryIds.length
    || categoryIds.some((id) => !scoped.some((category) => category.id === id))) {
    throw new Error("La lista de categorías está desactualizada.");
  }
  const reordered = categoryIds.map((id, sort) => ({ ...scoped.find((category) => category.id === id)!, sort }));
  let scopedIndex = 0;
  return categories.map((category) => categoryBelongsToScope(category, scope, ownerId)
    ? reordered[scopedIndex++]
    : category);
}

export type CredentialCategoryMutationResult = { ok: true; warning?: string } | { ok: false; error: string };
type CategoryAssetDeps = { upload: typeof uploadAsset; remove: typeof removeAssetByPublicUrl };
const DEFAULT_ASSET_DEPS: CategoryAssetDeps = { upload: uploadAsset, remove: removeAssetByPublicUrl };

export async function persistCredentialCategoryWithAssets(
  category: CredentialCategory,
  previous: CredentialCategory | null,
  persist: (category: CredentialCategory) => Promise<CredentialCategoryMutationResult>,
  assets: CategoryAssetDeps = DEFAULT_ASSET_DEPS,
): Promise<CredentialCategoryMutationResult> {
  let next = category;
  let uploadedUrl: string | null = null;
  if (category.icon.startsWith("data:")) {
    let file: File;
    try {
      file = assetFileFromDataUrl(category.icon, "categoria-credencial");
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "El ícono personalizado no es válido." };
    }
    const uploaded = await assets.upload(file, "credential-categories");
    if (!uploaded.ok) return uploaded;
    uploadedUrl = uploaded.url;
    next = { ...category, icon: uploaded.url };
  }

  const persisted = await persist(next);
  if (!persisted.ok) {
    if (uploadedUrl) {
      const rollback = await assets.remove(uploadedUrl);
      if (!rollback.ok) return { ok: false, error: `${persisted.error} Además, no se pudo revertir el ícono nuevo: ${rollback.error}` };
    }
    return persisted;
  }

  if (previous?.icon && previous.icon !== next.icon && isManagedAssetUrl(previous.icon)) {
    const cleanup = await assets.remove(previous.icon);
    if (!cleanup.ok) return { ok: true, warning: `La categoría se guardó, pero no se pudo borrar el ícono anterior: ${cleanup.error}` };
  }
  return { ok: true };
}
