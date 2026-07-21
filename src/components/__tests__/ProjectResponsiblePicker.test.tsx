import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectResponsiblePicker } from "@/components/ProjectResponsiblePicker";

vi.stubGlobal("React", React);

vi.mock("@/lib/profiles", () => ({
  useProfiles: () => ({ profiles: [
    { id: "1", username: "bryan", fullName: "Bryan" },
    { id: "2", username: "cielo", fullName: "Cielo" },
    { id: "3", username: "elizabeth", fullName: "Elizabeth" },
  ] }),
}));
vi.mock("@/components/Avatar", () => ({ Avatar: ({ username }: { username: string }) => <span>{username}</span> }));

describe("ProjectResponsiblePicker", () => {
  it("excludes the lead and toggles unique additional responsibles", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ProjectResponsiblePicker owner="bryan" value={[]} onChange={onChange} />);
    expect(screen.queryByRole("button", { name: /bryan/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cielo/i }));
    expect(onChange).toHaveBeenCalledWith(["cielo"]);
    rerender(<ProjectResponsiblePicker owner="bryan" value={["cielo"]} onChange={onChange} />);
    expect(screen.getByRole("button", { name: /cielo/i })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /cielo/i }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("keeps every additional-responsible option at least 44 pixels tall", () => {
    render(<ProjectResponsiblePicker owner="bryan" value={[]} onChange={vi.fn()} />);

    for (const option of screen.getAllByRole("button")) {
      expect(option).toHaveClass("min-h-11");
    }
  });
});
