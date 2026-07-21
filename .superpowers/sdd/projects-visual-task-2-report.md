# Projects Visual Task 2 — Structured step editor

## Scope

- Base SHA: `c846e28d80f56b20a9b80bc25a683339dc5eae10`
- Result: the single `feat(projects): build structured step editor` commit created for this task.
- Supabase schema, calls, retry handling, and persisted `Project.steps` shape were not changed.

## TDD evidence

### Red

1. `ProjectStepsEditor.test.tsx` was added before the component; the focused run failed because `ProjectStepsEditor` did not exist.
2. Page integration tests were added before replacing the textarea; the focused page run failed because `Paso 01` was absent and the legacy textarea remained.
3. The completed-step regression was tightened to use a legacy label with surrounding whitespace; it failed with `done: false`, proving that normalized labels did not preserve completion.
4. The pending-save regression failed after switching to Nota during an unresolved save, proving the structured draft lock was incomplete.

### Green

- Added the visual ordered editor with add/focus, Enter, delete/renumber, disabled, reduced-motion, visible focus, and 44-pixel control coverage.
- Integrated `Project["steps"]` drafts, cloned existing step objects, defaulted new owners from `user.username`, trimmed and filtered on save, and matched normalized labels when retaining `done`.
- Guarded draft-changing controls while saving, while retaining the existing failure/error/retry flow.

## Files

- `src/app/(app)/proyectos/_components/ProjectStepsEditor.tsx`
- `src/app/(app)/proyectos/_components/__tests__/ProjectStepsEditor.test.tsx`
- `src/app/(app)/proyectos/page.tsx`
- `src/app/(app)/proyectos/__tests__/page.test.tsx`

## Verification

- `npx.cmd vitest run "src/app/(app)/proyectos/_components/__tests__/ProjectStepsEditor.test.tsx" "src/app/(app)/proyectos/__tests__/page.test.tsx"`
- `npx.cmd tsc --noEmit`
- `git diff --check`

## Concerns

- No blocking concerns.
- Steps intentionally do not support drag reorder because persisted steps have no stable IDs. The editor uses positional rows only for short add/remove motion.
