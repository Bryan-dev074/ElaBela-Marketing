import React, { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "@/components/ui";

function ModalHarness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>Abrir modal</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Modal accesible"
        initialFocusRef={initialFocusRef}
      >
        <button ref={initialFocusRef} type="button">Primera acción</button>
        <button type="button">Última acción</button>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("associates its title and moves focus into the dialog", () => {
    render(<ModalHarness />);
    const trigger = screen.getByRole("button", { name: "Abrir modal" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Modal accesible" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Primera acción" })).toHaveFocus();
  });

  it("contains forward and reverse tab navigation", () => {
    render(<ModalHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir modal" }));
    const dialog = screen.getByRole("dialog", { name: "Modal accesible" });
    const close = screen.getByRole("button", { name: "Cerrar" });
    const last = screen.getByRole("button", { name: "Última acción" });

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();

    close.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("closes with Escape and restores focus to the trigger", () => {
    render(<ModalHarness />);
    const trigger = screen.getByRole("button", { name: "Abrir modal" });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Modal accesible" }), { key: "Escape" });

    expect(trigger).toHaveFocus();
  });
});
