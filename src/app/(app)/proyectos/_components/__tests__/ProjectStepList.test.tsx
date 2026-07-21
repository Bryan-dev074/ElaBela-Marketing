import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/lib/data";
import { ProjectStepList } from "../ProjectStepList";

const motionState = vi.hoisted(() => ({
  reduced: false,
  transitions: [] as Array<Record<string, unknown> | undefined>,
  animations: [] as Array<Record<string, unknown> | undefined>,
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  return {
    useReducedMotion: () => motionState.reduced,
    motion: {
      span: ReactModule.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & {
        animate?: unknown;
        initial?: unknown;
        transition?: Record<string, unknown>;
      }>(function MotionSpan({ animate, initial: _initial, transition, ...props }, ref) {
        motionState.transitions.push(transition);
        motionState.animations.push(animate as Record<string, unknown> | undefined);
        return <span ref={ref} {...props} />;
      }),
    },
  };
});

const labels = ["Concepto", "Fotos", "Edición", "Copy", "Aprobación", "Publicación"];
const project = (overrides: Partial<Project> = {}): Project => ({
  id: "project-1",
  name: "Campaña Glow",
  owner: "bryan",
  responsibleUsernames: ["cielo"],
  projectType: "campaign",
  priority: "high",
  status: "doing",
  createdAt: "2026-07-01",
  contentMode: "steps",
  steps: labels.map((label, index) => ({ label, done: index === 0 })),
  ...overrides,
});

describe("ProjectStepList", () => {
  beforeEach(() => {
    motionState.reduced = false;
    motionState.transitions.length = 0;
    motionState.animations.length = 0;
  });

  it("limits compact lists to four rows and opens the remaining steps action", () => {
    const onOpen = vi.fn();
    render(<ProjectStepList project={project()} variant="compact" onToggle={vi.fn()} onOpen={onOpen} />);

    expect(screen.getByRole("list").querySelectorAll(":scope > li")).toHaveLength(4);
    const more = screen.getByRole("button", { name: "+2 pasos más" });
    expect(more).toHaveClass("min-h-11");
    fireEvent.click(more);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("keeps compact step labels visually bounded without clipping detail labels", () => {
    render(<ProjectStepList project={project()} variant="compact" onToggle={vi.fn()} />);

    expect(screen.getByText("Concepto")).toHaveClass("line-clamp-2");

    render(<ProjectStepList project={project()} variant="detail" onToggle={vi.fn()} />);
    const detailLabels = screen.getAllByText("Concepto");
    expect(detailLabels[1]).not.toHaveClass("line-clamp-2");
  });

  it("renders every row in the detail variant", () => {
    render(<ProjectStepList project={project()} variant="detail" onToggle={vi.fn()} />);

    expect(screen.getByRole("list").querySelectorAll(":scope > li")).toHaveLength(6);
    expect(screen.getByText("06")).toBeInTheDocument();
    expect(screen.getByText("Publicación")).toBeInTheDocument();
  });

  it("toggles the correct step using a label-aware accessible name", () => {
    const onToggle = vi.fn();
    render(<ProjectStepList project={project()} onToggle={onToggle} />);

    const incomplete = screen.getByRole("button", { name: "Completar paso: Fotos" });
    expect(incomplete).toHaveAttribute("aria-pressed", "false");
    expect(incomplete).toHaveAttribute("data-cursor", "complete");
    fireEvent.click(incomplete);
    expect(onToggle).toHaveBeenCalledWith(1);

    const complete = screen.getByRole("button", { name: "Marcar pendiente: Concepto" });
    expect(complete).toHaveAttribute("data-cursor", "edit");
  });

  it("disables every toggle and shows the read-only guidance once", () => {
    render(<ProjectStepList project={project()} variant="detail" readOnly onToggle={vi.fn()} />);

    for (const button of screen.getAllByRole("button", { name: /paso:/i })) {
      expect(button).toBeDisabled();
    }
    expect(screen.getAllByText("Reabrí el proyecto para modificar sus pasos")).toHaveLength(1);
  });

  it("keeps a pending row disabled with a 44-pixel target and saving state", () => {
    render(<ProjectStepList project={project()} pendingIndex={1} onToggle={vi.fn()} />);

    const pending = screen.getByRole("button", { name: "Completar paso: Fotos" });
    expect(pending).toBeDisabled();
    expect(pending).toHaveClass("min-h-11");
    expect(screen.getByText("Guardando")).toBeInTheDocument();
  });

  it("uses a zero-duration tween under reduced motion and never a spring", () => {
    motionState.reduced = true;
    render(<ProjectStepList project={project()} onToggle={vi.fn()} />);

    expect(motionState.transitions).toContainEqual(expect.objectContaining({ duration: 0 }));
    expect(motionState.transitions.some((transition) => transition?.type === "spring")).toBe(false);
    expect(motionState.animations.some((animation) => "scale" in (animation ?? {}))).toBe(false);
  });
});
