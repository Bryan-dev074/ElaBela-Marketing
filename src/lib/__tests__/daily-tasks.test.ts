import {
  assignedUserForDate,
  buildDailyTaskTransition,
  dailyTaskFromRow,
  dailyTaskToRow,
  isTaskAssignedForDate,
  paraguayDateKey,
  paraguayWeekday,
  stateForTask,
  taskAppliesForDate,
  taskBelongsTo,
  taskMineForDate,
  tasksVisibleToTeam,
} from "@/lib/daily-tasks";
import type { DailyTask, DailyTaskLog } from "@/lib/data";

const fixed = (patch: Partial<DailyTask> = {}): DailyTask => ({
  id: "task-1",
  name: "Publicar reel",
  icon: "🎬",
  assignee: "cielo",
  ...patch,
});

describe("Paraguay activity dates", () => {
  it("uses America/Asuncion across a UTC month boundary", () => {
    expect(paraguayDateKey(new Date("2026-08-01T02:30:00.000Z"))).toBe("2026-07-31");
    expect(paraguayDateKey(new Date("2026-08-01T04:30:00.000Z"))).toBe("2026-08-01");
  });

  it("returns a Monday-first weekday in Asuncion", () => {
    expect(paraguayWeekday(new Date("2026-07-20T12:00:00.000Z"))).toBe(0);
    expect(paraguayWeekday(new Date("2026-07-26T12:00:00.000Z"))).toBe(6);
  });
});

describe("daily assignment source of truth", () => {
  const monday = new Date("2026-07-20T12:00:00.000Z");
  const tuesday = new Date("2026-07-21T12:00:00.000Z");

  it("normalizes a blank fixed owner to unassigned", () => {
    expect(dailyTaskFromRow({ id: "x", name: "X", icon: "✨", assignee: "   " }).assignee).toBeNull();
    const persisted = dailyTaskToRow(fixed({ assignee: null }));
    expect(persisted.assignee).toBeNull();
    expect(persisted).not.toHaveProperty("state");
  });

  it("uses the exact per-day owner and never falls back on a blank day", () => {
    const task = fixed({ assignee: "stale-owner", dayAssignees: ["cielo", "", "elizabeth", "", "", "", ""] });
    expect(assignedUserForDate(task, monday)).toBe("cielo");
    expect(assignedUserForDate(task, tuesday)).toBeNull();
    expect(isTaskAssignedForDate(task, tuesday)).toBe(false);
    expect(taskAppliesForDate(task, tuesday)).toBe(false);
  });

  it("resolves deterministic rotation before the fixed fallback", () => {
    const task = fixed({ assignee: "fallback", rotation: ["cielo", "elizabeth"] });
    expect(assignedUserForDate(task, monday)).toBe("elizabeth");
    expect(assignedUserForDate(task, tuesday)).toBe("cielo");
  });

  it("treats a malformed one-member rotation as fixed ownership", () => {
    const task = fixed({ assignee: "bryan", rotation: ["cielo"] });
    expect(assignedUserForDate(task, monday)).toBe("bryan");
    expect(taskBelongsTo(task, "bryan")).toBe(true);
    expect(taskBelongsTo(task, "cielo")).toBe(false);
    expect(dailyTaskFromRow({ id: "x", name: "X", assignee: "bryan", rotation: ["cielo"] }).rotation).toBeUndefined();
    expect(dailyTaskToRow(task).rotation).toBeNull();
  });

  it("keeps shared rotation visible to every member while excluding unassigned work", () => {
    const rotation = fixed({ id: "rotation", rotation: ["cielo", "elizabeth"] });
    const unassigned = fixed({ id: "unassigned", assignee: null });
    const future = fixed({ id: "future", assignee: "bryan", days: [1] });
    expect(taskMineForDate(rotation, "elizabeth", monday)).toBe(true);
    expect(tasksVisibleToTeam([rotation, unassigned, future], monday).map((task) => task.id)).toEqual(["rotation"]);
  });

  it("includes an unassigned definition immediately after assignment", () => {
    const task = fixed({ assignee: null });
    expect(tasksVisibleToTeam([task], monday)).toEqual([]);
    expect(tasksVisibleToTeam([{ ...task, assignee: "bryan" }], monday)).toHaveLength(1);
  });
});

describe("date-scoped daily transitions", () => {
  const task = fixed({ assignee: "cielo" });
  const date = "2026-07-20";
  const now = "2026-07-20T15:30:00.000Z";

  it("defaults to todo without pre-seeding a log", () => {
    expect(stateForTask([], task.id)).toBe("todo");
  });

  it("snapshots definition and completion attribution when entering done", () => {
    expect(buildDailyTaskTransition({ task, activityDate: date, state: "done", actorId: "11111111-1111-1111-1111-111111111111", now })).toEqual({
      task_id: "task-1",
      activity_date: date,
      state: "done",
      task_name_snapshot: "Publicar reel",
      task_icon_snapshot: "🎬",
      assignee_snapshot: "cielo",
      completed_by: "11111111-1111-1111-1111-111111111111",
      completed_at: now,
      updated_at: now,
    });
  });

  it("clears completion metadata when reopening", () => {
    expect(buildDailyTaskTransition({ task, activityDate: date, state: "todo", actorId: "actor", now })).toMatchObject({
      completed_by: null,
      completed_at: null,
    });
  });

  it("rejects state changes for an unassigned definition", () => {
    expect(() => buildDailyTaskTransition({ task: fixed({ assignee: null }), activityDate: date, state: "doing", actorId: "actor", now })).toThrow(/asign/i);
  });

  it("requires a valid authenticated UUID when entering done", () => {
    expect(() => buildDailyTaskTransition({ task, activityDate: date, state: "done", actorId: "actor", now })).toThrow(/usuario/i);
  });

  it("reads only the matching task log", () => {
    const logs: DailyTaskLog[] = [
      { id: "log", taskId: "task-1", activityDate: date, state: "doing", taskNameSnapshot: "Viejo", taskIconSnapshot: "✨", assigneeSnapshot: "cielo", updatedAt: now },
    ];
    expect(stateForTask(logs, "task-1")).toBe("doing");
    expect(stateForTask(logs, "other")).toBe("todo");
  });
});
