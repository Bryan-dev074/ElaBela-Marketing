import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, vi } from "vitest";

vi.stubGlobal("React", React);

const mocks = vi.hoisted(() => ({
  addAsync: vi.fn(),
  updateAsync: vi.fn(),
  removeAsync: vi.fn(),
  addCategoryAsync: vi.fn(),
  updateCategoryAsync: vi.fn(),
  setCategories: vi.fn(),
  deleteCategory: vi.fn(),
  reorderCategories: vi.fn(),
  clearCredentialError: vi.fn(),
  clearCategoryError: vi.fn(),
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    useCredentials: () => ({
      items: [
        { id: "google", platform: "Google", icon: "🔑", idType: "email", identifier: "team@example.com", secret: "clave-google", url: "https://accounts.google.com", scope: "shared", categoryId: "social" },
        { id: "orphan", platform: "Huérfana", icon: "🔑", idType: "usuario", identifier: "team", secret: "clave", scope: "shared", categoryId: "missing" },
        { id: "mismatch", platform: "Incompatible", icon: "🔑", idType: "usuario", identifier: "team", secret: "clave", scope: "shared", categoryId: "personal" },
        { id: "bank", platform: "Banco", icon: "🔒", idType: "usuario", identifier: "yo", secret: "privada", scope: "private", ownerId: "user-1", categoryId: "personal" },
        { id: "foreign", platform: "No visible", icon: "🔒", idType: "usuario", identifier: "otro", secret: "ajena", scope: "private", ownerId: "user-2", categoryId: "foreign-category" },
      ],
      addAsync: mocks.addAsync,
      updateAsync: mocks.updateAsync,
      removeAsync: mocks.removeAsync,
      error: null,
      clearError: mocks.clearCredentialError,
      ready: true,
    }),
    useCredentialCategories: () => ({
      items: [
        { id: "social", name: "Redes Sociales", icon: "📱", scope: "shared", sort: 0, createdAt: "" },
        { id: "personal", name: "Personal", icon: "🔒", scope: "private", ownerId: "user-1", sort: 0, createdAt: "" },
        { id: "foreign-category", name: "Oculta", icon: "🕵️", scope: "private", ownerId: "user-2", sort: 0, createdAt: "" },
      ],
      addAsync: mocks.addCategoryAsync,
      updateAsync: mocks.updateCategoryAsync,
      setItems: mocks.setCategories,
      error: null,
      clearError: mocks.clearCategoryError,
      ready: true,
    }),
    deleteEmptyCredentialCategory: mocks.deleteCategory,
    reorderCredentialCategories: mocks.reorderCategories,
  };
});

vi.mock("@/components/IconPicker", () => ({
  IconPicker: ({ onChange }: { onChange: (value: string) => void }) => (
    <button type="button" onClick={() => onChange("✨")}>Elegir ícono</button>
  ),
}));

import CredencialesView from "@/components/views/CredencialesView";

describe("CredencialesView categories and preserved actions", () => {
  beforeEach(() => {
    mocks.addAsync.mockReset().mockResolvedValue({ ok: true });
    mocks.updateAsync.mockReset().mockResolvedValue({ ok: true });
    mocks.removeAsync.mockReset().mockResolvedValue({ ok: true });
    mocks.addCategoryAsync.mockReset().mockResolvedValue({ ok: true });
    mocks.updateCategoryAsync.mockReset().mockResolvedValue({ ok: true });
    mocks.deleteCategory.mockReset().mockResolvedValue({ ok: true });
    mocks.reorderCategories.mockReset().mockResolvedValue({ ok: true });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("renders compatible category groups and hides foreign categories and credentials", () => {
    render(<CredencialesView role="marketer" ownerId="user-1" />);
    expect(screen.getByRole("region", { name: "Categoría compartida Redes Sociales" })).toHaveTextContent("Google");
    const ungrouped = screen.getByRole("region", { name: "Credenciales compartidas sin categoría" });
    expect(ungrouped).toHaveTextContent("Huérfana");
    expect(ungrouped).toHaveTextContent("Incompatible");
    expect(screen.getByRole("region", { name: "Categoría privada Personal" })).toHaveTextContent("Banco");
    expect(screen.queryByText("Oculta")).not.toBeInTheDocument();
    expect(screen.queryByText("No visible")).not.toBeInTheDocument();
  });

  it("lists only compatible categories and clears selection when scope changes", () => {
    render(<CredencialesView role="marketer" ownerId="user-1" />);
    const row = screen.getByText("Google").closest("[data-credential-row]") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Editar acceso" }));
    const category = screen.getByLabelText("Categoría") as HTMLSelectElement;
    expect(category).toHaveValue("social");
    expect(within(category).getByRole("option", { name: "Redes Sociales" })).toBeInTheDocument();
    expect(within(category).queryByRole("option", { name: "Personal" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Privada" }));
    expect(category).toHaveValue("");
    expect(within(category).getByRole("option", { name: "Personal" })).toBeInTheDocument();
    expect(within(category).queryByRole("option", { name: "Redes Sociales" })).not.toBeInTheDocument();
  });

  it("awaits credential persistence, retains draft on failure, and succeeds on retry", async () => {
    let fail: ((value: { ok: false; error: string }) => void) | undefined;
    mocks.updateAsync
      .mockImplementationOnce(() => new Promise<{ ok: false; error: string }>((resolve) => { fail = resolve; }))
      .mockResolvedValueOnce({ ok: true });
    render(<CredencialesView role="marketer" ownerId="user-1" />);
    const row = screen.getByText("Google").closest("[data-credential-row]") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Editar acceso" }));
    fireEvent.change(screen.getByLabelText("Plataforma"), { target: { value: "Google Workspace" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Guardando…" }));
    expect(mocks.updateAsync).toHaveBeenCalledTimes(1);

    await act(async () => fail?.({ ok: false, error: "Fallo transitorio." }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Fallo transitorio.");
    expect(screen.getByLabelText("Plataforma")).toHaveValue("Google Workspace");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar acceso" })).not.toBeInTheDocument());
    expect(mocks.updateAsync).toHaveBeenCalledTimes(2);
  });

  it("preserves reveal, copy, edit, and confirmed awaited delete behavior", async () => {
    let finishDelete: ((value: { ok: true }) => void) | undefined;
    mocks.removeAsync.mockImplementation(() => new Promise<{ ok: true }>((resolve) => { finishDelete = resolve; }));
    render(<CredencialesView role="marketer" ownerId="user-1" />);
    const row = screen.getByText("Google").closest("[data-credential-row]") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Mostrar valores" }));
    expect(within(row).getByText("clave-google")).toBeInTheDocument();
    const passwordCopy = within(row).getByRole("button", { name: "Copiar contraseña" });
    expect(passwordCopy).toHaveAttribute("title", "Copiar contraseña");
    expect(passwordCopy).toHaveTextContent("Contraseña");
    fireEvent.click(passwordCopy);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("clave-google"));

    fireEvent.click(within(row).getByRole("button", { name: "Eliminar acceso" }));
    fireEvent.click(within(row).getByRole("button", { name: "Confirmar eliminación" }));
    expect(mocks.removeAsync).toHaveBeenCalledWith("google");
    expect(within(row).getByRole("button", { name: "Eliminando acceso" })).toBeDisabled();
    await act(async () => finishDelete?.({ ok: true }));
  });

  it("copies the email with an explicit action and exposes the direct access link", async () => {
    render(<CredencialesView role="marketer" ownerId="user-1" />);
    const row = screen.getByText("Google").closest("[data-credential-row]") as HTMLElement;

    const emailCopy = within(row).getByRole("button", { name: "Copiar correo" });
    expect(emailCopy).toHaveAttribute("title", "Copiar correo");
    expect(emailCopy).toHaveTextContent("Correo");
    fireEvent.click(emailCopy);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("team@example.com"));

    const link = within(row).getByRole("link", { name: "Abrir enlace de Google" });
    expect(link).toHaveAttribute("href", "https://accounts.google.com/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("persists an optional access URL from the editor", async () => {
    render(<CredencialesView role="marketer" ownerId="user-1" />);
    const row = screen.getByText("Google").closest("[data-credential-row]") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Editar acceso" }));
    fireEvent.change(screen.getByLabelText("URL de acceso (opcional)"), { target: { value: "https://admin.google.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mocks.updateAsync).toHaveBeenCalledWith("google", expect.objectContaining({ url: "https://admin.google.com" })));
  });
});
