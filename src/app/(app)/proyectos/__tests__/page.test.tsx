import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

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

const activeSol = (): Project => ({
  ...activeGlow(),
  id: "p2",
  name: "Campaña Sol",
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
  afterEach(cleanup);

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

    const openProject = screen.getByRole("button", { name: "Abrir proyecto Campaña Glow" });
    expect(openProject).toHaveAttribute("data-cursor", "open");
    expect(openProject).not.toHaveAttribute("data-cursor-color", "#3b82f6");
  });

  it("opens the integrated Project Studio from the card surface", () => {
    render(<ProjectsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir proyecto Campaña Glow" }));

    const dialog = screen.getByRole("dialog", { name: "Campaña Glow" });
    expect(dialog).toHaveClass("max-w-5xl");
    expect(within(dialog).getByText("Presentar la línea Glow")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Editar proyecto" })).toBeInTheDocument();
  });

  it("changes project status from inside the detail", async () => {
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir proyecto Campaña Glow" }));
    const dialog = screen.getByRole("dialog", { name: "Campaña Glow" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Sin empezar" }));

    await waitFor(() => expect(updateAsync).toHaveBeenCalledWith("p1", expect.objectContaining({ status: "todo" })));
  });

  it("toggles a step from inside the detail", async () => {
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir proyecto Campaña Glow" }));
    const dialog = screen.getByRole("dialog", { name: "Campaña Glow" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Completar paso: Diseñar piezas" }));

    await waitFor(() => expect(updateAsync).toHaveBeenCalledWith("p1", expect.objectContaining({
      status: "done",
      steps: [{ label: "Diseñar piezas", done: true }],
    })));
  });

  it("hands the detail off to the structured editor", () => {
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir proyecto Campaña Glow" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar proyecto" }));

    expect(screen.getByRole("dialog", { name: "Editar proyecto" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Paso 01" })).toHaveValue("Diseñar piezas");
  });

  it("keeps the studio open when the last step completes the project", async () => {
    updateAsync.mockImplementationOnce(async (id: string, patch: Project) => {
      projects = projects.map((item) => item.id === id ? { ...item, ...patch } : item);
      return { ok: true };
    });
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir proyecto Campaña Glow" }));

    const dialog = screen.getByRole("dialog", { name: "Campaña Glow" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Completar paso: Diseñar piezas" }));

    await waitFor(() => expect(screen.getByRole("dialog", { name: "Campaña Glow" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Reabrir proyecto" })).toBeInTheDocument();
    expect(screen.getByText(/Completado el/i)).toBeInTheDocument();
  });

  it("keeps active completion semantics and blocks a second mutation during an optimistic completion", async () => {
    const update = deferred<{ ok: true }>();
    updateAsync.mockImplementationOnce((id: string, patch: Project) => {
      projects = projects.map((item) => item.id === id ? { ...item, ...patch } : item);
      return update.promise;
    });
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir proyecto Campaña Glow" }));
    const dialog = screen.getByRole("dialog", { name: "Campaña Glow" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Completar proyecto" }));

    await waitFor(() => expect(updateAsync).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByRole("button", { name: "Completando…" })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Reabrir proyecto" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Editar proyecto" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Sin empezar" }));
    expect(updateAsync).toHaveBeenCalledTimes(1);
  });

  it("keeps completed reopen semantics while its optimistic update is pending", async () => {
    const update = deferred<{ ok: true }>();
    projects = [completedGlow()];
    updateAsync.mockImplementationOnce((id: string, patch: Project) => {
      projects = projects.map((item) => item.id === id ? { ...item, ...patch } : item);
      return update.promise;
    });
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Completados/i }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir proyecto Campaña Glow" }));
    const dialog = screen.getByRole("dialog", { name: "Campaña Glow" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Reabrir proyecto" }));

    await waitFor(() => expect(updateAsync).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByRole("button", { name: "Reabriendo…" })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Completar proyecto" })).not.toBeInTheDocument();
  });

  it("keeps last-step auto-completion in locked active semantics until its save resolves", async () => {
    const update = deferred<{ ok: true }>();
    updateAsync.mockImplementationOnce((id: string, patch: Project) => {
      projects = projects.map((item) => item.id === id ? { ...item, ...patch } : item);
      return update.promise;
    });
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir proyecto Campaña Glow" }));
    const dialog = screen.getByRole("dialog", { name: "Campaña Glow" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Completar paso: Diseñar piezas" }));

    await waitFor(() => expect(updateAsync).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByRole("button", { name: "Completar proyecto" })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Reabrir proyecto" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Completar proyecto" }));
    expect(updateAsync).toHaveBeenCalledTimes(1);
  });

  it("keeps A locked when B resolves while both project saves are pending", async () => {
    const first = deferred<{ ok: true }>();
    const second = deferred<{ ok: true }>();
    projects = [activeGlow(), activeSol()];
    updateAsync.mockImplementation((id: string) => id === "p1" ? first.promise : second.promise);
    render(<ProjectsPage />);

    const cardA = screen.getByRole("article", { name: "Campaña Glow" });
    fireEvent.click(within(cardA).getByRole("button", { name: "Cambiar estado de Campaña Glow" }));
    fireEvent.click(within(cardA).getByRole("button", { name: "Sin empezar" }));
    await waitFor(() => expect(updateAsync).toHaveBeenCalledTimes(1));

    const cardB = screen.getByRole("article", { name: "Campaña Sol" });
    fireEvent.click(within(cardB).getByRole("button", { name: "Cambiar estado de Campaña Sol" }));
    fireEvent.click(within(cardB).getByRole("button", { name: "Sin empezar" }));
    await waitFor(() => expect(updateAsync).toHaveBeenCalledTimes(2));

    await act(async () => {
      second.resolve({ ok: true });
      await second.promise;
    });

    const statusA = within(cardA).getByRole("button", { name: "Cambiar estado de Campaña Glow" });
    expect(statusA).toBeDisabled();
    fireEvent.click(statusA);
    expect(updateAsync).toHaveBeenCalledTimes(2);
  });

  it("keeps a failed A error out of B and restores it when A opens after B operates", async () => {
    const first = deferred<{ ok: false; error: string }>();
    const second = deferred<{ ok: true }>();
    projects = [activeGlow(), activeSol()];
    updateAsync.mockImplementation((id: string) => id === "p1" ? first.promise : second.promise);
    render(<ProjectsPage />);

    const cardA = screen.getByRole("article", { name: "Campaña Glow" });
    fireEvent.click(within(cardA).getByRole("button", { name: "Cambiar estado de Campaña Glow" }));
    fireEvent.click(within(cardA).getByRole("button", { name: "Sin empezar" }));
    await waitFor(() => expect(updateAsync).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Abrir proyecto Campaña Sol" }));
    const dialogB = screen.getByRole("dialog", { name: "Campaña Sol" });
    await act(async () => {
      first.resolve({ ok: false, error: "Fallo de A" });
      await first.promise;
    });

    expect(within(dialogB).queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(within(dialogB).getByRole("button", { name: "Sin empezar" }));
    await waitFor(() => expect(updateAsync).toHaveBeenCalledTimes(2));
    fireEvent.click(within(dialogB).getByRole("button", { name: "Cerrar" }));

    fireEvent.click(screen.getByRole("button", { name: "Abrir proyecto Campaña Glow" }));
    const dialogA = screen.getByRole("dialog", { name: "Campaña Glow" });
    expect(within(dialogA).getByRole("alert")).toHaveTextContent("Fallo de A");
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

  it("makes the selected completed profile visually distinct", () => {
    projects = [completedGlow(), completedElizabeth()];
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Completados/i }));

    const cielo = screen.getByRole("button", { name: "Cielo" });
    fireEvent.click(cielo);

    expect(cielo).toHaveAttribute("aria-pressed", "true");
    expect(cielo).toHaveClass("border-nude/50", "bg-nude/10", "text-white");
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "false");
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
    fireEvent.click(screen.getByRole("button", { name: /Reabrir proyecto Campaña Glow/i }));
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

  it("opens a new project with Paso 01 instead of the newline steps textarea", () => {
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Nuevo proyecto/i }));

    expect(screen.getByRole("textbox", { name: "Paso 01" })).toBeInTheDocument();
    expect(screen.queryByText("Pasos (uno por línea)")).not.toBeInTheDocument();
  });

  it("saves entered structured rows with the authenticated user as owner", async () => {
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Nuevo proyecto/i }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Lanzamiento Glow" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Paso 01" }), { target: { value: "Preparar piezas" } });
    fireEvent.click(screen.getByRole("button", { name: "Añadir paso" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Paso 02" }), { target: { value: "Publicar" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(addAsync).toHaveBeenCalledWith(expect.objectContaining({
      owner: "bryan",
      steps: [
        { label: "Preparar piezas", done: false },
        { label: "Publicar", done: false },
      ],
    })));
  });

  it("defaults the new project owner to the current username", () => {
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Nuevo proyecto/i }));

    expect(screen.getByRole("button", { name: "bryan" })).toBeInTheDocument();
  });

  it("trims step labels while preserving a matching completed step", async () => {
    projects = [{ ...activeGlow(), steps: [{ label: " Preparar piezas ", done: true }, { label: "Publicar", done: false }] }];
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Editar Campaña Glow/i }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(updateAsync).toHaveBeenCalledWith("p1", expect.objectContaining({
      steps: [
        { label: "Preparar piezas", done: true },
        { label: "Publicar", done: false },
      ],
    })));
  });

  it("retains the structured draft after a failed save for retry", async () => {
    addAsync.mockResolvedValueOnce({ ok: false, error: "sin conexión" });
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Nuevo proyecto/i }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Lanzamiento Glow" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Paso 01" }), { target: { value: "Preparar piezas" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("sin conexión");
    expect(screen.getByRole("textbox", { name: "Paso 01" })).toHaveValue("Preparar piezas");
  });

  it("keeps the structured draft locked while a save is pending", async () => {
    addAsync.mockImplementationOnce(() => new Promise(() => {}));
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Nuevo proyecto/i }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Lanzamiento Glow" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "bryan" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Listo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Nota" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Nota" }));
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));

    expect(screen.getByRole("textbox", { name: "Paso 01" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nuevo proyecto/i })).toBeDisabled();
  });
});
