import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button, PageHeader, Reveal, Segmented } from "@/components/ui";

const motionState = vi.hoisted(() => ({
  reduced: false,
  elements: [] as Array<{
    tag: "header" | "div";
    initial?: unknown;
    animate?: unknown;
    whileInView?: unknown;
    transition?: Record<string, unknown>;
  }>,
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  const factory = (tag: "header" | "div") => ReactModule.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & {
    initial?: unknown;
    animate?: unknown;
    whileInView?: unknown;
    viewport?: unknown;
    transition?: Record<string, unknown>;
  }>(function MotionElement({ initial, animate, whileInView, viewport: _viewport, transition, ...props }, ref) {
    motionState.elements.push({ tag, initial, animate, whileInView, transition });
    return ReactModule.createElement(tag, { ...props, ref });
  });

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => motionState.reduced,
    motion: {
      header: factory("header"),
      div: factory("div"),
    },
  };
});

describe("shared UI accessibility", () => {
  beforeEach(() => {
    motionState.reduced = false;
    motionState.elements.length = 0;
  });

  it("keeps PageHeader motion at or below 300 ms", () => {
    render(<PageHeader eyebrow="Iniciativas" title="Proyectos" />);

    expect(motionState.elements[0]?.transition?.duration).toBeLessThanOrEqual(0.3);
  });

  it("removes PageHeader translation when reduced motion is preferred", () => {
    motionState.reduced = true;
    render(<PageHeader eyebrow="Iniciativas" title="Proyectos" />);

    expect(motionState.elements[0]).toMatchObject({
      initial: false,
      animate: { opacity: 1 },
      transition: expect.objectContaining({ duration: 0 }),
    });
  });

  it("keeps Reveal duration and capped delay within 300 ms", () => {
    render(<Reveal delay={2}>Contenido</Reveal>);

    const transition = motionState.elements[0]?.transition;
    expect(Number(transition?.duration) + Number(transition?.delay)).toBeLessThanOrEqual(0.3);
  });

  it("removes Reveal translation and delay when reduced motion is preferred", () => {
    motionState.reduced = true;
    render(<Reveal delay={2}>Contenido</Reveal>);

    expect(motionState.elements[0]).toMatchObject({
      initial: false,
      whileInView: { opacity: 1 },
      transition: expect.objectContaining({ duration: 0, delay: 0 }),
    });
  });

  it("exposes Segmented selection and 44-pixel targets", () => {
    render(<Segmented value="active" onChange={vi.fn()} options={[
      { value: "active", label: "Activos" },
      { value: "completed", label: "Completados" },
    ]} />);

    expect(screen.getByRole("button", { name: "Activos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Completados" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("button")).toEqual(expect.arrayContaining([
      expect.objectContaining({ className: expect.stringContaining("min-h-11") }),
      expect.objectContaining({ className: expect.stringContaining("min-w-11") }),
    ]));
    for (const option of screen.getAllByRole("button")) {
      expect(option).toHaveClass("min-h-11", "min-w-11");
    }
  });

  it("gives Button a 44-pixel target", () => {
    render(<Button>Guardar</Button>);

    expect(screen.getByRole("button", { name: "Guardar" })).toHaveClass("min-h-11", "min-w-11");
  });

  it("cancels Button press transforms when reduced motion is preferred", () => {
    render(<Button>Guardar</Button>);

    expect(screen.getByRole("button", { name: "Guardar" })).toHaveClass("motion-reduce:active:transform-none");
  });
});
