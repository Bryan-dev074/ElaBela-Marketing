# Projects and Gemini Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar Proyectos con responsables múltiples, metadatos, finalización auditable, vistas de completados, calendario compacto y generación segura de notas Markdown mediante Gemini.

**Architecture:** Mantener `owner` y la tabla `projects` existentes, sumar columnas aditivas y concentrar todas las reglas en funciones puras de `src/lib/projects.ts`. La UI continúa usando `useCollection`, pero las transiciones importantes esperan `addAsync`/`updateAsync` para informar rollback. Gemini se consume únicamente desde un Route Handler autenticado con un contrato JSON estable.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Supabase Postgres/Auth/SSR, Vitest + Testing Library, Playwright, REST de Gemini Interactions API v1.

## Global Constraints

- Conservar el diseño visual actual; no realizar un rediseño global.
- `owner` sigue siendo responsable principal obligatoria; `responsibleUsernames` contiene responsables adicionales únicas y nunca repite `owner`.
- Tipos: `campaign`, `launch`, `content`, `brand-design`, `web-ecommerce`, `event`, `crm`, `operations`, `other`.
- Prioridades: `low`, `normal`, `high`, `urgent`.
- Modos de contenido: `steps` y `note`; `Solo nota` no es un tipo de proyecto.
- Completar guarda `completedAt`, `completedBy` y la instantánea única de responsables; completar de nuevo es idempotente y reabrir limpia los tres campos.
- Completados se filtra por `completedResponsibleUsernames`, nunca por `completedBy`.
- Un terminado sin fecha confiable pertenece a `Anteriores` y no entra en métricas ni calendario.
- No crear, mostrar ni recuperar funcionalidad de proyectos semanales.
- Bandeja y modal de calendario solo agendan proyectos `todo` no archivados; la bandeja comienza plegada.
- Un proyecto `done` aparece una sola vez en calendario, en la fecha paraguaya de `completedAt`, y no en `due`.
- Gemini usa `POST https://generativelanguage.googleapis.com/v1/interactions`, `store: false`, modelo predeterminado `gemini-3.5-flash`, timeout de 20 segundos y salida máxima validada de 6.000 caracteres.
- `GEMINI_API_KEY` y `GEMINI_MODEL` son variables exclusivamente de servidor; ninguna clave se incorpora al repositorio o bundle cliente.
- La nota generada está en español, tiene entre 250 y 500 palabras, usa encabezados Markdown breves y prosa descriptiva; no presenta pasos, checklist ni instrucciones numeradas.
- Cada cambio de comportamiento sigue RED → GREEN → REFACTOR y cada tarea termina en un commit revisable.

---

## File Structure

- Create: `src/lib/projects.ts` — reglas de responsables, transiciones, clasificación, filtros y ocurrencias de calendario.
- Create: `src/lib/__tests__/projects.test.ts` — contrato puro del dominio.
- Modify: `src/lib/data.ts` — tipos y semillas compatibles.
- Modify: `src/lib/db.ts` — mapeadores exportados y hook de proyectos.
- Modify: `src/lib/__tests__/db-mappers.test.ts` — round-trip y fallbacks de filas.
- Create: `src/lib/__tests__/project-schema.test.ts` — paridad estática entre migración y esquema canónico.
- Create: `supabase/migrations/*_expand_projects.sql` — el único archivo cuyo nombre exacto imprime `npx supabase migration new expand_projects`.
- Modify: `supabase/schema.sql` — estado canónico de la tabla.
- Create: `src/components/ProjectResponsiblePicker.tsx` — selector múltiple accesible.
- Create: `src/components/__tests__/ProjectResponsiblePicker.test.tsx` — selección y deduplicación.
- Modify: `src/components/Avatar.tsx` — nombre accesible de pilas de avatares.
- Modify: `src/app/(app)/proyectos/page.tsx` — formulario, vistas y transiciones.
- Create: `src/app/(app)/proyectos/__tests__/page.test.tsx` — recorridos de Proyectos y Solo nota.
- Modify: `src/app/(app)/calendario/page.tsx` — acordeón, lista agendable y finalizaciones.
- Create: `src/app/(app)/calendario/__tests__/page.test.tsx` — calendario compacto y ocurrencias.
- Create: `src/lib/project-note-api.ts` — contrato y cliente servidor de Gemini.
- Create: `src/lib/__tests__/project-note-api.test.ts` — validación, payload y extracción.
- Create: `src/app/api/projects/generate-note/route.ts` — frontera HTTP autenticada.
- Create: `src/app/api/projects/generate-note/__tests__/route.test.ts` — estados HTTP estables.
- Modify: `src/lib/supabase/middleware.ts` — permitir que el Route Handler devuelva su propio JSON 401.
- Create: `src/lib/__tests__/supabase-middleware.test.ts` — excepción exacta de la ruta.
- Modify: `.env.example` — variables Gemini documentadas sin valor real.
- Modify: `README.md` — configuración local y de Vercel.

### Task 1: Project domain and lifecycle

**Files:**
- Create: `src/lib/projects.ts`
- Create: `src/lib/__tests__/projects.test.ts`
- Modify: `src/lib/data.ts:138-188`

**Interfaces:**
- Produces: `normalizeAdditionalResponsibles`, `projectResponsibleSnapshot`, `transitionProjectStatus`, `toggleProjectStep`, `classifyProject`, `filterCompletedByResponsible`, `isProjectSchedulable`, `projectCalendarOccurrence`.
- Consumes: `Project`, `TaskState`, `paraguayDateKey`.

- [ ] **Step 1: Add the expanded compile-time model**

Add these exact types and fields to `src/lib/data.ts`:

```ts
export type ProjectType =
  | "campaign" | "launch" | "content" | "brand-design"
  | "web-ecommerce" | "event" | "crm" | "operations" | "other";

export type ProjectPriority = "low" | "normal" | "high" | "urgent";

export interface Project {
  id: string;
  name: string;
  owner: string;
  responsibleUsernames: string[];
  projectType: ProjectType;
  priority: ProjectPriority;
  objective?: string;
  status: "todo" | "doing" | "done";
  createdAt: string;
  startDate?: string;
  due?: string;
  archived?: boolean;
  completedAt?: string;
  completedBy?: string;
  completedResponsibleUsernames?: string[];
  contentMode: "steps" | "note";
  steps: ProjectStep[];
  note?: string;
}
```

Update every local seed with `responsibleUsernames: []`, `projectType: "other"`, and `priority: "normal"`; retain `pr3` as `done + archived` without `completedAt` to exercise legacy classification.

- [ ] **Step 2: Write the failing domain tests**

Create `src/lib/__tests__/projects.test.ts` with a shared builder and explicit cases:

```ts
import { describe, expect, it } from "vitest";
import type { Project } from "@/lib/data";
import {
  classifyProject,
  filterCompletedByResponsible,
  isProjectSchedulable,
  normalizeAdditionalResponsibles,
  projectCalendarOccurrence,
  projectResponsibleSnapshot,
  toggleProjectStep,
  transitionProjectStatus,
} from "@/lib/projects";

const project = (patch: Partial<Project> = {}): Project => ({
  id: "p1", name: "Campaña Glow", owner: "bryan",
  responsibleUsernames: [], projectType: "campaign", priority: "normal",
  status: "todo", createdAt: "2026-07-20", contentMode: "steps",
  steps: [{ label: "Diseño", done: false }], ...patch,
});

describe("project domain", () => {
  const ACTOR_ID = "00000000-0000-4000-8000-000000000001";
  const OTHER_ACTOR_ID = "00000000-0000-4000-8000-000000000002";

  it("normalizes additional responsibles without owner, blanks, or duplicates", () => {
    expect(normalizeAdditionalResponsibles("bryan", [" cielo ", "bryan", "cielo", ""])).toEqual(["cielo"]);
  });

  it("completes once with actor, timestamp, and responsible snapshot", () => {
    const now = new Date("2026-07-20T15:00:00.000Z");
    const completed = transitionProjectStatus(project({ responsibleUsernames: ["cielo"] }), "done", ACTOR_ID, now);
    expect(completed).toMatchObject({
      status: "done", completedAt: now.toISOString(), completedBy: ACTOR_ID,
      completedResponsibleUsernames: ["bryan", "cielo"],
    });
    expect(transitionProjectStatus(completed, "done", OTHER_ACTOR_ID, new Date("2026-07-21T15:00:00Z"))).toBe(completed);
  });

  it("clears every completion field when reopened", () => {
    const reopened = transitionProjectStatus(project({
      status: "done", completedAt: "2026-07-20T15:00:00Z", completedBy: ACTOR_ID,
      completedResponsibleUsernames: ["bryan"],
    }), "doing", OTHER_ACTOR_ID, new Date());
    expect(reopened).toMatchObject({ status: "doing" });
    expect(reopened.completedAt).toBeUndefined();
    expect(reopened.completedBy).toBeUndefined();
    expect(reopened.completedResponsibleUsernames).toBeUndefined();
  });

  it("uses the lifecycle transition when the last checklist item is toggled", () => {
    const completed = toggleProjectStep(project(), 0, ACTOR_ID, new Date("2026-07-20T15:00:00Z"));
    expect(completed.status).toBe("done");
    expect(completed.completedAt).toBe("2026-07-20T15:00:00.000Z");
  });

  it("classifies active, completed, previous, and hidden rows", () => {
    expect(classifyProject(project())).toBe("active");
    expect(classifyProject(project({ status: "done", completedAt: "2026-07-20T15:00:00Z" }))).toBe("completed");
    expect(classifyProject(project({ status: "done", completedAt: "not-a-date" }))).toBe("previous");
    expect(classifyProject(project({ status: "done", archived: true }))).toBe("previous");
    expect(classifyProject(project({ archived: true }))).toBe("hidden");
  });

  it("filters completed projects by responsible-at-completion", () => {
    const rows = [
      project({ id: "a", status: "done", completedAt: "2026-07-20T15:00:00Z", completedResponsibleUsernames: ["bryan", "cielo"] }),
      project({ id: "b", status: "done", completedAt: "2026-07-19T15:00:00Z", completedResponsibleUsernames: ["elizabeth"] }),
    ];
    expect(filterCompletedByResponsible(rows, "cielo").map(({ id }) => id)).toEqual(["a"]);
  });

  it("only exposes todo non-archived projects for scheduling", () => {
    expect(isProjectSchedulable(project())).toBe(true);
    expect(isProjectSchedulable(project({ status: "doing" }))).toBe(false);
    expect(isProjectSchedulable(project({ status: "done" }))).toBe(false);
    expect(isProjectSchedulable(project({ archived: true }))).toBe(false);
  });

  it("uses due for active work and completedAt for done work without duplication", () => {
    expect(projectCalendarOccurrence(project({ status: "doing", due: "2026-08-15" }))).toEqual({ date: "2026-08-15", kind: "due" });
    expect(projectCalendarOccurrence(project({
      status: "done", due: "2026-08-15", completedAt: "2026-08-01T02:30:00.000Z",
    }))).toEqual({ date: "2026-07-31", kind: "completed" });
  });

  it("omits archived, malformed, and undated legacy completions from calendar", () => {
    expect(projectCalendarOccurrence(project({ archived: true, due: "2026-08-15" }))).toBeNull();
    expect(projectCalendarOccurrence(project({ status: "done" }))).toBeNull();
    expect(projectCalendarOccurrence(project({ status: "done", completedAt: "not-a-date" }))).toBeNull();
  });

  it("builds a unique responsible snapshot", () => {
    expect(projectResponsibleSnapshot(project({ responsibleUsernames: ["cielo", "cielo"] }))).toEqual(["bryan", "cielo"]);
  });

  it("rejects completion without a valid authenticated UUID", () => {
    expect(() => transitionProjectStatus(project(), "done", "not-a-uuid", new Date())).toThrow(/usuario autenticado válido/i);
  });
});
```

- [ ] **Step 3: Run the tests and verify RED**

Run: `npm test -- src/lib/__tests__/projects.test.ts`

Expected: FAIL because `@/lib/projects` does not exist.

- [ ] **Step 4: Implement the pure domain**

Create `src/lib/projects.ts` with these exported contracts and branch rules:

```ts
import type { Project, TaskState } from "@/lib/data";
import { paraguayDateKey } from "@/lib/paraguay-time";

export type ProjectSection = "active" | "completed" | "previous" | "hidden";
export type ProjectCalendarOccurrence = { date: string; kind: "due" | "completed" };

const normalizeUsername = (value: string) => value.trim();
const unique = (values: string[]) => [...new Set(values.map(normalizeUsername).filter(Boolean))];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeAdditionalResponsibles(owner: string, usernames: string[]): string[] {
  const normalizedOwner = normalizeUsername(owner);
  return unique(usernames).filter((username) => username !== normalizedOwner);
}

export function projectResponsibleSnapshot(project: Project): string[] {
  return unique([project.owner, ...normalizeAdditionalResponsibles(project.owner, project.responsibleUsernames)]);
}

export function transitionProjectStatus(
  project: Project,
  nextStatus: TaskState,
  actorId: string,
  now: Date,
): Project {
  if (project.status === nextStatus) return project;
  if (nextStatus === "done") {
    if (!UUID.test(actorId)) {
      throw new Error("No hay un usuario autenticado válido para completar el proyecto.");
    }
    return {
      ...project,
      status: "done",
      completedAt: now.toISOString(),
      completedBy: actorId,
      completedResponsibleUsernames: projectResponsibleSnapshot(project),
    };
  }
  if (project.status === "done") {
    const { completedAt: _at, completedBy: _by, completedResponsibleUsernames: _responsibles, ...reopened } = project;
    return { ...reopened, status: nextStatus };
  }
  return { ...project, status: nextStatus };
}

export function toggleProjectStep(
  project: Project,
  stepIndex: number,
  actorId: string,
  now: Date,
): Project {
  const steps = project.steps.map((step, index) => index === stepIndex ? { ...step, done: !step.done } : step);
  const nextStatus: TaskState = steps.length > 0 && steps.every(({ done }) => done)
    ? "done"
    : steps.some(({ done }) => done) ? "doing" : "todo";
  return transitionProjectStatus({ ...project, steps }, nextStatus, actorId, now);
}

export function classifyProject(project: Project): ProjectSection {
  if (project.status === "done") {
    const instant = project.completedAt ? new Date(project.completedAt) : null;
    return instant && !Number.isNaN(instant.getTime()) ? "completed" : "previous";
  }
  if (project.archived) return "hidden";
  return "active";
}

export function filterCompletedByResponsible(projects: Project[], username?: string): Project[] {
  const completed = projects
    .filter((project) => classifyProject(project) === "completed")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  return username
    ? completed.filter((project) => project.completedResponsibleUsernames?.includes(username))
    : completed;
}

export function isProjectSchedulable(project: Project): boolean {
  return project.status === "todo" && !project.archived;
}

export function projectCalendarOccurrence(project: Project): ProjectCalendarOccurrence | null {
  if (project.archived) return null;
  if (project.status === "done") {
    if (!project.completedAt) return null;
    const instant = new Date(project.completedAt);
    return Number.isNaN(instant.getTime()) ? null : { date: paraguayDateKey(instant), kind: "completed" };
  }
  return project.due ? { date: project.due, kind: "due" } : null;
}
```

- [ ] **Step 5: Run the directed and full tests**

Run: `npm test -- src/lib/__tests__/projects.test.ts`

Expected: PASS, 9 tests.

Run: `npm test`

Expected: all existing suites pass after seed fixtures are updated.

- [ ] **Step 6: Commit the domain slice**

```powershell
git add src/lib/data.ts src/lib/projects.ts src/lib/__tests__/projects.test.ts
git commit -m "feat: add project lifecycle domain"
```

### Task 2: Project persistence and additive migration

**Files:**
- Create: `supabase/migrations/*_expand_projects.sql` through the CLI command below; after creation, use the exact path printed by the CLI
- Modify: `supabase/schema.sql:86-104,703-704`
- Modify: `src/lib/db.ts:357-364`
- Modify: `src/lib/__tests__/db-mappers.test.ts`
- Create: `src/lib/__tests__/project-schema.test.ts`

**Interfaces:**
- Produces: `projectFromRow(row): Project`, `projectToRow(project): Record<string, unknown>`.
- Consumes: expanded `Project` from Task 1.

- [ ] **Step 1: Generate the migration filename with the installed CLI**

Run: `npx --yes supabase@latest migration new expand_projects`

Expected: exactly one new `supabase/migrations/*_expand_projects.sql` file. Use the path printed by the CLI for every command in this task; do not invent or rename the timestamp.

- [ ] **Step 2: Write failing mapper and schema tests**

Add a `project mapper` describe block to `src/lib/__tests__/db-mappers.test.ts`:

```ts
it("maps expanded project rows and preserves completion snapshots", () => {
  const mapped = projectFromRow({
    id: "p1", name: "Glow", owner: "bryan", responsible_usernames: ["cielo"],
    project_type: "campaign", priority: "high", objective: "Relanzar",
    status: "done", created_at: "2026-07-01", start_date: "2026-07-02", due_date: "2026-07-20",
    archived: false, completed_at: "2026-07-19T20:00:00Z", completed_by: "00000000-0000-4000-8000-000000000001",
    completed_responsible_usernames: ["bryan", "cielo"], content_mode: "note", steps: [], note: "# Glow",
  });
  expect(mapped).toMatchObject({
    responsibleUsernames: ["cielo"], projectType: "campaign", priority: "high",
    objective: "Relanzar", startDate: "2026-07-02", completedBy: "00000000-0000-4000-8000-000000000001",
    completedResponsibleUsernames: ["bryan", "cielo"],
  });
  expect(projectToRow(mapped)).toMatchObject({
    responsible_usernames: ["cielo"], project_type: "campaign", priority: "high",
    completed_responsible_usernames: ["bryan", "cielo"],
  });
});

it("applies safe defaults to legacy project rows without fabricating completion data", () => {
  const mapped = projectFromRow({
    id: "legacy", name: "Anterior", owner: "bryan", status: "done",
    created_at: "2026-06-01", archived: true, content_mode: "steps", steps: [],
  });
  expect(mapped).toMatchObject({ responsibleUsernames: [], projectType: "other", priority: "normal" });
  expect(mapped.completedAt).toBeUndefined();
  expect(mapped.completedResponsibleUsernames).toBeUndefined();
});
```

Create `src/lib/__tests__/project-schema.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const schema = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8").toLowerCase();

describe("expanded project schema", () => {
  it.each([
    "responsible_usernames", "completed_responsible_usernames", "project_type",
    "priority", "objective", "start_date", "completed_at", "completed_by",
  ])("contains %s in the canonical schema", (column) => expect(schema).toContain(column));

  it("indexes dated completions", () => {
    expect(schema).toContain("projects_completed_at_idx");
    expect(schema).toContain("where status = 'done'");
  });
});
```

- [ ] **Step 3: Verify RED**

Run: `npm test -- src/lib/__tests__/db-mappers.test.ts src/lib/__tests__/project-schema.test.ts`

Expected: FAIL because the exports and columns do not exist.

- [ ] **Step 4: Write the additive SQL in both schema sources**

Place this SQL in the CLI-generated migration and mirror its final state in `supabase/schema.sql`:

```sql
alter table public.projects add column if not exists responsible_usernames text[] not null default '{}';
alter table public.projects add column if not exists completed_responsible_usernames text[];
alter table public.projects add column if not exists project_type text not null default 'other';
alter table public.projects add column if not exists priority text not null default 'normal';
alter table public.projects add column if not exists objective text;
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists completed_at timestamptz;
alter table public.projects add column if not exists completed_by uuid references public.profiles(id) on delete set null;

do $$ begin
  alter table public.projects add constraint projects_project_type_check
    check (project_type in ('campaign','launch','content','brand-design','web-ecommerce','event','crm','operations','other'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.projects add constraint projects_priority_check
    check (priority in ('low','normal','high','urgent'));
exception when duplicate_object then null; end $$;

create index if not exists projects_completed_at_idx
  on public.projects (completed_at desc) where status = 'done';

alter table public.projects enable row level security;
grant select, insert, update, delete on table public.projects to authenticated;
```

- [ ] **Step 5: Export exact mappers and wire `useProjects`**

In `src/lib/db.ts`, replace the anonymous mappers with:

```ts
const stringArray = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
  : [];

export function projectFromRow(r: Record<string, unknown>): Project {
  return {
    id: r.id as string,
    name: r.name as string,
    owner: (r.owner as string) || "",
    responsibleUsernames: stringArray(r.responsible_usernames),
    projectType: (r.project_type as Project["projectType"]) || "other",
    priority: (r.priority as Project["priority"]) || "normal",
    objective: (r.objective as string) || undefined,
    status: r.status as Project["status"],
    createdAt: (r.created_at as string)?.slice(0, 10),
    startDate: (r.start_date as string) || undefined,
    due: (r.due_date as string) || undefined,
    archived: !!r.archived,
    completedAt: (r.completed_at as string) || undefined,
    completedBy: (r.completed_by as string) || undefined,
    completedResponsibleUsernames: Array.isArray(r.completed_responsible_usernames)
      ? stringArray(r.completed_responsible_usernames) : undefined,
    contentMode: (r.content_mode as Project["contentMode"]) || "steps",
    steps: (r.steps as Project["steps"]) || [],
    note: (r.note as string) || undefined,
  };
}

export function projectToRow(p: Project): Record<string, unknown> {
  return {
    id: p.id, name: p.name, owner: p.owner,
    responsible_usernames: p.responsibleUsernames,
    project_type: p.projectType, priority: p.priority,
    objective: p.objective ?? null, status: p.status,
    created_at: p.createdAt, start_date: p.startDate ?? null, due_date: p.due ?? null,
    archived: !!p.archived, completed_at: p.completedAt ?? null,
    completed_by: p.completedBy ?? null,
    completed_responsible_usernames: p.completedResponsibleUsernames ?? null,
    content_mode: p.contentMode, steps: p.steps, note: p.note ?? null,
  };
}

export const useProjects = () => useCollection<Project>({
  table: "projects", seed: PROJECTS, order: { col: "created_at", asc: false },
  fromRow: projectFromRow, toRow: projectToRow,
});
```

- [ ] **Step 6: Run tests and migration checks**

Run: `npm test -- src/lib/__tests__/db-mappers.test.ts src/lib/__tests__/project-schema.test.ts`

Expected: PASS.

Run: `npx --yes supabase@latest migration list --linked`

Expected: the linked project is `uxeuipryacnwsqhegrrs`; if authentication is absent, stop before any remote change and complete login with the correct account.

Run: `npx --yes supabase@latest db push --linked --dry-run`

Expected: only unapplied repository migrations are listed. Do not run a remote push in this task unless the list matches the repository and the root agent authorizes the final integration step.

- [ ] **Step 7: Commit persistence**

```powershell
git add src/lib/db.ts src/lib/__tests__/db-mappers.test.ts src/lib/__tests__/project-schema.test.ts supabase/schema.sql supabase/migrations
git commit -m "feat: persist expanded projects"
```

### Task 3: Project responsible picker and project views

**Files:**
- Create: `src/components/ProjectResponsiblePicker.tsx`
- Create: `src/components/__tests__/ProjectResponsiblePicker.test.tsx`
- Modify: `src/components/Avatar.tsx:127-138`
- Modify: `src/app/(app)/proyectos/page.tsx`
- Create: `src/app/(app)/proyectos/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: domain and persistence contracts from Tasks 1–2.
- Produces: accessible multi-select and Activos/Completados/Anteriores UI.

- [ ] **Step 1: Write failing selector tests**

Create `src/components/__tests__/ProjectResponsiblePicker.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectResponsiblePicker } from "@/components/ProjectResponsiblePicker";

vi.mock("@/lib/profiles", () => ({
  useProfiles: () => ({ profiles: [
    { id: "1", username: "bryan", fullName: "Bryan" },
    { id: "2", username: "cielo", fullName: "Cielo" },
    { id: "3", username: "elizabeth", fullName: "Elizabeth" },
  ] }),
}));
vi.mock("@/components/Avatar", () => ({ Avatar: ({ username }: { username: string }) => <span>{username}</span> }));

describe("ProjectResponsiblePicker", () => {
  it("excludes the lead and toggles unique additional responsibles", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ProjectResponsiblePicker owner="bryan" value={[]} onChange={onChange} />);
    expect(screen.queryByRole("button", { name: /bryan/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cielo/i }));
    expect(onChange).toHaveBeenCalledWith(["cielo"]);
    rerender(<ProjectResponsiblePicker owner="bryan" value={["cielo"]} onChange={onChange} />);
    expect(screen.getByRole("button", { name: /cielo/i })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /cielo/i }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
```

- [ ] **Step 2: Verify selector RED and implement it**

Run: `npm test -- src/components/__tests__/ProjectResponsiblePicker.test.tsx`

Expected: FAIL because the component is missing.

Create `ProjectResponsiblePicker` with this public API:

```tsx
export type ProjectResponsiblePickerProps = {
  owner: string;
  value: string[];
  onChange: (usernames: string[]) => void;
  disabled?: boolean;
};
```

Map `profiles.filter(({ username }) => username !== owner)`, render each as a `button` with `aria-pressed`, and call `normalizeAdditionalResponsibles(owner, next)` before `onChange`. Use the same classes, avatar sizes and pressed styling as `OwnerPicker`.

Update `AvatarStack` to wrap its stack in `role="img"` and `aria-label={\`Responsables: ${usernames.join(", ")}\`}`.

Run: `npm test -- src/components/__tests__/ProjectResponsiblePicker.test.tsx`

Expected: PASS.

- [ ] **Step 3: Write failing project-page behavior tests**

Create `src/app/(app)/proyectos/__tests__/page.test.tsx` with mocked `useProjects`, `useUser`, `useProfiles`, and stable seed rows. Cover these exact assertions:

```tsx
it("shows active, completed, and previous sections without archive actions", async () => {
  render(<ProjectsPage />);
  expect(screen.getByRole("button", { name: /Activos/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Completados/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Anteriores/i })).toBeInTheDocument();
  expect(screen.queryByText(/Archivar|Restaurar/)).not.toBeInTheDocument();
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
  render(<ProjectsPage />);
  fireEvent.click(screen.getByRole("button", { name: /Completados/i }));
  fireEvent.click(screen.getByRole("button", { name: /Cielo/i }));
  expect(screen.getByText("Campaña Glow")).toBeInTheDocument();
  expect(screen.queryByText("Proyecto Elizabeth")).not.toBeInTheDocument();
});

it("reopens a completed project and clears completion audit", async () => {
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
```

- [ ] **Step 4: Verify page RED**

Run: `npm test -- "src/app/(app)/proyectos/__tests__/page.test.tsx"`

Expected: FAIL because the current page only classifies by `archived` and writes fire-and-forget.

- [ ] **Step 5: Implement the expanded page in the existing visual system**

Apply these exact state and data-flow contracts in `page.tsx`:

```ts
type ProjectTab = "active" | "completed" | "previous";
type Draft = {
  id: string; name: string; owner: string; responsibleUsernames: string[];
  projectType: ProjectType; priority: ProjectPriority; objective: string;
  startDate: string; due: string; status: TaskState;
  contentMode: "steps" | "note"; steps: string; note: string;
};

const active = projects.filter((project) => classifyProject(project) === "active");
const completed = filterCompletedByResponsible(projects, completedResponsible || undefined);
const previous = projects.filter((project) => classifyProject(project) === "previous");
```

Use `useUser().id` in every `transitionProjectStatus`. Use `toggleProjectStep` for checkbox changes. Persist with `await addAsync` or `await updateAsync`; disable the affected controls while a mutation is pending; on `{ok:false}`, keep the modal/detail state and show a `role="alert"` message.

The editor must render exact fields for name, type, priority, objective, start date, due date, lead `OwnerPicker`, additional `ProjectResponsiblePicker`, status and content mode. Before save, normalize additions and remove the lead. Completed cards render `completedAt`, type, priority, `AvatarStack`, and an accessible `Reabrir <nombre>` button. Previous cards are read-only for status. Remove the archive import, archive tabs, archive button, restore button and all writes to `archived`.

Build the completed-responsible filter options from the union of current profile usernames and every `completedResponsibleUsernames` snapshot. This keeps people who no longer have an active profile available as historical filters. Each completed project renders exactly once in `Completados`, including when its lead also appears in the snapshot.

- [ ] **Step 6: Run page and full tests**

Run: `npm test -- src/components/__tests__/ProjectResponsiblePicker.test.tsx "src/app/(app)/proyectos/__tests__/page.test.tsx"`

Expected: PASS.

Run: `npm test`

Expected: all suites pass.

- [ ] **Step 7: Commit the project UI**

```powershell
git add src/components/ProjectResponsiblePicker.tsx src/components/Avatar.tsx src/components/__tests__/ProjectResponsiblePicker.test.tsx "src/app/(app)/proyectos/page.tsx" "src/app/(app)/proyectos/__tests__/page.test.tsx"
git commit -m "feat: expand project management"
```

### Task 4: Compact project scheduling and completion calendar

**Files:**
- Modify: `src/app/(app)/calendario/page.tsx`
- Create: `src/app/(app)/calendario/__tests__/page.test.tsx`
- Test: `src/lib/__tests__/projects.test.ts`

**Interfaces:**
- Consumes: `isProjectSchedulable` and `projectCalendarOccurrence` from Task 1.
- Produces: one calendar occurrence per project and one shared schedulable collection.

- [ ] **Step 1: Write failing calendar tests**

Mock `useProjects` with one row per state and create these tests:

```tsx
it("starts with the pending project tray collapsed and exposes its count", () => {
  render(<CalendarioPage />);
  const tray = screen.getByRole("button", { name: /Proyectos pendientes/i });
  expect(tray).toHaveAttribute("aria-expanded", "false");
  expect(tray).toHaveTextContent("1");
  expect(screen.queryByText("Proyecto por hacer")).not.toBeInTheDocument();
});

it("shows only todo non-archived projects in tray and scheduling modal", () => {
  render(<CalendarioPage />);
  fireEvent.click(screen.getByRole("button", { name: /Proyectos pendientes/i }));
  expect(screen.getByText("Proyecto por hacer")).toBeInTheDocument();
  expect(screen.queryByText("Proyecto en curso")).not.toBeInTheDocument();
  expect(screen.queryByText("Proyecto completado")).not.toBeInTheDocument();
});

it("renders a completed project on completedAt without a deschedule action", () => {
  render(<CalendarioPage />);
  fireEvent.click(screen.getByRole("button", { name: /31/i }));
  expect(screen.getByText("Proyecto completado")).toBeInTheDocument();
  expect(screen.getByText("Completado")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Desagendar Proyecto completado/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run calendar tests and verify RED**

Run: `npm test -- src/lib/__tests__/projects.test.ts "src/app/(app)/calendario/__tests__/page.test.tsx"`

Expected: page tests FAIL against the always-expanded current tray.

- [ ] **Step 3: Implement a typed agenda and shared scheduling filter**

Replace `DayAgenda.projects: Project[]` with:

```ts
type CalendarProjectItem = { project: Project; kind: "due" | "completed" };
type DayAgenda = {
  special: SpecialDate[];
  projects: CalendarProjectItem[];
  guiones: Guion[];
  events: CalEventRow[];
};
```

Build the agenda and schedulable list exactly once:

```ts
for (const project of projects) {
  const occurrence = projectCalendarOccurrence(project);
  if (occurrence) at(occurrence.date).projects.push({ project, kind: occurrence.kind });
}

const schedulableProjects = useMemo(
  () => projects.filter(isProjectSchedulable),
  [projects],
);
```

Use `schedulableProjects` in both the drag tray and `Agendar proyecto` modal. In `dropOn`, resolve the project from the current collection and return without writing unless `isProjectSchedulable(project)` remains true.

- [ ] **Step 4: Implement the compact tray and occurrence rendering**

Add `const [trayOpen, setTrayOpen] = useState(false)`. Render the card header as one button with `aria-expanded`, `aria-controls="calendar-project-tray"`, label `Proyectos pendientes`, count, and a `ChevronDown` that rotates. Only mount the scrollable `max-h-72 overflow-y-auto` draggable list while open.

Adapt every `a.projects.map` to destructure `{ project, kind }`. A `completed` occurrence displays `Completado`, retains the done pill, and has no Desagendar action. A `due` occurrence keeps the delivery label and Desagendar action. Rename the day-modal heading from `Proyectos (entrega)` to `Proyectos`.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- src/lib/__tests__/projects.test.ts "src/app/(app)/calendario/__tests__/page.test.tsx"`

Expected: PASS.

Run: `npm test`

Expected: all suites pass.

```powershell
git add "src/app/(app)/calendario/page.tsx" "src/app/(app)/calendario/__tests__/page.test.tsx" src/lib/projects.ts src/lib/__tests__/projects.test.ts
git commit -m "feat: compact project calendar"
```

### Task 5: Authenticated Gemini server boundary

**Files:**
- Create: `src/lib/project-note-api.ts`
- Create: `src/lib/__tests__/project-note-api.test.ts`
- Create: `src/app/api/projects/generate-note/route.ts`
- Create: `src/app/api/projects/generate-note/__tests__/route.test.ts`
- Modify: `src/lib/supabase/middleware.ts`
- Create: `src/lib/__tests__/supabase-middleware.test.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces: `ProjectNoteApiResponse`, `ProjectNoteErrorCode`, `generateProjectNote(name, options)` and `POST(request)`.
- Consumes: `getUser()` and server-only environment variables.

- [ ] **Step 1: Write failing API-library tests**

Create `src/lib/__tests__/project-note-api.test.ts` and assert:

```ts
it("sends a stateless request and extracts the last model output", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    status: "completed",
    steps: [{ type: "model_output", content: [{ type: "text", text: "# Glow\n\n## Qué es\nTexto" }] }],
  }), { status: 200 }));
  const note = await generateProjectNote(" Glow ", { apiKey: "test-key", model: "gemini-test", fetchImpl });
  expect(note).toContain("# Glow");
  expect(fetchImpl).toHaveBeenCalledWith(
    "https://generativelanguage.googleapis.com/v1/interactions",
    expect.objectContaining({ method: "POST", cache: "no-store" }),
  );
  const init = fetchImpl.mock.calls[0][1];
  expect(JSON.parse(String(init.body))).toMatchObject({ model: "gemini-test", store: false });
  expect(new Headers(init.headers).get("x-goog-api-key")).toBe("test-key");
});

it.each([
  [401, "AI_NOT_CONFIGURED", false], [403, "AI_NOT_CONFIGURED", false],
  [429, "AI_QUOTA_EXCEEDED", true], [500, "AI_UNAVAILABLE", true],
])("maps provider status %s", async (status, code, retryable) => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response("provider detail", { status }));
  await expect(generateProjectNote("Glow", { apiKey: "key", fetchImpl }))
    .rejects.toMatchObject({ code, retryable });
});

it("rejects empty, incomplete, oversized, and malformed model output", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "completed", steps: [] })));
  await expect(generateProjectNote("Glow", { apiKey: "key", fetchImpl }))
    .rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
});
```

- [ ] **Step 2: Verify library RED and implement exact server contract**

Run: `npm test -- src/lib/__tests__/project-note-api.test.ts`

Expected: FAIL because the module is missing.

Create these exported types/constants in `project-note-api.ts`:

```ts
export const PROJECT_NOTE_NAME_MAX_LENGTH = 160;
export const PROJECT_NOTE_OUTPUT_MAX_LENGTH = 6_000;
export const PROJECT_NOTE_TIMEOUT_MS = 20_000;
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

export type ProjectNoteErrorCode =
  | "AUTH_REQUIRED" | "INVALID_REQUEST" | "AI_NOT_CONFIGURED"
  | "AI_QUOTA_EXCEEDED" | "AI_TIMEOUT" | "AI_UNAVAILABLE" | "AI_INVALID_RESPONSE";

export type ProjectNoteApiResponse =
  | { note: string }
  | { error: { code: ProjectNoteErrorCode; message: string; retryable: boolean } };
```

`generateProjectNote` accepts `{apiKey, model?, fetchImpl?, signal?}`. Normalize `name.trim().replace(/\s+/g, " ")`; validate `1..160`; issue the exact v1 request with `x-goog-api-key`, `cache: "no-store"`, `store:false`, a Spanish `system_instruction`, `input` that labels the name as untrusted data, and `generation_config: { max_output_tokens: 1024 }`. The instruction requires 250–500 Spanish words, short Markdown headings and descriptive prose that explains what the project is and why it matters; it explicitly forbids numbered steps, checklists and procedural instructions. Use a 20-second `AbortController`, combine an external abort signal, require `status === "completed"`, select the last `steps` entry with `type === "model_output"`, join only `content` entries with `type === "text"`, trim, and require `1..6000` characters. Throw a typed error object without provider body or key.

Run: `npm test -- src/lib/__tests__/project-note-api.test.ts`

Expected: PASS.

- [ ] **Step 3: Write failing Route Handler and middleware tests**

In the route test, mock `getUser` and `generateProjectNote`; assert 401 without session, 400 for invalid JSON/name, 503 without key, 200 with `{note}`, and the error status mapping `429/503/504/502`.

Create `src/lib/__tests__/supabase-middleware.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { routeHandlesOwnAuthentication } from "@/lib/supabase/middleware";

describe("middleware auth routing", () => {
  it("lets only the project note API return its own JSON auth response", () => {
    expect(routeHandlesOwnAuthentication("/api/projects/generate-note")).toBe(true);
    expect(routeHandlesOwnAuthentication("/api/projects/generate-note/extra")).toBe(false);
    expect(routeHandlesOwnAuthentication("/dashboard")).toBe(false);
  });
});
```

- [ ] **Step 4: Verify route RED and implement it**

Run: `npm test -- "src/app/api/projects/generate-note/__tests__/route.test.ts" src/lib/__tests__/supabase-middleware.test.ts`

Expected: FAIL because the route and exported predicate are absent.

Implement `POST` with this order: `getUser()`; parse JSON; validate name; read `GEMINI_API_KEY` inside the function; call `generateProjectNote`; translate typed errors to the stable response. Never read the key at module load, so builds work without it.

Export and apply this middleware predicate after session refresh:

```ts
const SELF_AUTHENTICATED_PATHS = new Set(["/api/projects/generate-note"]);
export const routeHandlesOwnAuthentication = (path: string) => SELF_AUTHENTICATED_PATHS.has(path);
```

Change the redirect condition to `if (!user && !isPublic && !routeHandlesOwnAuthentication(path))`.

- [ ] **Step 5: Document server configuration and run tests**

Append to `.env.example`:

```dotenv
# ---- Gemini Developer API (SERVER ONLY) ----
GEMINI_API_KEY=replace_with_a_rotated_server_key
GEMINI_MODEL=gemini-3.5-flash
```

Add README instructions for `.env.local` and Vercel Environment Variables, explicitly stating that the previously shared key must be rotated and no variable may use `NEXT_PUBLIC_`.

Run: `npm test -- src/lib/__tests__/project-note-api.test.ts "src/app/api/projects/generate-note/__tests__/route.test.ts" src/lib/__tests__/supabase-middleware.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the server boundary**

```powershell
git add src/lib/project-note-api.ts src/lib/__tests__/project-note-api.test.ts src/lib/supabase/middleware.ts src/lib/__tests__/supabase-middleware.test.ts src/app/api/projects/generate-note/route.ts src/app/api/projects/generate-note/__tests__/route.test.ts .env.example README.md
git commit -m "feat: add secure Gemini project notes"
```

### Task 6: Gemini interaction in Solo nota

**Files:**
- Modify: `src/app/(app)/proyectos/page.tsx`
- Test: `src/app/(app)/proyectos/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `ProjectNoteApiResponse` and `/api/projects/generate-note` from Task 5.
- Produces: explicit generate/replace/retry UI that changes only the editable draft.

- [ ] **Step 1: Add failing UI tests**

Add these exact cases to the existing project-page test:

```tsx
it("does not call Gemini when Solo nota is selected", () => {
  render(<ProjectsPage />);
  fireEvent.click(screen.getByRole("button", { name: "Solo nota" }));
  expect(fetch).not.toHaveBeenCalled();
});

it("generates into an empty editable note only after the explicit click", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ note: "# Glow\n\n## Qué es\nTexto" })));
  render(<ProjectsPage />);
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Glow" } });
  fireEvent.click(screen.getByRole("button", { name: "Solo nota" }));
  fireEvent.click(screen.getByRole("button", { name: "Generar con IA" }));
  expect(await screen.findByDisplayValue(/# Glow/)).toBeInTheDocument();
});

it("requires an internal confirmation before replacing a non-empty note", async () => {
  render(<ProjectsPage />);
  fireEvent.click(screen.getByRole("button", { name: "Generar con IA" }));
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Reemplazar nota" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
});

it("keeps the previous note and offers retry after a recoverable error", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
    error: { code: "AI_QUOTA_EXCEEDED", message: "Cuota agotada temporalmente.", retryable: true },
  }), { status: 429 }));
  render(<ProjectsPage />);
  fireEvent.click(screen.getByRole("button", { name: "Generar con IA" }));
  fireEvent.click(screen.getByRole("button", { name: "Reemplazar nota" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Cuota agotada");
  expect(screen.getByDisplayValue("Nota existente")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- "src/app/(app)/proyectos/__tests__/page.test.tsx"`

Expected: Gemini UI cases FAIL.

- [ ] **Step 3: Implement request lifecycle without stale writes**

Add state for `aiPending`, `aiError`, `aiRetryable`, `confirmReplace`; keep an `AbortController` ref and an incrementing request ID. `Generar con IA` appears only when `draft.contentMode === "note"` and `draft.name.trim()` is non-empty. Existing text opens the inline confirmation; empty text calls the route immediately. Disable generation while pending. On success, update `draft.note` only when the request ID and the current draft identity/name still match. On abort or close, do not show an error. On any other failure, preserve the note and expose `role="alert"`; show `Reintentar` only for a retryable error.

Use a client parser that rejects responses missing both `note` and `error`. Do not store provider details or call Gemini when the content-mode selector changes.

- [ ] **Step 4: Run tests, typecheck, and commit**

Run: `npm test -- "src/app/(app)/proyectos/__tests__/page.test.tsx"`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: exit 0.

```powershell
git add "src/app/(app)/proyectos/page.tsx" "src/app/(app)/proyectos/__tests__/page.test.tsx"
git commit -m "feat: generate editable project notes"
```

### Task 7: Integrated verification, review, and delivery

**Files:**
- Review: every file listed above
- Review: `docs/superpowers/specs/2026-07-20-projects-ai-avatar-crop-design.md`

**Interfaces:**
- Consumes: all Tasks 1–6.
- Produces: verified commit series ready for direct push.

- [ ] **Step 1: Run the complete local verification sequentially**

```powershell
npm test
npm run build
npx tsc --noEmit
npm run test:e2e
```

Expected: zero failing Vitest files, successful 16+ route build, TypeScript exit 0, Playwright exit 0. Run build and TypeScript sequentially because both use `.next/types`.

- [ ] **Step 2: Scan for forbidden regressions and secrets**

```powershell
rg -n -i "tareas semanales|proyecto semanal|useWeeklyTasks|WeeklyTask|Nueva semanal" src supabase/schema.sql
git grep -n "NEXT_PUBLIC_GEMINI"
rg -n "GEMINI_API_KEY|GEMINI_MODEL" .next/static
git diff --check
```

Expected: no active weekly-project code, no public Gemini variable, no Gemini server variable in static chunks, and no whitespace errors. Test files may construct legacy search terms dynamically but active source must remain absent.

- [ ] **Step 3: Run Supabase remote preflight and apply only reviewed migrations**

```powershell
npx --yes supabase@latest link --project-ref uxeuipryacnwsqhegrrs
npx --yes supabase@latest migration list --linked
npx --yes supabase@latest db push --linked --dry-run
npx --yes supabase@latest db push --linked
npx --yes supabase@latest migration list --linked
```

Expected: login uses the Google account that owns `uxeuipryacnwsqhegrrs`; dry-run lists only reviewed local migrations; final lists local and remote versions aligned. Never use `db reset --linked` or `--include-seed`.

- [ ] **Step 4: Query the remote schema and advisors**

Use the Supabase connector when authenticated to the correct account, otherwise use the CLI against the linked project. Confirm every new `projects` column and index, then run security and performance advisors. Record existing unrelated notices separately; fix notices introduced by this migration.

- [ ] **Step 5: Independent two-stage review**

Dispatch one reviewer for spec compliance and another for code quality/security. Resolve Critical and Important findings with a new failing test before changing production code. Re-run Step 1 after any fix.

- [ ] **Step 6: Push the reviewed branch and fast-forward main**

```powershell
git status --short --branch
git push -u origin codex/elabela-functional-upgrades
git merge-base --is-ancestor origin/main HEAD
git push origin HEAD:main
git ls-remote origin refs/heads/main refs/heads/codex/elabela-functional-upgrades
```

Expected: both remote refs resolve to the reviewed HEAD and the worktree is clean.
