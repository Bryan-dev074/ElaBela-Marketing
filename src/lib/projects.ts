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
