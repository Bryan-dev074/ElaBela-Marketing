import { beforeEach, vi } from "vitest";

const remove = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ remove }),
    },
  }),
}));

import { isManagedAssetUrl, removeAssetByPublicUrl, validateAssetFile } from "@/lib/storage";

describe("validateAssetFile", () => {
  it("accepts an image within the configured size limit", () => {
    const image = new File(["image"], "foto.png", { type: "image/png" });

    expect(validateAssetFile(image, { kind: "image", maxBytes: 8 * 1024 * 1024 })).toEqual({ ok: true });
  });

  it("rejects an image that exceeds the configured size limit", () => {
    const oversizedImage = new File([new Uint8Array(9 * 1024 * 1024)], "foto.png", { type: "image/png" });

    expect(validateAssetFile(oversizedImage, { kind: "image", maxBytes: 8 * 1024 * 1024 })).toEqual({
      ok: false,
      error: "foto.png supera el límite de 8 MB.",
    });
  });

  it("accepts a supported font within the configured size limit", () => {
    const font = new File(["font"], "marca.woff2", { type: "font/woff2" });

    expect(validateAssetFile(font, { kind: "font", maxBytes: 5 * 1024 * 1024 })).toEqual({ ok: true });
  });

  it("accepts an allowed font extension when browsers omit its MIME type", () => {
    const font = new File(["font"], "marca.woff2", { type: "" });

    expect(validateAssetFile(font, { kind: "font", maxBytes: 5 * 1024 * 1024 })).toEqual({ ok: true });
  });

  it("rejects a font MIME type paired with a disallowed extension", () => {
    const font = new File(["font"], "marca.eot", { type: "font/woff2" });

    expect(validateAssetFile(font, { kind: "font", maxBytes: 5 * 1024 * 1024 })).toEqual({
      ok: false,
      error: "marca.eot no es un archivo de fuente compatible.",
    });
  });

  it("rejects a supported font extension paired with a different font MIME", () => {
    const font = new File(["font"], "marca.ttf", { type: "font/woff2" });

    expect(validateAssetFile(font, { kind: "font", maxBytes: 5 * 1024 * 1024 })).toEqual({
      ok: false,
      error: "marca.ttf no coincide con el tipo de fuente declarado.",
    });
  });
});

describe("removeAssetByPublicUrl", () => {
  beforeEach(() => {
    remove.mockResolvedValue({ error: null });
  });

  it("refuses a lookalike URL from another origin", async () => {
    await expect(removeAssetByPublicUrl(
      "https://evil.example/storage/v1/object/public/elabela-assets/private.png",
    )).resolves.toEqual({
      ok: false,
      error: "La URL del recurso no pertenece al almacenamiento de ElaBela.",
    });

    expect(remove).not.toHaveBeenCalled();
  });

  it("refuses a same-origin URL whose bucket prefix is not at the pathname start", async () => {
    await expect(removeAssetByPublicUrl(
      "https://example.supabase.co/prefix/storage/v1/object/public/elabela-assets/private.png",
    )).resolves.toEqual({
      ok: false,
      error: "La URL del recurso no pertenece al almacenamiento de ElaBela.",
    });

    expect(remove).not.toHaveBeenCalled();
  });
});

describe("isManagedAssetUrl", () => {
  it("recognizes only the configured ElaBela Storage bucket", () => {
    expect(isManagedAssetUrl("https://example.supabase.co/storage/v1/object/public/elabela-assets/tools/image.png")).toBe(true);
    expect(isManagedAssetUrl("https://cdn.example/tools/image.png")).toBe(false);
    expect(isManagedAssetUrl("not-a-url")).toBe(false);
  });
});
