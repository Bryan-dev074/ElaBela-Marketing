import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import type { DailyTask, TaskState } from "@/lib/data";

vi.stubGlobal("React", React);
vi.stubGlobal("IntersectionObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

const mocks = vi.hoisted(() => ({
  addAsync: vi.fn(),
  updateAsync: vi.fn(),
  removeAsync: vi.fn(),
  transition: vi.fn(),
  clearError: vi.fn(),
  logError: null as string | null,
}));

const tasks: DailyTask[] = [
  { id: "unassigned", name: "Idea pendiente", icon: "💡", assignee: null },
  { id: "fixed", name: "Publicar reel", icon: "🎬", assignee: "cielo", postType: "reel" },
  { id: "rotating", name: "Responder mensajes", icon: "💬", assignee: "cielo", rotation: ["cielo", "elizabeth"] },
];

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    useDailyTasks: () => ({
      items: tasks,
      addAsync: mocks.addAsync,
      updateAsync: mocks.updateAsync,
      removeAsync: mocks.removeAsync,
      error: null,
      clearError: vi.fn(),
      ready: true,
    }),
    useDailyTaskLogs: () => ({
      logs: [],
      loading: false,
      error: mocks.logError,
      clearError: mocks.clearError,
      stateFor: (id: string): TaskState => id === "fixed" ? "doing" : "todo",
      transition: mocks.transition,
    }),
    usePostTypes: () => ({ items: [{ id: "reel", name: "Reel", icon: "🎥", desc: "Video", accent: "#d6ab99", exampleImages: [], guide: "", toolIds: [] }] }),
    useProjects: () => ({ items: [] }),
    useStoryConfig: () => ({ items: [], update: vi.fn() }),
  };
});

vi.mock("@/lib/profiles", () => ({
  useProfiles: () => ({
    profiles: [
      { id: "u1", username: "bryan", fullName: "Bryan", role: "admin" },
      { id: "u2", username: "cielo", fullName: "Cielo", role: "marketer" },
      { id: "u3", username: "elizabeth", fullName: "Elizabeth", role: "marketer" },
    ],
    byUsername: (username: string) => ({ id: username, username, fullName: username, role: "marketer" }),
    ready: true,
  }),
}));

vi.mock("@/lib/useToday", () => ({ useToday: () => "2026-07-20" }));
vi.mock("@/components/IconPicker", () => ({ IconPicker: () => <button type="button">Ícono</button> }));

import TareasView from "@/components/views/TareasView";
import DashboardView from "@/components/views/DashboardView";

describe("daily task views", () => {
  beforeEach(() => {
    mocks.addAsync.mockReset().mockResolvedValue({ ok: true });
    mocks.updateAsync.mockReset().mockResolvedValue({ ok: true });
    mocks.removeAsync.mockReset().mockResolvedValue({ ok: true });
    mocks.transition.mockReset().mockResolvedValue({ ok: true });
    mocks.clearError.mockReset();
    mocks.logError = null;
  });

  it("creates a daily definition as Sin asignar without defaulting to a profile", async () => {
    render(<TareasView role="admin" username="bryan" userId="11111111-1111-1111-1111-111111111111" />);
    fireEvent.click(screen.getAllByRole("button", { name: /nueva tarea/i })[0]);
    expect(screen.getByRole("button", { name: "Sin asignar" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Preparar propuesta" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Guardar" })); });
    expect(mocks.addAsync).toHaveBeenCalledWith(expect.objectContaining({ name: "Preparar propuesta", assignee: null }));
  });

  it("leads management with unassigned work and exposes direct actions", () => {
    render(<TareasView role="admin" username="bryan" userId="11111111-1111-1111-1111-111111111111" />);
    fireEvent.click(screen.getByRole("button", { name: /gestión de tareas diarias/i }));
    const groups = screen.getAllByTestId("daily-management-group");
    expect(groups[0]).toHaveTextContent("Sin asignar");
    expect(groups[0]).toHaveTextContent("Idea pendiente");
    expect(within(groups[0]).getByRole("button", { name: /asignar idea pendiente/i })).toBeInTheDocument();
    expect(within(groups[0]).getByRole("button", { name: /editar idea pendiente/i })).toBeInTheDocument();
    expect(within(groups[0]).getByRole("button", { name: /eliminar idea pendiente/i })).toBeInTheDocument();
  });

  it("excludes unassigned work from queues and persists state only through the daily log", () => {
    render(<TareasView role="admin" username="bryan" userId="11111111-1111-1111-1111-111111111111" />);
    fireEvent.click(screen.getByRole("button", { name: /equipo/i }));
    expect(screen.queryByText("Idea pendiente")).not.toBeInTheDocument();
    expect(screen.getByText("Publicar reel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar estado de Publicar reel" }));
    expect(mocks.transition).toHaveBeenCalledWith(tasks[1], "done", "11111111-1111-1111-1111-111111111111");
    expect(mocks.updateAsync).not.toHaveBeenCalledWith("fixed", expect.objectContaining({ state: expect.anything() }));
  });

  it("shows daily-log errors accessibly", () => {
    mocks.logError = "No se pudo guardar";
    render(<TareasView role="admin" username="bryan" userId="11111111-1111-1111-1111-111111111111" />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar");
  });

  it("excludes unassigned definitions from dashboard totals, rows, and profile progress", () => {
    render(<DashboardView name="Bryan" username="bryan" userId="11111111-1111-1111-1111-111111111111" role="admin" />);
    expect(screen.queryByText("Idea pendiente")).not.toBeInTheDocument();
    expect(screen.getByText("Responder mensajes")).toBeInTheDocument();
    expect(screen.getAllByText(/0\/1|1\/1/).length).toBeGreaterThan(0);
  });
});
