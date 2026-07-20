import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Lightbox } from "@/components/Lightbox";

function LightboxHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir visor</button>
      {open ? (
        <Lightbox
          images={["one.jpg", "two.jpg"]}
          alt="Ejemplo"
          caption="Visor accesible"
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

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

  it("moves focus into the viewer and contains tab navigation", () => {
    render(<LightboxHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir visor" }));
    const dialog = screen.getByRole("dialog", { name: "Visor accesible" });
    const close = screen.getByRole("button", { name: "Cerrar" });
    const previous = screen.getByRole("button", { name: "Imagen anterior" });

    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(previous).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(close).toHaveFocus();
  });

  it("restores focus to the trigger after Escape closes the viewer", () => {
    render(<LightboxHarness />);
    const trigger = screen.getByRole("button", { name: "Abrir visor" });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Visor accesible" }), { key: "Escape" });

    expect(trigger).toHaveFocus();
  });
});
