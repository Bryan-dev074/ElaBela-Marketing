import type { DailyTask, DailyTaskLog, TaskState } from "@/lib/data";
import { paraguayDateKey, paraguayWeekday, utcForParaguayDate } from "@/lib/paraguay-time";

const ROTATION_EPOCH_UTC = Date.UTC(2024, 0, 1);
export { PARAGUAY_TIME_ZONE, paraguayDateKey, paraguayWeekday } from "@/lib/paraguay-time";

const normalizeOwner = (owner: unknown): string | null => {
  if (typeof owner !== "string") return null;
  const value = owner.trim();
  return value || null;
};

const normalizeRotation = (rotation: unknown): string[] => Array.isArray(rotation)
  ? rotation.map(normalizeOwner).filter((owner): owner is string => owner !== null)
  : [];

export const taskIsPerDay = (task: DailyTask): boolean => Array.isArray(task.dayAssignees);

const scheduledOnDate = (task: DailyTask, date: Date): boolean =>
  !task.days || task.days.length === 0 || task.days.length === 7 || task.days.includes(paraguayWeekday(date));

export function assignedUserForDate(task: DailyTask, date = new Date()): string | null {
  if (taskIsPerDay(task)) return normalizeOwner(task.dayAssignees?.[paraguayWeekday(date)]);
  if (!scheduledOnDate(task, date)) return null;

  const rotation = normalizeRotation(task.rotation);
  if (rotation.length >= 2) {
    const diff = Math.floor((utcForParaguayDate(date) - ROTATION_EPOCH_UTC) / 86_400_000);
    let offset = diff;
    if (task.days && task.days.length > 0 && task.days.length < 7) {
      const fullWeeks = Math.floor(diff / 7);
      const remainder = ((diff % 7) + 7) % 7;
      offset = fullWeeks * task.days.length + task.days.filter((weekday) => weekday < remainder).length;
    }
    return rotation[((offset % rotation.length) + rotation.length) % rotation.length];
  }
  return normalizeOwner(task.assignee);
}

export const isTaskAssignedForDate = (task: DailyTask, date = new Date()): boolean => assignedUserForDate(task, date) !== null;
export const taskAppliesForDate = (task: DailyTask, date = new Date()): boolean => isTaskAssignedForDate(task, date);

export function taskBelongsTo(task: DailyTask, username: string): boolean {
  if (taskIsPerDay(task)) return (task.dayAssignees ?? []).some((owner) => normalizeOwner(owner) === username);
  const rotation = normalizeRotation(task.rotation);
  return rotation.length > 1 ? rotation.includes(username) : normalizeOwner(task.assignee) === username;
}

export function taskMineForDate(task: DailyTask, username: string, date = new Date()): boolean {
  if (!isTaskAssignedForDate(task, date)) return false;
  if (taskIsPerDay(task)) return assignedUserForDate(task, date) === username;
  const rotation = normalizeRotation(task.rotation);
  return rotation.length > 1 ? rotation.includes(username) : assignedUserForDate(task, date) === username;
}

export const tasksVisibleToTeam = (tasks: DailyTask[], date = new Date()): DailyTask[] =>
  tasks.filter((task) => taskAppliesForDate(task, date));

export function dailyTaskFromRow(row: Record<string, unknown>): DailyTask {
  const dayAssignees = row.day_assignees;
  const rotation = normalizeRotation(row.rotation);
  return {
    id: row.id as string,
    name: row.name as string,
    icon: (row.icon as string) || "✨",
    assignee: normalizeOwner(row.assignee),
    note: (row.note as string) || undefined,
    rotation: rotation.length > 1 ? rotation : undefined,
    days: Array.isArray(row.days) ? row.days.filter((day): day is number => typeof day === "number") : undefined,
    dayAssignees: Array.isArray(dayAssignees) ? Array.from({ length: 7 }, (_, index) => normalizeOwner(dayAssignees[index]) ?? "") : undefined,
    postType: (row.post_type as string) || undefined,
  };
}

export function dailyTaskToRow(task: DailyTask): Record<string, unknown> {
  const rotation = normalizeRotation(task.rotation);
  return {
    id: task.id,
    name: task.name,
    icon: task.icon,
    assignee: normalizeOwner(task.assignee),
    note: task.note ?? null,
    rotation: rotation.length > 1 ? rotation : null,
    days: task.days?.length ? task.days : null,
    day_assignees: task.dayAssignees ?? null,
    post_type: task.postType ?? null,
  };
}

export function dailyTaskLogFromRow(row: Record<string, unknown>): DailyTaskLog {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    activityDate: row.activity_date as string,
    state: row.state as TaskState,
    taskNameSnapshot: row.task_name_snapshot as string,
    taskIconSnapshot: (row.task_icon_snapshot as string) || "✨",
    assigneeSnapshot: normalizeOwner(row.assignee_snapshot),
    completedBy: (row.completed_by as string) || undefined,
    completedAt: (row.completed_at as string) || undefined,
    updatedAt: row.updated_at as string,
  };
}

export const stateForTask = (logs: DailyTaskLog[], taskId: string): TaskState =>
  logs.find((log) => log.taskId === taskId)?.state ?? "todo";

export type DailyTaskTransitionRow = {
  task_id: string;
  activity_date: string;
  state: TaskState;
  task_name_snapshot: string;
  task_icon_snapshot: string;
  assignee_snapshot: string | null;
  completed_by: string | null;
  completed_at: string | null;
  updated_at: string;
};

export function buildDailyTaskTransition({
  task,
  activityDate,
  state,
  actorId,
  now = new Date().toISOString(),
}: {
  task: DailyTask;
  activityDate: string;
  state: TaskState;
  actorId: string;
  now?: string;
}): DailyTaskTransitionRow {
  const activityInstant = new Date(`${activityDate}T12:00:00.000Z`);
  const assignee = assignedUserForDate(task, activityInstant);
  if (!assignee) throw new Error("Asigná la tarea antes de cambiar su estado.");
  if (state === "done" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId)) {
    throw new Error("No hay un usuario autenticado válido para completar la tarea.");
  }
  return {
    task_id: task.id,
    activity_date: activityDate,
    state,
    task_name_snapshot: task.name,
    task_icon_snapshot: task.icon || "✨",
    assignee_snapshot: assignee,
    completed_by: state === "done" ? actorId : null,
    completed_at: state === "done" ? now : null,
    updated_at: now,
  };
}
