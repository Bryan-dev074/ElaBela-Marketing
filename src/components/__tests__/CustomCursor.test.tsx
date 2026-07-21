import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomCursor from "@/components/CustomCursor";
import "@/app/globals.css";

describe("CustomCursor", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows semantic action hover and its tag label", () => {
    const { container } = render(
      <>
        <CustomCursor />
        <button data-cursor="complete">Completar tarea</button>
      </>,
    );

    fireEvent.mouseOver(container.querySelector("button")!);

    expect(container.querySelector(".cursor-ring")).toHaveAttribute("data-hover", "1");
    expect(container.querySelector(".cursor-tag")).toHaveAttribute("data-visible", "1");
    expect(container.querySelector(".cursor-tag")).toHaveTextContent("Completar");
  });

  it.each([
    ["edit", "Editar"],
    ["complete", "Completar"],
    ["danger", "Eliminar"],
    ["doing", "En curso"],
    ["copy", "Copiar"],
    ["external", "Visitar"],
    ["drag", "Arrastrar"],
  ])("shows the %s semantic action label", (intent, label) => {
    const { container } = render(
      <>
        <CustomCursor />
        <button data-cursor={intent}>Acción</button>
      </>,
    );

    fireEvent.mouseOver(container.querySelector("button")!);

    expect(container.querySelector(".cursor-ring")).toHaveAttribute("data-hover", "1");
    expect(container.querySelector(".cursor-tag")).toHaveTextContent(label);
  });

  it("clears hover and hides the tag over a text field", () => {
    const { container } = render(
      <>
        <CustomCursor />
        <input type="text" aria-label="Título" />
      </>,
    );

    fireEvent.mouseOver(container.querySelector("input")!);

    expect(container.querySelector(".cursor-ring")).toHaveAttribute("data-hover", "0");
    expect(container.querySelector(".cursor-tag")).toHaveAttribute("data-visible", "0");
  });

  it.each([
    ["empty", ""],
    ["invalid", "not-a-real-input-type"],
  ])("preserves the native caret for a %s input type", (_description, type) => {
    const { container } = render(
      <>
        <CustomCursor />
        <input type={type} aria-label="Título" />
      </>,
    );

    expect(getComputedStyle(container.querySelector("input")!).cursor).toBe("text");
  });

  it("does not force the text caret for a non-textual input", () => {
    const { container } = render(
      <>
        <CustomCursor />
        <input type="checkbox" aria-label="Completar" />
      </>,
    );

    expect(getComputedStyle(container.querySelector("input")!).cursor).toBe("none");
  });

  it("does not tint the cursor from a passive annotated ancestor", () => {
    const { container } = render(
      <>
        <CustomCursor />
        <div data-cursor-color="#60a5fa" data-cursor-label="En curso"><span>Tarjeta pasiva</span></div>
      </>,
    );

    fireEvent.mouseOver(container.querySelector("span")!);

    expect(container.querySelector(".cursor-ring")).toHaveAttribute("data-hover", "0");
    expect(container.querySelector(".cursor-ring")).not.toHaveStyle("--cursor-accent: #60a5fa");
    expect(container.querySelector(".cursor-tag")).toHaveAttribute("data-visible", "0");
  });

  it("removes the body class and event behavior on cleanup", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<CustomCursor />);

    expect(document.body).toHaveClass("has-custom-cursor");
    expect(addEventListener).toHaveBeenCalledWith("mousemove", expect.any(Function), { passive: true });

    unmount();

    expect(document.body).not.toHaveClass("has-custom-cursor");
    expect(removeEventListener).toHaveBeenCalledWith("mousemove", expect.any(Function));
  });
});
