import {
  normalizePublicationImages,
  resolveGuideTools,
  safeExternalHref,
  validatePublicationImages,
} from "@/lib/publications";
import type { ToolItem } from "@/lib/db";

const tools: ToolItem[] = [
  {
    id: "tool-1",
    category: "apps",
    categoryId: "apps",
    kind: "link",
    title: "Primera herramienta",
    note: "",
    href: "https://example.com/one",
    image: "",
    icon: "",
    steps: "",
  },
  {
    id: "tool-2",
    category: "ia",
    categoryId: "ia",
    kind: "prompt",
    title: "Segunda herramienta",
    note: "",
    href: "",
    image: "",
    icon: "",
    steps: "",
  },
];

describe("normalizePublicationImages", () => {
  it("promotes a legacy image when the gallery is empty", () => {
    expect(normalizePublicationImages([], "legacy.jpg")).toEqual(["legacy.jpg"]);
  });

  it("keeps gallery order and removes empty URLs without appending the legacy image", () => {
    expect(normalizePublicationImages(["a.jpg", "", "b.jpg"], "legacy.jpg")).toEqual(["a.jpg", "b.jpg"]);
  });
});

describe("validatePublicationImages", () => {
  it("rejects galleries with more than eight images", () => {
    expect(validatePublicationImages(Array.from({ length: 9 }, (_, i) => String(i)))).toBe(
      "Podés guardar hasta 8 imágenes de ejemplo.",
    );
  });

  it("accepts galleries with up to eight images", () => {
    expect(validatePublicationImages(Array.from({ length: 8 }, (_, i) => String(i)))).toBeNull();
  });
});

describe("resolveGuideTools", () => {
  it("keeps the requested order and ignores missing tools", () => {
    expect(resolveGuideTools(["tool-2", "missing", "tool-1"], tools).map((tool) => tool.id)).toEqual([
      "tool-2",
      "tool-1",
    ]);
  });
});

describe("safeExternalHref", () => {
  it("accepts HTTP links and rejects executable protocols", () => {
    expect(safeExternalHref("https://example.com/tool")).toBe("https://example.com/tool");
    expect(safeExternalHref("javascript:alert(1)")).toBeNull();
  });
});
