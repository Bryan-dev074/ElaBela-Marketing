import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, vi } from "vitest";

vi.stubGlobal("React", React);
vi.stubGlobal("IntersectionObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

const mocks = vi.hoisted(() => ({
  addAsync: vi.fn(),
  updateAsync: vi.fn(),
  removeAsync: vi.fn(),
  uploadAsset: vi.fn(),
  removeAssetByPublicUrl: vi.fn(),
  ready: true,
}));

const woff2File = (name = "font.woff2") => new File(
  [new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0])],
  name,
  { type: "font/woff2" },
);

const fonts = [
  {
    id: "font-1",
    kind: "font" as const,
    name: "ElaBela Serif",
    value: "ElaBela Serif",
    role: "Títulos",
    fileUrl: "https://example.supabase.co/storage/v1/object/public/elabela-assets/brand/fonts/old.woff2",
    fileFormat: "woff2" as const,
    storagePath: "brand/fonts/old.woff2",
  },
  { id: "legacy-font", kind: "font" as const, name: "Legacy", value: "Legacy", role: "Archivo" },
];

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    useBrandAssets: () => {
      const [error, setError] = React.useState<string | null>(null);
      const mutation = (operation: typeof mocks.addAsync) => async (...args: unknown[]) => {
        const result = await operation(...args);
        if (!result.ok) setError(result.error);
        return result;
      };
      return {
        items: fonts,
        add: vi.fn(),
        addAsync: mutation(mocks.addAsync),
        updateAsync: mutation(mocks.updateAsync),
        removeAsync: mutation(mocks.removeAsync),
        error,
        clearError: () => setError(null),
        ready: mocks.ready,
      };
    },
  };
});

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    uploadAsset: mocks.uploadAsset,
    removeAssetByPublicUrl: mocks.removeAssetByPublicUrl,
  };
});

import MarcaPage from "@/app/(app)/marca/page";

describe("MarcaPage brand fonts", () => {
  let loadFont: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mocks.addAsync.mockReset().mockResolvedValue({ ok: true });
    mocks.updateAsync.mockReset().mockResolvedValue({ ok: true });
    mocks.removeAsync.mockReset().mockResolvedValue({ ok: true });
    mocks.uploadAsset.mockReset().mockResolvedValue({
      ok: true,
      url: "https://example.supabase.co/storage/v1/object/public/elabela-assets/brand/fonts/new.woff2",
    });
    mocks.removeAssetByPublicUrl.mockReset().mockResolvedValue({ ok: true });
    mocks.ready = true;
    loadFont = vi.fn().mockImplementation(() => new Promise(() => {}));
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { load: loadFont },
    });
  });

  it("creates a font from a required uploaded file with display name and role", async () => {
    const { container } = render(<MarcaPage />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar fuente" }));
    const dialog = screen.getByRole("dialog", { name: "Agregar fuente" });
    fireEvent.change(within(dialog).getByLabelText("Nombre visible"), { target: { value: "Nueva Sans" } });
    fireEvent.change(within(dialog).getByLabelText("Rol o uso"), { target: { value: "Cuerpo" } });
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, { target: { files: [woff2File("nueva.woff2")] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar fuente" }));

    await waitFor(() => expect(mocks.addAsync).toHaveBeenCalledTimes(1));
    expect(mocks.uploadAsset).toHaveBeenCalledWith(expect.any(File), "brand/fonts");
    expect(mocks.addAsync.mock.calls[0][0]).toMatchObject({
      kind: "font",
      name: "Nueva Sans",
      role: "Cuerpo",
      fileUrl: expect.stringContaining("/brand/fonts/new.woff2"),
      fileFormat: "woff2",
      storagePath: "brand/fonts/new.woff2",
    });
  });

  it("reports failed cleanup when create persistence fails after upload", async () => {
    mocks.addAsync.mockResolvedValueOnce({ ok: false, error: "No se pudo crear." });
    mocks.removeAssetByPublicUrl.mockResolvedValueOnce({ ok: false, error: "No se pudo revertir." });
    const { container } = render(<MarcaPage />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar fuente" }));
    const dialog = screen.getByRole("dialog", { name: "Agregar fuente" });
    fireEvent.change(within(dialog).getByLabelText("Nombre visible"), { target: { value: "Nueva Sans" } });
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInput!, { target: { files: [woff2File("nueva.woff2")] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar fuente" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No se pudo crear. Además, no se pudo revertir el archivo nuevo: No se pudo revertir.");
    expect(mocks.addAsync.mock.invocationCallOrder[0]).toBeLessThan(mocks.removeAssetByPublicUrl.mock.invocationCallOrder[0]);
    expect(mocks.removeAssetByPublicUrl).toHaveBeenCalledWith(expect.stringContaining("/new.woff2"));
  });

  it("rejects arbitrary bytes before upload or persistence", async () => {
    const { container } = render(<MarcaPage />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar fuente" }));
    const dialog = screen.getByRole("dialog", { name: "Agregar fuente" });
    fireEvent.change(within(dialog).getByLabelText("Nombre visible"), { target: { value: "Fuente falsa" } });
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInput!, { target: { files: [new File(["not a font"], "fake.woff2", { type: "font/woff2" })] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar fuente" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("fake.woff2 no contiene una firma binaria WOFF2 válida.");
    expect(mocks.uploadAsset).not.toHaveBeenCalled();
    expect(mocks.addAsync).not.toHaveBeenCalled();
  });

  it("keeps a failed runtime font on the UI fallback and removes its descriptor on unmount", async () => {
    loadFont.mockRejectedValueOnce(new Error("decode failed"));
    const { unmount } = render(<MarcaPage />);

    expect(document.head.querySelector('style[data-brand-font-id="font-1"]')).not.toBeNull();
    expect(document.head.querySelector('style[data-brand-font-id="legacy-font"]')).toBeNull();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar; se muestra la fuente de interfaz.");
    const preview = screen.getByLabelText("Vista previa de ElaBela Serif");
    expect(preview).toHaveStyle({ fontFamily: "var(--font-sans)" });

    unmount();
    expect(document.head.querySelector('style[data-brand-font-id="font-1"]')).toBeNull();
  });

  it.each(["missing FontFaceSet support", "an empty FontFaceSet match"])("keeps fallback for %s", async (scenario) => {
    if (scenario === "missing FontFaceSet support") {
      Object.defineProperty(document, "fonts", { configurable: true, value: undefined });
    } else {
      loadFont.mockResolvedValueOnce([]);
    }
    render(<MarcaPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar; se muestra la fuente de interfaz.");
    expect(screen.getByLabelText("Vista previa de ElaBela Serif")).toHaveStyle({ fontFamily: "var(--font-sans)" });
  });

  it("updates editable preview text, size, and letter spacing", async () => {
    render(<MarcaPage />);
    const card = screen.getByRole("article", { name: "Fuente ElaBela Serif" });
    const sample = within(card).getByLabelText("Texto de muestra de ElaBela Serif");
    const preview = within(card).getByLabelText("Vista previa de ElaBela Serif");

    fireEvent.change(sample, { target: { value: "Brillo auténtico" } });
    fireEvent.change(within(card).getByLabelText("Tamaño de ElaBela Serif"), { target: { value: "48" } });
    fireEvent.change(within(card).getByLabelText("Espaciado de ElaBela Serif"), { target: { value: "1.5" } });

    expect(preview).toHaveTextContent("Brillo auténtico");
    expect(preview).toHaveStyle({ fontSize: "48px", letterSpacing: "1.5px" });
    expect(within(card).getByText("Aa Bb Cc 123 · ÁÉÍÓÚ ñ")).toBeInTheDocument();
    expect(within(card).getByText(/ElaBela crea experiencias de belleza/)).toBeInTheDocument();
  });

  it("edits name and role without touching Storage when no replacement is selected", async () => {
    render(<MarcaPage />);
    const card = screen.getByRole("article", { name: "Fuente ElaBela Serif" });
    fireEvent.click(within(card).getByRole("button", { name: "Editar ElaBela Serif" }));
    const dialog = screen.getByRole("dialog", { name: "Editar fuente" });
    fireEvent.change(within(dialog).getByLabelText("Nombre visible"), { target: { value: "ElaBela Display" } });
    fireEvent.change(within(dialog).getByLabelText("Rol o uso"), { target: { value: "Campañas" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(mocks.updateAsync).toHaveBeenCalledWith("font-1", { name: "ElaBela Display", role: "Campañas", value: "ElaBela Display" }));
    expect(mocks.uploadAsset).not.toHaveBeenCalled();
    expect(mocks.removeAssetByPublicUrl).not.toHaveBeenCalled();
  });

  it("compensates a replacement upload when persistence fails and retains editor state", async () => {
    mocks.updateAsync.mockResolvedValueOnce({ ok: false, error: "No se pudo guardar." });
    const { container } = render(<MarcaPage />);
    const card = screen.getByRole("article", { name: "Fuente ElaBela Serif" });
    fireEvent.click(within(card).getByRole("button", { name: "Editar ElaBela Serif" }));
    const dialog = screen.getByRole("dialog", { name: "Editar fuente" });
    fireEvent.change(within(dialog).getByLabelText("Nombre visible"), { target: { value: "Nombre retenido" } });
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInput!, { target: { files: [woff2File("new.woff2")] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No se pudo guardar.");
    expect(within(dialog).getByLabelText("Nombre visible")).toHaveValue("Nombre retenido");
    expect(mocks.removeAssetByPublicUrl).toHaveBeenCalledTimes(1);
    expect(mocks.removeAssetByPublicUrl).toHaveBeenCalledWith(expect.stringContaining("/new.woff2"));
    expect(mocks.removeAssetByPublicUrl).not.toHaveBeenCalledWith(expect.stringContaining("/old.woff2"));
    expect(mocks.updateAsync.mock.invocationCallOrder[0]).toBeLessThan(mocks.removeAssetByPublicUrl.mock.invocationCallOrder[0]);
  });

  it("removes the old upload only after a replacement persisted and reports cleanup failure", async () => {
    mocks.removeAssetByPublicUrl.mockResolvedValueOnce({ ok: false, error: "No se pudo borrar la fuente anterior." });
    const { container } = render(<MarcaPage />);
    const card = screen.getByRole("article", { name: "Fuente ElaBela Serif" });
    fireEvent.click(within(card).getByRole("button", { name: "Editar ElaBela Serif" }));
    const dialog = screen.getByRole("dialog", { name: "Editar fuente" });
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInput!, { target: { files: [woff2File("new.woff2")] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    const warning = await screen.findByText("La fuente se guardó, pero no se pudo limpiar el archivo anterior: No se pudo borrar la fuente anterior.");
    expect(warning).toHaveAttribute("role", "status");
    expect(mocks.updateAsync.mock.invocationCallOrder[0]).toBeLessThan(mocks.removeAssetByPublicUrl.mock.invocationCallOrder[0]);
    expect(mocks.removeAssetByPublicUrl).toHaveBeenCalledWith(expect.stringContaining("/old.woff2"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar fuente" })).not.toBeInTheDocument());
  });

  it("retains the row and stored file when confirmed database deletion fails", async () => {
    mocks.removeAsync.mockResolvedValueOnce({ ok: false, error: "No se pudo borrar el registro." });
    render(<MarcaPage />);
    const card = screen.getByRole("article", { name: "Fuente ElaBela Serif" });
    fireEvent.click(within(card).getByRole("button", { name: "Eliminar ElaBela Serif" }));
    const dialog = screen.getByRole("dialog", { name: "Eliminar fuente" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sí, eliminar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No se pudo borrar el registro.");
    expect(mocks.removeAssetByPublicUrl).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Eliminar fuente" })).toBeInTheDocument();
  });

  it("deletes the database row before storage and accurately reports cleanup failure", async () => {
    mocks.removeAssetByPublicUrl.mockResolvedValueOnce({ ok: false, error: "Storage no disponible." });
    render(<MarcaPage />);
    const card = screen.getByRole("article", { name: "Fuente ElaBela Serif" });
    fireEvent.click(within(card).getByRole("button", { name: "Eliminar ElaBela Serif" }));
    const dialog = screen.getByRole("dialog", { name: "Eliminar fuente" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sí, eliminar" }));

    const warning = await screen.findByText("La fuente se eliminó, pero no se pudo limpiar su archivo: Storage no disponible.");
    expect(warning).toHaveAttribute("role", "status");
    expect(mocks.removeAsync.mock.invocationCallOrder[0]).toBeLessThan(mocks.removeAssetByPublicUrl.mock.invocationCallOrder[0]);
  });

  it("clears a stale collection error when a failed edit retry succeeds", async () => {
    mocks.updateAsync
      .mockResolvedValueOnce({ ok: false, error: "Fallo transitorio." })
      .mockResolvedValueOnce({ ok: true });
    render(<MarcaPage />);
    const card = screen.getByRole("article", { name: "Fuente ElaBela Serif" });
    fireEvent.click(within(card).getByRole("button", { name: "Editar ElaBela Serif" }));
    let dialog = screen.getByRole("dialog", { name: "Editar fuente" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar fuente" })).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears a previous collection error before opening delete confirmation", async () => {
    mocks.updateAsync.mockResolvedValueOnce({ ok: false, error: "Error anterior." });
    render(<MarcaPage />);
    const card = screen.getByRole("article", { name: "Fuente ElaBela Serif" });
    fireEvent.click(within(card).getByRole("button", { name: "Editar ElaBela Serif" }));
    const editDialog = screen.getByRole("dialog", { name: "Editar fuente" });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Guardar cambios" }));
    await screen.findAllByRole("alert");
    fireEvent.click(within(editDialog).getByRole("button", { name: "Cerrar" }));

    fireEvent.click(within(card).getByRole("button", { name: "Eliminar ElaBela Serif" }));
    expect(screen.getByRole("dialog", { name: "Eliminar fuente" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryAllByText("Error anterior.")).toHaveLength(0));
  });

  it("gates font mutations until delayed collection hydration finishes", () => {
    mocks.ready = false;
    const { rerender } = render(<MarcaPage />);
    const create = screen.getByRole("button", { name: "Agregar fuente" });
    const card = screen.getByRole("article", { name: "Fuente ElaBela Serif" });
    expect(create).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Editar ElaBela Serif" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Eliminar ElaBela Serif" })).toBeDisabled();
    fireEvent.click(create);
    expect(screen.queryByRole("dialog", { name: "Agregar fuente" })).not.toBeInTheDocument();

    mocks.ready = true;
    rerender(<MarcaPage />);
    expect(screen.getByRole("button", { name: "Agregar fuente" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Agregar fuente" }));
    expect(screen.getByRole("dialog", { name: "Agregar fuente" })).toBeInTheDocument();
  });
});
