import {
  UNCATEGORIZED_CREDENTIAL_CATEGORY_ID,
  categoryIdAfterScopeChange,
  groupCredentials,
  isCategoryCompatible,
  persistCredentialCategoryWithAssets,
  reorderCredentialCategoriesLocally,
  validateCredentialCategoryName,
  type CredentialCategory,
} from "@/lib/credential-categories";

const sharedCategory: CredentialCategory = {
  id: "social",
  name: "Redes Sociales",
  icon: "📱",
  scope: "shared",
  sort: 0,
  createdAt: "",
};
const privateCategory: CredentialCategory = {
  id: "personal",
  name: "Personal",
  icon: "🔒",
  scope: "private",
  ownerId: "user-1",
  sort: 0,
  createdAt: "",
};

describe("credential category domain", () => {
  it("accepts only credentials compatible with category scope and owner", () => {
    expect(isCategoryCompatible(sharedCategory, { scope: "shared" }, "user-1")).toBe(true);
    expect(isCategoryCompatible(sharedCategory, { scope: "private", ownerId: "user-1" }, "user-1")).toBe(false);
    expect(isCategoryCompatible(privateCategory, { scope: "private", ownerId: "user-1" }, "user-1")).toBe(true);
    expect(isCategoryCompatible(privateCategory, { scope: "private", ownerId: "user-2" }, "user-1")).toBe(false);
    expect(isCategoryCompatible({ ...privateCategory, ownerId: "user-2" }, { scope: "private", ownerId: "user-2" }, "user-1")).toBe(false);
  });

  it("treats a visible legacy owner-null private credential as current-owner compatible", () => {
    expect(isCategoryCompatible(privateCategory, { scope: "private" }, "user-1")).toBe(true);
  });

  it("groups invalid, deleted, foreign-owner, and scope-mismatched IDs under Sin categoría", () => {
    const foreign = { ...privateCategory, id: "foreign", name: "Oculta", ownerId: "user-2", sort: 1 };
    const credentials = [
      { id: "valid", scope: "shared" as const, categoryId: "social" },
      { id: "missing", scope: "shared" as const, categoryId: "deleted" },
      { id: "wrong-scope", scope: "shared" as const, categoryId: "personal" },
      { id: "foreign-owner", scope: "private" as const, ownerId: "user-1", categoryId: "foreign" },
    ];

    const groups = groupCredentials(credentials, [sharedCategory, privateCategory, foreign], "shared", "user-1");
    expect(groups.map((group) => group.category.name)).toEqual(["Redes Sociales", "Sin categoría"]);
    expect(groups.find((group) => group.category.id === UNCATEGORIZED_CREDENTIAL_CATEGORY_ID)?.credentials.map((item) => item.id)).toEqual([
      "missing",
      "wrong-scope",
    ]);

    const privateGroups = groupCredentials(credentials, [sharedCategory, privateCategory, foreign], "private", "user-1");
    expect(privateGroups.map((group) => group.category.name)).toEqual(["Personal", "Sin categoría"]);
    expect(privateGroups.at(-1)?.credentials.map((item) => item.id)).toEqual(["foreign-owner"]);
    expect(privateGroups.some((group) => group.category.name === "Oculta")).toBe(false);
  });

  it("clears an incompatible category when credential scope changes", () => {
    expect(categoryIdAfterScopeChange("social", "private", [sharedCategory, privateCategory], "user-1")).toBeUndefined();
    expect(categoryIdAfterScopeChange("personal", "private", [sharedCategory, privateCategory], "user-1")).toBe("personal");
    expect(categoryIdAfterScopeChange(undefined, "shared", [sharedCategory], "user-1")).toBeUndefined();
  });

  it("trims names and enforces case-insensitive uniqueness only within the applicable scope", () => {
    const categories = [sharedCategory, privateCategory, { ...privateCategory, id: "other", ownerId: "user-2" }];
    expect(validateCredentialCategoryName("  Accesos  ", categories, "shared", "user-1")).toEqual({ ok: true, name: "Accesos" });
    expect(validateCredentialCategoryName(" ", categories, "shared", "user-1")).toEqual({ ok: false, error: "El nombre es obligatorio." });
    expect(validateCredentialCategoryName(" redes sociales ", categories, "shared", "user-1")).toEqual({
      ok: false,
      error: "Ya existe una categoría con ese nombre.",
    });
    expect(validateCredentialCategoryName(" personal ", categories, "private", "user-1")).toEqual({
      ok: false,
      error: "Ya existe una categoría con ese nombre.",
    });
    expect(validateCredentialCategoryName(" personal ", categories, "private", "user-2")).toEqual({
      ok: false,
      error: "Ya existe una categoría con ese nombre.",
    });
    expect(validateCredentialCategoryName("Redes Sociales", categories, "private", "user-1")).toEqual({ ok: true, name: "Redes Sociales" });
  });

  it("produces contiguous scope-local sort values without touching another scope", () => {
    const privateSecond = { ...privateCategory, id: "private-2", name: "Otra", sort: 1 };
    expect(reorderCredentialCategoriesLocally([sharedCategory, privateCategory, privateSecond], "private", ["private-2", "personal"], "user-1")).toEqual([
      sharedCategory,
      { ...privateSecond, sort: 0 },
      { ...privateCategory, sort: 1 },
    ]);
    expect(() => reorderCredentialCategoriesLocally([sharedCategory, privateCategory], "private", ["personal", "missing"], "user-1")).toThrow("desactualizada");
  });

  it("rolls back a new icon when persistence fails and retains both errors", async () => {
    const upload = vi.fn().mockResolvedValue({ ok: true, url: "https://example.supabase.co/storage/v1/object/public/elabela-assets/credential-categories/new.png" });
    const remove = vi.fn().mockResolvedValue({ ok: false, error: "No se pudo borrar el ícono nuevo." });
    const persist = vi.fn().mockResolvedValue({ ok: false, error: "No se pudo guardar." });

    await expect(persistCredentialCategoryWithAssets(
      { ...sharedCategory, icon: "data:image/png;base64,aW1hZ2U=" },
      sharedCategory,
      persist,
      { upload, remove },
    )).resolves.toEqual({
      ok: false,
      error: "No se pudo guardar. Además, no se pudo revertir el ícono nuevo: No se pudo borrar el ícono nuevo.",
    });
    expect(upload).toHaveBeenCalledWith(expect.any(File), "credential-categories");
    expect(remove).toHaveBeenCalledWith(expect.stringContaining("/credential-categories/new.png"));
  });

  it("removes a replaced managed icon only after persistence and returns a non-retry warning", async () => {
    const oldUrl = "https://example.supabase.co/storage/v1/object/public/elabela-assets/credential-categories/old.png";
    const upload = vi.fn().mockResolvedValue({ ok: true, url: "https://example.supabase.co/storage/v1/object/public/elabela-assets/credential-categories/new.png" });
    const remove = vi.fn().mockResolvedValue({ ok: false, error: "Storage no disponible." });
    const persist = vi.fn().mockResolvedValue({ ok: true });

    await expect(persistCredentialCategoryWithAssets(
      { ...sharedCategory, icon: "data:image/png;base64,aW1hZ2U=" },
      { ...sharedCategory, icon: oldUrl },
      persist,
      { upload, remove },
    )).resolves.toEqual({
      ok: true,
      warning: "La categoría se guardó, pero no se pudo borrar el ícono anterior: Storage no disponible.",
    });
    expect(persist.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
  });
});
