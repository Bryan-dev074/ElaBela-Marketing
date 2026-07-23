-- Allow tasks created in the calendar to share the same lifecycle as projects.
alter table if exists public.calendar_events
  add column if not exists status text not null default 'todo';

update public.calendar_events
set status = 'todo'
where status is null or status not in ('todo', 'doing', 'done');

alter table public.calendar_events
  drop constraint if exists calendar_events_status_check;

alter table public.calendar_events
  add constraint calendar_events_status_check
  check (status in ('todo', 'doing', 'done'));
