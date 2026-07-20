export const MAX_PUBLICATION_IMAGES = 8;
export const MAX_PUBLICATION_IMAGE_BYTES = 8 * 1024 * 1024;

export function normalizePublicationImages(images: string[] | undefined, legacyImage?: string | null) {
  const normalized = (images ?? []).filter((image) => image.length > 0);
  if (normalized.length > 0) return normalized;
  return legacyImage ? [legacyImage] : [];
}

export function validatePublicationImages(images: string[]) {
  return images.length > MAX_PUBLICATION_IMAGES
    ? "Podés guardar hasta 8 imágenes de ejemplo."
    : null;
}

export function resolveGuideTools<T extends { id: string }>(toolIds: string[], tools: T[]) {
  const toolsById = new Map(tools.map((tool) => [tool.id, tool]));
  return toolIds.flatMap((id) => {
    const tool = toolsById.get(id);
    return tool ? [tool] : [];
  });
}

export function safeExternalHref(href: string) {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? href : null;
  } catch {
    return null;
  }
}
