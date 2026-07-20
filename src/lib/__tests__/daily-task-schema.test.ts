import fs from "node:fs";
import path from "node:path";

const schema = fs.readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf8");
const migration = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", "20260718174251_elabela_functional_upgrades.sql"), "utf8");

describe.each([["canonical schema", schema], ["pending migration", migration]])("daily task persistence in %s", (_label, sql) => {
  it("keeps nullable definitions and date-scoped snapshots", () => {
    expect(sql).toMatch(/alter table public\.daily_tasks alter column assignee drop not null/i);
    expect(sql).toMatch(/create table if not exists public\.daily_task_logs[\s\S]*unique \(task_id, activity_date\)/i);
    expect(sql).toMatch(/assignee_snapshot text/i);
    expect(sql).toMatch(/completed_by uuid/i);
    expect(sql).toMatch(/completed_by uuid references public\.profiles\(id\)|daily_task_logs_completed_by_fkey[\s\S]*foreign key \(completed_by\) references public\.profiles\(id\)[\s\S]*on delete set null/i);
    expect(sql).toMatch(/updated_at timestamptz not null/i);
    const logsBlock = sql.match(/create table if not exists public\.daily_task_logs \([\s\S]*?\n\);/i)?.[0] ?? "";
    expect(logsBlock).not.toMatch(/task_id text[^,]*references public\.daily_tasks/i);
    const consistency = sql.match(/add constraint daily_task_logs_completion_consistency check \([\s\S]*?\n\s*\);/i)?.[0] ?? "";
    expect(consistency).toMatch(/state = 'done' and completed_at is not null/i);
    expect(consistency).not.toMatch(/state = 'done' and completed_by is not null/i);
    expect(consistency).toMatch(/state <> 'done' and completed_by is null and completed_at is null/i);
  });

  it("has explicit authenticated RLS and Data API grants for logs", () => {
    expect(sql).toMatch(/alter table public\.daily_task_logs enable row level security/i);
    expect(sql).toMatch(/create policy daily_task_logs_select[\s\S]*for select to authenticated[\s\S]*using \(true\)/i);
    expect(sql).toMatch(/create policy daily_task_logs_insert[\s\S]*for insert to authenticated[\s\S]*state = 'done' and completed_by = \(select auth\.uid\(\)\) and completed_at is not null[\s\S]*state <> 'done' and completed_by is null and completed_at is null/i);
    expect(sql).toMatch(/create policy daily_task_logs_update[\s\S]*for update to authenticated[\s\S]*using \(true\)[\s\S]*state = 'done' and completed_by = \(select auth\.uid\(\)\) and completed_at is not null[\s\S]*state <> 'done' and completed_by is null and completed_at is null/i);
    expect(sql).not.toMatch(/create policy daily_task_logs_all[\s\S]*with check \(true\)/i);
    expect(sql).toMatch(/grant select, insert, update, delete on table[\s\S]*public\.daily_task_logs[\s\S]*to authenticated/i);
  });

  it("indexes activity dates and completed history", () => {
    expect(sql).toMatch(/create index(?: if not exists)? daily_task_logs_activity_date_idx/i);
    expect(sql).toMatch(/create index(?: if not exists)? daily_task_logs_completed_at_idx/i);
  });
});
