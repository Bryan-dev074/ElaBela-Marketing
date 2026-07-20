-- ElaBela hotfix: habilita tareas sin asignar y crea el historial diario.
-- Ejecutar completo una sola vez desde Supabase Dashboard > SQL Editor.

begin;

alter table public.daily_tasks
  alter column assignee drop not null;

create table if not exists public.daily_task_logs (
  id uuid primary key default gen_random_uuid(),
  task_id text not null,
  activity_date date not null,
  state text not null default 'todo' check (state in ('todo', 'doing', 'done')),
  task_name_snapshot text not null,
  task_icon_snapshot text not null default '✨',
  assignee_snapshot text,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (task_id, activity_date)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.daily_task_logs'::regclass
      and conname = 'daily_task_logs_completion_consistency'
  ) then
    alter table public.daily_task_logs
      add constraint daily_task_logs_completion_consistency check (
        (state = 'done' and completed_at is not null)
        or (state <> 'done' and completed_by is null and completed_at is null)
      );
  end if;
end
$$;

create index if not exists daily_task_logs_activity_date_idx
  on public.daily_task_logs (activity_date);

create index if not exists daily_task_logs_completed_at_idx
  on public.daily_task_logs (completed_at)
  where state = 'done';

alter table public.daily_task_logs enable row level security;

drop policy if exists daily_task_logs_all on public.daily_task_logs;

drop policy if exists daily_task_logs_select on public.daily_task_logs;
create policy daily_task_logs_select
  on public.daily_task_logs
  for select
  to authenticated
  using (true);

drop policy if exists daily_task_logs_insert on public.daily_task_logs;
create policy daily_task_logs_insert
  on public.daily_task_logs
  for insert
  to authenticated
  with check (
    (state = 'done' and completed_by = (select auth.uid()) and completed_at is not null)
    or (state <> 'done' and completed_by is null and completed_at is null)
  );

drop policy if exists daily_task_logs_update on public.daily_task_logs;
create policy daily_task_logs_update
  on public.daily_task_logs
  for update
  to authenticated
  using (true)
  with check (
    (state = 'done' and completed_by = (select auth.uid()) and completed_at is not null)
    or (state <> 'done' and completed_by is null and completed_at is null)
  );

drop policy if exists daily_task_logs_delete on public.daily_task_logs;
create policy daily_task_logs_delete
  on public.daily_task_logs
  for delete
  to authenticated
  using (true);

grant select, insert, update, delete
  on table public.daily_task_logs
  to authenticated;

commit;

notify pgrst, 'reload schema';

select to_regclass('public.daily_task_logs') as created_table;
