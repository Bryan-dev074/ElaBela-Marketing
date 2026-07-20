# Task 4 report — editable brand font uploads

## Scope

- Implemented real WOFF2, WOFF, TTF, and OTF uploads for `/marca` with a 5 MB per-file limit.
- Added compatible `BrandAsset` mapping for `fileUrl`, `fileFormat`, and `storagePath`; legacy name-only fonts and color rows remain supported.
- Added deterministic asset-ID-scoped runtime `@font-face` registration, format hints, CSS URL escaping, load/error feedback, UI-font fallback, and effect cleanup.
- Rebuilt each persisted font card around a leading live preview, editable sample, size and letter-spacing controls, short/paragraph specimens, display metadata, and edit/delete actions.
- Added create, metadata-only edit, optional replacement, and confirmed delete flows with explicit DB/Storage compensation ordering and surfaced cleanup failures.
- Reused the existing Storage helpers, error-aware collection mutations, Modal, Button, Input, Field, and Premium Noir Glow page vocabulary.
- Did not add a migration and did not touch weekly task/project functionality.

## TDD record

### RED

Tests were added before production changes.

1. `src/lib/__tests__/storage.test.ts`
   - New supported-extension/wrong-MIME case expected `marca.ttf` + `font/woff2` to be rejected.
   - Observed failure: `expected { ok: true } to deeply equal { ok: false, ... }`.
2. `src/lib/__tests__/brand-fonts.test.ts` and `src/lib/__tests__/db-mappers.test.ts`
   - Added wished-for descriptor/format/path and compatibility-mapper behavior.
   - Observed failures because the exported helpers/mappers were absent (`expected undefined to be type of 'function'`).
3. `src/app/(app)/marca/__tests__/page.test.tsx`
   - Added upload/create behavior first.
   - The initial render exposed missing jsdom `IntersectionObserver`; a test-only stub fixed that harness issue.
   - The meaningful RED then failed because no accessible `Agregar fuente` action existed.
4. Before the page implementation, expanded the same page test with runtime failure/fallback/unmount cleanup, preview controls, metadata-only edit, failed replacement compensation/editor retention, successful replacement cleanup ordering/warning, and both failed/successful confirmed-delete paths.

RED command:

```text
npx vitest run src/lib/__tests__/storage.test.ts src/app/(app)/marca/__tests__/page.test.tsx
Result: 2 failed, 8 passed (expected feature failures after the harness correction)

npx vitest run src/lib/__tests__/brand-fonts.test.ts src/lib/__tests__/db-mappers.test.ts
Result: 6 failed, 9 passed (helpers and mappers absent)
```

### GREEN

- Tightened font validation to require a supported extension and a matching declared MIME when a MIME is present; empty browser MIME remains accepted for a supported extension.
- Added tested helpers for file-format extraction, stable family naming, descriptor construction, correct CSS format hints, URL escaping, and Storage path extraction.
- Added explicit `brandAssetFromRow` / `brandAssetToRow` compatibility mappers and optional typed font metadata.
- Implemented the page workflows and runtime lifecycle to satisfy the prewritten behavior tests.
- TypeScript then caught `uploadedFormat` as potentially unassigned; initialized it to `null` and reran focused tests plus `tsc` successfully.

Focused GREEN:

```text
npx vitest run src/lib/__tests__/storage.test.ts src/lib/__tests__/brand-fonts.test.ts src/lib/__tests__/db-mappers.test.ts src/app/(app)/marca/__tests__/page.test.tsx
Result: 4 files passed, 33 tests passed
```

### Refactor

- Replaced temporary namespace/type-cast test access with direct typed imports after the new exports existed.
- Kept the runtime registration local to the font card lifecycle and kept pure descriptor/persistence logic in tested library helpers.
- Added explicit coverage that a failed create rollback reports its own Storage cleanup failure.

## Ordering and failure decisions

- Create: validate -> upload -> `addAsync`; on DB failure, remove the new URL and keep the modal/draft open. A rollback cleanup failure is appended to the DB error.
- Metadata-only edit: `updateAsync` only; Storage is never called.
- Replace: validate -> upload new -> `updateAsync`; on DB failure, remove only the new URL and keep the modal/draft; on DB success, close once and then attempt old-URL cleanup. Old cleanup failure becomes a non-retry status warning.
- Delete: confirmation -> `removeAsync`; DB failure leaves the modal open and never calls Storage; DB success closes the confirmation and then attempts file cleanup. Cleanup failure accurately states that the row was deleted but the file cleanup failed.
- Runtime: legacy rows do not create a descriptor. Uploaded rows inject one scoped `<style>` and call `document.fonts.load`; previews use the uploaded family only after load success and otherwise explicitly use `var(--font-sans)`. Effect cleanup removes the style on URL/format/ID changes and unmount.
- The integrated Inter UI card is a non-persisted reference/fallback; every persisted font, including legacy rows, has edit and delete actions.

## Self-review

- Reviewed every changed path and confirmed changes are limited to `/marca`, BrandAsset mapping/font helpers, font validation, tests, and this report.
- Confirmed no weekly feature file, schema, or migration changed.
- Confirmed `value` remains populated with the display name for legacy compatibility.
- Confirmed all persistence-success cleanup failures are warnings rather than resubmission/retry prompts.
- Confirmed tests assert DB-before-Storage ordering for replacement/delete and prohibit old-file deletion on DB failure.
- No unresolved correctness concern found. Browser decoding still depends on the actual uploaded font bytes; that is intentionally surfaced by the runtime error/fallback state.

## Verification

Run sequentially; `tsc` ran after the completed build and did not race `.next`.

```text
Focused: npx vitest run src/lib/__tests__/storage.test.ts src/lib/__tests__/brand-fonts.test.ts src/lib/__tests__/db-mappers.test.ts src/app/(app)/marca/__tests__/page.test.tsx
PASS — 4 files, 33 tests

Full unit suite: npm test
PASS — 13 files, 100 tests

Production build: npm run build
PASS — Next.js compiled, type-checked, generated 16/16 static pages; /marca included

Standalone types: npx tsc --noEmit
PASS — exit 0, no diagnostics

Whitespace: git diff --check
PASS — exit 0, no whitespace errors
```

## Independent-review fixes

### Review RED

The independent review found five blocking gaps. New regression tests were written before changing production:

1. Representative binary headers for WOFF2 (`wOF2`), WOFF (`wOFF`), OTF (`OTTO`), and the accepted TTF sfnt signatures (`00 01 00 00`, `true`, `typ1`) expected an asynchronous content validator. RED: the exported validator was absent.
2. A WOFF header renamed to `.woff2` expected a precise Spanish signature error. RED: no byte inspection existed.
3. A stubbed browser `FontFace` decoder rejected a signature-valid binary. RED: no local decode step existed.
4. Runtime tests made `document.fonts` absent, resolve with zero matches, and reject. RED: absent/empty cases were treated as loaded, and loading/error messages had no live-region semantics.
5. A stateful collection mock reproduced failure -> retry -> success and edit failure -> delete open. RED: the stale collection alert remained.
6. Delayed hydration rendered with `ready=false`, then rerendered ready. RED: create/edit/delete were enabled before the initial collection load completed.

Meaningful RED command/result:

```text
npx vitest run src/lib/__tests__/storage.test.ts src/app/(app)/marca/__tests__/page.test.tsx
Result before production fix: 14 feature failures, including missing async validator, runtime fallback semantics, stale alert, and hydration gating.
```

### Review GREEN

- Added `validateFontFile`, which first applies the existing 5 MB/extension/MIME gate, reads the real file bytes, verifies the exact four-byte signature for the selected extension, and then uses `new FontFace(validationFamily, arrayBuffer).load()` when the browser API exists.
- The local decode path passes an `ArrayBuffer` directly: it creates no object URL, adds no face to `document.fonts`, and therefore leaves no URL/FontFaceSet resource requiring explicit removal.
- `/marca` awaits content/decode validation before calling `uploadAsset`; arbitrary renamed bytes cannot reach Storage or persistence.
- Runtime registration now treats missing FontFaceSet support, a zero-length load result, or a rejected load as an error and keeps `var(--font-sans)`.
- Runtime loading uses `role="status"`; decode/load failure uses `role="alert"`.
- Every font save/delete attempt clears both the local attempt error and the collection error before work. Opening delete also clears inherited errors. Regression tests prove fail -> retry -> success removes the stale alert.
- Create, color add, font edit/replace, and delete are disabled and handler-gated until `useBrandAssets().ready` is true. A loading status explains the temporary gate.
- Existing create/replace/delete compensation order and warnings remain unchanged.

Review-focused GREEN:

```text
npx vitest run src/lib/__tests__/storage.test.ts src/lib/__tests__/brand-fonts.test.ts src/lib/__tests__/db-mappers.test.ts src/app/(app)/marca/__tests__/page.test.tsx
PASS — 4 files, 47 tests

npx tsc --noEmit
PASS — exit 0, no diagnostics
```

Review-fix final verification, run sequentially so standalone TypeScript did not race `.next`:

```text
Full unit suite: npm test
PASS — 13 files, 114 tests

Production build: npm run build
PASS — compiled, type-checked, and generated 16/16 static pages; /marca included

Standalone types: npx tsc --noEmit
PASS — exit 0, no diagnostics

Whitespace: git diff --check
PASS — exit 0, no whitespace errors
```
