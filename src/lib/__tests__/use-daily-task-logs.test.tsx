import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import type { DailyTask } from "@/lib/data";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mocks.from }),
}));

import { useDailyTaskLogs } from "@/lib/db";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const task: DailyTask = { id: "task-1", name: "Publicar reel", icon: "🎬", assignee: "cielo" };
const otherTask: DailyTask = { id: "task-2", name: "Responder mensajes", icon: "💬", assignee: "bryan" };
const row = (activityDate: string, state: "todo" | "doing" | "done") => ({
  id: `${activityDate}-${state}`,
  task_id: "task-1",
  activity_date: activityDate,
  state,
  task_name_snapshot: "Publicar reel",
  task_icon_snapshot: "🎬",
  assignee_snapshot: "cielo",
  completed_by: null,
  completed_at: null,
  updated_at: `${activityDate}T12:00:00.000Z`,
});
const otherRow = (activityDate: string, state: "todo" | "doing" | "done") => ({
  ...row(activityDate, state),
  id: `${activityDate}-other-${state}`,
  task_id: "task-2",
  task_name_snapshot: "Responder mensajes",
  task_icon_snapshot: "💬",
  assignee_snapshot: "bryan",
});

describe("useDailyTaskLogs", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.select.mockReset();
    mocks.eq.mockReset();
    mocks.upsert.mockReset();
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select, upsert: mocks.upsert });
  });

  it("ignores a stale previous-date response", async () => {
    const first = deferred<{ data: ReturnType<typeof row>[]; error: null }>();
    const second = deferred<{ data: ReturnType<typeof row>[]; error: null }>();
    mocks.eq.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(({ date }) => useDailyTaskLogs(date), { initialProps: { date: "2026-07-20" } });
    rerender({ date: "2026-07-21" });

    await act(async () => {
      second.resolve({ data: [row("2026-07-21", "done")], error: null });
      await second.promise;
    });
    expect(result.current.stateFor("task-1")).toBe("done");

    await act(async () => {
      first.resolve({ data: [row("2026-07-20", "doing")], error: null });
      await first.promise;
    });
    expect(result.current.logs).toHaveLength(1);
    expect(result.current.logs[0].activityDate).toBe("2026-07-21");
  });

  it("optimistically updates and rolls back with a visible error", async () => {
    mocks.eq.mockResolvedValue({ data: [row("2026-07-20", "doing")], error: null });
    const write = deferred<{ data: null; error: { message: string } }>();
    mocks.upsert.mockReturnValue(write.promise);

    const { result } = renderHook(() => useDailyTaskLogs("2026-07-20"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let transition!: Promise<unknown>;
    act(() => {
      transition = result.current.transition(task, "done", "11111111-1111-1111-1111-111111111111");
    });
    expect(result.current.stateFor("task-1")).toBe("done");

    await act(async () => {
      write.resolve({ data: null, error: { message: "No se pudo guardar" } });
      await transition;
    });
    expect(result.current.stateFor("task-1")).toBe("doing");
    expect(result.current.error).toBe("No se pudo guardar");

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it("does not create a write for an unassigned task", async () => {
    mocks.eq.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useDailyTaskLogs("2026-07-20"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const response = await result.current.transition({ ...task, assignee: null }, "doing", "actor");
      expect(response.ok).toBe(false);
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/asign/i);
  });

  it("rolls back only the failed task without erasing another successful transition", async () => {
    mocks.eq.mockResolvedValue({ data: [row("2026-07-20", "doing"), otherRow("2026-07-20", "todo")], error: null });
    const failed = deferred<{ data: null; error: { message: string } }>();
    mocks.upsert.mockReturnValueOnce(failed.promise).mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useDailyTaskLogs("2026-07-20"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let first!: Promise<unknown>;
    await act(async () => {
      first = result.current.transition(task, "done", "11111111-1111-1111-1111-111111111111");
      await result.current.transition(otherTask, "doing", "11111111-1111-1111-1111-111111111111");
    });
    await act(async () => {
      failed.resolve({ data: null, error: { message: "Falló task 1" } });
      await first;
    });
    expect(result.current.stateFor("task-1")).toBe("doing");
    expect(result.current.stateFor("task-2")).toBe("doing");
  });

  it("serializes overlapping writes for the same task and date", async () => {
    mocks.eq.mockResolvedValue({ data: [row("2026-07-20", "todo")], error: null });
    const firstWrite = deferred<{ data: null; error: null }>();
    mocks.upsert.mockReturnValueOnce(firstWrite.promise).mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useDailyTaskLogs("2026-07-20"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.transition(task, "doing", "11111111-1111-1111-1111-111111111111");
      second = result.current.transition(task, "done", "11111111-1111-1111-1111-111111111111");
    });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    await act(async () => {
      firstWrite.resolve({ data: null, error: null });
      await first;
      await second;
    });
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(result.current.stateFor("task-1")).toBe("done");
  });

  it("does not let an initial fetch overwrite a newer optimistic transition", async () => {
    const read = deferred<{ data: ReturnType<typeof row>[]; error: null }>();
    mocks.eq.mockReturnValue(read.promise);
    mocks.upsert.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useDailyTaskLogs("2026-07-20"));

    await act(async () => {
      await result.current.transition(task, "done", "11111111-1111-1111-1111-111111111111");
    });
    await act(async () => {
      read.resolve({ data: [row("2026-07-20", "doing"), otherRow("2026-07-20", "doing")], error: null });
      await read.promise;
    });
    expect(result.current.stateFor("task-1")).toBe("done");
    expect(result.current.stateFor("task-2")).toBe("doing");
    expect(result.current.loading).toBe(false);
  });

  it("keeps optimistic state but exposes a concurrent initial read error", async () => {
    const read = deferred<{ data: null; error: { message: string } }>();
    mocks.eq.mockReturnValue(read.promise);
    mocks.upsert.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useDailyTaskLogs("2026-07-20"));

    await act(async () => {
      await result.current.transition(task, "done", "11111111-1111-1111-1111-111111111111");
    });
    await act(async () => {
      read.resolve({ data: null, error: { message: "No se pudo cargar el día" } });
      await read.promise;
    });

    expect(result.current.stateFor("task-1")).toBe("done");
    expect(result.current.error).toBe("No se pudo cargar el día");
    expect(result.current.loading).toBe(false);
  });

  it("does not let an old-date write corrupt rollback state for the new date", async () => {
    mocks.eq
      .mockResolvedValueOnce({ data: [row("2026-07-20", "doing")], error: null })
      .mockResolvedValueOnce({ data: [row("2026-07-21", "todo")], error: null });
    const oldWrite = deferred<{ data: null; error: null }>();
    const newWrite = deferred<{ data: null; error: { message: string } }>();
    mocks.upsert.mockReturnValueOnce(oldWrite.promise).mockReturnValueOnce(newWrite.promise);

    const { result, rerender } = renderHook(({ date }) => useDailyTaskLogs(date), { initialProps: { date: "2026-07-20" } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let oldTransition!: Promise<unknown>;
    act(() => { oldTransition = result.current.transition(task, "done", "11111111-1111-1111-1111-111111111111"); });

    rerender({ date: "2026-07-21" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stateFor("task-1")).toBe("todo");
    let newTransition!: Promise<unknown>;
    act(() => { newTransition = result.current.transition(task, "doing", "11111111-1111-1111-1111-111111111111"); });

    await act(async () => {
      oldWrite.resolve({ data: null, error: null });
      await oldTransition;
      newWrite.resolve({ data: null, error: { message: "Falló fecha nueva" } });
      await newTransition;
    });
    expect(result.current.stateFor("task-1")).toBe("todo");
    expect(result.current.logs[0].activityDate).toBe("2026-07-21");
  });
});
