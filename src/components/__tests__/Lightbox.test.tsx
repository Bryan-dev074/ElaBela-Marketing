import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Lightbox } from "@/components/Lightbox";

describe("Lightbox", () => {
  it("opens a collection at the requested index and navigates through it", () => {
    render(
      <Lightbox
        images={["one.jpg", "two.jpg", "three.jpg"]}
        initialIndex={1}
        alt="Ejemplo"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "Ejemplo 2" })).toHaveAttribute("src", "two.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Imagen siguiente" }));
    expect(screen.getByRole("img", { name: "Ejemplo 3" })).toHaveAttribute("src", "three.jpg");
  });

  it("remains compatible with a single src", () => {
    render(<Lightbox src="legacy.jpg" alt="Legacy" onClose={vi.fn()} />);

    expect(screen.getByRole("img", { name: "Legacy" })).toHaveAttribute("src", "legacy.jpg");
  });
});
