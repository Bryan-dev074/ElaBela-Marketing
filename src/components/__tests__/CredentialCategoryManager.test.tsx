import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

vi.stubGlobal("React", React);

vi.mock("@/components/IconPicker", () => ({
  IconPicker: ({ onChange }: { onChange: (value: string) => void }) => (
    <button type="button" onClick={() => onChange("data:image/png;base64,aW1hZ2U=")}>Elegir imagen de categoría</button>
  ),
}));

import { CredentialCategoryManager } from "@/components/CredentialCategoryManager";
import type { CredentialCategory } from "@/lib/credential-categories";

const categories: CredentialCategory[] = [
  { id: "social", name: "Redes Sociales", icon: "📱", scope: "shared", sort: 0, createdAt: "" },
  { id: "systems", name: "Sistemas", icon: "🖥️", scope: "shared", sort: 1, createdAt: "" },
];

function props(overrides: Partial<React.ComponentProps<typeof CredentialCategoryManager>> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    scope: "shared" as const,
    ownerId: "user-1",
    categories,
    credentials: [],
    onAdd: vi.fn().mockResolvedValue({ ok: true }),
    onUpdate: vi.fn().mockResolvedValue({ ok: true }),
    onReorder: vi.fn().mockResolvedValue({ ok: true }),
    onDelete: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

describe("CredentialCategoryManager", () => {
  it("confirms empty deletion and retains confirmation when the server detects a race", async () => {
    const onDelete = vi.fn().mockResolvedValue({ ok: false, error: "La categoría no está vacía." });
    render(<CredentialCategoryManager {...props({ onDelete })} />);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Sistemas" }));
    expect(screen.getByText("Esta categoría está vacía.")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar definitivamente" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La categoría no está vacía.");
    expect(screen.getByRole("dialog", { name: "Eliminar Sistemas" })).toBeInTheDocument();
  });

  it("refuses client-side deletion when the category contains credentials", () => {
    const onDelete = vi.fn();
    render(<CredentialCategoryManager {...props({ credentials: [{ categoryId: "social" }], onDelete })} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Redes Sociales" }));

    expect(screen.getByText("Mové sus credenciales antes de eliminarla.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar definitivamente" })).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("locks every reorder control while one scoped transaction is pending", async () => {
    let finish: ((value: { ok: true }) => void) | undefined;
    const onReorder = vi.fn().mockImplementation(() => new Promise<{ ok: true }>((resolve) => { finish = resolve; }));
    render(<CredentialCategoryManager {...props({ onReorder })} />);
    fireEvent.click(screen.getByRole("button", { name: "Subir Sistemas" }));

    expect(screen.getByRole("button", { name: "Bajar Redes Sociales" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bajar Sistemas" })).toBeDisabled();
    expect(onReorder).toHaveBeenCalledWith(["systems", "social"]);
    await act(async () => finish?.({ ok: true }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Bajar Redes Sociales" })).toBeEnabled());
  });

  it("trims scoped names, retains the draft on failure, and prevents duplicate saves while pending", async () => {
    let finish: ((value: { ok: false; error: string }) => void) | undefined;
    const onAdd = vi.fn().mockImplementation(() => new Promise<{ ok: false; error: string }>((resolve) => { finish = resolve; }));
    render(<CredentialCategoryManager {...props({ onAdd })} />);
    fireEvent.click(screen.getByRole("button", { name: "Nueva categoría" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "  Google / Metricool  " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar categoría" }));

    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Guardando…" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      name: "Google / Metricool",
      scope: "shared",
      ownerId: undefined,
      sort: 2,
    }));
    await act(async () => finish?.({ ok: false, error: "No se pudo guardar." }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar.");
    expect(screen.getByLabelText("Nombre")).toHaveValue("  Google / Metricool  ");
  });
});
