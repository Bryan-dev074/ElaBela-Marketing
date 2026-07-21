export type CursorIntent =
  | "open" | "edit" | "complete" | "danger" | "doing"
  | "warning" | "drag" | "copy" | "external";

type CursorTarget = {
  interactive: boolean;
  textEntry: boolean;
  color: string;
  label: string;
};

const INTENT_META: Record<CursorIntent, { color: string; label: string }> = {
  open: { color: "#d6ab99", label: "Abrir" },
  edit: { color: "#dec2ad", label: "Editar" },
  complete: { color: "#34d399", label: "Completar" },
  danger: { color: "#f87171", label: "Eliminar" },
  doing: { color: "#60a5fa", label: "En curso" },
  warning: { color: "#fbbf24", label: "Confirmar" },
  drag: { color: "#c18468", label: "Arrastrar" },
  copy: { color: "#dec2ad", label: "Copiar" },
  external: { color: "#dec2ad", label: "Visitar" },
};

const ACTIONABLE_SELECTOR = "a[href],button,input,select,textarea,label,[role=\"button\"],[data-cursor]";
const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "password", "url", "tel", "number"]);
const INACTIVE_TARGET: CursorTarget = { interactive: false, textEntry: false, color: "", label: "" };

function isCursorIntent(value: string | null): value is CursorIntent {
  return value !== null && Object.hasOwn(INTENT_META, value);
}

function isTextEntry(target: Element): boolean {
  for (let current: Element | null = target; current; current = current.parentElement) {
    if (current.hasAttribute("contenteditable")) {
      return current.getAttribute("contenteditable") !== "false";
    }
  }

  const textarea = target.closest("textarea");
  if (textarea) return true;

  const input = target.closest("input");
  return input instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(input.type.toLowerCase());
}

function isDisabled(action: Element): boolean {
  return action.matches(":disabled")
    || action.getAttribute("aria-disabled")?.toLowerCase() === "true";
}

function getLegacyMeta(target: Element, action: Element) {
  for (let current: Element | null = target; current; current = current.parentElement) {
    const color = current.getAttribute("data-cursor-color");
    const label = current.getAttribute("data-cursor-label");
    if (color !== null || label !== null) return { color, label };
    if (current === action) break;
  }

  return { color: null, label: null };
}

export function cursorIntentProps(intent: CursorIntent, label?: string): Record<string, string> {
  const meta = INTENT_META[intent];
  return {
    "data-cursor": intent,
    "data-cursor-color": meta.color,
    "data-cursor-label": label || meta.label,
  };
}

export function resolveCursorTarget(target: Element | null): CursorTarget {
  if (!target) return INACTIVE_TARGET;
  if (isTextEntry(target)) return { ...INACTIVE_TARGET, textEntry: true };

  const action = target.closest(ACTIONABLE_SELECTOR);
  if (!action || isDisabled(action)) return INACTIVE_TARGET;

  const intent = action.getAttribute("data-cursor");
  if (isCursorIntent(intent)) {
    const meta = INTENT_META[intent];
    return {
      interactive: true,
      textEntry: false,
      color: meta.color,
      label: action.getAttribute("data-cursor-label") || meta.label,
    };
  }

  const legacy = getLegacyMeta(target, action);
  const open = INTENT_META.open;
  return {
    interactive: true,
    textEntry: false,
    color: legacy.color || open.color,
    label: legacy.label || open.label,
  };
}
