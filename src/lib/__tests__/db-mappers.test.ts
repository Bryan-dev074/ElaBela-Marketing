import {
  brandAssetFromRow,
  brandAssetToRow,
  postTypeToRow,
  publicationFromRow,
  publicationToRow,
  toolCategoryFromRow,
  toolCategoryToRow,
  toolItemFromRow,
  toolItemToRow,
} from "@/lib/db";

describe("publicationFromRow", () => {
  it("falls back to the legacy example image when no image array exists", () => {
    expect(publicationFromRow({ example_image: "legacy.jpg", example_images: [] }).exampleImages).toEqual(["legacy.jpg"]);
  });

  it("prefers the image array over the legacy example image", () => {
    expect(publicationFromRow({ example_image: "legacy.jpg", example_images: ["new.jpg"] }).exampleImages).toEqual(["new.jpg"]);
  });

  it("persists the publication fields introduced by the migration", () => {
    expect(publicationToRow({
      id: "post-1",
      name: "Post",
      icon: "✨",
      desc: "Descripción",
      accent: "#d6ab99",
      example: "Ejemplo",
      exampleImage: "first.jpg",
      exampleImages: ["first.jpg", "second.jpg"],
      guide: "# Guía",
      toolIds: ["tool-1"],
    })).toMatchObject({
      example_image: "first.jpg",
      example_images: ["first.jpg", "second.jpg"],
      guide: "# Guía",
      tool_ids: ["tool-1"],
    });
  });

  it("keeps mapped gallery, guide, and tools when an existing post is written", () => {
    expect(postTypeToRow(publicationFromRow({
      id: "post-1",
      name: "Post",
      icon: "✨",
      descr: "Descripción",
      accent: "#d6ab99",
      example_image: "legacy.jpg",
      example_images: ["first.jpg", "second.jpg"],
      guide: "# Guía",
      tool_ids: ["tool-1"],
    }))).toMatchObject({
      example_image: "first.jpg",
      example_images: ["first.jpg", "second.jpg"],
      guide: "# Guía",
      tool_ids: ["tool-1"],
    });
  });

  it("normalizes legacy GEMS tools into the current IA category", () => {
    expect(toolItemFromRow({
      id: "gem-1",
      category: "gems",
      kind: "link",
      title: "GEM",
    })).toMatchObject({ category: "ia", categoryId: "ia" });
  });

  it("prefers a migrated category ID and writes its compatible pair", () => {
    const item = toolItemFromRow({
      id: "tool-1",
      category: "gems",
      category_id: "apps",
      kind: "link",
      title: "App",
    });

    expect(item).toMatchObject({ category: "apps", categoryId: "apps" });
    expect(toolItemToRow(item)).toMatchObject({ category: "apps", category_id: "apps" });
  });

  it("persists categoryId as the current-page source of truth and synchronizes legacy category", () => {
    const loaded = toolItemFromRow({
      id: "tool-1",
      category: "ia",
      category_id: "ia",
      kind: "link",
      title: "IA tool",
    });
    const editedThroughPage = { ...loaded, categoryId: "apps" };

    expect(toolItemToRow(editedThroughPage)).toMatchObject({
      category: "apps",
      category_id: "apps",
    });
  });

  it("normalizes visible legacy category labels while preserving new Enlaces", () => {
    expect(toolItemFromRow({ id: "official", category: "Enlaces Oficiales", title: "Official" }).categoryId).toBe("redes-sociales");
    expect(toolItemFromRow({ id: "legacy-id", category_id: "gems", category: "apps", title: "Legacy ID" }).categoryId).toBe("ia");
    expect(toolItemFromRow({ id: "new-links", category: "enlaces", title: "New" }).categoryId).toBe("enlaces");
  });

  it("maps persisted tool categories in both directions", () => {
    const category = toolCategoryFromRow({
      id: "apps",
      name: "Apps",
      icon: "📲",
      accent: "#22d3ee",
      kind: "link",
      sort: 2,
      created_at: "2026-07-20T00:00:00Z",
    });
    expect(category).toMatchObject({ id: "apps", name: "Apps", kind: "link", createdAt: "2026-07-20T00:00:00Z" });
    expect(toolCategoryToRow(category)).toEqual({
      id: "apps",
      name: "Apps",
      icon: "📲",
      accent: "#22d3ee",
      kind: "link",
      sort: 2,
    });
  });
});

describe("brand asset compatibility mapping", () => {
  it("loads legacy name-only fonts without inventing file metadata", () => {
    expect(brandAssetFromRow({ id: "legacy", kind: "font", name: "Legacy", value: "Legacy", role_label: "Archivo" })).toEqual({
      id: "legacy",
      kind: "font",
      name: "Legacy",
      value: "Legacy",
      role: "Archivo",
      fileUrl: undefined,
      fileFormat: undefined,
      storagePath: undefined,
    });
  });

  it("round-trips uploaded font metadata while preserving color compatibility", () => {
    const fontRow = {
      id: "font-1",
      kind: "font",
      name: "Serif",
      value: "Serif",
      role_label: "Títulos",
      file_url: "https://assets.example/serif.otf",
      file_format: "otf",
      storage_path: "brand/fonts/serif.otf",
    };

    expect(brandAssetToRow(brandAssetFromRow(fontRow))).toMatchObject(fontRow);
    expect(brandAssetToRow({ id: "color", kind: "color", name: "Nude", value: "#d6ab99", role: "Marca" })).toMatchObject({
      file_url: null,
      file_format: null,
      storage_path: null,
    });
  });
});
