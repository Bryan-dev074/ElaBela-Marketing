import {
  DEFAULT_TOOL_CATEGORIES,
  LINKS_DOWNLOADER_TOOL,
  canDeleteCategory,
  categoryIdFromName,
  ensureLinksDownloader,
  normalizeLegacyCategory,
  persistCategoryWithAssets,
  resolveCategoryId,
  safeExternalUrl,
  syncToolToCategory,
  validateCategoryName,
} from "@/lib/tool-categories";

describe("tool category domain", () => {
  it("keeps the required default visible order", () => {
    expect(DEFAULT_TOOL_CATEGORIES.map((category) => category.name)).toEqual([
      "Prompts",
      "IA",
      "Apps",
      "Ads",
      "Enlaces",
      "Redes Sociales",
    ]);
  });

  it.each([
    ["gems", "ia"],
    ["GEMS de Gemini", "ia"],
    ["links", "redes-sociales"],
    ["Enlaces Oficiales", "redes-sociales"],
    ["enlaces", "enlaces"],
  ])("maps legacy category %s without conflating new Enlaces", (legacy, expected) => {
    expect(normalizeLegacyCategory(legacy)).toBe(expected);
  });

  it("resolves invalid and deleted IDs to Sin categoría", () => {
    expect(resolveCategoryId("missing", DEFAULT_TOOL_CATEGORIES)).toBe("uncategorized");
    expect(resolveCategoryId("apps", DEFAULT_TOOL_CATEGORIES)).toBe("apps");
  });

  it("refuses referenced deletion and reports the number of affected tools", () => {
    expect(canDeleteCategory("prompts", [
      { categoryId: "prompts" },
      { categoryId: "apps" },
      { categoryId: "prompts" },
    ])).toEqual({ ok: false, count: 2 });
    expect(canDeleteCategory("ads", [{ categoryId: "apps" }])).toEqual({ ok: true, count: 0 });
  });

  it("trims names and enforces case-insensitive uniqueness", () => {
    expect(validateCategoryName("  Tutoriales  ", DEFAULT_TOOL_CATEGORIES)).toEqual({ ok: true, name: "Tutoriales" });
    expect(validateCategoryName("  ", DEFAULT_TOOL_CATEGORIES)).toEqual({ ok: false, error: "El nombre es obligatorio." });
    expect(validateCategoryName(" apps ", DEFAULT_TOOL_CATEGORIES)).toEqual({
      ok: false,
      error: "Ya existe una categoría con ese nombre.",
    });
    expect(validateCategoryName(" apps ", DEFAULT_TOOL_CATEGORIES, "apps")).toEqual({ ok: true, name: "apps" });
  });

  it.each([
    ["All", "all-2"],
    ["Uncategorized", "uncategorized-2"],
    ["Sin categoría", "sin-categoria"],
    ["Links", "links-2"],
    ["GEMS", "gems-2"],
    ["Prompts", "prompts-2"],
    ["Apps", "apps-2"],
  ])("suffixes reserved category slug for %s", (name, expected) => {
    expect(categoryIdFromName(name, [])).toBe(expected);
  });

  it("keeps dormant href and steps when category presentation changes", () => {
    const tool = {
      id: "tool-1",
      category: "apps",
      categoryId: "apps",
      kind: "link" as const,
      title: "Tool",
      note: "",
      href: "https://example.com/",
      image: "",
      icon: "",
      steps: "Uno\nDos",
    };

    expect(syncToolToCategory(tool, { ...DEFAULT_TOOL_CATEGORIES[0], id: "prompts" })).toMatchObject({
      category: "prompts",
      categoryId: "prompts",
      kind: "prompt",
      href: "https://example.com/",
      steps: "Uno\nDos",
    });
    expect(syncToolToCategory(tool, { ...DEFAULT_TOOL_CATEGORIES[2], id: "apps" })).toMatchObject({
      kind: "link",
      href: "https://example.com/",
      steps: "Uno\nDos",
    });
  });

  it("allows only HTTP(S) external URLs", () => {
    expect(safeExternalUrl(" https://example.com/path ")).toBe("https://example.com/path");
    expect(safeExternalUrl("http://example.com")).toBe("http://example.com/");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,test")).toBeNull();
    expect(safeExternalUrl("example.com")).toBeNull();
  });

  it("adds Links Downloader exactly once and preserves an existing row", () => {
    const once = ensureLinksDownloader([]);
    const twice = ensureLinksDownloader(once);

    expect(once).toContainEqual(LINKS_DOWNLOADER_TOOL);
    expect(twice.filter((tool) => tool.id === LINKS_DOWNLOADER_TOOL.id)).toHaveLength(1);
    expect(ensureLinksDownloader([{ ...LINKS_DOWNLOADER_TOOL, note: "Personalizada" }])).toEqual([
      { ...LINKS_DOWNLOADER_TOOL, note: "Personalizada" },
    ]);
    expect(ensureLinksDownloader([{ ...LINKS_DOWNLOADER_TOOL, id: "existing-link", href: "" }])).toHaveLength(1);
    expect(ensureLinksDownloader([{ ...LINKS_DOWNLOADER_TOOL, id: "existing-url", title: "Descargador" }])).toHaveLength(1);
  });

  it("rolls back a newly uploaded custom icon when category persistence fails", async () => {
    const upload = vi.fn().mockResolvedValue({ ok: true, url: "https://assets.example/new.png" });
    const remove = vi.fn().mockResolvedValue({ ok: true });
    const persist = vi.fn().mockResolvedValue({ ok: false, error: "No se pudo guardar." });
    const category = { ...DEFAULT_TOOL_CATEGORIES[0], icon: "data:image/png;base64,aW1hZ2U=" };

    await expect(persistCategoryWithAssets(category, DEFAULT_TOOL_CATEGORIES[0], persist, { upload, remove })).resolves.toEqual({
      ok: false,
      error: "No se pudo guardar.",
    });
    expect(upload).toHaveBeenCalledWith(expect.any(File), "tools");
    expect(remove).toHaveBeenCalledWith("https://assets.example/new.png");
  });

  it("reports both persistence and uploaded-icon rollback failures", async () => {
    const upload = vi.fn().mockResolvedValue({ ok: true, url: "https://assets.example/new.png" });
    const remove = vi.fn().mockResolvedValue({ ok: false, error: "No se pudo borrar el ícono nuevo." });
    const persist = vi.fn().mockResolvedValue({ ok: false, error: "No se pudo guardar." });
    const category = { ...DEFAULT_TOOL_CATEGORIES[0], icon: "data:image/png;base64,aW1hZ2U=" };

    await expect(persistCategoryWithAssets(category, DEFAULT_TOOL_CATEGORIES[0], persist, { upload, remove })).resolves.toEqual({
      ok: false,
      error: "No se pudo guardar. Además, no se pudo revertir el ícono nuevo: No se pudo borrar el ícono nuevo.",
    });
  });

  it("deletes a replaced stored icon only after successful persistence", async () => {
    const upload = vi.fn().mockResolvedValue({ ok: true, url: "https://assets.example/new.png" });
    const remove = vi.fn().mockResolvedValue({ ok: true });
    const persist = vi.fn().mockResolvedValue({ ok: true });
    const previous = { ...DEFAULT_TOOL_CATEGORIES[0], icon: "https://example.supabase.co/storage/v1/object/public/elabela-assets/tools/old.png" };
    const category = { ...previous, icon: "data:image/png;base64,aW1hZ2U=" };

    await expect(persistCategoryWithAssets(category, previous, persist, { upload, remove })).resolves.toEqual({ ok: true });
    expect(persist).toHaveBeenCalledWith({ ...category, icon: "https://assets.example/new.png" });
    expect(remove).toHaveBeenCalledWith("https://example.supabase.co/storage/v1/object/public/elabela-assets/tools/old.png");
    expect(remove.mock.invocationCallOrder[0]).toBeGreaterThan(persist.mock.invocationCallOrder[0]);
  });

  it("returns a non-retry warning when old-icon cleanup fails after persistence", async () => {
    const upload = vi.fn().mockResolvedValue({ ok: true, url: "https://assets.example/new.png" });
    const remove = vi.fn().mockResolvedValue({ ok: false, error: "No se pudo borrar el ícono anterior." });
    const persist = vi.fn().mockResolvedValue({ ok: true });
    const previous = { ...DEFAULT_TOOL_CATEGORIES[0], icon: "https://example.supabase.co/storage/v1/object/public/elabela-assets/tools/old.png" };
    const category = { ...previous, icon: "data:image/png;base64,aW1hZ2U=" };

    await expect(persistCategoryWithAssets(category, previous, persist, { upload, remove })).resolves.toEqual({
      ok: true,
      warning: "La categoría se guardó, pero no se pudo borrar el ícono anterior: No se pudo borrar el ícono anterior.",
    });
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
