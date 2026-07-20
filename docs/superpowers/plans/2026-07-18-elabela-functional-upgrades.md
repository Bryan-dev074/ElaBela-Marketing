# ElaBela Functional Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver every approved functional upgrade for Publications, Tools, Brand Manual, Credentials, Daily Tasks, Projects, and monthly History while removing weekly-task functionality and preserving the current interface.

**Architecture:** Add an idempotent Supabase migration and small testable domain modules first, then connect focused React components and existing routes to those interfaces. Existing rows remain readable through compatibility mappers, large non-secret assets move to a public-read/authenticated-write Storage bucket, and monthly productivity comes from dated completion records rather than destructive resets.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase JS/SSR, Tailwind CSS, Framer Motion, Vitest, React Testing Library, Playwright.

## Global Constraints

- Preserve the current Premium Noir Glow shell, Inter typography, glass cards, warm nude accent, animated background, cursor, modal vocabulary, and responsive behavior.
- Do not implement a global redesign.
- Remove WeeklyTask, useWeeklyTasks, weekly-task creation/conversion/scheduling, and every weekly-task UI/calendar reference from the active application.
- Do not drop the legacy weekly_tasks table from the existing remote database and do not delete legacy archived projects.
- Publication carousel interval is exactly 1500 ms, supports at most 8 images, rejects source files over 8 MB, and disables autoplay under prefers-reduced-motion.
- Font files accept only .woff2, .woff, .ttf, and .otf up to 5 MB; fonts can be renamed, have their role edited, be replaced, and be deleted.
- Default Tool categories, in order, are Prompts, IA, Apps, Ads, Enlaces, and Redes Sociales.
- Store only non-secret media/fonts in the public elabela-assets bucket. Never upload credential values.
- Group activity by America/Asuncion calendar dates and calculate month views without deleting prior records.
- Keep shared/private credential visibility rules unchanged while adding scope-compatible categories.
- Target Supabase project reference is uxeuipryacnwsqhegrrs. Never commit .env.local, access tokens, database passwords, or service-role keys.
- Every functional task follows RED → GREEN → REFACTOR, then commit and push to origin/codex/elabela-functional-upgrades.

---

### Task 1: Test harness, migration, safe persistence, and asset service

**Files:**
- Modify: package.json
- Modify: package-lock.json
- Create: vitest.config.ts
- Create: src/test/setup.ts
- Create: src/lib/storage.ts
- Create: src/lib/__tests__/storage.test.ts
- Modify: src/lib/db.ts
- Create: src/lib/__tests__/db-mappers.test.ts
- Modify: supabase/schema.sql
- Create: supabase/config.toml
- Create: supabase/migrations/20260718190000_elabela_functional_upgrades.sql

**Interfaces:**
- Produces: AssetFolder = "publications" | "tools" | "brand/fonts"; validateAssetFile(file, rules); uploadAsset(file, folder); removeAssetByPublicUrl(url).
- Produces: CollectionMutationResult = { ok: true } | { ok: false; error: string }; useCollection returns error, clearError, addAsync, upsertAsync, updateAsync, removeAsync while preserving current synchronous methods for untouched routes.
- Produces database tables/columns required by Tasks 2–8.

- [ ] **Step 1: Install and configure the test harness**

Run:

~~~powershell
npm install --save-dev --save-exact vitest@3.2.4 jsdom@26.1.0 @testing-library/react@16.3.0 @testing-library/jest-dom@6.6.3 @testing-library/user-event@14.6.1
~~~

Add scripts:

~~~json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
~~~

Configure jsdom, the @ alias, globals, setupFiles, CSS support, and restoreMocks in vitest.config.ts. Import @testing-library/jest-dom/vitest and run cleanup after each test in src/test/setup.ts.

- [ ] **Step 2: Write failing asset-validation and mapper tests**

Tests must assert:

~~~ts
expect(validateAssetFile(image, { kind: "image", maxBytes: 8 * 1024 * 1024 })).toEqual({ ok: true });
expect(validateAssetFile(oversizedImage, { kind: "image", maxBytes: 8 * 1024 * 1024 })).toEqual({
  ok: false,
  error: "foto.png supera el límite de 8 MB.",
});
expect(validateAssetFile(font, { kind: "font", maxBytes: 5 * 1024 * 1024 })).toEqual({ ok: true });
expect(publicationFromRow({ example_image: "legacy.jpg", example_images: [] }).exampleImages).toEqual(["legacy.jpg"]);
expect(publicationFromRow({ example_image: "legacy.jpg", example_images: ["new.jpg"] }).exampleImages).toEqual(["new.jpg"]);
~~~

Run:

~~~powershell
npm test -- src/lib/__tests__/storage.test.ts src/lib/__tests__/db-mappers.test.ts
~~~

Expected: FAIL because storage helpers and exported mappers do not exist.

- [ ] **Step 3: Implement asset helpers and explicit collection mutation results**

Use a unique object path composed from folder, Date.now(), crypto.randomUUID(), and a sanitized extension. Upload with:

~~~ts
const { data, error } = await supabase.storage
  .from("elabela-assets")
  .upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });
if (error) return { ok: false, error: error.message };
const { data: publicData } = supabase.storage.from("elabela-assets").getPublicUrl(data.path);
return { ok: true, url: publicData.publicUrl };
~~~

Async collection methods must apply an optimistic update, await Supabase, restore the previous array on error, expose the message, and return CollectionMutationResult. Existing method names remain available so unaffected screens compile.

- [ ] **Step 4: Create the idempotent schema and dated migration**

Initialize Supabase CLI metadata with npx supabase@latest init, create the migration through npx supabase@latest migration new elabela_functional_upgrades, and ensure the committed migration contains:

- publication columns example_images text[] not null default '{}', guide text not null default '', tool_ids text[] not null default '{}';
- tool_categories and tool_items.category_id;
- brand_assets.file_url, file_format, storage_path;
- credential_categories and credentials.category_id;
- daily_task_logs with unique (task_id, activity_date), plus task name/icon and
  assignee snapshots so later renames/deletions do not corrupt history;
- projects.completed_at and projects.completed_by;
- elabela-assets public bucket with 8 MB bucket limit and allowed image/font MIME types;
- RLS enabled on every new public table;
- explicit grants to authenticated for Data API access;
- authenticated Storage INSERT, SELECT, UPDATE, and DELETE policies scoped to elabela-assets;
- seeded categories in the exact required order and legacy category backfill;
- no DROP TABLE weekly_tasks and no destructive archived-project backfill.

The canonical schema must stop creating weekly_tasks and must use TO authenticated policies instead of auth.role() checks for newly added policies.

- [ ] **Step 5: Verify and publish Task 1**

Run:

~~~powershell
npm test -- src/lib/__tests__/storage.test.ts src/lib/__tests__/db-mappers.test.ts
npx tsc --noEmit
npm run build
git add package.json package-lock.json vitest.config.ts src/test src/lib/storage.ts src/lib/db.ts supabase
git commit -m "feat: add persistence foundation for functional upgrades"
git push
~~~

Expected: tests, TypeScript, and production build pass; push updates the tracked feature branch.

---

### Task 2: Publications gallery, lightbox, editor, and production guide

**Files:**
- Modify: src/lib/data.ts
- Create: src/lib/publications.ts
- Create: src/lib/__tests__/publications.test.ts
- Create: src/components/MediaCarousel.tsx
- Create: src/components/__tests__/MediaCarousel.test.tsx
- Modify: src/components/Lightbox.tsx
- Modify: src/app/(app)/publicaciones/page.tsx
- Modify: src/lib/db.ts

**Interfaces:**
- Consumes: uploadAsset and removeAssetByPublicUrl from Task 1; ToolItem and useToolItems.
- Produces: PostType.exampleImages, guide, toolIds; normalizePublicationImages; resolveGuideTools; MediaCarousel({ images, alt, intervalMs, onOpen }).

- [ ] **Step 1: Write failing publication-domain tests**

Tests must assert ordered legacy promotion, removal of empty URLs, maximum-eight validation, and linked tool resolution:

~~~ts
expect(normalizePublicationImages([], "legacy.jpg")).toEqual(["legacy.jpg"]);
expect(normalizePublicationImages(["a.jpg", "", "b.jpg"], "legacy.jpg")).toEqual(["a.jpg", "b.jpg"]);
expect(validatePublicationImages(Array.from({ length: 9 }, (_, i) => String(i)))).toBe(
  "Podés guardar hasta 8 imágenes de ejemplo."
);
expect(resolveGuideTools(["tool-2", "missing", "tool-1"], tools).map((tool) => tool.id)).toEqual(["tool-2", "tool-1"]);
~~~

Run npm test -- src/lib/__tests__/publications.test.ts and confirm expected failures.

- [ ] **Step 2: Write failing carousel component tests**

Using fake timers, assert:

~~~ts
expect(screen.getByText("1 / 3")).toBeInTheDocument();
await act(async () => vi.advanceTimersByTimeAsync(1500));
expect(screen.getByText("2 / 3")).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "Imagen anterior" }));
expect(screen.getByText("1 / 3")).toBeInTheDocument();
~~~

Mock matchMedia with matches: true and assert advancing 3000 ms does not change the slide. Click the image and assert onOpen receives the active index.

Run npm test -- src/components/__tests__/MediaCarousel.test.tsx and confirm failures because the component does not exist.

- [ ] **Step 3: Implement model, mapper, carousel, and collection lightbox**

PostType becomes:

~~~ts
export interface PostType {
  id: string;
  name: string;
  icon: string;
  desc: string;
  accent: string;
  example?: string;
  exampleImage?: string;
  exampleImages: string[];
  guide: string;
  toolIds: string[];
}
~~~

MediaCarousel uses object-contain, exactly 1500 ms by default, modulo navigation, position dots/text, accessible buttons, and reduced-motion autoplay suppression. Lightbox accepts images: string[] and initialIndex while remaining compatible with its current single-src caller.

- [ ] **Step 4: Implement the publication editor and guide modal**

The editor accepts multiple files, validates 8 MB/8 total, compresses images, uploads them, displays reorder/remove controls, edits Markdown guide text, and selects related Tools. Save waits for upload and database mutation results; on failure it leaves the editor open with an error.

The card media sits above the title, uses contained images, opens Lightbox, and title/body opens a separate guide modal. The guide renders Markdown and linked Tools with safe external anchors.

Intent: marketing teammate needs to understand and produce a post quickly; media and guide are the focal content.
Hierarchy: contained example media first, post name second, guide content third, edit/delete demoted.
Palette: reuse current semantic tokens and each post accent only for identity.
Depth: existing glass borders and modal elevation.
Surfaces: unchanged card and modal surfaces.
Typography: existing Inter hierarchy and current PageHeader/Card styles.
Spacing: current 4 px grid and existing card density.

- [ ] **Step 5: Verify and publish Task 2**

Run:

~~~powershell
npm test -- src/lib/__tests__/publications.test.ts src/components/__tests__/MediaCarousel.test.tsx
npx tsc --noEmit
npm run build
git add src/lib/data.ts src/lib/db.ts src/lib/publications.ts src/lib/__tests__/publications.test.ts src/components/MediaCarousel.tsx src/components/__tests__/MediaCarousel.test.tsx src/components/Lightbox.tsx "src/app/(app)/publicaciones/page.tsx"
git commit -m "feat: add publication galleries and guides"
git push
~~~

---

### Task 3: Dynamic Tool categories and improved media/filter layout

**Files:**
- Create: src/lib/tool-categories.ts
- Create: src/lib/__tests__/tool-categories.test.ts
- Modify: src/lib/data.ts
- Modify: src/lib/db.ts
- Create: src/components/ToolCategoryManager.tsx
- Modify: src/app/(app)/tools/page.tsx

**Interfaces:**
- Consumes: uploadAsset, useCollection error-aware mutations, IconPicker, Modal, Button, Input, Lightbox.
- Produces: ToolCategoryRow; DEFAULT_TOOL_CATEGORIES; normalizeLegacyCategory; canDeleteCategory; useToolCategories.

- [ ] **Step 1: Write failing category-domain tests**

~~~ts
expect(DEFAULT_TOOL_CATEGORIES.map((c) => c.name)).toEqual([
  "Prompts", "IA", "Apps", "Ads", "Enlaces", "Redes Sociales",
]);
expect(normalizeLegacyCategory("gems")).toBe("ia");
expect(normalizeLegacyCategory("links")).toBe("redes-sociales");
expect(canDeleteCategory("prompts", [{ categoryId: "prompts" }])).toEqual({
  ok: false,
  count: 1,
});
~~~

Run npm test -- src/lib/__tests__/tool-categories.test.ts and confirm the missing-module failure.

- [ ] **Step 2: Implement category types, seeds, and persistence**

ToolCategoryRow fields are id, name, icon, accent, kind, sort, createdAt. ToolItem gains categoryId while retaining legacy category during migration. Mapper preference is category_id, then normalized legacy category.

Category mutation rules:

- trim and require a unique visible name;
- allow prompt/link presentation kind;
- allow emoji/image/GIF icon through IconPicker;
- reorder by persisting sort values;
- refuse deletion while tools reference the category unless a destination category is supplied;
- show invalid/deleted category IDs under Sin categoría.

- [ ] **Step 3: Implement category manager and dynamic Tools screen**

Replace hard-coded CATS filters with database categories. Provide an existing-style manage-categories modal for create, rename, icon/GIF, accent, kind, reorder, and safe delete/move. Every Tool edit explicitly chooses a category.

Move each prompt/link image above the title, use an object-contain aspect frame, and retain Lightbox, copy, steps, search, external-link, edit, and delete behavior. Replace simple pills with a responsive glass filter rail that shows icon, name, item count, selected state, keyboard focus, and horizontal mobile scrolling without changing the global visual language.

Intent: teammate must locate or classify an ecosystem resource immediately.
Hierarchy: category navigation and search lead; media/name lead each card; management remains secondary.
Palette: current nude accent plus persisted per-category accent.
Depth: existing glass cards and border-based selected state.
Surfaces: current base/card/modal levels.
Typography: current Tool title/body scale.
Spacing: current 4 px grid with 44 px filter hit targets.

- [ ] **Step 4: Verify and publish Task 3**

Run unit tests, TypeScript, build, then:

~~~powershell
git add src/lib/tool-categories.ts src/lib/__tests__/tool-categories.test.ts src/lib/data.ts src/lib/db.ts src/components/ToolCategoryManager.tsx "src/app/(app)/tools/page.tsx"
git commit -m "feat: add configurable tool categories"
git push
~~~

---

### Task 4: Uploadable, editable, replaceable, and deletable brand fonts

**Files:**
- Create: src/lib/fonts.ts
- Create: src/lib/__tests__/fonts.test.ts
- Modify: src/lib/db.ts
- Create: src/components/FontPreviewCard.tsx
- Modify: src/app/(app)/marca/page.tsx

**Interfaces:**
- Consumes: uploadAsset/removeAssetByPublicUrl; BrandAsset persistence.
- Produces: FontFormat; validateFontFile; fontFaceDescriptor; FontPreviewCard.

- [ ] **Step 1: Write failing font tests**

~~~ts
expect(validateFontFile(file("Ela.woff2", "font/woff2", 1024))).toEqual({
  ok: true,
  format: "woff2",
});
expect(validateFontFile(file("Ela.exe", "application/octet-stream", 1024))).toEqual({
  ok: false,
  error: "Formato no permitido. Usá WOFF2, WOFF, TTF u OTF.",
});
expect(fontFaceDescriptor({ id: "font 1", url: "https://cdn/font.woff2", format: "woff2" })).toContain(
  "font-family: 'elabela-font-font-1'"
);
~~~

Run npm test -- src/lib/__tests__/fonts.test.ts and confirm failure.

- [ ] **Step 2: Implement validation, runtime registration, and CRUD UI**

BrandAsset gains fileUrl, fileFormat, storagePath. Each font card registers an @font-face style keyed by asset ID and exposes sample text, size, letter-spacing, short and paragraph specimens, and load-error fallback.

Create/edit modal supports:

- upload on create;
- display-name and role edits without replacing the file;
- optional file replacement using the same validation/upload flow;
- save only after upload and database update succeed;
- best-effort removal of the previous Storage object after successful replacement;
- confirmed delete of row plus best-effort Storage cleanup.

Intent: brand owner needs to inspect and maintain real typography assets.
Hierarchy: live specimen leads, controls remain compact beneath metadata.
Palette/depth/surfaces/typography/spacing: reuse the current Brand Manual page and its existing tokens; do not restyle the page shell.

- [ ] **Step 3: Verify and publish Task 4**

Run tests, TypeScript, build, then commit feat: add editable brand font uploads and push.

---

### Task 5: Shared/private credential categories

**Files:**
- Create: src/lib/credential-categories.ts
- Create: src/lib/__tests__/credential-categories.test.ts
- Modify: src/lib/db.ts
- Create: src/components/CredentialCategoryManager.tsx
- Modify: src/components/views/CredencialesView.tsx

**Interfaces:**
- Produces: CredentialScope; CredentialCategory; isCategoryCompatible; groupCredentials; useCredentialCategories(ownerId).

- [ ] **Step 1: Write failing scope/grouping tests**

~~~ts
expect(isCategoryCompatible(sharedCategory, sharedCredential, "user-1")).toBe(true);
expect(isCategoryCompatible(sharedCategory, privateCredential, "user-1")).toBe(false);
expect(isCategoryCompatible(privateCategory, privateCredential, "user-1")).toBe(true);
expect(groupCredentials(credentials, categories).get("uncategorized")).toHaveLength(1);
~~~

Run npm test -- src/lib/__tests__/credential-categories.test.ts and confirm failure.

- [ ] **Step 2: Implement category persistence and grouped credential UI**

CredentialCategory fields are id, name, icon, scope, ownerId, sort, createdAt. Query shared categories plus current-owner private categories. Credential rows gain categoryId.

Both tabs provide create, rename, icon/GIF, reorder, and empty-category delete. Credential editor shows only scope-compatible categories and includes Sin categoría. Existing reveal/copy/edit/delete behavior and current RLS visibility remain unchanged.

Intent: teammate separates social logins, system access, Google/Metricool, and future groups without exposing private records.
Hierarchy: category groups lead, credential rows remain the working unit, management is secondary.
Palette/depth/surfaces/typography/spacing: reuse current credential tab/card/modal components and 44 px controls.

- [ ] **Step 3: Verify and publish Task 5**

Run the credential tests, TypeScript, build, commit feat: add credential categories, and push.

---

### Task 6: Remove all weekly tasks and add unassigned daily-task behavior

**Files:**
- Modify: src/lib/data.ts
- Modify: src/lib/db.ts
- Create: src/lib/asuncion-date.ts
- Create: src/lib/task-activity.ts
- Create: src/lib/__tests__/task-activity.test.ts
- Modify: src/components/views/TareasView.tsx
- Modify: src/components/views/DashboardView.tsx
- Modify: src/app/(app)/tareas/page.tsx
- Modify: src/app/(app)/dashboard/page.tsx
- Modify: src/app/(app)/calendario/page.tsx

**Interfaces:**
- Produces: asuncionDateKey; DailyTask.assignee: string | null; assignedUserForDate; isTaskAssignedForDate; tasksVisibleToTeam; DailyTaskLog; useDailyTaskLogs(date).
- Removes: WeeklyTask and useWeeklyTasks exports and all consumers.

- [ ] **Step 1: Write failing assignment/date tests**

~~~ts
expect(assignedUserForDate(unassignedTask, new Date("2026-07-18T12:00:00-04:00"))).toBeNull();
expect(tasksVisibleToTeam([unassignedTask, assignedTask], date)).toEqual([assignedTask]);
expect(stateForDate([], "task-1", "2026-07-19")).toBe("todo");
expect(stateForDate([{ taskId: "task-1", activityDate: "2026-07-18", state: "done" }], "task-1", "2026-07-19")).toBe("todo");
expect(asuncionDateKey("2026-08-01T02:30:00Z")).toBe("2026-07-31");
~~~

Run npm test -- src/lib/__tests__/task-activity.test.ts and confirm failure.

- [ ] **Step 2: Implement nullable assignment and daily logs**

Daily task definitions no longer store the canonical changing state. Current state comes from daily_task_logs for the selected Asunción date, defaulting to todo. A state transition upserts task_id/activity_date/state/assignee_snapshot/task_name_snapshot/task_icon_snapshot/completed_by/completed_at/updated_at; reopening clears completed_at and completed_by.

Task editor includes Sin asignar. Unassigned means no fixed assignee, no active rotation member, and no per-day owner for the date. Such tasks stay in management and are absent from Team/Dashboard workload and productivity totals.

- [ ] **Step 3: Delete every active weekly-task path**

Remove:

- WeeklyTask interface/comment;
- useWeeklyTasks hook/imports;
- weekly draft/state/helpers/cards/modals;
- Convertir en semanal actions and copy;
- weekly task sections/counters;
- calendar weekly tray, drag/drop, dots, agenda rows, legend, and detail panels;
- schema creation/policies for weekly_tasks.

Run:

~~~powershell
rg -n -i "WeeklyTask|useWeeklyTasks|weekly_tasks|tarea semanal|tareas semanales|convertir en semanal" src supabase/schema.sql
~~~

Expected: no active-code matches.

- [ ] **Step 4: Reorganize Daily Task Management locally**

Use the current card/status vocabulary for an unassigned group and assigned groups by fixed/rotation/per-day profile. Show schedule, publication type, current-day state, and direct edit/assign/delete actions. Preserve the rest of the page shell.

Intent: admin must see what is unowned and assign it without polluting the team's personal queue.
Hierarchy: Sin asignar group and task name/status lead; schedule/metadata support; actions stay discoverable.
Palette: existing task state colors and nude admin accent.
Depth/surfaces: current cards and glass sections.
Typography: current task scale.
Spacing: current dense 4 px rhythm and minimum 40–44 px hit targets.

- [ ] **Step 5: Verify and publish Task 6**

Run task tests, TypeScript, build, the zero-weekly rg command, commit feat: remove weekly tasks and support unassigned work, and push.

---

### Task 7: Project completion timestamps and removal of archive UX

**Files:**
- Create: src/lib/projects.ts
- Create: src/lib/__tests__/projects.test.ts
- Modify: src/lib/data.ts
- Modify: src/lib/db.ts
- Modify: src/app/(app)/proyectos/page.tsx
- Modify: src/app/(app)/calendario/page.tsx

**Interfaces:**
- Produces: transitionProjectStatus(project, nextStatus, actorId, now); Project.completedAt; Project.completedBy.

- [ ] **Step 1: Write failing transition tests**

~~~ts
expect(transitionProjectStatus(project, "done", "user-1", now)).toMatchObject({
  status: "done",
  completedAt: now.toISOString(),
  completedBy: "user-1",
});
expect(transitionProjectStatus(doneProject, "doing", "user-1", now)).toMatchObject({
  status: "doing",
  completedAt: undefined,
  completedBy: undefined,
});
~~~

Run npm test -- src/lib/__tests__/projects.test.ts and confirm failure.

- [ ] **Step 2: Implement timestamps and remove archive controls**

Project mapper persists completed_at/completed_by. Status transitions use the current authenticated actor. Projects page removes archive tabs, archive count, archive/restore buttons, and completed cards from the active list. Legacy archived rows stay hidden from active work and remain untouched.

Calendar includes only non-done, non-legacy-archived projects. No write sets archived.

- [ ] **Step 3: Verify and publish Task 7**

Run tests, TypeScript, build, then verify:

~~~powershell
rg -n -i "archive|archiv|restore" "src/app/(app)/proyectos/page.tsx"
~~~

Expected: no project archive UI/action matches. Commit feat: track project completion history and push.

---

### Task 8: Monthly productivity history

**Files:**
- Create: src/lib/history.ts
- Create: src/lib/__tests__/history.test.ts
- Create: src/components/MonthlyActivityChart.tsx
- Create: src/app/(app)/historial/page.tsx
- Modify: src/lib/brand.ts
- Modify: src/components/views/DashboardView.tsx

**Interfaces:**
- Consumes: daily task logs, projects, profile data.
- Produces: monthRangeAsuncion; aggregateMonthlyHistory; HistorySummary; WeeklyBucket; ProfileBreakdown.

- [ ] **Step 1: Write failing aggregation tests**

Use records around month boundaries and assert:

~~~ts
expect(monthRangeAsuncion("2026-07")).toEqual({
  start: "2026-07-01",
  endExclusive: "2026-08-01",
});
expect(summary.dailyCompleted).toBe(2);
expect(summary.projectsCompleted).toBe(1);
expect(summary.weekly.map((bucket) => bucket.total)).toEqual([1, 2, 0, 0, 0]);
expect(augustSummary.total).toBe(0);
~~~

Also assert reopened/non-done logs and legacy projects without completedAt do not count.

Run npm test -- src/lib/__tests__/history.test.ts and confirm failure.

- [ ] **Step 2: Implement pure aggregation and route**

The authenticated /historial route defaults to the current month and provides month previous/next controls, daily completion metric, completed-project metric, weekly SVG/CSS chart, profile breakdown, chronological activity list, Anteriores list for legacy completed rows without reliable dates, and an empty state.

No cron or destructive reset is added. A new month displays zero until that month's dated records exist.

Intent: owner evaluates real team productivity by month without losing evidence.
Hierarchy: month and total completion summary lead, weekly comparison second, details last.
Palette: current state colors used semantically, no decorative new palette.
Depth/surfaces: existing glass summary cards and one lightweight SVG chart.
Typography: tabular numbers for metrics, existing headings/body.
Spacing: current page rhythm and responsive stacked layout.

- [ ] **Step 3: Integrate navigation and current-month dashboard metrics**

Add Historial to the existing sidebar without changing its structure. Dashboard reads current-date logs and excludes unassigned tasks. It links to Historial for full monthly detail.

- [ ] **Step 4: Verify and publish Task 8**

Run history tests, all unit tests, TypeScript, build, commit feat: add monthly productivity history, and push.

---

### Task 9: Remote Supabase migration, end-to-end verification, and final review

**Files:**
- Modify only if verification reveals a failing test or confirmed defect in files touched by Tasks 1–8.
- Create: e2e/functional-upgrades.spec.ts

**Interfaces:**
- Verifies the complete feature set and the real project uxeuipryacnwsqhegrrs.

- [ ] **Step 1: Write browser smoke coverage**

The Playwright test, using existing authenticated test setup when credentials are available, checks:

- Publications editor supports multiple file input and guide modal opens;
- Tools shows all six category names and category manager opens;
- Brand Manual font editor exposes upload/sample/size/spacing controls;
- Credentials exposes category management in both tabs;
- Tasks has Sin asignar and no weekly copy;
- Projects has no archive control;
- Historial renders month selector and empty/data states.

If authenticated credentials are not available in CI, tests are guarded with a clear skip reason while unit/component coverage remains mandatory.

- [ ] **Step 2: Authenticate and link Supabase CLI**

Run:

~~~powershell
npx supabase@latest login
npx supabase@latest link --project-ref uxeuipryacnwsqhegrrs
npx supabase@latest migration list
~~~

The user completes the browser login with the Google account that owns the target project. Do not request or print the database password unless the CLI explicitly requires it.

- [ ] **Step 3: Apply and verify the migration**

Run the migration against the linked project using the CLI command discovered from npx supabase@latest db --help. Then verify through SQL/MCP or CLI:

- all new tables and columns exist;
- six category seeds exist in order;
- elabela-assets is public and its policies cover authenticated insert/select/update/delete;
- weekly_tasks rows/table were not dropped;
- new tables have RLS and authenticated Data API grants.

Run database security and performance advisors if the linked CLI version supports them; resolve findings caused by this migration.

- [ ] **Step 4: Run complete automated verification**

~~~powershell
npm test
npx tsc --noEmit
npm run build
npm run test:e2e
rg -n -i "WeeklyTask|useWeeklyTasks|weekly_tasks|tarea semanal|tareas semanales|convertir en semanal" src supabase/schema.sql
~~~

Expected: all tests/build pass and the weekly search returns no active-code matches.

- [ ] **Step 5: Visual and interaction verification**

Start npm run dev and verify desktop 1440×900 plus mobile 390×844 for /publicaciones, /tools, /marca, /credenciales, /tareas, /proyectos, and /historial. Check keyboard focus, modal/lightbox close and focus return, contained images, 1.5-second rotation, reduced motion, loading/empty/error states, horizontal overflow, and browser console errors.

- [ ] **Step 6: Whole-branch review and final push**

Review the diff from git merge-base main HEAD through HEAD for spec compliance, security, regression risk, accessibility, and code quality. Fix Critical/Important findings with covering tests.

Run:

~~~powershell
git add e2e/functional-upgrades.spec.ts
git commit -m "test: cover functional upgrade workflows"
git push
git status --short --branch
~~~

Expected: branch tracks origin, worktree is clean, and every verified commit is present remotely.
