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
