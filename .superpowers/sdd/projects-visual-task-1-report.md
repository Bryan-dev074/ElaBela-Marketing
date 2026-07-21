# Projects Visual Task 1 — implementation report

## Status and scope

- Implemented from base SHA `999be83d85a2df068f88d2462d8b497cf9150ecf`.
- Added the reusable progress route and interactive step list foundations.
- Did not import or render either component from `ProjectsPage`.
- Final commit subject: `feat(projects): add progress route and step interactions`.
- The final commit SHA is intentionally reported in the handoff: a commit cannot embed its own resulting SHA without changing that SHA.

## TDD evidence

### RED

- `ProjectProgress`: the first focused run failed because the module did not exist; after adding the public skeleton, all 5 tests failed for the expected missing behavior (incorrect calculation, absent ring/gradient IDs, absent note and zero-step states, and absent reduced-motion transition).
- `ProjectStepList`: after adding its public skeleton, all 6 tests failed for the expected missing behavior (no ordered list, rows, controls, pending state, read-only state, or reduced-motion transition).

### GREEN

- `npx.cmd vitest run "src/app/(app)/proyectos/_components/__tests__/ProjectProgress.test.tsx" "src/app/(app)/proyectos/_components/__tests__/ProjectStepList.test.tsx"`
  - 2 test files passed.
  - 11 tests passed, 0 failed.
- `npx.cmd tsc --noEmit`
  - Exit code 0; no TypeScript errors.

## Files

- `src/app/(app)/proyectos/_components/ProjectProgress.tsx`
- `src/app/(app)/proyectos/_components/ProjectStepList.tsx`
- `src/app/(app)/proyectos/_components/__tests__/ProjectProgress.test.tsx`
- `src/app/(app)/proyectos/_components/__tests__/ProjectStepList.test.tsx`
- `.superpowers/sdd/projects-visual-task-1-report.md`

## Self-review

- Progress uses a named determinate progressbar only for steps projects, distinct `useId()` SVG gradients, tabular data, a zero-step label, note-mode text, and emerald completion semantics.
- Motion is a 240 ms-or-less tween with the specified easing; reduced motion sets duration to zero. No springs, confetti, permanent pulse, or ambient loop were added.
- Step controls are 44 px minimum, expose `aria-pressed` and label-aware names, preserve visible controls for touch, and use complete/edit cursor intent according to state.
- Pending rows disable only the affected control and reserve status width for `Guardando`; read-only guidance is rendered once and every toggle is disabled.
- Styling stays within graphite, nude-deep (`#b98a76`), nude (`#d6ab99`), nude-soft (`#dec2ad`), and emerald-at-completion semantics.

## Concerns

- No functional blocker found.
- Browser-level composition QA is deferred until these foundations are intentionally integrated into `ProjectsPage`; this task explicitly forbids that integration.
