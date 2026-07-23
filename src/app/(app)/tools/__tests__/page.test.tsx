import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, vi } from "vitest";

vi.stubGlobal("React", React);

const mocks = vi.hoisted(() => ({
  addAsync: vi.fn(),
  updateAsync: vi.fn(),
  removeAsync: vi.fn(),
  setToolItems: vi.fn(),
  setCategories: vi.fn(),
  moveAndDelete: vi.fn(),
  reorderCategories: vi.fn(),
  uploadAsset: vi.fn(),
  removeAssetByPublicUrl: vi.fn(),
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    useToolItems: () => ({
      items: [
        { id: "prompt-1", category: "prompts", categoryId: "prompts", kind: "prompt", title: "Prompt visible", note: "Copiar", href: "https://prompt.example.com/", image: "prompt.jpg", icon: "", steps: "Paso" },
        { id: "app-1", category: "apps", categoryId: "apps", kind: "link", title: "App visible", note: "Abrir", href: "https://example.com", image: "https://example.supabase.co/storage/v1/object/public/elabela-assets/tools/app.jpg", icon: "", steps: "Pasos dormidos" },
        { id: "lost-1", category: "missing", categoryId: "missing", kind: "link", title: "Recurso huérfano", note: "", href: "", image: "", icon: "", steps: "" },
      ],
      addAsync: mocks.addAsync,
      updateAsync: mocks.updateAsync,
      removeAsync: mocks.removeAsync,
      setItems: mocks.setToolItems,
      error: null,
      clearError: vi.fn(),
    }),
    useToolCategories: () => ({
      items: [
        { id: "prompts", name: "Prompts", icon: "💬", accent: "#d6ab99", kind: "prompt", sort: 0, createdAt: "" },
        { id: "apps", name: "Apps", icon: "📲", accent: "#22d3ee", kind: "link", sort: 1, createdAt: "" },
      ],
      setItems: mocks.setCategories,
      addAsync: mocks.addAsync,
      updateAsync: mocks.updateAsync,
      error: null,
      clearError: vi.fn(),
    }),
    moveAndDeleteToolCategory: mocks.moveAndDelete,
    reorderToolCategories: mocks.reorderCategories,
  };
});

vi.mock("@/lib/storage", () => ({
  uploadAsset: mocks.uploadAsset,
  removeAssetByPublicUrl: mocks.removeAssetByPublicUrl,
  isManagedAssetUrl: (url: string) => url.includes("/storage/v1/object/public/elabela-assets/"),
  validateAssetFile: () => ({ ok: true }),
}));

vi.mock("@/components/IconPicker", () => ({
  IconPicker: ({ onChange }: { onChange: (icon: string) => void }) => (
    <button type="button" onClick={() => onChange("data:image/png;base64,aW1hZ2U=")}>Usar ícono personalizado</button>
  ),
}));

import ToolsPage from "@/app/(app)/tools/page";

describe("ToolsPage dynamic categories", () => {
  beforeEach(() => {
    mocks.addAsync.mockReset().mockResolvedValue({ ok: true });
    mocks.updateAsync.mockReset().mockResolvedValue({ ok: true });
    mocks.removeAsync.mockReset().mockResolvedValue({ ok: true });
    mocks.moveAndDelete.mockReset().mockResolvedValue({ ok: true });
    mocks.reorderCategories.mockReset().mockResolvedValue({ ok: true });
    mocks.uploadAsset.mockReset().mockResolvedValue({ ok: true, url: "https://example.supabase.co/storage/v1/object/public/elabela-assets/tools/new.png" });
    mocks.removeAssetByPublicUrl.mockReset().mockResolvedValue({ ok: true });
  });

  it("renders persisted filters with canonical counts and an uncategorized bucket", async () => {
    render(<ToolsPage />);

    expect(screen.getByRole("button", { name: /Prompts\s+1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apps\s+1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sin categoría\s+1/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Apps\s+1/ }));
    expect(screen.getByText("App visible")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Prompt visible")).not.toBeInTheDocument());
  });

  it("uses category kind as the presentation source of truth", () => {
    render(<ToolsPage />);

    expect(screen.getAllByRole("button", { name: "Copiar prompt Prompt visible" })).not.toHaveLength(0);
    expect(screen.getByRole("link", { name: "Abrir App visible" })).toHaveAttribute("href", "https://example.com/");
  });

  it("keeps long prompt previews compact without changing the copy action", () => {
    render(<ToolsPage />);

    const promptCard = screen.getByText("Prompt visible").closest("article");
    const preview = promptCard?.querySelector("[data-prompt-preview]");
    expect(preview).not.toBeNull();
    expect(preview).toHaveClass("line-clamp-4");
    expect(within(promptCard!).getAllByRole("button", { name: "Copiar prompt Prompt visible" })).toHaveLength(2);
  });

  it("places contained media before each card title and keeps Lightbox labels in sync", () => {
    render(<ToolsPage />);

    const promptCard = screen.getByText("Prompt visible").closest("article");
    expect(promptCard).not.toBeNull();
    const media = within(promptCard!).getByRole("button", { name: "Ver imagen de Prompt visible" });
    const title = within(promptCard!).getByText("Prompt visible");
    expect(media.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(media.querySelector("img")).toHaveClass("object-contain");

    fireEvent.click(media);
    expect(screen.getByRole("dialog", { name: "Prompt visible" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Prompt visible" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Imagen siguiente" }));
    expect(screen.getByRole("dialog", { name: "App visible" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "App visible" })).toHaveAttribute("src", "https://example.supabase.co/storage/v1/object/public/elabela-assets/tools/app.jpg");
  });

  it("leaves local category order untouched when the reorder transaction fails", async () => {
    mocks.reorderCategories.mockResolvedValueOnce({ ok: false, error: "No se pudo reordenar." });
    render(<ToolsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Gestionar categorías" }));
    fireEvent.click(screen.getByRole("button", { name: "Subir Apps" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo reordenar.");
    expect(mocks.reorderCategories).toHaveBeenCalledWith(["apps", "prompts"]);
    expect(mocks.setCategories).not.toHaveBeenCalled();
  });

  it("rejects unsafe external links without creating an anchor", () => {
    render(<ToolsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Apps\s+1/ }));
    const appCard = screen.getByText("App visible").closest("article");
    expect(appCard).not.toBeNull();
    fireEvent.click(within(appCard!).getByRole("button", { name: "Editar recurso" }));
    fireEvent.change(screen.getByPlaceholderText("https://…"), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Usá un enlace HTTP o HTTPS válido.");
    expect(mocks.updateAsync).not.toHaveBeenCalled();
  });

  it("preserves dormant href and steps when the editor moves a Tool across kinds", async () => {
    render(<ToolsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Apps\s+1/ }));
    const appCard = screen.getByText("App visible").closest("article");
    fireEvent.click(within(appCard!).getByRole("button", { name: "Editar recurso" }));
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "prompts" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(mocks.updateAsync).toHaveBeenCalled());
    expect(mocks.updateAsync.mock.calls[0][1]).toMatchObject({
      category: "prompts",
      categoryId: "prompts",
      kind: "prompt",
      href: "https://example.com",
      steps: "Pasos dormidos",
    });
  });

  it("preserves a dormant URL when editing a prompt after a category kind transition", async () => {
    render(<ToolsPage />);
    const promptCard = screen.getByText("Prompt visible").closest("article");
    fireEvent.click(within(promptCard!).getByRole("button", { name: "Editar recurso" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(mocks.updateAsync).toHaveBeenCalled());
    expect(mocks.updateAsync.mock.calls[0][1]).toMatchObject({
      kind: "prompt",
      href: "https://prompt.example.com/",
      steps: "Paso",
    });
  });

  it("surfaces failed uploaded-image rollback and retains the draft when persistence fails", async () => {
    mocks.updateAsync.mockResolvedValueOnce({ ok: false, error: "No se pudo guardar." });
    mocks.removeAssetByPublicUrl.mockResolvedValueOnce({ ok: false, error: "No se pudo borrar la imagen nueva." });
    const { container } = render(<ToolsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Apps\s+1/ }));
    const appCard = screen.getByText("App visible").closest("article");
    expect(appCard).not.toBeNull();
    fireEvent.click(within(appCard!).getByRole("button", { name: "Editar recurso" }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [new File(["image"], "tool.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar. Además, no se pudo revertir el archivo nuevo: No se pudo borrar la imagen nueva.");
    await waitFor(() => expect(mocks.removeAssetByPublicUrl).toHaveBeenCalledWith(expect.stringContaining("/tools/new.png")));
    expect(screen.getByRole("dialog", { name: "Editar recurso" })).toBeInTheDocument();
  });

  it("surfaces failed compensation when icon upload fails after an image upload", async () => {
    mocks.uploadAsset
      .mockResolvedValueOnce({ ok: true, url: "https://example.supabase.co/storage/v1/object/public/elabela-assets/tools/new-image.png" })
      .mockResolvedValueOnce({ ok: false, error: "No se pudo subir el ícono." });
    mocks.removeAssetByPublicUrl.mockResolvedValueOnce({ ok: false, error: "No se pudo borrar la imagen nueva." });
    const { container } = render(<ToolsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Apps\s+1/ }));
    const appCard = screen.getByText("App visible").closest("article");
    fireEvent.click(within(appCard!).getByRole("button", { name: "Editar recurso" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar ícono personalizado" }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input!, { target: { files: [new File(["image"], "tool.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo subir el ícono. Además, no se pudo revertir el archivo nuevo: No se pudo borrar la imagen nueva.");
    expect(mocks.updateAsync).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Editar recurso" })).toBeInTheDocument();
  });

  it("closes the editor and reports a warning when old-asset cleanup fails after persistence", async () => {
    mocks.removeAssetByPublicUrl.mockResolvedValueOnce({ ok: false, error: "No se pudo borrar la imagen anterior." });
    const { container } = render(<ToolsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Apps\s+1/ }));
    const appCard = screen.getByText("App visible").closest("article");
    fireEvent.click(within(appCard!).getByRole("button", { name: "Editar recurso" }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input!, { target: { files: [new File(["image"], "tool.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("status")).toHaveTextContent("El recurso se guardó, pero no se pudo limpiar el archivo anterior: No se pudo borrar la imagen anterior.");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar recurso" })).not.toBeInTheDocument());
    expect(mocks.updateAsync).toHaveBeenCalledTimes(1);
  });
});
