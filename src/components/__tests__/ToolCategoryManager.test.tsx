import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
});
