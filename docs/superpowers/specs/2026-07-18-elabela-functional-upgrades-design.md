# ElaBela Functional Upgrades Design

**Date:** 2026-07-18

**Status:** Approved by user
**Repository:** `Bryan-dev074/ElaBela-Marketing`

## Goal

Implement the requested functionality for Publications, Tools, Brand Manual,
Credentials, Daily Tasks, Projects, and monthly productivity history while
preserving the application's current Premium Noir Glow design.

## Confirmed Product Direction

The existing visual system remains the source of truth. The implementation
keeps the current:

- sidebar and navigation structure;
- dark glass surfaces and warm nude accent;
- Inter-based typography;
- animated background and custom cursor;
- page headers, cards, modals, buttons, segmented controls, and status styles;
- motion language and responsive shell.

New controls and screens must reuse these patterns. There is no global visual
redesign, typography replacement, navigation-shell redesign, or new aesthetic
direction. Local layout changes are allowed only when required to make a new
feature understandable, such as category management, a media gallery, or a
productivity chart.

## Out of Scope

- The rejected Noir Atelier redesign and its mockups.
- A site-wide premium-polish pass.
- Replacing the sidebar, background, cursor, or base typography.
- Weekly tasks or weekly projects in any form.
- Destructive deletion of legacy database rows without an explicit migration
  decision.
- Changing authentication roles or credential-visibility rules.
- Adding Headroom or coding-agent tooling to the application runtime.

## Architecture Principles

1. **Backward-compatible reads.** Existing single publication images, data-URL
   icons, tool rows, and brand assets continue to render after the migration.
2. **Additive migrations.** New columns and tables are added before legacy
   columns are retired. The obsolete `weekly_tasks` table is not dropped from an
   existing database, avoiding silent data loss, but the application stops using
   it completely.
3. **Supabase Storage for large assets.** New publication images, tool images,
   and uploaded fonts are stored in a public-read, authenticated-write
   `elabela-assets` bucket. It contains only non-secret marketing media and
   fonts; credential secrets never enter this bucket. Existing data URLs remain
   readable. Small emoji/image/GIF icons can continue using the existing
   `IconPicker` representation.
4. **Focused modules.** Large route files are split only where the requested
   feature creates a clear reusable boundary, such as `MediaCarousel`, category
   management, font preview, task activity, and monthly aggregation.
5. **Visible persistence failures.** New writes and asset uploads must report
   Supabase errors. The UI must not claim that data was saved when the migration
   or upload failed.
6. **Asunción calendar semantics.** Daily and monthly activity is grouped by
   the user's Paraguay calendar date rather than by a raw UTC day.

## 1. Publications

### Data model

`PostType` gains:

- `exampleImages: string[]` — ordered Storage URLs or legacy data URLs;
- `guide: string` — Markdown instructions for producing the post type;
- `toolIds: string[]` — references to relevant items in Tools.

The database keeps `example_image` for compatibility and adds
`example_images text[]`, `guide text`, and `tool_ids text[]`. When
`example_images` is empty, the mapper promotes `example_image` into a one-item
array.

### Card behavior

- The media area sits at the top of the existing publication card.
- Images use a contained presentation so the complete reference remains
  visible; they are not forcibly cropped with `object-cover`.
- With two or more images, the active image advances every exactly 1.5 seconds.
- The carousel shows the current position and provides manual previous/next
  controls.
- `prefers-reduced-motion` disables automatic rotation while retaining manual
  navigation.
- Clicking the media opens a collection-aware lightbox at the active image.
- Clicking the card title or body opens the production guide. Edit and delete
  buttons remain separate actions and do not open the guide.

### Editing

- The editor accepts multiple image files in one selection.
- Images can be reordered and removed before saving.
- New images are compressed client-side before upload.
- A post type supports at most 8 example images; each source file is limited to
  8 MB before compression.
- The guide editor accepts Markdown.
- The editor can link zero or more current Tools items.

### Guide

The guide opens in the existing modal style and contains:

- the post type name, icon, and description;
- rendered Markdown steps and examples;
- linked Tools resources with their existing icon, title, and direct action;
- external links opening safely in a new tab with `noopener noreferrer`.

## 2. Tools

### Default categories

The default ordered categories are:

1. Prompts
2. IA
3. Apps
4. Ads
5. Enlaces
6. Redes Sociales

The old `GEMS de Gemini` category migrates to `IA`. The old
`Enlaces Oficiales` category migrates to `Redes Sociales`.

### Category model

A new `tool_categories` table stores:

- stable `id`;
- editable `name`;
- emoji, image, or GIF `icon`;
- `accent` color;
- item presentation `kind` (`prompt` or `link`);
- `sort` order;
- creation timestamp.

Categories can be created, renamed, reordered, recolored, and assigned a new
icon/GIF. A category can only be deleted after its tools are moved to another
category or the user explicitly confirms moving them to an uncategorized
fallback.

`tool_items` receives `category_id`. The existing text `category` column remains
available during migration and is mapped to the seeded category IDs.

### Tool editing and filtering

- Every tool explicitly selects a category.
- The category determines the default card presentation, while an existing item
  retains its compatible `kind` during migration.
- Filters are generated from category rows rather than hard-coded constants.
- The filter area uses the current glass/card vocabulary. It can be reorganized
  for clarity but must not introduce the rejected redesign.
- A category-management modal uses existing `Modal`, `Input`, `Button`, and
  `IconPicker` components.

### Tool cards

- A prompt or link image appears above the name and main copy.
- Images use a contained aspect-ratio frame so the complete image is visible.
- Clicking an image opens the existing lightbox.
- Prompt copying, numbered steps, search, external links, and CRUD behavior stay
  intact.
- Publication guides resolve their linked `toolIds` from the same collection.

## 3. Brand Manual Fonts

### Upload

The Brand Manual accepts `.woff2`, `.woff`, `.ttf`, and `.otf` files up to 5 MB.
The asset is uploaded to `elabela-assets/brand/fonts/`, and the `brand_assets`
row stores its URL and format metadata while preserving current color assets.

### Preview

Each uploaded font is registered at runtime with a generated `@font-face`
declaration scoped to its asset ID. The preview provides:

- editable sample text;
- font-size control;
- letter-spacing control for visually stretching or tightening the sample;
- short and paragraph specimens;
- file-format and font-name metadata;
- edit action for its display name and role/usage label;
- replace-file action using the same validation and Storage flow;
- delete action with confirmation, removing both the database row and the
  uploaded Storage object when possible.

If the file cannot be decoded by the browser, the card shows a clear error and
falls back to the UI font without pretending the custom font loaded.

## 4. Credential Categories

### Data model

A new `credential_categories` table stores:

- stable `id`;
- `name`;
- emoji, image, or GIF `icon`;
- `scope` (`shared` or `private`);
- owner user ID for private categories;
- `sort` order and creation timestamp.

`credentials` gains nullable `category_id`. Existing credentials without a
category appear in an explicit `Sin categoría` group.

### Visibility

- Shared categories and their shared credentials are visible to authenticated
  team members under the existing shared rules.
- Private categories are visible only to their owner, matching the current
  private-credential policy; this change does not add an admin override.
- A credential cannot be placed in a category whose scope conflicts with the
  credential scope.

### UI

Both Shared and Private tabs support:

- creating a category;
- renaming it;
- changing its icon/GIF;
- reordering categories;
- assigning or moving credentials;
- deleting an empty category with confirmation.

The existing credential card, reveal/copy behavior, and visibility rules remain
unchanged apart from grouping.

## 5. Daily Tasks

### Weekly-task removal

The application removes all weekly-task functionality:

- `WeeklyTask` application type and seed logic;
- `useWeeklyTasks` hook;
- weekly-task creation, conversion, scheduling, and UI;
- weekly-task calendar drag/drop and calendar rendering;
- weekly-task dashboard references.

The existing remote table is left untouched as legacy data, but no current UI
reads or writes it. The canonical schema stops creating `weekly_tasks` for new
environments, while the dated migration deliberately avoids `DROP TABLE` for
existing environments.

### Unassigned daily tasks

`DailyTask.assignee` becomes nullable. A task is unassigned when it has no fixed
assignee, active rotation member, or per-day assignee for the relevant day.

- Task creation and editing include `Sin asignar`.
- Unassigned tasks remain visible in Daily Task Management.
- Unassigned tasks do not appear in the Team section, Dashboard team progress,
  personal workload, or current-day productivity totals.
- Assigning a profile makes the task eligible for those views immediately.

### Daily state and completion log

A new `daily_task_logs` table stores one row per task and Paraguay calendar day:

- `task_id`;
- `activity_date`;
- `state` (`todo`, `doing`, or `done`);
- assignee snapshot;
- user who completed it;
- `completed_at` and `updated_at`.

The unique key is `(task_id, activity_date)`. Current-day state is derived from
this row, with `todo` as the default. This replaces the current permanent state
behavior, so daily tasks naturally start fresh on a new day while preserving
past completion evidence.

Changing a task away from `done` clears `completed_at`; it no longer counts as a
completion for that day. Historical counts therefore reflect the final saved
state, not every click.

### Management layout

The management area is reorganized using the existing card and status styles:

- an unassigned group;
- assigned tasks grouped by profile or assignment mode;
- visible schedule, publication type, and current-day state;
- direct edit, assign, and delete actions.

This is a local information-architecture improvement, not a global redesign.

## 6. Projects and Monthly History

### Projects

`projects` gains `completed_at` and `completed_by`.

- Transitioning a project to `done` records completion time and user.
- Reopening a project clears those completion fields.
- Archive tabs, archive counters, archive buttons, and restore actions are
  removed.
- Active Projects shows projects that are not complete and not legacy-archived.
- Completed projects appear in monthly history instead of an archive.
- Legacy archived rows are not deleted or silently assigned a fabricated
  completion date. Completed legacy rows without a reliable date appear in an
  `Anteriores` list and do not affect monthly metrics.

### History page

A new authenticated `/historial` route, linked in the existing navigation,
provides:

- selected month control, defaulting to the current month;
- completed daily-task count;
- completed-project count;
- weekly comparison chart within the month;
- breakdown by assigned profile;
- chronological list of completed tasks and projects;
- clear empty state when the month has no activity.

The chart uses lightweight SVG/CSS and existing design tokens; no charting
dependency is required.

### Monthly reset semantics

There is no destructive scheduled reset. Metrics are calculated from records
whose local completion date falls inside the selected month. At the beginning
of a new month, the current-month view is naturally zero while prior records
remain available through the month selector. This fulfills the reset behavior
without deleting data or relying on a cron job.

## 7. Storage and Database Migration

The canonical schema and a dated migration create:

- `tool_categories`;
- `credential_categories`;
- `daily_task_logs`;
- new publication, tool, credential, and project columns;
- the `elabela-assets` Storage bucket and authenticated write policies;
- RLS policies for the new tables matching current role/scope behavior;
- indexes on category sort, `(task_id, activity_date)`, completion dates, and
  project completion time.

The migration seeds the six Tool categories and maps known legacy category
values. It does not delete `weekly_tasks`, legacy images, or archived projects.

Because this repository is not linked to Supabase CLI and DDL cannot be applied
through the browser client, the migration must be run in the Supabase SQL Editor
or through a separately linked Supabase CLI before new persistence is relied on.
Until then, the application shows a migration-required error instead of silently
falling back after a failed write.

## 8. Error Handling

- Storage validation errors identify the rejected file and reason.
- Failed uploads clean up files already uploaded in the same unsaved batch when
  possible.
- Supabase insert/update/delete errors remain visible in the relevant modal or
  section.
- Optimistic writes roll back or refetch after failure.
- Missing linked Tools resources are omitted from a publication guide without
  breaking the guide.
- Invalid or deleted category IDs display under `Sin categoría`.
- Empty, loading, and migration-required states use existing UI components.

## 9. Testing Strategy

Add Vitest and React Testing Library for deterministic unit/component tests,
while retaining Playwright for browser-level checks.

Required automated coverage:

- publication legacy-image promotion and multi-image ordering;
- 1.5-second carousel rotation, manual navigation, and reduced-motion behavior;
- default Tool category migration and dynamic filtering;
- publication guide resolution of linked tools;
- font format validation and generated font-face descriptor;
- credential category scope validation;
- unassigned-task exclusion from Team and Dashboard views;
- per-day task-state reset and completion-log aggregation;
- project completion/reopen timestamps;
- current-month and prior-month productivity aggregation;
- existing login E2E tests;
- production build and TypeScript validation.

Browser verification covers the affected routes at desktop and mobile widths,
including keyboard focus, modal/lightbox behavior, image fitting, and console
errors.

## Acceptance Criteria

1. A publication type can store, reorder, rotate, and fullscreen-view multiple
   example images.
2. A publication type opens an editable guide with working internal Tools links
   and external platform links.
3. Tools exposes the six requested default categories and allows future category
   CRUD with custom icon/GIF.
4. Prompt/tool images appear above names, remain fully visible, and open in the
   lightbox.
5. A real font file can be uploaded, edited, replaced, deleted, and
   interactively previewed.
6. Shared and private credentials can each be organized into editable custom
   categories.
7. Weekly-task functionality no longer appears anywhere in the application.
8. A daily task may remain unassigned and is then absent from Team and Dashboard
   workload views.
9. Daily completions and project completions appear in month-based history and
   current-month metrics start at zero automatically in a new month.
10. Project archive UI is removed without deleting legacy rows.
11. The current global visual design remains recognizably unchanged.
12. Unit tests, existing E2E tests, and production build pass before push.
