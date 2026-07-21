import React, { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, vi } from "vitest";
import { IconPicker } from "@/components/IconPicker";
import { TimePicker } from "@/components/TimePicker";
import { Modal } from "@/components/ui";

const motionState = vi.hoisted(() => ({
  reduced: false,
  transitions: [] as Array<Record<string, unknown> | undefined>,
}));

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  const ReactModule = await import("react");
  const MotionDiv = ReactModule.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & {
    animate?: unknown;
    initial?: unknown;
    exit?: unknown;
    transition?: Record<string, unknown>;
  }>(function MotionDiv({ animate: _animate, initial: _initial, exit: _exit, transition, ...props }, ref) {
    motionState.transitions.push(transition);
    return <div ref={ref} {...props} />;
  });
  return {
    ...actual,
    useReducedMotion: () => motionState.reduced,
    motion: new Proxy(actual.motion, {
      get(target, property, receiver) {
        if (property === "div") return MotionDiv;
        return Reflect.get(target, property, receiver);
      },
    }),
  };
});

const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeAll(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});

beforeEach(() => {
  motionState.reduced = false;
  motionState.transitions.length = 0;
});

afterAll(() => {
  if (originalScrollIntoView) {
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: originalScrollIntoView });
  } else {
    delete (Element.prototype as { scrollIntoView?: typeof Element.prototype.scrollIntoView }).scrollIntoView;
  }
});

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

function IconPickerModalHarness() {
  const [open, setOpen] = useState(false);
  const [icon, setIcon] = useState("✨");

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir selector</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Selector accesible">
        <IconPicker value={icon} onChange={setIcon} />
      </Modal>
    </>
  );
}

function TimePickerModalHarness() {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("09:00");

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir horario</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Horario accesible">
        <TimePicker value={time} onChange={setTime} />
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("makes every modal transition immediate when reduced motion is preferred", () => {
    motionState.reduced = true;
    render(<Modal open onClose={vi.fn()} title="Modal accesible">Contenido</Modal>);

    expect(motionState.transitions).not.toHaveLength(0);
    expect(motionState.transitions.every((transition) => transition?.duration === 0)).toBe(true);
  });

  it("supports a mobile-safe studio surface without changing dialog semantics", () => {
    render(
      <Modal open onClose={vi.fn()} title="Project Studio" size="studio">
        <button type="button">Acción del estudio</button>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Project Studio" });
    expect(dialog).toHaveClass("max-w-5xl");
    expect(dialog.parentElement).toHaveClass("p-2", "sm:p-4");
    expect(dialog.firstElementChild).toHaveClass("max-h-[calc(100dvh-1rem)]", "flex", "flex-col");
    expect(dialog.querySelector(".max-h-\\[calc\\(100dvh-9rem\\)\\]")).toBeInTheDocument();
  });

  it("gives the close action a 44-pixel target", () => {
    render(<Modal open onClose={vi.fn()} title="Modal accesible">Contenido</Modal>);

    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveClass("min-h-11", "min-w-11");
  });

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

  it("keeps an IconPicker portal inside the dialog focus boundary", () => {
    render(<IconPickerModalHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir selector" }));
    const dialog = screen.getByRole("dialog", { name: "Selector accesible" });
    const pickerTrigger = screen.getByRole("button", { name: "Elegir ícono" });
    fireEvent.click(pickerTrigger);

    const search = screen.getByPlaceholderText("Buscar… (ej: video, cliente)");
    expect(dialog).toContainElement(search);
    expect(search).toHaveFocus();

    const focusableButtons = dialog.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
    const last = focusableButtons[focusableButtons.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();

    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Selector accesible" })).toBeInTheDocument();
    expect(pickerTrigger).toHaveFocus();
  });

  it("keeps a TimePicker portal inside the dialog focus boundary", () => {
    render(<TimePickerModalHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir horario" }));
    const dialog = screen.getByRole("dialog", { name: "Horario accesible" });
    const pickerTrigger = screen.getByRole("button", { name: "09:00" });
    fireEvent.click(pickerTrigger);

    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(dialog).toContainElement(confirm);

    confirm.focus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();

    fireEvent.keyDown(confirm, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Horario accesible" })).toBeInTheDocument();
    expect(pickerTrigger).toHaveFocus();
  });
});
