import {
  brandFontFaceRule,
  brandFontFamily,
  fontFormatFromFileName,
  storagePathFromPublicUrl,
} from "@/lib/brand";

describe("brand font helpers", () => {
  it("derives only the supported persisted font formats", () => {
    expect(fontFormatFromFileName("ElaBela.WOFF2")).toBe("woff2");
    expect(fontFormatFromFileName("ElaBela.otf")).toBe("otf");
    expect(fontFormatFromFileName("ElaBela.eot")).toBeNull();
  });

  it("builds deterministic ID-scoped descriptors with escaped URLs and correct format hints", () => {
    const asset = { id: "font weird/id", fileUrl: 'https://assets.example/a"b.woff2', fileFormat: "woff2" };
    const family = brandFontFamily(asset.id);
    const rule = brandFontFaceRule(asset);

    expect(family).toMatch(/^ElaBelaBrand-font-weird-id-/);
    expect(rule).toContain(`font-family: "${family}"`);
    expect(rule).toContain('url("https://assets.example/a\\"b.woff2") format("woff2")');
  });

  it("does not register fake descriptors for legacy or invalid rows", () => {
    expect(brandFontFaceRule({ id: "legacy" })).toBeNull();
    expect(brandFontFaceRule({ id: "bad", fileUrl: "https://assets.example/font.eot", fileFormat: "eot" })).toBeNull();
  });

  it("extracts the persisted Storage path from a public asset URL", () => {
    expect(storagePathFromPublicUrl("https://example.supabase.co/storage/v1/object/public/elabela-assets/brand/fonts/new.ttf"))
      .toBe("brand/fonts/new.ttf");
  });
});
