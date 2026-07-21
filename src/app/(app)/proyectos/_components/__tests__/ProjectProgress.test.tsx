import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/lib/data";
import { getProjectProgress, ProjectProgress } from "../ProjectProgress";

const motionState = vi.hoisted(() => ({
  reduced: false,
  transitions: [] as Array<Record<string, unknown> | undefined>,
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  return {
    useReducedMotion: () => motionState.reduced,
    motion: {
      circle: ReactModule.forwardRef<SVGCircleElement, React.SVGProps<SVGCircleElement> & {
        animate?: unknown;
        initial?: unknown;
        transition?: Record<string, unknown>;
      }>(function MotionCircle({ animate: _animate, initial: _initial, transition, ...props }, ref) {
        motionState.transitions.push(transition);
        return <circle ref={ref} {...props} />;
      }),
    },
  };
});

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
  steps: [
    { label: "Concepto", done: true },
    { label: "Fotos", done: true },
    { label: "Edición", done: true },
    { label: "Publicación", done: false },
  ],
  ...overrides,
});

describe("ProjectProgress", () => {
  beforeEach(() => {
    motionState.reduced = false;
    motionState.transitions.length = 0;
  });

  it("calculates and names determinate progress for three of four steps", () => {
    expect(getProjectProgress(project())).toEqual({
      completed: 3,
      total: 4,
      percentage: 75,
      determinate: true,
    });

    render(<ProjectProgress project={project()} />);

    const progressbar = screen.getByRole("progressbar", { name: "Progreso de Campaña Glow" });
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
    expect(progressbar).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByText("3 de 4 · 75 %")).toBeInTheDocument();
  });

  it("gives each rendered ring a distinct gradient id", () => {
    const { container } = render(
      <>
        <ProjectProgress project={project()} />
        <ProjectProgress project={project({ id: "project-2", name: "Lanzamiento" })} />
      </>,
    );

    const ids = Array.from(container.querySelectorAll("linearGradient"), (gradient) => gradient.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("renders a note project as a textual, non-numeric state", () => {
    render(<ProjectProgress project={project({ contentMode: "note", steps: [], note: "Ideas" })} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Nota del proyecto")).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("describes a steps project with no steps without implying progress", () => {
    render(<ProjectProgress project={project({ steps: [] })} />);

    expect(screen.getByText("Sin pasos")).toBeInTheDocument();
    expect(screen.queryByText(/0\s?%/)).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("uses a zero-duration tween under reduced motion and never a spring", () => {
    motionState.reduced = true;
    render(<ProjectProgress project={project()} compact />);

    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(motionState.transitions).toContainEqual(expect.objectContaining({ duration: 0 }));
    expect(motionState.transitions.some((transition) => transition?.type === "spring")).toBe(false);
  });
});
