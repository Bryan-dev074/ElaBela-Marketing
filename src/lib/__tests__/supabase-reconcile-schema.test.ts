import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");
const migrationNames = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /^\d{14}_reconcile_remote_schema\.sql$/.test(name))
  : [];
const migration = migrationNames.length === 1
  ? fs.readFileSync(path.join(migrationsDir, migrationNames[0]), "utf8")
  : "";
const manualPath = path.join(root, "supabase", "manual", "20260720_complete_remote_sync.sql");
const manual = fs.existsSync(manualPath) ? fs.readFileSync(manualPath, "utf8") : "";
const schema = fs.readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
const report = fs.readFileSync(path.join(root, ".superpowers", "sdd", "supabase-reconcile-report.md"), "utf8");

const scripts = [
  ["forward migration", migration],
  ["manual SQL Editor script", manual],
] as const;

function reconciliationBody(sql: string) {
  return sql.match(/-- RECONCILIATION BODY START\s*([\s\S]*?)\s*-- RECONCILIATION BODY END/i)?.[1]
    .replace(/\r\n/g, "\n")
    .trim() ?? "";
}

function dollarBlock(sql: string, tag: string) {
  return sql.match(new RegExp(`do \\$${tag}\\$[\\s\\S]*?\\$${tag}\\$;`, "i"))?.[0]
    .replace(/\r\n/g, "\n")
    .trim() ?? "";
}

function cteValuesBlock(sql: string, cteName: string) {
  const cteStart = sql.indexOf(`${cteName}(`);
  expect(cteStart, `missing ${cteName} CTE`).toBeGreaterThanOrEqual(0);
  const valuesStart = sql.indexOf("values", cteStart);
  expect(valuesStart, `missing VALUES in ${cteName}`).toBeGreaterThan(cteStart);
  const end = sql.indexOf("\n  ),", valuesStart);
  expect(end, `unterminated ${cteName}`).toBeGreaterThan(valuesStart);
  return sql.slice(valuesStart + "values".length, end);
}

function normalizePolicyExpression(expression: string) {
  return expression
    .replace(/\s+/g, "")
    .replaceAll("(SELECTauth.uid()ASuid)", "auth.uid()");
}

const requiredColumnAudit = [
  ["profiles", "avatar", "text", false, "none"],
  ["daily_tasks", "assignee", "text", false, "none"],
  ["daily_tasks", "rotation", "text[]", false, "none"],
  ["daily_tasks", "sort", "integer", false, "zero"],
  ["daily_tasks", "days", "integer[]", false, "none"],
  ["daily_tasks", "day_assignees", "text[]", false, "none"],
  ["daily_tasks", "post_type", "text", false, "none"],
  ["projects", "archived", "boolean", true, "false"],
  ["projects", "content_mode", "text", true, "steps"],
  ["projects", "note", "text", false, "none"],
  ["clients", "last_purchase", "date", false, "none"],
  ["guiones", "product", "text", false, "none"],
  ["story_config", "done_date", "date", false, "none"],
  ["tool_items", "icon", "text", false, "none"],
  ["tool_items", "steps", "text", false, "none"],
  ["credentials", "icon", "text", false, "key"],
  ["credentials", "id_type", "text", false, "email"],
  ["credentials", "identifier", "text", false, "none"],
  ["credentials", "secret", "text", false, "none"],
  ["credentials", "scope", "text", true, "private"],
  ["post_types", "example_images", "text[]", true, "empty_text_array"],
  ["post_types", "guide", "text", true, "empty_text"],
  ["post_types", "tool_ids", "text[]", true, "empty_text_array"],
  ["brand_assets", "file_url", "text", false, "none"],
  ["brand_assets", "file_format", "text", false, "none"],
  ["brand_assets", "storage_path", "text", false, "none"],
  ["tool_items", "category_id", "text", false, "none"],
  ["credentials", "category_id", "text", false, "none"],
  ["projects", "responsible_usernames", "text[]", true, "empty_text_array"],
  ["projects", "completed_responsible_usernames", "text[]", false, "none"],
  ["projects", "project_type", "text", true, "other"],
  ["projects", "priority", "text", true, "normal"],
  ["projects", "objective", "text", false, "none"],
  ["projects", "start_date", "date", false, "none"],
  ["projects", "completed_at", "timestamp with time zone", false, "none"],
  ["projects", "completed_by", "uuid", false, "none"],
  ["tool_categories", "id", "text", true, "none"],
  ["tool_categories", "name", "text", true, "none"],
  ["tool_categories", "icon", "text", true, "sparkle"],
  ["tool_categories", "accent", "text", true, "accent"],
  ["tool_categories", "kind", "text", true, "link"],
  ["tool_categories", "sort", "integer", true, "zero"],
  ["tool_categories", "created_at", "timestamp with time zone", true, "now"],
  ["credential_categories", "id", "text", true, "none"],
  ["credential_categories", "name", "text", true, "none"],
  ["credential_categories", "icon", "text", true, "key"],
  ["credential_categories", "scope", "text", true, "none"],
  ["credential_categories", "owner_id", "uuid", false, "none"],
  ["credential_categories", "sort", "integer", true, "zero"],
  ["credential_categories", "created_at", "timestamp with time zone", true, "now"],
  ["daily_task_logs", "id", "uuid", true, "gen_random_uuid"],
  ["daily_task_logs", "task_id", "text", true, "none"],
  ["daily_task_logs", "activity_date", "date", true, "none"],
  ["daily_task_logs", "state", "text", true, "todo"],
  ["daily_task_logs", "task_name_snapshot", "text", true, "none"],
  ["daily_task_logs", "task_icon_snapshot", "text", true, "sparkle"],
  ["daily_task_logs", "assignee_snapshot", "text", false, "none"],
  ["daily_task_logs", "completed_by", "uuid", false, "none"],
  ["daily_task_logs", "completed_at", "timestamp with time zone", false, "none"],
  ["daily_task_logs", "updated_at", "timestamp with time zone", true, "now"],
] as const;

const requiredPolicyAudit = [
  ["public", "tool_categories", "tool_categories_all", "ALL", "true", "true"],
  ["public", "credential_categories", "credential_categories_select", "SELECT", "category_visible", "none"],
  ["public", "credential_categories", "credential_categories_insert", "INSERT", "none", "category_valid"],
  ["public", "credential_categories", "credential_categories_update", "UPDATE", "category_visible", "category_valid"],
  ["public", "credential_categories", "credential_categories_delete", "DELETE", "category_visible", "none"],
  ["public", "credentials", "credentials_select", "SELECT", "credential_visible", "none"],
  ["public", "credentials", "credentials_insert", "INSERT", "none", "credential_visible"],
  ["public", "credentials", "credentials_update", "UPDATE", "credential_visible", "credential_visible"],
  ["public", "credentials", "credentials_delete", "DELETE", "credential_visible", "none"],
  ["public", "daily_task_logs", "daily_task_logs_select", "SELECT", "true", "none"],
  ["public", "daily_task_logs", "daily_task_logs_insert", "INSERT", "none", "log_write"],
  ["public", "daily_task_logs", "daily_task_logs_update", "UPDATE", "true", "log_write"],
  ["public", "daily_task_logs", "daily_task_logs_delete", "DELETE", "true", "none"],
  ["storage", "objects", "elabela_assets_insert", "INSERT", "none", "bucket"],
  ["storage", "objects", "elabela_assets_select", "SELECT", "bucket", "none"],
  ["storage", "objects", "elabela_assets_update", "UPDATE", "bucket", "bucket"],
  ["storage", "objects", "elabela_assets_delete", "DELETE", "bucket", "none"],
] as const;

describe("Supabase remote reconciliation artifacts", () => {
  it("has exactly one generated forward migration and the copy/paste manual script", () => {
    expect(migrationNames).toHaveLength(1);
    expect(manual).not.toBe("");
  });

  it("keeps the migration and manual reconciliation bodies identical", () => {
    expect(reconciliationBody(migration)).not.toBe("");
    expect(reconciliationBody(manual)).toBe(reconciliationBody(migration));
  });
});

describe.each(scripts)("reconciliation contract in %s", (_label, sql) => {
  it("starts with one Spanish prerequisite guard covering every required base table", () => {
    const guard = reconciliationBody(sql).match(/^do \$prerequisites\$[\s\S]*?\$prerequisites\$;/i)?.[0] ?? "";
    for (const table of [
      "profiles", "daily_tasks", "story_config", "post_types", "tool_items",
      "brand_assets", "credentials", "projects",
    ]) {
      expect(guard).toContain(`'${table}'`);
    }
    expect(guard).toMatch(/information_schema\.tables/i);
    expect(guard).toMatch(/raise exception 'Faltan tablas base requeridas[^']*%'/i);
  });

  it("adds all current-code compatibility columns without rebuilding base tables", () => {
    const columns: Array<[string, string, RegExp]> = [
      ["profiles", "avatar", /text/i],
      ["daily_tasks", "rotation", /text\[\]/i],
      ["daily_tasks", "sort", /integer default 0/i],
      ["daily_tasks", "days", /integer\[\]/i],
      ["daily_tasks", "day_assignees", /text\[\]/i],
      ["daily_tasks", "post_type", /text/i],
      ["projects", "archived", /boolean not null default false/i],
      ["projects", "content_mode", /text not null default 'steps'/i],
      ["projects", "note", /text/i],
      ["clients", "last_purchase", /date/i],
      ["guiones", "product", /text/i],
      ["story_config", "done_date", /date/i],
      ["tool_items", "icon", /text/i],
      ["tool_items", "steps", /text/i],
      ["credentials", "icon", /text default '🔑'/i],
      ["credentials", "id_type", /text default 'email'/i],
      ["credentials", "identifier", /text/i],
      ["credentials", "secret", /text/i],
      ["credentials", "scope", /text not null default 'private'/i],
    ];
    for (const [table, column, definition] of columns) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table}\\s+add column if not exists ${column} ${definition.source}`, "i"));
    }
    expect(sql).toMatch(/alter table public\.daily_tasks\s+alter column assignee drop not null/i);
  });

  it("reconciles publication, tool, font and credential-category features", () => {
    expect(sql).toMatch(/post_types\s+add column if not exists example_images text\[\] not null default '\{\}'/i);
    expect(sql).toMatch(/post_types\s+add column if not exists guide text not null default ''/i);
    expect(sql).toMatch(/post_types\s+add column if not exists tool_ids text\[\] not null default '\{\}'/i);
    for (const column of ["file_url", "file_format", "storage_path"]) {
      expect(sql).toMatch(new RegExp(`brand_assets\\s+add column if not exists ${column} text`, "i"));
    }
    expect(sql).toMatch(/create table if not exists public\.tool_categories/i);
    expect(sql).toMatch(/create table if not exists public\.credential_categories/i);
    expect(sql).toMatch(/insert into public\.tool_items[\s\S]*'links-downloader'[\s\S]*on conflict \(id\) do nothing/i);
    for (const routine of [
      "move_and_delete_tool_category", "reorder_tool_categories",
      "delete_empty_credential_category", "reorder_credential_categories",
    ]) {
      expect(sql).toMatch(new RegExp(`create or replace function public\\.${routine}\\(`, "i"));
    }
    expect(sql).toMatch(/create trigger sync_tool_category_kind/i);
    expect(sql).toMatch(/create trigger enforce_credential_category_compatibility/i);
    expect(sql).toMatch(/create trigger enforce_category_credential_compatibility/i);
    expect(sql).toMatch(/create trigger prevent_nonempty_credential_category_delete/i);
  });

  it("aborts on incompatible category data instead of silently omitting integrity", () => {
    expect(sql).toMatch(/tool_categories_name_nonblank[\s\S]*Hay valores incompatibles en public\.tool_categories/i);
    expect(sql).toMatch(/credential_categories_name_nonblank[\s\S]*Hay valores incompatibles en public\.credential_categories/i);
    expect(sql).toMatch(/credential_categories_name_trimmed[\s\S]*Hay valores incompatibles en public\.credential_categories/i);
    expect(sql).toMatch(/group by lower\(btrim\(name\)\) having count\(\*\) > 1[\s\S]*raise exception 'No se puede crear el índice tool_categories_name_ci_unique/i);
    expect(sql).toMatch(/credential_categories_shared_name_ci_unique[\s\S]*raise exception 'No se puede crear el índice credential_categories_shared_name_ci_unique/i);
    expect(sql).toMatch(/credential_categories_private_name_ci_unique[\s\S]*raise exception 'No se puede crear el índice credential_categories_private_name_ci_unique/i);
    expect(sql).not.toMatch(/update public\.credential_categories\s+set name = btrim\(name\)/i);
    expect(sql).not.toMatch(/raise notice 'No se (?:agregó|creó) (?:tool_categories|credential_categories)/i);
  });

  it("ensures equivalent named foreign keys and future-write enforcement", () => {
    for (const constraint of [
      "tool_items_category_id_fkey", "credentials_category_id_fkey",
      "daily_task_logs_completed_by_fkey", "projects_completed_by_fkey",
    ]) {
      expect(sql).toContain(constraint);
    }
    expect(sql).toMatch(/pg_constraint[\s\S]*contype = 'f'/i);
    expect(sql).toMatch(/credentials_category_id_fkey[\s\S]*on delete set null[\s\S]*not valid/i);
    expect(sql).toMatch(/daily_task_logs_completed_by_fkey[\s\S]*on delete set null[\s\S]*not valid/i);
    expect(sql).toMatch(/projects_completed_by_fkey[\s\S]*on delete set null[\s\S]*not valid/i);
    const namedIntegrity = dollarBlock(sql, "named_foreign_key_integrity");
    for (const constraint of [
      "tool_items_category_id_fkey", "credentials_category_id_fkey",
      "daily_task_logs_completed_by_fkey", "projects_completed_by_fkey",
      "credential_categories_owner_id_fkey",
    ]) {
      expect(namedIntegrity).toContain(`'${constraint}'`);
    }
    expect(namedIntegrity).toMatch(/conname = required\.constraint_name[\s\S]*confdeltype = required\.delete_action[\s\S]*raise exception 'La restricción % existe con otra definición\.'/i);
  });

  it("normalizes and strictly validates expanded project metadata", () => {
    for (const column of [
      "responsible_usernames", "completed_responsible_usernames", "project_type", "priority",
      "objective", "start_date", "completed_at", "completed_by",
    ]) {
      expect(sql).toMatch(new RegExp(`projects\\s+add column if not exists ${column}`, "i"));
    }
    expect(sql).toMatch(/update public\.projects[\s\S]*project_type = 'other'[\s\S]*project_type is null or project_type not in/i);
    expect(sql).toMatch(/update public\.projects[\s\S]*priority = 'normal'[\s\S]*priority is null or priority not in/i);
    const typeGuard = sql.match(/do \$project_type_check\$[\s\S]*?\$project_type_check\$;/i)?.[0] ?? "";
    const priorityGuard = sql.match(/do \$project_priority_check\$[\s\S]*?\$project_priority_check\$;/i)?.[0] ?? "";
    expect(typeGuard).toMatch(/projects_project_type_check/);
    expect(typeGuard).toMatch(/pg_get_constraintdef/i);
    expect(priorityGuard).toMatch(/projects_priority_check/);
    expect(priorityGuard).toMatch(/pg_get_constraintdef/i);
    expect(sql).toMatch(/create index if not exists projects_completed_at_idx[\s\S]*where status = 'done'/i);
  });

  it("reconciles logs, RLS policies, the authoritative bucket and Data API grants", () => {
    expect(sql).toMatch(/create table if not exists public\.daily_task_logs/i);
    expect(sql).toMatch(/daily_task_logs_completion_consistency/i);
    for (const table of ["tool_categories", "credential_categories", "daily_task_logs"]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    }
    for (const policy of [
      "tool_categories_all", "credential_categories_select", "credential_categories_insert",
      "credential_categories_update", "credential_categories_delete", "credentials_select",
      "credentials_insert", "credentials_update", "credentials_delete", "daily_task_logs_select",
      "daily_task_logs_insert", "daily_task_logs_update", "daily_task_logs_delete",
      "elabela_assets_insert", "elabela_assets_select", "elabela_assets_update", "elabela_assets_delete",
    ]) {
      expect(sql).toMatch(new RegExp(`drop policy if exists ${policy}[\\s\\S]*create policy ${policy}`, "i"));
    }
    expect(sql).toMatch(/insert into storage\.buckets[\s\S]*'elabela-assets'[\s\S]*8388608[\s\S]*image\/avif[\s\S]*font\/woff2[\s\S]*on conflict \(id\) do update/i);
    expect(sql).toMatch(/grant select, insert, update, delete on table[\s\S]*public\.daily_task_logs[\s\S]*to authenticated/i);
  });

  it("revokes PUBLIC and grants authenticated execution for all four management RPCs", () => {
    const signatures = [
      "move_and_delete_tool_category\\(text, text\\)",
      "reorder_tool_categories\\(text\\[\\]\\)",
      "delete_empty_credential_category\\(text\\)",
      "reorder_credential_categories\\(text, text\\[\\]\\)",
    ];
    for (const signature of signatures) {
      expect(sql).toMatch(new RegExp(`revoke execute on function public\\.${signature} from public`, "i"));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${signature} to authenticated`, "i"));
    }
    expect(sql).toMatch(/notify pgrst, 'reload schema'/i);
  });

  it("uses idempotent guards and contains no destructive/bootstrap operations", () => {
    expect(sql).toMatch(/add column if not exists/i);
    expect(sql).toMatch(/create table if not exists/i);
    expect(sql).toMatch(/create index if not exists|to_regclass\(/i);
    expect(sql).toMatch(/drop policy if exists/i);
    expect(sql).toMatch(/on conflict \(id\) do (?:nothing|update)/i);
    expect(sql).not.toMatch(/create table(?: if not exists)? public\.(?:profiles|daily_tasks|story_config|post_types|tool_items|brand_assets|credentials|projects)\b/i);
    expect(sql).not.toMatch(/alter table[\s\S]{0,100}alter column id type/i);
    expect(sql).not.toMatch(/alter table[\s\S]{0,100}drop column|drop table|truncate table|supabase db reset|seed\.sql|auth\.users|on_auth_user_created|handle_new_user/i);
    expect(sql).not.toMatch(/weekly_(?:tasks|projects)/i);
  });

  it("fully repairs all columns and mandatory properties of partially-created upgrade tables", () => {
    const tableColumns: Record<string, string[]> = {
      tool_categories: ["id", "name", "icon", "accent", "kind", "sort", "created_at"],
      credential_categories: ["id", "name", "icon", "scope", "owner_id", "sort", "created_at"],
      daily_task_logs: [
        "id", "task_id", "activity_date", "state", "task_name_snapshot", "task_icon_snapshot",
        "assignee_snapshot", "completed_by", "completed_at", "updated_at",
      ],
    };
    for (const [table, columns] of Object.entries(tableColumns)) {
      for (const column of columns) {
        expect(sql).toMatch(new RegExp(`alter table public\\.${table}\\s+add column if not exists ${column}\\b`, "i"));
      }
    }
    for (const [table, column] of [
      ["tool_categories", "id"], ["tool_categories", "name"], ["tool_categories", "icon"],
      ["tool_categories", "accent"], ["tool_categories", "kind"], ["tool_categories", "sort"],
      ["tool_categories", "created_at"], ["credential_categories", "id"],
      ["credential_categories", "name"], ["credential_categories", "icon"],
      ["credential_categories", "scope"], ["credential_categories", "sort"],
      ["credential_categories", "created_at"], ["daily_task_logs", "id"],
      ["daily_task_logs", "task_id"], ["daily_task_logs", "activity_date"],
      ["daily_task_logs", "state"], ["daily_task_logs", "task_name_snapshot"],
      ["daily_task_logs", "task_icon_snapshot"], ["daily_task_logs", "updated_at"],
    ]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table}\\s+alter column ${column} set not null`, "i"));
    }
    for (const [table, column, value] of [
      ["tool_categories", "icon", "'✨'"], ["tool_categories", "accent", "'#d6ab99'"],
      ["tool_categories", "kind", "'link'"], ["tool_categories", "sort", "0"],
      ["tool_categories", "created_at", "now\\(\\)"], ["credential_categories", "icon", "'🔑'"],
      ["credential_categories", "sort", "0"], ["credential_categories", "created_at", "now\\(\\)"],
      ["daily_task_logs", "id", "gen_random_uuid\\(\\)"], ["daily_task_logs", "state", "'todo'"],
      ["daily_task_logs", "task_icon_snapshot", "'✨'"], ["daily_task_logs", "updated_at", "now\\(\\)"],
    ]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table}\\s+alter column ${column} set default ${value}`, "i"));
    }
    expect(sql).toMatch(/Faltan valores obligatorios en public\.tool_categories/i);
    expect(sql).toMatch(/Faltan valores obligatorios en public\.credential_categories/i);
    expect(sql).toMatch(/Faltan valores obligatorios en public\.daily_task_logs/i);
  });

  it("reconciles exact PK, unique, check and owner-FK integrity for upgrade tables", () => {
    for (const constraint of [
      "tool_categories_pkey", "tool_categories_kind_check", "tool_categories_name_nonblank",
      "credential_categories_pkey", "credential_categories_scope_check",
      "credential_categories_owner_scope_check", "credential_categories_name_nonblank",
      "credential_categories_name_trimmed", "credential_categories_owner_id_fkey",
      "daily_task_logs_pkey", "daily_task_logs_state_check",
      "daily_task_logs_task_activity_unique", "daily_task_logs_completion_consistency",
    ]) {
      expect(sql).toContain(constraint);
    }
    expect(sql).toMatch(/credential_categories_owner_id_fkey[\s\S]*references public\.profiles\(id\)[\s\S]*on delete cascade[\s\S]*not valid/i);
    expect(sql).toMatch(/daily_task_logs_task_activity_unique[\s\S]*unique \(task_id, activity_date\)/i);
    expect(sql).toMatch(/No se puede crear la clave primaria de public\.tool_categories/i);
    expect(sql).toMatch(/No se puede crear la clave primaria de public\.credential_categories/i);
    expect(sql).toMatch(/No se puede crear la unicidad de public\.daily_task_logs/i);
  });

  it("rejects homonymous constraints and indexes whose catalog definitions differ", () => {
    const constraintBlocks: Array<[string, string[]]> = [
      ["tool_integrity", ["tool_categories_kind_check", "tool_categories_name_nonblank"]],
      ["credential_integrity", [
        "credential_categories_scope_check", "credential_categories_owner_scope_check",
        "credential_categories_name_nonblank", "credential_categories_name_trimmed",
      ]],
      ["daily_log_integrity", ["daily_task_logs_state_check", "daily_task_logs_completion_consistency"]],
    ];
    for (const [tag, constraints] of constraintBlocks) {
      const block = sql.match(new RegExp(`do \\$${tag}\\$[\\s\\S]*?\\$${tag}\\$;`, "i"))?.[0] ?? "";
      expect(block).toMatch(/pg_get_constraintdef/i);
      for (const constraint of constraints) {
        expect(block).toContain(`conname = '${constraint}'`);
        expect(block).toContain(`raise exception 'La restricción ${constraint} existe con otra definición`);
      }
    }
    for (const [tag, index, table] of [
      ["tool_unique", "tool_categories_name_ci_unique", "tool_categories"],
      ["credential_shared_unique", "credential_categories_shared_name_ci_unique", "credential_categories"],
      ["credential_private_unique", "credential_categories_private_name_ci_unique", "credential_categories"],
      ["projects_completed_at_index", "projects_completed_at_idx", "projects"],
    ]) {
      const block = sql.match(new RegExp(`do \\$${tag}\\$[\\s\\S]*?\\$${tag}\\$;`, "i"))?.[0] ?? "";
      expect(block).toContain(index);
      expect(block).toMatch(/pg_index/i);
      expect(block).toMatch(/pg_get_indexdef|pg_get_expr/i);
      expect(block).toMatch(new RegExp(`indrelid = 'public\\.${table}'::regclass`, "i"));
      expect(block).toMatch(/pg_am[\s\S]*amname = 'btree'|amname = 'btree'[\s\S]*pg_am/i);
      expect(block).toMatch(/raise exception 'El índice [^']+ existe con otra definición/i);
    }
    const simpleIndexes = sql.match(/do \$simple_index_integrity\$[\s\S]*?\$simple_index_integrity\$;/i)?.[0] ?? "";
    for (const index of [
      "tool_items_category_id_idx", "credentials_category_id_idx",
      "daily_task_logs_activity_date_idx", "daily_task_logs_completed_at_idx",
      "daily_task_logs_completed_by_idx", "projects_completed_by_idx",
    ]) {
      expect(simpleIndexes).toContain(index);
    }
    expect(simpleIndexes).toMatch(/pg_index/i);
    expect(simpleIndexes).toMatch(/pg_get_indexdef/i);
    expect(simpleIndexes).toMatch(/pg_get_expr/i);
    expect(simpleIndexes).toMatch(/index_state\.indrelid = to_regclass\(required\.table_name\)/i);
    expect(simpleIndexes).toMatch(/pg_am[\s\S]*amname = 'btree'|amname = 'btree'[\s\S]*pg_am/i);
    expect(simpleIndexes).toMatch(/raise exception 'El índice % existe con otra definición\.'/i);
    expect(sql).not.toMatch(/raise notice 'No se (?:agregó|creó) (?:tool_categories|credential_categories)/i);
  });
});

describe("manual reconciliation safety and verification", () => {
  it("wraps mutations atomically, reloads PostgREST after commit and ends with a compact safe check", () => {
    expect(manual).toMatch(/\bbegin;[\s\S]*-- RECONCILIATION BODY START[\s\S]*-- RECONCILIATION BODY END[\s\S]*\bcommit;[\s\S]*notify pgrst, 'reload schema';/i);
    const verification = manual.match(/-- VERIFICATION[\s\S]*$/i)?.[0] ?? "";
    expect(verification).toMatch(/select[\s\S]*\bas ok\b/i);
    expect(verification).toMatch(/information_schema\.columns/i);
    expect(verification).toMatch(/pg_class[\s\S]*relrowsecurity/i);
    expect(verification).toMatch(/storage\.buckets/i);
    expect(verification).toMatch(/pg_policy/i);
    expect(verification).toMatch(/has_function_privilege\('authenticated'/i);
    expect(verification).not.toMatch(/select \*|from public\.credentials/i);
  });

  it("audits the exact 60-column contract including types, defaults, nullability and nullable assignee", () => {
    const verification = manual.match(/-- VERIFICATION[\s\S]*$/i)?.[0] ?? "";
    const values = cteValuesBlock(verification, "required_columns");
    const rows = [...values.matchAll(/\('([^']+)', '([^']+)', '([^']+)', (true|false), '([^']+)'\)/g)]
      .map((match) => [match[1], match[2], match[3], match[4] === "true", match[5]]);
    expect(rows).toEqual(requiredColumnAudit);
    expect(verification).toMatch(/format_type\(attribute\.atttypid, attribute\.atttypmod\) = required\.expected_type/i);
    expect(verification).toMatch(/attribute\.attnotnull = required\.expected_not_null/i);
    expect(verification).toMatch(/pg_get_expr\(default_value\.adbin, default_value\.adrelid\)/i);
    expect(verification).toMatch(/required\.table_name = 'daily_tasks'[\s\S]*required\.column_name = 'assignee'/i);
  });

  it("audits all policies by sole authenticated role, command, USING and WITH CHECK semantics", () => {
    const verification = manual.match(/-- VERIFICATION[\s\S]*$/i)?.[0] ?? "";
    const values = cteValuesBlock(verification, "required_policies");
    const rows = [...values.matchAll(/\('([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)'\)/g)]
      .map((match) => match.slice(1, 7));
    expect(rows).toEqual(requiredPolicyAudit);
    expect(verification).toMatch(/policy\.polroles = array\[authenticated_role\.oid\]::oid\[\]/i);
    expect(verification).toMatch(/pg_get_expr\(policy\.polqual, policy\.polrelid\)/i);
    expect(verification).toMatch(/pg_get_expr\(policy\.polwithcheck, policy\.polrelid\)/i);
    const policyState = verification.match(/policy_state as \([\s\S]*?\n  \),/i)?.[0] ?? "";
    expect(policyState).toContain("'[[:space:]]+', '', 'g'");
    expect(policyState).toContain("'(SELECTauth.uid()ASuid)', 'auth.uid()'");
    expect(policyState).not.toMatch(/lower\(coalesce\(pg_get_expr/i);
    expect(policyState).not.toMatch(/::text\|\\\(|\\\)/i);
    expect(policyState).not.toMatch(/replace\([^\n]+, '\(', ''\)|replace\([^\n]+, '\)', ''\)/i);
    expect(verification).toContain("'((scope=''shared''::text)OR(owner_id=auth.uid()))'");
    expect(verification).toContain("'(((scope=''shared''::text)AND(owner_idISNULL))OR((scope=''private''::text)AND(owner_id=auth.uid())))'");
    expect(verification).toContain("'((scope=''shared''::text)OR(owner_id=auth.uid())OR(owner_idISNULL))'");
    expect(verification).toContain("'(((state=''done''::text)AND(completed_by=auth.uid())AND(completed_atISNOTNULL))OR((state<>''done''::text)AND(completed_byISNULL)AND(completed_atISNULL)))'");
    expect(verification).toContain("'(bucket_id=''elabela-assets''::text)'");
    for (const key of ["true", "category_visible", "category_valid", "credential_visible", "log_write", "bucket", "none"]) {
      expect(verification).toContain(`'${key}'`);
    }
  });

  it("preserves boolean grouping when normalizing policy expressions", () => {
    const leftGrouped = normalizePolicyExpression("((scope = 'shared'::text OR owner_id = auth.uid()) AND owner_id IS NOT NULL)");
    const rightGrouped = normalizePolicyExpression("(scope = 'shared'::text OR (owner_id = auth.uid() AND owner_id IS NOT NULL))");
    expect(leftGrouped.replace(/[()]/g, "")).toBe(rightGrouped.replace(/[()]/g, ""));
    expect(leftGrouped).not.toBe(rightGrouped);
  });

  it("casts catalog column names to text before comparing key-column arrays", () => {
    const verification = manual.match(/-- VERIFICATION[\s\S]*$/i)?.[0] ?? "";
    const keyConstraints = verification.match(/key_constraints_ok as \([\s\S]*?\n  \),/i)?.[0] ?? "";

    expect(keyConstraints).toMatch(
      /array_agg\(attribute\.attname::text order by key_column\.ordinality\)/i,
    );
    expect(keyConstraints).toMatch(/constraint_state\.conname = required\.constraint_name/i);
  });

  it("audits RLS, exact FKs/checks/indexes/grants/RPC ACLs and the complete bucket", () => {
    const verification = manual.match(/-- VERIFICATION[\s\S]*$/i)?.[0] ?? "";
    const rlsRows = [...cteValuesBlock(verification, "required_rls_tables")
      .matchAll(/\('([^']+)', '([^']+)'\)/g)].map((match) => match.slice(1, 3));
    expect(rlsRows).toEqual([
      ["public", "projects"], ["public", "credentials"], ["public", "tool_categories"],
      ["public", "credential_categories"], ["public", "daily_task_logs"],
    ]);
    const foreignKeyRows = [...cteValuesBlock(verification, "required_foreign_keys")
      .matchAll(/\('([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)'\)/g)]
      .map((match) => match.slice(1, 7));
    expect(foreignKeyRows).toEqual([
      ["tool_items_category_id_fkey", "tool_items", "category_id", "tool_categories", "id", "a"],
      ["credentials_category_id_fkey", "credentials", "category_id", "credential_categories", "id", "n"],
      ["daily_task_logs_completed_by_fkey", "daily_task_logs", "completed_by", "profiles", "id", "n"],
      ["projects_completed_by_fkey", "projects", "completed_by", "profiles", "id", "n"],
      ["credential_categories_owner_id_fkey", "credential_categories", "owner_id", "profiles", "id", "c"],
    ]);
    expect(verification).toMatch(/foreign_key\.conname = required\.constraint_name/i);
    const checkRows = [...cteValuesBlock(verification, "required_checks")
      .matchAll(/^\s*\('([^']+)', '([^']+)',/gm)].map((match) => match.slice(1, 3));
    expect(checkRows).toEqual([
      ["tool_categories", "tool_categories_kind_check"],
      ["tool_categories", "tool_categories_name_nonblank"],
      ["credential_categories", "credential_categories_scope_check"],
      ["credential_categories", "credential_categories_owner_scope_check"],
      ["credential_categories", "credential_categories_name_nonblank"],
      ["credential_categories", "credential_categories_name_trimmed"],
      ["daily_task_logs", "daily_task_logs_state_check"],
      ["daily_task_logs", "daily_task_logs_completion_consistency"],
      ["projects", "projects_project_type_check"],
      ["projects", "projects_priority_check"],
    ]);
    const indexRows = [...cteValuesBlock(verification, "required_indexes")
      .matchAll(/^\s*\('([^']+)', '([^']+)',/gm)].map((match) => match.slice(1, 3));
    expect(indexRows).toEqual([
      ["tool_categories", "tool_categories_name_ci_unique"],
      ["credential_categories", "credential_categories_shared_name_ci_unique"],
      ["credential_categories", "credential_categories_private_name_ci_unique"],
      ["projects", "projects_completed_at_idx"],
      ["tool_items", "tool_items_category_id_idx"],
      ["credentials", "credentials_category_id_idx"],
      ["daily_task_logs", "daily_task_logs_activity_date_idx"],
      ["daily_task_logs", "daily_task_logs_completed_at_idx"],
      ["daily_task_logs", "daily_task_logs_completed_by_idx"],
      ["projects", "projects_completed_by_idx"],
    ]);
    expect(cteValuesBlock(verification, "required_indexes")).toContain(
      "('projects', 'projects_completed_at_idx', false, 1, 'completed_atdesc', 'none', true, true, 'status_done')",
    );
    const grantRows = [...cteValuesBlock(verification, "required_table_grants")
      .matchAll(/\('([^']+)'\)/g)].map((match) => match[1]);
    expect(grantRows).toEqual([
      "daily_tasks", "projects", "products", "clients", "guiones", "post_types", "story_config",
      "tool_items", "brand_assets", "calendar_events", "credentials", "tool_categories",
      "credential_categories", "daily_task_logs",
    ]);
    const rpcRows = [...cteValuesBlock(verification, "required_rpcs")
      .matchAll(/\('([^']+)'\)/g)].map((match) => match[1]);
    expect(rpcRows).toEqual([
      "public.move_and_delete_tool_category(text,text)",
      "public.reorder_tool_categories(text[])",
      "public.delete_empty_credential_category(text)",
      "public.reorder_credential_categories(text,text[])",
    ]);
    expect(verification).toMatch(/required_rls_tables[\s\S]*'projects'[\s\S]*'credentials'[\s\S]*'tool_categories'[\s\S]*'credential_categories'[\s\S]*'daily_task_logs'/i);
    expect(verification).toMatch(/required_foreign_keys[\s\S]*'tool_items_category_id_fkey'[\s\S]*'credentials_category_id_fkey'[\s\S]*'daily_task_logs_completed_by_fkey'[\s\S]*'projects_completed_by_fkey'/i);
    expect(verification).toMatch(/foreign_key\.confdeltype = required\.delete_action/i);
    expect(verification).toMatch(/required_checks[\s\S]*projects_project_type_check[\s\S]*projects_priority_check/i);
    expect(verification).toMatch(/required_indexes[\s\S]*projects_completed_at_idx/i);
    expect(verification).toMatch(/index_state\.is_desc[\s\S]*index_state\.predicate_key/i);
    expect(verification).toMatch(/pg_am[\s\S]*access_method\.amname = 'btree'/i);
    expect(verification).toMatch(/index_state\.method_matches/i);
    expect(verification).toMatch(/required_table_grants[\s\S]*has_table_privilege\('authenticated'/i);
    expect(verification).toMatch(/required_rpcs[\s\S]*prosecdef = false[\s\S]*has_function_privilege\('authenticated'/i);
    expect(verification).toMatch(/aclexplode\(coalesce\(procedure\.proacl, acldefault\('f', procedure\.proowner\)\)\)[\s\S]*grantee = 0/i);
    expect(verification).toMatch(/allowed_mime_types = array\[[\s\S]*'font\/woff2'[\s\S]*\]::text\[\]/i);
    expect(verification).toMatch(/columns_ok[\s\S]*policies_ok[\s\S]*foreign_keys_ok[\s\S]*checks_ok[\s\S]*indexes_ok[\s\S]*table_grants_ok[\s\S]*rpcs_ok[\s\S]*bucket_ok[\s\S]*as ok/i);
  });

  it("documents abort semantics and the actual five reconciled foreign keys", () => {
    expect(manual).toMatch(/incompatibilidades abortan la transacción/i);
    expect(manual).not.toMatch(/los avisos indican datos heredados/i);
    expect(report).toMatch(/cinco FKs `NOT VALID`/i);
    expect(report).not.toMatch(/cuatro FKs `NOT VALID`|producen `NOTICE` y omiten/i);
  });
});

describe("canonical schema parity", () => {
  it("keeps the critical reconciliation guards equivalent to the forward migration", () => {
    for (const tag of [
      "project_type_check", "project_priority_check", "projects_completed_at_index",
      "tool_column_types", "tool_integrity", "tool_unique",
      "credential_column_types", "credential_integrity", "credential_shared_unique",
      "credential_private_unique", "daily_log_column_types", "daily_log_integrity",
      "simple_index_integrity", "named_foreign_key_integrity", "foreign_key_validation",
      "check_constraint_validation",
    ]) {
      expect(dollarBlock(schema, tag), `missing schema block ${tag}`).not.toBe("");
      expect(dollarBlock(schema, tag).replace(/\n\s*\n/g, "\n"))
        .toBe(dollarBlock(migration, tag).replace(/\n\s*\n/g, "\n"));
    }
  });

  it("preserves hardened RPC privileges and exact project checks", () => {
    for (const routine of [
      /move_and_delete_tool_category\(text, text\)/,
      /reorder_tool_categories\(text\[\]\)/,
      /delete_empty_credential_category\(text\)/,
      /reorder_credential_categories\(text, text\[\]\)/,
    ]) {
      expect(schema).toMatch(new RegExp(`revoke execute on function public\\.${routine.source} from public`, "i"));
    }
    const typeGuard = schema.match(/do \$project_type_check\$[\s\S]*?\$project_type_check\$;/i)?.[0] ?? "";
    const priorityGuard = schema.match(/do \$project_priority_check\$[\s\S]*?\$project_priority_check\$;/i)?.[0] ?? "";
    expect(typeGuard).toMatch(/projects_project_type_check[\s\S]*pg_get_constraintdef|pg_get_constraintdef[\s\S]*projects_project_type_check/i);
    expect(priorityGuard).toMatch(/projects_priority_check[\s\S]*pg_get_constraintdef|pg_get_constraintdef[\s\S]*projects_priority_check/i);
  });

  it("keeps aborting category conflict guards and explicit foreign-key reconciliation", () => {
    expect(schema).toMatch(/do \$tool_integrity\$[\s\S]*tool_categories_name_nonblank[\s\S]*pg_get_constraintdef[\s\S]*raise exception/i);
    expect(schema).toMatch(/do \$credential_integrity\$[\s\S]*credential_categories_name_nonblank[\s\S]*pg_get_constraintdef[\s\S]*raise exception/i);
    expect(schema).toMatch(/do \$tool_unique\$[\s\S]*tool_categories_name_ci_unique[\s\S]*pg_index[\s\S]*raise exception/i);
    expect(schema).toMatch(/do \$credential_shared_unique\$[\s\S]*credential_categories_shared_name_ci_unique[\s\S]*pg_index[\s\S]*raise exception/i);
    expect(schema).not.toMatch(/update public\.credential_categories\s+set name = btrim\(name\)/i);
    expect(schema).not.toMatch(/raise notice 'No se (?:agregó|creó) (?:tool_categories|credential_categories)/i);
    for (const constraint of [
      "tool_items_category_id_fkey", "credentials_category_id_fkey",
      "daily_task_logs_completed_by_fkey", "projects_completed_by_fkey",
    ]) {
      expect(schema).toContain(constraint);
    }
    expect(schema).not.toMatch(/add column if not exists (?:category_id text|completed_by uuid) references public\./i);
  });
});
