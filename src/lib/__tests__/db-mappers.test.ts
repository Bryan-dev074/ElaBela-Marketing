import { postTypeToRow, publicationFromRow, publicationToRow } from "@/lib/db";

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
});
