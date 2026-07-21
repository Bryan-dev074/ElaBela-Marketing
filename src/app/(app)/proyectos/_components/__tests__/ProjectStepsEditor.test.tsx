import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/lib/data";
import { ProjectStepsEditor } from "@/app/(app)/proyectos/_components/ProjectStepsEditor";

const motionState = vi.hoisted(() => ({
  reduced: false,
  animations: [] as Array<Record<string, unknown> | undefined>,
}));

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  const ReactModule = await import("react");
  const MotionDiv = ReactModule.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & {
    animate?: unknown;
    initial?: unknown;
    exit?: unknown;
  }>(function MotionDiv({ animate, initial: _initial, exit: _exit, ...props }, ref) {
    motionState.animations.push(animate as Record<string, unknown> | undefined);
    return <div ref={ref} {...props} />;
  });
  return {
    ...actual,
    useReducedMotion: () => motionState.reduced,
    motion: new Proxy(actual.motion, {
      get(target, property, receiver) {
        if (property === "div") return MotionDiv;
        return Reflect.get(target, property, receiver);
      },
    }),
  };
});

function EditorHarness({ initial, disabled = false }: { initial: Project["steps"]; disabled?: boolean }) {
  const [steps, setSteps] = useState(initial);
  return <ProjectStepsEditor value={steps} onChange={setSteps} disabled={disabled} />;
}

describe("ProjectStepsEditor", () => {
  beforeEach(() => {
    motionState.reduced = false;
    motionState.animations.length = 0;
  });

  it("renders the first blank route as Paso 01", () => {
    render(<EditorHarness initial={[{ label: "", done: false }]} />);

    expect(screen.getByText("Paso 01")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Paso 01" })).toBeInTheDocument();
  });

  it("adds and focuses Paso 02", async () => {
    render(<EditorHarness initial={[{ label: "Preparar piezas", done: false }]} />);

    fireEvent.click(screen.getByRole("button", { name: "Añadir paso" }));

    const secondStep = screen.getByRole("textbox", { name: "Paso 02" });
    expect(secondStep).toBeInTheDocument();
    await waitFor(() => expect(secondStep).toHaveFocus());
  });

  it("uses Enter on the last non-empty row to add and focus Paso 03", async () => {
    render(<EditorHarness initial={[
      { label: "Planificar", done: false },
      { label: "Publicar", done: false },
    ]} />);

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Paso 02" }), { key: "Enter" });

    const thirdStep = screen.getByRole("textbox", { name: "Paso 03" });
    expect(thirdStep).toBeInTheDocument();
    await waitFor(() => expect(thirdStep).toHaveFocus());
  });

  it("deletes a middle row, renumbers, and preserves the following row identity", async () => {
    render(<EditorHarness initial={[
      { label: "Planificar", done: false },
      { label: "Diseñar", done: false },
      { label: "Publicar", done: false },
    ]} />);

    const thirdStep = screen.getByRole("textbox", { name: "Paso 03" });
    const thirdRowId = thirdStep.closest("[data-row-id]")?.getAttribute("data-row-id");
    expect(thirdRowId).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Paso 02" }));

    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Paso 03" })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByRole("textbox", { name: "Paso 02" })).toHaveLength(1));
    const renumberedStep = screen.getByRole("textbox", { name: "Paso 02" });
    expect(renumberedStep).toHaveValue("Publicar");
    expect(renumberedStep.closest("[data-row-id]")).toHaveAttribute("data-row-id", thirdRowId);
  });

  it("keeps one blank row after deleting the last remaining row", async () => {
    render(<EditorHarness initial={[{ label: "Planificar", done: false }]} />);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Paso 01" }));

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Paso 01" })).toHaveValue(""));
    expect(screen.queryByRole("textbox", { name: "Paso 02" })).not.toBeInTheDocument();
  });

  it("rejects edits and actions when disabled", () => {
    const onChange = vi.fn();
    render(<ProjectStepsEditor value={[{ label: "Planificar", done: false }]} onChange={onChange} disabled />);

    expect(screen.getByRole("textbox", { name: "Paso 01" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Añadir paso" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Eliminar Paso 01" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Añadir paso" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses 44-pixel target utility classes for editor controls", () => {
    render(<EditorHarness initial={[{ label: "Planificar", done: false }]} />);

    expect(screen.getByRole("textbox", { name: "Paso 01" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Añadir paso" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Eliminar Paso 01" })).toHaveClass("h-11");
  });

  it("keeps step fields legible on mobile and uses an intentional placeholder", () => {
    render(<EditorHarness initial={[{ label: "", done: false }]} />);

    const field = screen.getByRole("textbox", { name: "Paso 01" });
    expect(field).toHaveClass("text-base", "sm:text-sm");
    expect(field).toHaveAttribute("placeholder", "Describí este paso…");
  });

  it("removes insertion translation and scale when reduced motion is preferred", () => {
    motionState.reduced = true;
    const { container } = render(<EditorHarness initial={[{ label: "Planificar", done: false }]} />);

    expect(container.querySelector("[data-motion='reduced']")).toBeInTheDocument();
    expect(motionState.animations.some((animation) => "y" in (animation ?? {}) || "scale" in (animation ?? {}))).toBe(false);
  });
});
