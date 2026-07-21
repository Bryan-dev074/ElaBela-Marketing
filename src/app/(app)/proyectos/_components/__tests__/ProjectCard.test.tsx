import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/lib/data";
import type { ProjectPendingOperation, ProjectSection } from "../project-view-types";
import { ProjectCard } from "../ProjectCard";

const motionState = vi.hoisted(() => ({
  reduced: false,
  transitions: [] as Array<Record<string, unknown> | undefined>,
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  const factory = (tag: "article" | "span") => ReactModule.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & {
    animate?: unknown;
    initial?: unknown;
    whileHover?: unknown;
    whileTap?: unknown;
    transition?: Record<string, unknown>;
  }>(function MotionElement({ animate: _animate, initial: _initial, whileHover: _whileHover, whileTap: _whileTap, transition, ...props }, ref) {
    motionState.transitions.push(transition);
    return React.createElement(tag, { ...props, ref });
  });
  return {
    useReducedMotion: () => motionState.reduced,
    motion: {
      article: factory("article"),
      span: factory("span"),
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

vi.mock("@/components/Avatar", () => ({
  AvatarChip: ({ username }: { username: string }) => <span>Líder {username}</span>,
  AvatarStack: ({ usernames }: { usernames: string[] }) => <span>Equipo {usernames.join(", ")}</span>,
}));

const labels = ["Concepto", "Fotos", "Edición", "Copy", "Aprobación", "Publicación"];
const project = (overrides: Partial<Project> = {}): Project => ({
  id: "project-1",
  name: "Campaña Glow",
  owner: "bryan",
  responsibleUsernames: ["cielo"],
  projectType: "campaign",
  priority: "high",
  objective: "Presentar la nueva línea Glow con una historia editorial.",
  status: "doing",
  createdAt: "2026-07-01",
  startDate: "2026-07-02",
  due: "2026-07-31",
  contentMode: "steps",
  steps: labels.map((label, index) => ({ label, done: index < 2 })),
  ...overrides,
});

const renderCard = ({
  value = project(),
  section = "active",
  pendingOperation = null,
  statusMenuOpen = false,
  deleteConfirmOpen = false,
}: {
  value?: Project;
  section?: ProjectSection;
  pendingOperation?: ProjectPendingOperation;
  statusMenuOpen?: boolean;
  deleteConfirmOpen?: boolean;
} = {}) => {
  const callbacks = {
    onOpen: vi.fn(),
    onToggleStatusMenu: vi.fn(),
    onStatusChange: vi.fn(),
    onStepChange: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onReopen: vi.fn(),
  };
  render(
    <ProjectCard
      project={value}
      section={section}
      index={12}
      pendingOperation={pendingOperation}
      statusMenuOpen={statusMenuOpen}
      deleteConfirmOpen={deleteConfirmOpen}
      {...callbacks}
    />,
  );
  return callbacks;
};

describe("ProjectCard", () => {
  beforeEach(() => {
    motionState.reduced = false;
    motionState.transitions.length = 0;
  });

  it("uses an explicit opening surface without nesting actions in a control", () => {
    const callbacks = renderCard();
    const article = screen.getByRole("article", { name: "Campaña Glow" });
    const open = screen.getByRole("button", { name: "Abrir proyecto Campaña Glow" });
    const status = screen.getByRole("button", { name: "Cambiar estado de Campaña Glow" });
    const step = screen.getByRole("button", { name: "Completar paso: Edición" });

    expect(article).toContainElement(open);
    expect(open.parentElement).toBe(article);
    expect(open.querySelector("button, a, input, select, textarea")).toBeNull();
    expect(open).toHaveAttribute("data-cursor", "open");
    expect(open).toHaveAttribute("data-cursor-color", "#d6ab99");
    expect(status.parentElement).toHaveClass("pointer-events-none");
    expect(status).toHaveClass("pointer-events-auto");
    expect(step.closest("div[class*='z-20']")).toHaveClass("pointer-events-none");
    expect(step).toHaveClass("pointer-events-auto");

    fireEvent.click(open);
    expect(callbacks.onOpen).toHaveBeenCalledOnce();
  });

  it("keeps opening distinct from status and step actions", () => {
    const callbacks = renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Cambiar estado de Campaña Glow" }));
    fireEvent.click(screen.getByRole("button", { name: "Completar paso: Edición" }));

    expect(callbacks.onToggleStatusMenu).toHaveBeenCalledOnce();
    expect(callbacks.onStepChange).toHaveBeenCalledWith(2);
    expect(callbacks.onOpen).not.toHaveBeenCalled();
  });

  it("shows editorial metadata and one progress route", () => {
    const { container } = render(<ProjectCard
      project={project()}
      section="active"
      index={0}
      pendingOperation={null}
      statusMenuOpen={false}
      deleteConfirmOpen={false}
      onOpen={vi.fn()}
      onToggleStatusMenu={vi.fn()}
      onStatusChange={vi.fn()}
      onStepChange={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onReopen={vi.fn()}
    />);

    expect(screen.getByText(/Presentar la nueva línea Glow/)).toBeInTheDocument();
    expect(screen.getByText("Campaña")).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument();
    expect(screen.getByText("Equipo bryan, cielo")).toBeInTheDocument();
    expect(screen.getByText(/31 jul/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progreso de Campaña Glow" })).toHaveAttribute("aria-valuenow", "33");
    expect(container.querySelector("[data-project-progress-rail]")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+2 pasos más" })).toBeInTheDocument();
  });

  it("shows completion audit and a 44-pixel reopen action", () => {
    const callbacks = renderCard({
      section: "completed",
      value: project({
        status: "done",
        completedAt: "2026-07-19T15:00:00.000Z",
        completedBy: "user-1",
        completedResponsibleUsernames: ["bryan", "cielo"],
        steps: labels.map((label) => ({ label, done: true })),
      }),
    });

    const article = screen.getByRole("article", { name: "Campaña Glow" });
    expect(within(article).getByText(/Completado el/i)).toBeInTheDocument();
    expect(within(article).getByText("Equipo bryan, cielo")).toBeInTheDocument();
    const reopen = within(article).getByRole("button", { name: "Reabrir proyecto Campaña Glow" });
    expect(reopen).toHaveClass("min-h-11", "min-w-11");
    fireEvent.click(reopen);
    expect(callbacks.onReopen).toHaveBeenCalledOnce();
  });

  it("removes card movement and caps entrance delay under reduced motion", () => {
    motionState.reduced = true;
    renderCard();

    expect(motionState.transitions).toContainEqual(expect.objectContaining({ duration: 0, delay: 0 }));
    expect(motionState.transitions.some((transition) => transition?.delay === 0.27)).toBe(false);
  });

  it("uses the same restrained CSS lift for hover and focus-within without motion transforms", () => {
    renderCard();
    const article = screen.getByRole("article", { name: "Campaña Glow" });

    expect(article).toHaveClass(
      "hover:-translate-y-[3px]",
      "focus-within:-translate-y-[3px]",
      "motion-reduce:hover:translate-y-0",
      "motion-reduce:focus-within:translate-y-0",
    );
  });
});
