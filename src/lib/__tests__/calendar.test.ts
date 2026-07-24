import { describe, expect, it } from "vitest";
import type { Project, SpecialDate } from "@/lib/data";
import { calendarProjectEntries, calendarTaskStateTone, calendarWeekSummary, schedulableProjectTray, upcomingFestiveDates } from "@/lib/calendar";

const project = (patch: Partial<Project> = {}): Project => ({
  id: "p1", name: "Campaña Glow", owner: "bryan",
  responsibleUsernames: [], projectType: "campaign", priority: "normal",
  status: "todo", createdAt: "2026-07-20", contentMode: "steps",
  steps: [{ label: "Diseño", done: false }], ...patch,
});

describe("calendar domain helpers", () => {
  it("marks a manually added calendar task as completed when it is listo", () => {
    expect(calendarTaskStateTone("done")).toBe("completed");
    expect(calendarTaskStateTone("todo")).toBe("pending");
  });

  it("summarizes a week for the agenda header without counting empty days", () => {
    const summary = calendarWeekSummary(
      ["2026-07-20", "2026-07-21", "2026-07-22"],
      new Map([
        ["2026-07-20", { projects: [{ kind: "due" as const }], events: [{ status: "todo" as const }] }],
        ["2026-07-21", { projects: [{ kind: "completed" as const }], events: [{ status: "done" as const }] }],
        ["2026-07-22", { special: [{ label: "Feriado" }] }],
      ]),
    );

    expect(summary).toEqual({ daysWithAgenda: 3, scheduled: 5, active: 2, completed: 2 });
  });

  it("uses the completion day for finished projects and never duplicates their due date", () => {
    const entries = calendarProjectEntries([
      project({ id: "done", status: "done", due: "2026-08-15", completedAt: "2026-08-01T02:30:00.000Z" }),
      project({ id: "pending", due: "2026-08-15" }),
    ]);

    expect(entries).toEqual([
      { project: expect.objectContaining({ id: "done" }), date: "2026-07-31", kind: "completed" },
      { project: expect.objectContaining({ id: "pending" }), date: "2026-08-15", kind: "due" },
    ]);
  });

  it("only exposes unfinished todo projects in the drag tray", () => {
    const tray = schedulableProjectTray([
      project({ id: "doing", status: "doing", due: "2026-07-24" }),
      project({ id: "done", status: "done", completedAt: "2026-07-22T15:00:00Z" }),
      project({ id: "dated", due: "2026-07-24" }),
      project({ id: "undated" }),
      project({ id: "archived", archived: true }),
    ]);

    expect(tray.map(({ id }) => id)).toEqual(["undated", "dated"]);
  });

  it("returns the next festive dates, excluding marketing dates and respecting the limit", () => {
    const dates: SpecialDate[] = [
      { date: "2026-08-15", label: "Fundación de Asunción", emoji: "🏛️", kind: "festivo" },
      { date: "2026-07-30", label: "Día del Amigo", emoji: "🤝", kind: "marketing" },
      { date: "2026-09-29", label: "Batalla de Boquerón", emoji: "🎖️", kind: "festivo" },
      { date: "2026-12-25", label: "Navidad", emoji: "🎄", kind: "festivo" },
    ];

    expect(upcomingFestiveDates(dates, "2026-07-23", 2).map(({ date }) => date)).toEqual([
      "2026-08-15", "2026-09-29",
    ]);
  });
});
