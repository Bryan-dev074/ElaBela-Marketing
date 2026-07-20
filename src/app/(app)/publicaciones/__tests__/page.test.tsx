import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addAsync: vi.fn(),
  updateAsync: vi.fn(),
  removeAsync: vi.fn(),
  clearError: vi.fn(),
  uploadAsset: vi.fn(),
  removeAssetByPublicUrl: vi.fn(),
  fileToImage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  usePostTypes: () => ({
    items: [],
    addAsync: mocks.addAsync,
    updateAsync: mocks.updateAsync,
    removeAsync: mocks.removeAsync,
    error: null,
    clearError: mocks.clearError,
  }),
  useToolItems: () => ({ items: [] }),
}));

vi.mock("@/lib/storage", () => ({
  validateAssetFile: () => ({ ok: true }),
  uploadAsset: mocks.uploadAsset,
  removeAssetByPublicUrl: mocks.removeAssetByPublicUrl,
}));

vi.mock("@/lib/profiles", () => ({
  fileToImage: mocks.fileToImage,
}));

import PublicacionesPage from "@/app/(app)/publicaciones/page";

async function prepareDraftWithTwoImages() {
  const { container } = render(<PublicacionesPage />);
  fireEvent.click(screen.getAllByRole("button", { name: "Nuevo tipo" })[0]);
  fireEvent.change(screen.getByPlaceholderText("Ej: Reel Tutorial"), { target: { value: "Carrusel de prueba" } });
  const input = container.querySelector<HTMLInputElement>('input[type="file"][multiple]');
  expect(input).not.toBeNull();
  fireEvent.change(input!, {
    target: {
      files: [
        new File(["one"], "one.png", { type: "image/png" }),
        new File(["two"], "two.png", { type: "image/png" }),
      ],
    },
  });
  await screen.findByText("2 / 8");
  return screen.getByPlaceholderText("Ej: Reel Tutorial");
}

describe("PublicacionesPage editor persistence", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn(() => ({
        disconnect: vi.fn(),
        observe: vi.fn(),
        takeRecords: vi.fn(() => []),
        unobserve: vi.fn(),
      })),
    );

    mocks.addAsync.mockReset();
    mocks.updateAsync.mockReset();
    mocks.removeAsync.mockReset();
    mocks.uploadAsset.mockReset();
    mocks.removeAssetByPublicUrl.mockReset();
    mocks.fileToImage.mockReset();
    mocks.addAsync.mockResolvedValue({ ok: true });
    mocks.updateAsync.mockResolvedValue({ ok: true });
    mocks.removeAsync.mockResolvedValue({ ok: true });
    mocks.removeAssetByPublicUrl.mockResolvedValue({ ok: true });
    mocks.fileToImage.mockResolvedValue("data:image/jpeg;base64,aW1hZ2U=");
  });

  it("rolls back successful uploads when another upload fails and retains the draft", async () => {
    mocks.uploadAsset
      .mockResolvedValueOnce({ ok: true, url: "https://assets.example/one.jpg" })
      .mockResolvedValueOnce({ ok: false, error: "Falló la segunda imagen." });
    const nameInput = await prepareDraftWithTwoImages();

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Falló la segunda imagen.");
    expect(mocks.removeAssetByPublicUrl).toHaveBeenCalledWith("https://assets.example/one.jpg");
    expect(mocks.addAsync).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Nuevo tipo de post" })).toBeInTheDocument();
    expect(nameInput).toHaveValue("Carrusel de prueba");
  });

  it("rolls back every new upload and retains the draft when persistence fails", async () => {
    mocks.uploadAsset
      .mockResolvedValueOnce({ ok: true, url: "https://assets.example/one.jpg" })
      .mockResolvedValueOnce({ ok: true, url: "https://assets.example/two.jpg" });
    mocks.addAsync.mockResolvedValueOnce({ ok: false, error: "No se pudo guardar en la base." });
    const nameInput = await prepareDraftWithTwoImages();

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar en la base.");
    await waitFor(() => expect(mocks.removeAssetByPublicUrl).toHaveBeenCalledTimes(2));
    expect(mocks.removeAssetByPublicUrl).toHaveBeenCalledWith("https://assets.example/one.jpg");
    expect(mocks.removeAssetByPublicUrl).toHaveBeenCalledWith("https://assets.example/two.jpg");
    expect(screen.getByRole("dialog", { name: "Nuevo tipo de post" })).toBeInTheDocument();
    expect(nameInput).toHaveValue("Carrusel de prueba");
  });
});
