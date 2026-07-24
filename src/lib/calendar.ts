import type { Project, SpecialDate, TaskState } from "@/lib/data";
import { isProjectSchedulable, projectCalendarOccurrence, type ProjectCalendarOccurrence } from "@/lib/projects";

export type CalendarProjectEntry = ProjectCalendarOccurrence & { project: Project };

export type CalendarWeekDayAgenda = {
  special?: readonly unknown[];
  projects?: readonly { kind?: string }[];
  guiones?: readonly unknown[];
  events?: readonly { status?: string }[];
};

export type CalendarWeekSummary = {
  daysWithAgenda: number;
  scheduled: number;
  active: number;
  completed: number;
};

/** Visual state used by manually added tasks inside the day agenda. */
export function calendarTaskStateTone(status: TaskState): "completed" | "in-progress" | "pending" {
  if (status === "done") return "completed";
  if (status === "doing") return "in-progress";
  return "pending";
}

/** Small, presentation-friendly totals for the weekly agenda header. */
export function calendarWeekSummary(
  days: readonly string[],
  agendaByDate: ReadonlyMap<string, CalendarWeekDayAgenda>,
): CalendarWeekSummary {
  let daysWithAgenda = 0;
  let scheduled = 0;
  let completed = 0;
  let specialDates = 0;

  for (const date of days) {
    const agenda = agendaByDate.get(date);
    if (!agenda) continue;
    const special = agenda.special?.length ?? 0;
    const projects = agenda.projects?.length ?? 0;
    const guiones = agenda.guiones?.length ?? 0;
    const events = agenda.events?.length ?? 0;
    const total = special + projects + guiones + events;
    if (total === 0) continue;

    daysWithAgenda += 1;
    scheduled += total;
    specialDates += special;
    completed += (agenda.projects ?? []).filter(({ kind }) => kind === "completed").length;
    completed += (agenda.events ?? []).filter(({ status }) => status === "done").length;
  }

  return { daysWithAgenda, scheduled, active: Math.max(0, scheduled - completed - specialDates), completed };
}

/** Converts project lifecycle dates into the single calendar occurrence to render. */
export function calendarProjectEntries(projects: Project[]): CalendarProjectEntry[] {
  return projects.flatMap((project) => {
    const occurrence = projectCalendarOccurrence(project);
    return occurrence ? [{ project, ...occurrence }] : [];
  });
}

/** The drag tray only accepts projects that are still waiting to start. */
export function schedulableProjectTray(projects: Project[]): Project[] {
  return projects
    .filter(isProjectSchedulable)
    .sort((a, b) => (a.due ? 1 : 0) - (b.due ? 1 : 0) || (a.due ?? "").localeCompare(b.due ?? "") || a.name.localeCompare(b.name));
}

/** Upcoming Paraguay holidays, excluding marketing-only dates. */
export function upcomingFestiveDates(
  dates: SpecialDate[],
  fromDate: string,
  limit = 3,
): SpecialDate[] {
  return dates
    .filter((date) => date.kind === "festivo" && date.date >= fromDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, Math.max(0, limit));
}
