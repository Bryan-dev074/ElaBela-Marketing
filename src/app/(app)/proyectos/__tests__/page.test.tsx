import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/lib/data";
import ProjectsPage from "@/app/(app)/proyectos/page";

vi.stubGlobal("React", React);
vi.stubGlobal("IntersectionObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

const updateAsync = vi.fn();
const addAsync = vi.fn();
const removeAsync = vi.fn();
let projects: Project[] = [];

const activeGlow = (): Project => ({
  id: "p1",
  name: "Campaña Glow",
  owner: "bryan",
  responsibleUsernames: ["cielo"],
  projectType: "campaign",
  priority: "high",
  objective: "Presentar la línea Glow",
  status: "doing",
  createdAt: "2026-07-01",
  startDate: "2026-07-02",
  due: "2026-07-31",
  contentMode: "steps",
  steps: [{ label: "Diseñar piezas", done: false }],
  note: "",
});

const completedGlow = (): Project => ({
  ...activeGlow(),
  status: "done",
  completedAt: "2026-07-19T15:00:00.000Z",
  completedBy: "00000000-0000-4000-8000-000000000002",
  completedResponsibleUsernames: ["bryan", "cielo"],
  steps: [{ label: "Diseñar piezas", done: true }],
});

const completedElizabeth = (): Project => ({
  ...activeGlow(),
  id: "p2",
  name: "Proyecto Elizabeth",
  owner: "elizabeth",
  responsibleUsernames: [],
  completedResponsibleUsernames: ["elizabeth"],
  status: "done",
  completedAt: "2026-07-18T15:00:00.000Z",
  completedBy: "00000000-0000-4000-8000-000000000002",
});

vi.mock("@/lib/db", () => ({
  useProjects: () => ({ items: projects, addAsync, updateAsync, removeAsync }),
}));

vi.mock("@/lib/user-context", () => ({
  useUser: () => ({
    id: "00000000-0000-4000-8000-000000000001",
    username: "bryan",
    fullName: "Bryan",
    role: "admin",
  }),
}));

vi.mock("@/lib/profiles", () => ({
  useProfiles: () => ({
    profiles: [
      { id: "1", username: "bryan", fullName: "Bryan" },
      { id: "3", username: "elizabeth", fullName: "Elizabeth" },
    ],
  }),
}));

vi.mock("@/components/Avatar", () => ({
  Avatar: ({ username }: { username: string }) => <span>{username}</span>,
  AvatarChip: ({ username }: { username: string }) => <span>{username}</span>,
  AvatarStack: ({ usernames }: { usernames: string[] }) => <span>{usernames.join(", ")}</span>,
  OwnerPicker: ({ value, onChange }: { value: string; onChange: (username: string) => void }) => (
    <button type="button" onClick={() => onChange(value)}>{value}</button>
  ),
}));

describe("ProjectsPage", () => {
  beforeEach(() => {
    projects = [activeGlow()];
    updateAsync.mockReset().mockResolvedValue({ ok: true });
    addAsync.mockReset().mockResolvedValue({ ok: true });
    removeAsync.mockReset().mockResolvedValue({ ok: true });
  });

  it("shows active, completed, and previous sections without archive actions", async () => {
    render(<ProjectsPage />);
    expect(screen.getByRole("button", { name: /Activos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Completados/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anteriores/i })).toBeInTheDocument();
    expect(screen.queryByText(/Archivar|Restaurar/)).not.toBeInTheDocument();
  });

  it("opens an in-progress project with an open cursor intent instead of its status color", () => {
    render(<ProjectsPage />);

    const openProject = screen.getByRole("button", { name: "Campaña Glow" });
    expect(openProject).toHaveAttribute("data-cursor", "open");
    expect(openProject).not.toHaveAttribute("data-cursor-color", "#3b82f6");
  });

  it("completes with the authenticated actor and responsible snapshot", async () => {
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Cambiar estado de Campaña Glow/i }));
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(updateAsync).toHaveBeenCalledWith("p1", expect.objectContaining({
      status: "done", completedBy: "00000000-0000-4000-8000-000000000001", completedResponsibleUsernames: ["bryan", "cielo"],
    })));
  });

  it("filters completed projects by responsible snapshot", async () => {
    projects = [completedGlow(), completedElizabeth()];
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Completados/i }));
    fireEvent.click(screen.getByRole("button", { name: /Cielo/i }));
    expect(screen.getByText("Campaña Glow")).toBeInTheDocument();
    expect(screen.queryByText("Proyecto Elizabeth")).not.toBeInTheDocument();
  });

  it("renders a completed project once when its lead is also in the snapshot", () => {
    projects = [completedGlow()];
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Completados/i }));
    expect(screen.getAllByText("Campaña Glow")).toHaveLength(1);
  });

  it("reopens a completed project and clears completion audit", async () => {
    projects = [completedGlow()];
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Completados/i }));
    fireEvent.click(screen.getByRole("button", { name: /Reabrir Campaña Glow/i }));
    await waitFor(() => expect(updateAsync).toHaveBeenCalledWith("p1", expect.objectContaining({
      status: "doing", completedAt: undefined, completedBy: undefined,
      completedResponsibleUsernames: undefined,
    })));
  });

  it("retains the editor and reports a failed async save", async () => {
    updateAsync.mockResolvedValueOnce({ ok: false, error: "sin conexión" });
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Editar Campaña Glow/i }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("sin conexión");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
