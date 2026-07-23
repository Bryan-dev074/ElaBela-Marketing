import type { Project, SpecialDate } from "@/lib/data";
import { isProjectSchedulable, projectCalendarOccurrence, type ProjectCalendarOccurrence } from "@/lib/projects";

export type CalendarProjectEntry = ProjectCalendarOccurrence & { project: Project };

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
