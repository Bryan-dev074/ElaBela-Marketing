# Projects Premium Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn ElaBela Projects into a polished responsive workspace with progressive brand color, structured steps, an actionable detail view, and purposeful motion.

**Architecture:** Keep `ProjectsPage` as the data and mutation orchestrator and extract focused components under `proyectos/_components`. Existing project domain and persistence functions remain authoritative; presentation receives projects and callbacks and introduces no database changes.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion 11, Lucide, Vitest, Testing Library, Playwright.

## Global Constraints

- Preserve the existing Premium Noir/Glow design, typography, navigation, and base palette.
- Use one progress route joining ring, steps, and completion.
- Use `nude-deep → nude → nude-soft` with intensity based on progress; emerald means actual completion.
- Notes show state, never a fabricated percentage.
- Motion is reactive, under 300 ms, and respects `prefers-reduced-motion`.
- Essential controls remain visible without hover and have at least 44 by 44 CSS pixels.
- Never turn a card containing controls into one large button.
- Reuse shared Modal, Button, StateSelector, avatars, Markdown, and persistence hooks.
- Add no dependency and make no Supabase change.
- Keep optimistic updates, visible errors, and rollback.
- Completed projects are read-only until explicitly reopened.

---

### Task 1: Project progress route and interactive steps

**Files:**
- Create: `src/app/(app)/proyectos/_components/ProjectProgress.tsx`
- Create: `src/app/(app)/proyectos/_components/ProjectStepList.tsx`
- Create: `src/app/(app)/proyectos/_components/__tests__/ProjectProgress.test.tsx`
- Create: `src/app/(app)/proyectos/_components/__tests__/ProjectStepList.test.tsx`

**Interfaces:**
- Produces `getProjectProgress(project)` with `completed`, `total`, `percentage`, and `determinate`.
- Produces `ProjectProgress({ project, size, compact })`.
- Produces `ProjectStepList({ project, variant, disabled, pendingIndex, readOnly, onToggle, onOpen })`.

- [ ] **Step 1: Write failing progress tests**

Create a four-step project with three complete. Assert visible `3 de 4 · 75 %`, a named progressbar with `aria-valuenow="75"`, and an SVG gradient ID. Render a note project and assert `Nota del proyecto` appears without a progressbar.

```tsx
expect(screen.getByRole("progressbar", { name: /progreso de campaña/i }))
  .toHaveAttribute("aria-valuenow", "75");
expect(screen.getByText("3 de 4 · 75 %")).toBeInTheDocument();
expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the progress test**

```powershell
npx.cmd vitest run "src/app/(app)/proyectos/_components/__tests__/ProjectProgress.test.tsx"
```

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement ProjectProgress**

Use `useId` for the gradient and `useReducedMotion` for a 240 ms stroke transition. Expose minimum, maximum, current value, and visible text. Increase nude stop opacity with percentage. At 100 percent show an emerald check. For notes render document state without numeric progress.

```ts
const transition = reducedMotion
  ? { duration: 0 }
  : { duration: 0.24, ease: [0.23, 1, 0.32, 1] as const };
```

- [ ] **Step 4: Run the progress test**

Expected: PASS.

- [ ] **Step 5: Write failing step-list tests**

Cover compact mode with four rows plus `+2 pasos más`, detail mode with every row, `onToggle(1)`, `onOpen`, accessible pressed state, 44-pixel targets, pending state, and a read-only completed list with `Reabrí el proyecto para modificar sus pasos`.

- [ ] **Step 6: Run the step-list test**

```powershell
npx.cmd vitest run "src/app/(app)/proyectos/_components/__tests__/ProjectStepList.test.tsx"
```

Expected: FAIL because the component is missing.

- [ ] **Step 7: Implement ProjectStepList**

Use a semantic ordered list. Each row renders sequence number, vertical connector, button, label, and pending spinner. Buttons have stable accessible labels and `aria-pressed`. Use a short check scale and opacity sweep; remove transforms when reduced motion is enabled.

```tsx
<button
  type="button"
  aria-pressed={step.done}
  aria-label={step.done ? "Marcar paso como pendiente" : "Completar paso"}
  disabled={disabled || readOnly}
  onClick={() => onToggle(index)}
/>
```

- [ ] **Step 8: Run both component tests**

```powershell
npx.cmd vitest run "src/app/(app)/proyectos/_components/__tests__/ProjectProgress.test.tsx" "src/app/(app)/proyectos/_components/__tests__/ProjectStepList.test.tsx"
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add "src/app/(app)/proyectos/_components"
git commit -m "feat(projects): add progress route and step interactions"
```

### Task 2: Structured step editor

**Files:**
- Create: `src/app/(app)/proyectos/_components/ProjectStepsEditor.tsx`
- Create: `src/app/(app)/proyectos/_components/__tests__/ProjectStepsEditor.test.tsx`
- Modify: `src/app/(app)/proyectos/page.tsx`
- Modify: `src/app/(app)/proyectos/__tests__/page.test.tsx`

**Interfaces:**
- Produces `ProjectStepsEditor({ value, onChange, disabled })` where value is `Project["steps"]`.
- Draft steps change from newline text to `Project["steps"]`.
- Saving filters blank labels and preserves existing completion by label.

- [ ] **Step 1: Write failing editor tests**

Assert a new editor contains `Paso 01`. Clicking `Añadir paso` appends and focuses `Paso 02`. Enter from the last non-empty row adds `Paso 03`. Removing the middle row renumbers the remainder. Disabled mode rejects changes.

```tsx
await user.click(screen.getByRole("button", { name: "Añadir paso" }));
expect(screen.getByLabelText("Paso 02")).toHaveFocus();
await user.keyboard("{Enter}");
expect(screen.getByLabelText("Paso 03")).toHaveFocus();
```

- [ ] **Step 2: Run the editor test**

```powershell
npx.cmd vitest run "src/app/(app)/proyectos/_components/__tests__/ProjectStepsEditor.test.tsx"
```

Expected: FAIL because the editor is missing.

- [ ] **Step 3: Implement ProjectStepsEditor**

Render indexed rows with connector, input, and 44-pixel delete button. Update immutable arrays. Focus newly created rows with indexed refs. Enter adds only from the last non-empty row and prevents form submission.

```ts
const updateLabel = (index: number, label: string) =>
  onChange(value.map((step, current) => current === index ? { ...step, label } : step));
const addStep = () => onChange([...value, { label: "", done: false }]);
const removeStep = (index: number) =>
  onChange(value.filter((_, current) => current !== index));
```

- [ ] **Step 4: Run the editor test**

Expected: PASS.

- [ ] **Step 5: Write failing page integration tests**

Open `Nuevo proyecto` and assert `Paso 01` replaces `Pasos (uno por línea)`. Enter two labels, save, and assert `addAsync` receives two step objects. Edit an existing project and confirm completed rows retain `done`.

- [ ] **Step 6: Run project page tests**

```powershell
npx.cmd vitest run "src/app/(app)/proyectos/__tests__/page.test.tsx"
```

Expected: FAIL with the old textarea.

- [ ] **Step 7: Integrate structured draft steps**

Change draft steps to `Project["steps"]`. Make `toDraft(project, defaultOwner)` copy existing steps or return one blank row. Use `user.username` instead of a hardcoded owner for new projects. Trim and filter rows before save. Replace the textarea with `ProjectStepsEditor`.

- [ ] **Step 8: Run editor and page tests**

```powershell
npx.cmd vitest run "src/app/(app)/proyectos/_components/__tests__/ProjectStepsEditor.test.tsx" "src/app/(app)/proyectos/__tests__/page.test.tsx"
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add "src/app/(app)/proyectos"
git commit -m "feat(projects): build structured step editor"
```

### Task 3: Premium cards and actionable Project Studio

**Files:**
- Create: `src/app/(app)/proyectos/_components/ProjectCard.tsx`
- Create: `src/app/(app)/proyectos/_components/ProjectDetailModal.tsx`
- Create: `src/app/(app)/proyectos/_components/__tests__/ProjectCard.test.tsx`
- Create: `src/app/(app)/proyectos/_components/__tests__/ProjectDetailModal.test.tsx`
- Modify: `src/app/(app)/proyectos/page.tsx`
- Modify: `src/app/(app)/proyectos/__tests__/page.test.tsx`
- Modify: `src/components/ui.tsx`
- Modify: `src/components/__tests__/Modal.test.tsx`

**Interfaces:**
- `ProjectCard` receives project, section, pending operation, profiles, index, and callbacks for open, status, step, edit, delete, and reopen.
- `ProjectDetailModal` receives project, pending operation, error, and callbacks for close, status, step, edit, and delete.
- `Modal` adds `size?: "default" | "wide" | "studio"` while retaining the existing `wide` prop.

- [ ] **Step 1: Write a failing Modal studio test**

Render a studio Modal and assert `max-w-5xl` and viewport-aware scroll height while all existing focus tests still pass.

- [ ] **Step 2: Implement compatible Modal sizing**

```ts
const widthClass = size === "studio"
  ? "max-w-5xl"
  : size === "wide" || wide
    ? "max-w-2xl"
    : "max-w-md";
```

Use `max-h-[calc(100dvh-9rem)]` for content and keep portal, Escape, focus trap, and focus return unchanged.

- [ ] **Step 3: Write failing ProjectCard tests**

Assert an explicit `Abrir proyecto <nombre>` surface, no nested controls, independent step/status actions, visible objective/team/type/priority/date, progress rail, `+N pasos más`, completed audit/reopen action, and neutral opening intent for a `doing` project.

- [ ] **Step 4: Implement ProjectCard**

Use an article plus a stretched opening button behind sibling controls. Add a top `scaleX` progress rail, 2–3-pixel hover lift, soft border glow, and focus-revealed arrow. Compose `ProjectProgress` and compact `ProjectStepList`. Cap reveal delay with `Math.min(index, 6) * 0.045`.

- [ ] **Step 5: Write failing ProjectDetailModal tests**

Assert type, priority, objective, owner, extra responsibles, start, due, completion audit, state controls inside the dialog, all steps, Markdown note without numeric progress, edit, complete, reopen, pending locks, and visible inline error.

- [ ] **Step 6: Implement ProjectDetailModal**

Compose the shared studio Modal. Use two columns on desktop and one on mobile. Main column holds progress and steps or Markdown; side column holds team, dates, and audit. StateSelector lives inside the dialog. Active projects expose `Completar proyecto`; completed projects expose `Reabrir proyecto` and read-only steps.

- [ ] **Step 7: Integrate cards and detail**

Replace inline cards/detail in `ProjectsPage`. Replace `pendingId` with:

```ts
type PendingOperation = {
  projectId: string;
  kind: "status" | "step" | "save" | "delete";
  stepIndex?: number;
} | null;
```

Keep current optimistic persistence and set exact operations. Keep the open project derived by ID. Style completed-person filters with a visible pressed state.

- [ ] **Step 8: Run focused tests**

```powershell
npx.cmd vitest run src/components/__tests__/Modal.test.tsx "src/app/(app)/proyectos/_components/__tests__/ProjectCard.test.tsx" "src/app/(app)/proyectos/_components/__tests__/ProjectDetailModal.test.tsx" "src/app/(app)/proyectos/__tests__/page.test.tsx"
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add src/components/ui.tsx src/components/__tests__/Modal.test.tsx "src/app/(app)/proyectos"
git commit -m "feat(projects): add premium cards and project studio"
```

### Task 4: Motion, accessibility, responsive QA, and verification

**Files:**
- Modify: `src/app/(app)/proyectos/_components/*.tsx`
- Modify: `src/app/(app)/proyectos/page.tsx`
- Modify: tests covering every issue found during QA
- Create: `e2e/projects.spec.ts` only if existing authenticated helpers support it

**Interfaces:**
- Consumes Tasks 1–3 and changes no public data API.

- [ ] **Step 1: Add reduced-motion tests**

Mock reduced motion and assert progress and step feedback avoid springs/transforms while the state still updates visibly.

- [ ] **Step 2: Run the focused tests**

Expected: at least one reduced-motion assertion fails before hardening.

- [ ] **Step 3: Harden every interaction state**

Verify default, hover, active, focus-visible, disabled, loading, empty, and error. Keep motion below 300 ms, animate transform/opacity, cap stagger, and add no `transition-all`.

- [ ] **Step 4: Run static and unit verification**

```powershell
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run build
```

Expected: 0 failures.

- [ ] **Step 5: Perform authenticated visual QA**

At approximately 1440-pixel desktop and 390-pixel mobile widths verify all tabs, a note, more than four steps, open/edit/complete/reopen, no nested click collisions, no clipped footer or overflow, visible keyboard focus, and neutral cursor over an En curso card.

- [ ] **Step 6: Run Playwright**

Add an authenticated project flow only if the existing fixture supports it; otherwise retain manual authenticated evidence and run the existing suite.

```powershell
npm.cmd run test:e2e
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src e2e
git commit -m "test(projects): verify premium project experience"
```
