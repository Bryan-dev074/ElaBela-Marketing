import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mocks.from }),
}));

import { ProfilesProvider, useProfiles } from "@/lib/profiles";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

describe("ProfilesProvider", () => {
  beforeEach(() => {
    mocks.select.mockResolvedValue({ data: null, error: { message: "offline" } });
    mocks.from.mockReturnValue({ select: mocks.select });
  });

  it("does not expose fallback profiles while the live profile query is pending", async () => {
    const pending = deferred<{ data: Array<Record<string, unknown>>; error: null }>();
    mocks.select.mockReturnValue(pending.promise);

    const { result } = renderHook(() => useProfiles(), {
      wrapper: ({ children }) => <ProfilesProvider>{children}</ProfilesProvider>,
    });

    expect(result.current.profiles).toEqual([]);

    pending.resolve({
      data: [{ id: "profile-1", username: "lucia", full_name: "Lucía", role: "marketer" }],
      error: null,
    });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.profiles).toEqual([
      { id: "profile-1", username: "lucia", fullName: "Lucía", role: "marketer", avatar: undefined },
    ]);
  });
});
