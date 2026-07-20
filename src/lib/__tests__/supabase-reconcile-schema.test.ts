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

const scripts = [
  ["forward migration", migration],
  ["manual SQL Editor script", manual],
] as const;

function reconciliationBody(sql: string) {
  return sql.match(/-- RECONCILIATION BODY START\s*([\s\S]*?)\s*-- RECONCILIATION BODY END/i)?.[1]
    .replace(/\r\n/g, "\n")
    .trim() ?? "";
}

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

  it("guards category constraints and case-insensitive uniqueness without rewriting legacy names", () => {
    expect(sql).toMatch(/tool_categories_name_nonblank[\s\S]*raise notice/i);
    expect(sql).toMatch(/credential_categories_name_nonblank[\s\S]*raise notice/i);
    expect(sql).toMatch(/credential_categories_name_trimmed[\s\S]*raise notice/i);
    expect(sql).toMatch(/tool_categories_name_ci_unique[\s\S]*group by lower\(btrim\(name\)\)[\s\S]*raise notice/i);
    expect(sql).toMatch(/credential_categories_shared_name_ci_unique[\s\S]*raise notice/i);
    expect(sql).toMatch(/credential_categories_private_name_ci_unique[\s\S]*raise notice/i);
    expect(sql).not.toMatch(/update public\.credential_categories\s+set name = btrim\(name\)/i);
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
});

describe("manual reconciliation safety and verification", () => {
  it("wraps mutations atomically, reloads PostgREST after commit and ends with a compact safe check", () => {
    expect(manual).toMatch(/\bbegin;[\s\S]*-- RECONCILIATION BODY START[\s\S]*-- RECONCILIATION BODY END[\s\S]*\bcommit;[\s\S]*notify pgrst, 'reload schema';/i);
    const verification = manual.match(/-- VERIFICATION[\s\S]*$/i)?.[0] ?? "";
    expect(verification).toMatch(/select[\s\S]*\bas ok\b/i);
    expect(verification).toMatch(/information_schema\.columns/i);
    expect(verification).toMatch(/pg_class[\s\S]*relrowsecurity/i);
    expect(verification).toMatch(/storage\.buckets/i);
    expect(verification).toMatch(/pg_policies/i);
    expect(verification).toMatch(/has_function_privilege\('authenticated'/i);
    expect(verification).not.toMatch(/identifier|secret|owner_id|select \*|from public\.credentials/i);
  });
});

describe("canonical schema parity", () => {
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

  it("keeps category conflict guards and explicit foreign-key reconciliation", () => {
    expect(schema).toMatch(/tool_categories_name_nonblank[\s\S]*raise notice/i);
    expect(schema).toMatch(/credential_categories_name_nonblank[\s\S]*raise notice/i);
    expect(schema).toMatch(/tool_categories_name_ci_unique[\s\S]*raise notice/i);
    expect(schema).toMatch(/credential_categories_shared_name_ci_unique[\s\S]*raise notice/i);
    expect(schema).not.toMatch(/update public\.credential_categories\s+set name = btrim\(name\)/i);
    for (const constraint of [
      "tool_items_category_id_fkey", "credentials_category_id_fkey",
      "daily_task_logs_completed_by_fkey", "projects_completed_by_fkey",
    ]) {
      expect(schema).toContain(constraint);
    }
    expect(schema).not.toMatch(/add column if not exists (?:category_id text|completed_by uuid) references public\./i);
  });
});
