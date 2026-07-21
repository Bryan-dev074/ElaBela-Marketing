import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Project } from "@/lib/data";
import { ProjectDetailModal } from "../ProjectDetailModal";

vi.stubGlobal("React", React);

vi.mock("@/components/Avatar", () => ({
  Avatar: ({ username }: { username: string }) => <span>{username}</span>,
  AvatarChip: ({ username }: { username: string }) => <span>Persona {username}</span>,
  AvatarStack: ({ usernames }: { usernames: string[] }) => <span>Equipo {usernames.join(", ")}</span>,
}));

vi.mock("@/lib/profiles", () => ({
  useProfiles: () => ({
    profiles: [
      { id: "user-1", username: "bryan", fullName: "Bryan" },
      { id: "user-2", username: "cielo", fullName: "Cielo" },
    ],
  }),
}));

const project = (overrides: Partial<Project> = {}): Project => ({
  id: "project-1",
  name: "Campaña Glow",
  owner: "bryan",
  responsibleUsernames: ["cielo"],
  projectType: "campaign",
  priority: "high",
  objective: "Presentar la nueva línea Glow",
  status: "doing",
  createdAt: "2026-07-01",
  startDate: "2026-07-02",
  due: "2026-07-31",
  contentMode: "steps",
  steps: [
    { label: "Concepto visual", done: true },
    { label: "Publicación final", done: false },
  ],
  ...overrides,
});

const renderDetail = (value: Project | null = project(), overrides: Partial<React.ComponentProps<typeof ProjectDetailModal>> = {}) => {
  const callbacks = {
    onClose: vi.fn(),
    onStatusChange: vi.fn(),
    onStepChange: vi.fn(),
    onEdit: vi.fn(),
    onReopen: vi.fn(),
  };
  render(
    <ProjectDetailModal
      project={value}
      pendingOperation={null}
      error=""
      {...callbacks}
      {...overrides}
    />,
  );
  return callbacks;
};

describe("ProjectDetailModal", () => {
  it("shows the full hierarchy, team, dates and state selector inside the studio", () => {
    const callbacks = renderDetail();
    const dialog = screen.getByRole("dialog", { name: "Campaña Glow" });

    expect(dialog).toHaveClass("max-w-5xl");
    expect(within(dialog).getByText("Campaña")).toBeInTheDocument();
    expect(within(dialog).getByText("Alta")).toBeInTheDocument();
    expect(within(dialog).getByText("Presentar la nueva línea Glow")).toBeInTheDocument();
    expect(within(dialog).getByText("Persona bryan")).toBeInTheDocument();
    expect(within(dialog).getByText("Persona cielo")).toBeInTheDocument();
    expect(within(dialog).getByText(/2 jul/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/31 jul/i)).toBeInTheDocument();

    const todo = within(dialog).getByRole("button", { name: "Sin empezar" });
    expect(todo).toHaveClass("min-h-11");
    fireEvent.click(todo);
    expect(callbacks.onStatusChange).toHaveBeenCalledWith("todo");
  });

  it("runs active step, edit and completion actions independently", () => {
    const callbacks = renderDetail();
    const dialog = screen.getByRole("dialog", { name: "Campaña Glow" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Completar paso: Publicación final" }));
    expect(callbacks.onStepChange).toHaveBeenCalledWith(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Editar proyecto" }));
    expect(callbacks.onEdit).toHaveBeenCalledOnce();

    fireEvent.click(within(dialog).getByRole("button", { name: "Completar proyecto" }));
    expect(callbacks.onStatusChange).toHaveBeenCalledWith("done");
  });

  it("makes completed steps read-only and exposes completion audit plus reopen", () => {
    const callbacks = renderDetail(project({
      status: "done",
      steps: [
        { label: "Concepto visual", done: true },
        { label: "Publicación final", done: true },
      ],
      completedAt: "2026-07-19T15:00:00.000Z",
      completedBy: "user-1",
      completedResponsibleUsernames: ["bryan", "cielo"],
    }));
    const dialog = screen.getByRole("dialog", { name: "Campaña Glow" });

    expect(within(dialog).getByText(/Completado el/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/por Bryan/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Marcar pendiente: Concepto visual" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reabrir proyecto" }));
    expect(callbacks.onReopen).toHaveBeenCalledOnce();
  });

  it("renders Markdown notes in an editorial surface without fabricated progress", () => {
    renderDetail(project({
      contentMode: "note",
      steps: [],
      note: "## Concepto\n\n**Glow** editorial",
    }));
    const dialog = screen.getByRole("dialog", { name: "Campaña Glow" });

    expect(within(dialog).getByRole("heading", { name: "Concepto" })).toBeInTheDocument();
    expect(within(dialog).getByText("Glow")).toBeInTheDocument();
    expect(within(dialog).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(dialog.querySelector("[data-project-note]")).toBeInTheDocument();
  });

  it("locks only the pending operation and keeps an inline error visible", () => {
    renderDetail(project(), {
      pendingOperation: { projectId: "project-1", kind: "step", stepIndex: 1 },
      error: "No se pudo actualizar el paso.",
    });
    const dialog = screen.getByRole("dialog", { name: "Campaña Glow" });

    expect(within(dialog).getByRole("button", { name: "Completar paso: Publicación final" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Marcar pendiente: Concepto visual" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Listo" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Editar proyecto" })).toBeEnabled();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("No se pudo actualizar el paso.");
  });

  it("uses a responsive one-column structure that cannot overflow horizontally", () => {
    renderDetail();
    const dialog = screen.getByRole("dialog", { name: "Campaña Glow" });
    const studio = dialog.querySelector("[data-project-studio]");

    expect(studio).toHaveClass("min-w-0", "overflow-x-hidden");
    expect(studio?.querySelector("[data-project-studio-grid]")).toHaveClass("grid-cols-1", "lg:grid-cols-[minmax(0,1fr)_18rem]");
  });
});
