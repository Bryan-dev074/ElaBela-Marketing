# Projects Visual Task 4 report

## Scope and reviewed SHAs

The original Projects visual hardening reviewed the integrated experience at explicit source SHA `c7ded9e` and produced Task 4 commit `ec29f41`. The first corrective pass was committed as `5dcbe46`.

This accessibility rereview follow-up corrects the remaining Important finding against the Task 4 result. It changes only the shared selection/field primitives used by the Projects editor, directly covering tests, and this report. It does not change Supabase, persistence, or project mutation behavior.

The accessibility corrective commit's exact SHA is reported in the task handoff. It cannot be embedded in this tracked report because changing the report changes that same commit SHA.

## Findings and fixes

1. Shared `PageHeader` and `Reveal` used translation with 450–500 ms transitions and had no reduced-motion branch. Both now use `useReducedMotion`, remove translation entirely when reduction is preferred, run for 240 ms normally, and make `Reveal` cap its delay at 60 ms so duration plus delay stays at or below 300 ms.
2. Shared `.card-sheen` used an 850 ms decorative transform. It now completes in 250 ms normally and removes the pseudo-element decoration, transform, and transition under reduced motion. Shared `.press` also removes its active transform and transition under reduced motion; generic `Button` explicitly cancels its active scale in that mode.
3. `Segmented` did not expose selection semantics or guarantee 44-pixel targets. Each option now has `aria-pressed` and `min-h-11 min-w-11`.
4. Generic `Button` and the Modal close action did not guarantee 44-pixel targets. Both now have `min-h-11 min-w-11`.
5. The Projects summary included retained hidden steps from `contentMode: "note"` projects. The aggregate now includes steps only from active `contentMode: "steps"` projects. Note cards and detail continue to show editorial text without a fabricated project percentage.
6. The previous binding-review claim that all Projects editor controls guaranteed 44-pixel targets was incomplete: `OwnerPicker` rendered at 32/36 pixels, `ProjectResponsiblePicker` rendered at 36 pixels, and shared `.field` had no 44-pixel minimum. Both pickers now use `min-h-11`; the selected leader exposes `aria-pressed`; the additional-responsible picker retains its existing `aria-pressed`; and `.field` now has `min-height: 2.75rem`, which remains compatible with taller textareas.

## TDD evidence

Focused tests were added before production changes.

- RED: `npm.cmd test -- "src/components/__tests__/ui.test.tsx" "src/components/__tests__/motion-accessibility.test.ts" "src/components/__tests__/Modal.test.tsx" "src/app/(app)/proyectos/__tests__/page.test.tsx"` failed with the expected 12 regressions: 7 shared primitive assertions, 3 CSS motion assertions, 1 Modal target assertion, and 1 note-step aggregate assertion.
- GREEN: the identical focused command passed 4/4 files and 44/44 tests.
- Accessibility rereview RED: `npm.cmd test -- "src/components/__tests__/Avatar.test.tsx" "src/components/__tests__/ProjectResponsiblePicker.test.tsx" "src/components/__tests__/motion-accessibility.test.ts"` failed with the expected 4 regressions: 2 leader-selection assertions, 1 additional-responsible target assertion, and 1 shared-field minimum-height assertion.
- Accessibility rereview GREEN: the identical focused command passed 3/3 files and 8/8 tests.

## Binding review

- Direct Framer Motion in the Projects page/components and the shared primitives used there is reduced-motion aware. Normal non-decorative durations are 150–250 ms; `Reveal` duration plus capped delay is at most 300 ms; ProjectCard list delay remains bounded.
- Reduced motion removes translation, scale, active press transforms, and the decorative card sheen while preserving immediate opacity/state feedback.
- No `transition-all` appears in the Projects task sources or changed shared primitives. Progress animation uses transform/opacity/stroke state rather than layout dimensions.
- `Segmented`, generic `Button`, Modal close, both Projects people pickers, shared project fields, project state/step/editor actions, and card actions have stable accessible labels or visible text and at least 44-pixel targets. Selected segmented options, leader options, and additional-responsible options expose `aria-pressed`.
- Progress remains numeric, tabular, and accessible; status includes text; note projects retain no project percentage; SVG gradient IDs remain per-instance.
- Cards retain a separate opening surface without nested interactive semantics. Completed steps still require explicit reopen. Structured editor minimum-row, Enter, pending, visible error, and retry behavior is unchanged and covered.
- Mobile-safe Project Studio/Modal sizing remains unchanged. No new effects, memoization, client boundaries, Supabase calls, or business mutations were introduced.

## Verification

- Original focused RED → GREEN — expected 12 failures, then passed: 4 files, 44 tests.
- Accessibility rereview focused RED → GREEN — expected 4 failures, then passed: 3 files, 8 tests.
- `npm.cmd test` — passed: 37 files, 346 tests.
- `npx.cmd tsc --noEmit` — passed with exit code 0.
- `npm.cmd run build` — passed; Next.js production build compiled and generated 16/16 static pages.
- `npm.cmd run test:e2e` — not rerun in this correction. Existing E2E coverage remains login-only and cannot reach authenticated Projects without credentials or weakened authentication; the changed behavior is covered by focused component/page tests.
- `git diff --check` — passed after the report edit; rerun once more immediately before commit.

## Commit and repository hygiene

Accessibility corrective commit subject: `fix(projects): complete editor accessibility`.

No push was performed. The unrelated pre-existing modification to `.superpowers/sdd/projects-visual-task-2-report.md` remains deliberately unstaged and excluded.

## Remaining concern for controller QA

Authenticated desktop/mobile visual QA of `/proyectos` still requires an existing signed-in browser session. Automated authenticated Projects E2E was not added because the current helpers cannot reach that page safely without embedding credentials or weakening authentication.
