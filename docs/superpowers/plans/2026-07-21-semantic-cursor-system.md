# Semantic Cursor System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Make the ElaBela custom cursor communicate the action under the pointer instead of inheriting a container's status color.

**Architecture:** A pure cursor-intent module owns the controlled vocabulary, labels, colors, and DOM resolution rules. \`CustomCursor\` consumes that resolver, while existing controls declare semantic intent through helpers; passive status containers stop carrying cursor metadata.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tailwind CSS.

## Global Constraints

- Keep the existing custom cursor visual language and fine-pointer-only behavior.
- Inputs, textareas, and contenteditable fields retain the native text caret.
- The closest actionable element wins; passive ancestors never tint or label the cursor.
- Blue is used only for an action that changes something to \`En curso\`.
- Green is used for completing or confirming, red for destructive actions, nude for opening/editing/navigation, and copper/nude for dragging.
- Disabled controls do not advertise an action.
- Keep backward compatibility only for legacy metadata attached directly to a real actionable element.
- Add no dependency and change no Supabase data.

---

### Task 1: Semantic resolver and cursor runtime

**Files:**
- Create: \`src/lib/cursor-intent.ts\`
- Create: \`src/lib/__tests__/cursor-intent.test.ts\`
- Modify: \`src/components/CustomCursor.tsx\`
- Modify: \`src/app/globals.css\`
- Create: \`src/components/__tests__/CustomCursor.test.tsx\`

**Interfaces:**
- Produces: \`CursorIntent\`, \`cursorIntentProps(intent, label?)\`, and \`resolveCursorTarget(target)\`.
- \`resolveCursorTarget\` returns \`{ interactive, textEntry, color, label }\`.
- \`CustomCursor\` uses the result only on \`mouseover\`; pointer tracking remains direct.

- [ ] **Step 1: Write resolver tests**

Create tests that build DOM fixtures and assert:

\`\`\`ts
expect(resolveCursorTarget(button.querySelector("span"))).toMatchObject({
  interactive: true,
  textEntry: false,
  color: "#d6ab99",
  label: "Abrir",
});

expect(resolveCursorTarget(passiveCard)).toMatchObject({
  interactive: false,
  label: "",
});

expect(resolveCursorTarget(input)).toMatchObject({
  interactive: false,
  textEntry: true,
});
\`\`\`

Also cover a nested destructive button winning over an annotated passive ancestor, disabled controls, \`doing\`, \`complete\`, \`drag\`, and a legacy label/color directly on a button.

- [ ] **Step 2: Run resolver tests and confirm failure**

Run:

\`\`\`powershell
npx.cmd vitest run src/lib/__tests__/cursor-intent.test.ts
\`\`\`

Expected: FAIL because \`@/lib/cursor-intent\` does not exist.

- [ ] **Step 3: Implement the semantic resolver**

Implement the controlled metadata:

\`\`\`ts
export type CursorIntent =
  | "open" | "edit" | "complete" | "danger" | "doing"
  | "warning" | "drag" | "copy" | "external";

const INTENTS = {
  open: { color: "#d6ab99", label: "Abrir" },
  edit: { color: "#dec2ad", label: "Editar" },
  complete: { color: "#34d399", label: "Completar" },
  danger: { color: "#f87171", label: "Eliminar" },
  doing: { color: "#60a5fa", label: "En curso" },
  warning: { color: "#fbbf24", label: "Confirmar" },
  drag: { color: "#c18468", label: "Arrastrar" },
  copy: { color: "#dec2ad", label: "Copiar" },
  external: { color: "#dec2ad", label: "Visitar" },
} satisfies Record<CursorIntent, { color: string; label: string }>;
\`\`\`

Use these selectors:

\`\`\`ts
const ACTIONABLE =
  'a[href],button,input,select,textarea,label,[role="button"],[data-cursor]';
const TEXT_ENTRY =
  'textarea,[contenteditable="true"],input:not([type]),input[type="text"],input[type="email"],input[type="password"],input[type="search"],input[type="tel"],input[type="url"],input[type="number"]';
\`\`\`

Resolve explicit \`data-cursor-intent\` on the actionable element first. Accept legacy label/color only when the annotated node is the actionable node or is contained by it. Never walk from a button to a passive annotated ancestor.

- [ ] **Step 4: Run resolver tests and confirm pass**

Run the same Vitest command. Expected: all resolver tests PASS.

- [ ] **Step 5: Write CustomCursor interaction tests**

Mock \`window.matchMedia\` as a fine pointer, render \`CustomCursor\`, and assert:

\`\`\`ts
fireEvent.mouseOver(screen.getByRole("button", { name: "Abrir proyecto" }));
expect(document.querySelector(".cursor-ring")).toHaveAttribute("data-hover", "1");
expect(document.querySelector(".cursor-tag")).toHaveTextContent("Abrir");

fireEvent.mouseOver(screen.getByRole("textbox"));
expect(document.querySelector(".cursor-ring")).toHaveAttribute("data-hover", "0");
expect(document.querySelector(".cursor-tag")).toHaveAttribute("data-visible", "0");
\`\`\`

Include a passive blue status ancestor around a neutral open button and assert the cursor remains nude.

- [ ] **Step 6: Run cursor component tests and confirm failure**

Run:

\`\`\`powershell
npx.cmd vitest run src/components/__tests__/CustomCursor.test.tsx
\`\`\`

Expected: FAIL because the old component inherits metadata from passive ancestors.

- [ ] **Step 7: Wire the resolver into CustomCursor and refine CSS**

Replace the independent \`closest\` calls with \`resolveCursorTarget\`. Set \`data-hover="1"\` only when \`interactive\` is true. Hide the contextual tag for text entry and disabled controls.

In CSS, preserve the native caret only for actual text-entry selectors, not every input type. Add native \`grab\`/ \`grabbing\` fallback for coarse pointers on \`[data-cursor-intent="drag"]\`.

- [ ] **Step 8: Run both cursor suites**

Run:

\`\`\`powershell
npx.cmd vitest run src/lib/__tests__/cursor-intent.test.ts src/components/__tests__/CustomCursor.test.tsx
\`\`\`

Expected: both files PASS.

- [ ] **Step 9: Commit**

\`\`\`powershell
git add src/lib/cursor-intent.ts src/lib/__tests__/cursor-intent.test.ts src/components/CustomCursor.tsx src/components/__tests__/CustomCursor.test.tsx src/app/globals.css
git commit -m "feat(cursor): resolve semantic action intent"
\`\`\`

### Task 2: Migrate state and application cursor metadata

**Files:**
- Modify: \`src/components/ui.tsx\`
- Modify: \`src/app/(app)/proyectos/page.tsx\`
- Modify: \`src/components/views/DashboardView.tsx\`
- Modify: \`src/components/views/TareasView.tsx\`
- Modify: \`src/app/(app)/guiones/page.tsx\`
- Modify: cursor annotations found by \`rg -n "data-cursor-(color|label)|stateCursorProps" src\`
- Modify: \`src/components/__tests__/CustomCursor.test.tsx\`
- Modify: \`src/app/(app)/proyectos/__tests__/page.test.tsx\`

**Interfaces:**
- Consumes: \`cursorIntentProps\` and \`CursorIntent\` from Task 1.
- Produces: \`stateCursorProps\` limited to actual status-changing controls.
- Existing legacy data attributes may remain only on real actions and must map to the same semantic colors.

- [ ] **Step 1: Add failing migration tests**

In the project page test, render a project in \`doing\` and assert the card/opening surface has \`data-cursor-intent="open"\`, not a blue \`data-cursor-color\`.

In the cursor test, cover semantic edit, complete, danger, doing, copy, external, and drag declarations.

- [ ] **Step 2: Run the focused tests and confirm failure**

\`\`\`powershell
npx.cmd vitest run src/components/__tests__/CustomCursor.test.tsx "src/app/(app)/proyectos/__tests__/page.test.tsx"
\`\`\`

Expected: FAIL because project cards still spread \`stateCursorProps(project.status)\`.

- [ ] **Step 3: Restrict status cursor metadata**

Change \`stateCursorProps\` to return semantic intent:

\`\`\`ts
export function stateCursorProps(state: TaskState): Record<string, string> {
  if (state === "doing") return cursorIntentProps("doing", stateLabel(state));
  if (state === "done") return cursorIntentProps("complete", stateLabel(state));
  return cursorIntentProps("open", stateLabel(state));
}
\`\`\`

Keep it only on each \`StateSelector\` button, add \`aria-pressed={active}\`, and remove it from passive project/task/dashboard cards. Drag surfaces in Guiones receive \`cursorIntentProps("drag", "Arrastrar")\`.

- [ ] **Step 4: Migrate explicit actionable metadata**

Replace hardcoded cursor colors on actual destructive, warning, completion, copy, external, edit, and drag controls with \`cursorIntentProps\`. Keep user/profile name labels neutral. Do not add contextual bubbles to ordinary buttons whose native label is already obvious.

Verify the remaining annotations:

\`\`\`powershell
rg -n "data-cursor-color|stateCursorProps" src --glob "*.tsx" --glob "*.ts"
\`\`\`

Expected: hardcoded colors exist only where third-party brand identity is genuinely meaningful, such as WhatsApp; \`stateCursorProps\` appears only in \`StateSelector\`.

- [ ] **Step 5: Run focused and full tests**

\`\`\`powershell
npx.cmd vitest run src/components/__tests__/CustomCursor.test.tsx "src/app/(app)/proyectos/__tests__/page.test.tsx"
npm.cmd test
\`\`\`

Expected: focused tests and all existing tests PASS.

- [ ] **Step 6: Commit**

\`\`\`powershell
git add src
git commit -m "refactor(cursor): apply intent across interactions"
\`\`\`
