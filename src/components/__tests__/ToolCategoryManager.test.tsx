import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

vi.stubGlobal("React", React);

import { ToolCategoryManager } from "@/components/ToolCategoryManager";
import { DEFAULT_TOOL_CATEGORIES } from "@/lib/tool-categories";

describe("ToolCategoryManager deletion safety", () => {
  it("requires a destination before deleting a referenced category", async () => {
    const onDelete = vi.fn().mockResolvedValue({ ok: true });
    render(
      <ToolCategoryManager
        open
        onClose={vi.fn()}
        categories={DEFAULT_TOOL_CATEGORIES.slice(0, 2)}
        tools={[{ categoryId: "prompts" }]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onReorder={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Prompts" }));
    expect(screen.getByText("Mover 1 recurso antes de eliminar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mover y eliminar" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Categoría de destino"), { target: { value: "ia" } });
    fireEvent.click(screen.getByRole("button", { name: "Mover y eliminar" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("prompts", "ia"));
    await screen.findByRole("button", { name: "Eliminar Prompts" });
  });

  it("requires confirmation before deleting an empty category", async () => {
    const onDelete = vi.fn().mockResolvedValue({ ok: true });
    render(
      <ToolCategoryManager
        open
        onClose={vi.fn()}
        categories={DEFAULT_TOOL_CATEGORIES.slice(0, 2)}
        tools={[]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onReorder={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Eliminar IA" }));
    expect(screen.getByText("Esta categoría está vacía.")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar definitivamente" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("ia", undefined));
    await screen.findByRole("button", { name: "Eliminar IA" });
  });

  it("locks every reorder control while one atomic reorder is pending", async () => {
    let finishReorder: ((result: { ok: true }) => void) | undefined;
    const onReorder = vi.fn().mockImplementation(() => new Promise<{ ok: true }>((resolve) => { finishReorder = resolve; }));
    render(
      <ToolCategoryManager
        open
        onClose={vi.fn()}
        categories={DEFAULT_TOOL_CATEGORIES.slice(0, 3)}
        tools={[]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onReorder={onReorder}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Subir IA" }));
    expect(screen.getByRole("button", { name: "Bajar Prompts" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bajar IA" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Bajar Prompts" }));
    expect(onReorder).toHaveBeenCalledTimes(1);

    await act(async () => finishReorder?.({ ok: true }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Bajar Prompts" })).toBeEnabled());
  });
});
