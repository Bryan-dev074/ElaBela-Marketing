import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OwnerPicker } from "@/components/Avatar";

vi.stubGlobal("React", React);

vi.mock("@/lib/profiles", () => ({
  useProfiles: () => ({
    profiles: [
      { id: "1", username: "bryan", fullName: "Bryan" },
      { id: "2", username: "cielo", fullName: "Cielo" },
    ],
    byUsername: (username: string) => ({ username, fullName: username }),
  }),
}));

describe("OwnerPicker", () => {
  it("exposes the selected leader through aria-pressed", () => {
    render(<OwnerPicker value="bryan" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /bryan/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /cielo/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps every leader option at least 44 pixels tall", () => {
    render(<OwnerPicker value="bryan" onChange={vi.fn()} size="sm" />);

    for (const option of screen.getAllByRole("button")) {
      expect(option).toHaveClass("min-h-11");
    }
  });
});
