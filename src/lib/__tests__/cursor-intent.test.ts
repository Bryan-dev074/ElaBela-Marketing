import { describe, expect, it } from "vitest";
import { cursorIntentProps, resolveCursorTarget } from "@/lib/cursor-intent";

function applyCursorIntent(element: HTMLElement, intent: Parameters<typeof cursorIntentProps>[0]) {
  for (const [name, value] of Object.entries(cursorIntentProps(intent))) {
    element.setAttribute(name, value);
  }
}

describe("cursor intent resolver", () => {
  it("resolves a nested icon inside an open button", () => {
    const button = document.createElement("button");
    const icon = document.createElement("span");
    button.append(icon);

    expect(resolveCursorTarget(icon)).toEqual({
      interactive: true,
      textEntry: false,
      color: "#d6ab99",
      label: "Abrir",
    });
  });

  it("does not make a passive blue ancestor interactive", () => {
    const card = document.createElement("div");
    card.dataset.cursorColor = "#60a5fa";
    card.dataset.cursorLabel = "En curso";
    const content = document.createElement("span");
    card.append(content);

    expect(resolveCursorTarget(content)).toEqual({
      interactive: false,
      textEntry: false,
      color: "",
      label: "",
    });
  });

  it("keeps an open button nude inside a passive blue ancestor", () => {
    const card = document.createElement("div");
    card.dataset.cursorColor = "#60a5fa";
    card.dataset.cursorLabel = "En curso";
    const button = document.createElement("button");
    card.append(button);

    expect(resolveCursorTarget(button)).toMatchObject({
      interactive: true,
      color: "#d6ab99",
      label: "Abrir",
    });
  });

  it("lets a destructive nested action win over its ancestor", () => {
    const parent = document.createElement("div");
    parent.dataset.cursorColor = "#60a5fa";
    parent.dataset.cursorLabel = "En curso";
    const button = document.createElement("button");
    applyCursorIntent(button, "danger");
    const icon = document.createElement("span");
    button.append(icon);
    parent.append(button);

    expect(resolveCursorTarget(icon)).toMatchObject({
      interactive: true,
      color: "#f87171",
      label: "Eliminar",
    });
  });

  it("keeps text input entry native and noninteractive", () => {
    const input = document.createElement("input");
    input.type = "text";

    expect(resolveCursorTarget(input)).toEqual({
      interactive: false,
      textEntry: true,
      color: "",
      label: "",
    });
  });

  it("does not advertise disabled actions", () => {
    const button = document.createElement("button");
    button.disabled = true;

    expect(resolveCursorTarget(button)).toMatchObject({
      interactive: false,
      textEntry: false,
      color: "",
      label: "",
    });
  });

  it.each([
    ["doing", "#60a5fa", "En curso"],
    ["complete", "#34d399", "Completar"],
    ["drag", "#c18468", "Arrastrar"],
  ] as const)("maps %s semantic intent", (intent, color, label) => {
    const button = document.createElement("button");
    applyCursorIntent(button, intent);

    expect(resolveCursorTarget(button)).toMatchObject({ interactive: true, color, label });
  });

  it("accepts legacy metadata directly on an actionable element", () => {
    const button = document.createElement("button");
    button.dataset.cursorLabel = "Configurar";
    button.dataset.cursorColor = "#123456";

    expect(resolveCursorTarget(button)).toMatchObject({
      interactive: true,
      color: "#123456",
      label: "Configurar",
    });
  });
});
