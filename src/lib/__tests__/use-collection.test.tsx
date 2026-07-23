import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  upsert: vi.fn(),
  remove: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mocks.from }),
}));

import { useCollection } from "@/lib/db";

type Row = { id: string; name: string };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

describe("useCollection async mutations", () => {
  beforeEach(() => {
    mocks.select.mockResolvedValue({ data: null, error: { message: "offline" } });
    mocks.eq.mockReturnValue({ error: null });
    mocks.delete.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({
      select: mocks.select,
      insert: mocks.insert,
      upsert: mocks.upsert,
      delete: mocks.delete,
    });
  });

  it("does not render local seed data while the live collection is still loading", async () => {
    const pending = deferred<{ data: Row[]; error: null }>();
    mocks.select.mockReturnValue(pending.promise);

    const { result } = renderHook(() => useCollection<Row>({
      table: "rows",
      seed: [{ id: "seed", name: "Contenido anterior" }],
      fromRow: (row) => row as unknown as Row,
      toRow: (row) => row,
    }));

    expect(result.current.items).toEqual([]);

    await act(async () => {
      pending.resolve({ data: [{ id: "live", name: "Contenido actual" }], error: null });
      await pending.promise;
    });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.items).toEqual([{ id: "live", name: "Contenido actual" }]);
  });

  it("retains a later successful add when an earlier overlapping add fails", async () => {
    const first = deferred<{ error: { message: string } }>();
    const second = deferred<{ error: null }>();
    mocks.insert.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useCollection<Row>({
      table: "rows",
      seed: [{ id: "base", name: "Base" }],
      fromRow: (row) => row as unknown as Row,
      toRow: (row) => row,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    let firstResult!: Promise<unknown>;
    let secondResult!: Promise<unknown>;
    act(() => {
      firstResult = result.current.addAsync({ id: "first", name: "First" });
      secondResult = result.current.addAsync({ id: "second", name: "Second" });
    });

    await act(async () => {
      second.resolve({ error: null });
      await secondResult;
      first.resolve({ error: { message: "first failed" } });
      await firstResult;
    });

    expect(result.current.items.map((row) => row.id)).toEqual(["second", "base"]);
    expect(result.current.error).toBe("first failed");
  });

  it("keeps the successful item when overlapping duplicate-ID adds resolve differently", async () => {
    const first = deferred<{ error: { message: string } }>();
    const second = deferred<{ error: null }>();
    mocks.insert.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useCollection<Row>({
      table: "rows",
      seed: [{ id: "base", name: "Base" }],
      fromRow: (row) => row as unknown as Row,
      toRow: (row) => row,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    let firstResult!: Promise<unknown>;
    let secondResult!: Promise<unknown>;
    act(() => {
      firstResult = result.current.addAsync({ id: "duplicate", name: "Failed copy" });
      secondResult = result.current.addAsync({ id: "duplicate", name: "Successful copy" });
    });

    await act(async () => {
      second.resolve({ error: null });
      await secondResult;
      first.resolve({ error: { message: "duplicate failed" } });
      await firstResult;
    });

    expect(result.current.items).toEqual([
      { id: "duplicate", name: "Successful copy" },
      { id: "base", name: "Base" },
    ]);
  });

  it("uses a caller-provided setItems value as the base for the next mutation", async () => {
    mocks.insert.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useCollection<Row>({
      table: "rows",
      seed: [{ id: "base", name: "Base" }],
      fromRow: (row) => row as unknown as Row,
      toRow: (row) => row,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.setItems([{ id: "caller", name: "Caller" }]);
    });
    await act(async () => {
      await result.current.addAsync({ id: "new", name: "New" });
    });

    expect(result.current.items.map((row) => row.id)).toEqual(["new", "caller"]);
  });
});
