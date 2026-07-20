import { postTypeToRow, publicationFromRow, publicationToRow, toolItemFromRow, toolItemToRow } from "@/lib/db";

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

  it("persists a current-page category edit over a stale migrated category ID", () => {
    const loaded = toolItemFromRow({
      id: "tool-1",
      category: "ia",
      category_id: "ia",
      kind: "link",
      title: "IA tool",
    });
    const editedThroughPage = { ...loaded, category: "apps" };

    expect(toolItemToRow(editedThroughPage)).toMatchObject({
      category: "apps",
      category_id: "apps",
    });
  });
});
