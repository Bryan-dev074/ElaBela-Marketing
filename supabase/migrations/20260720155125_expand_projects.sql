alter table public.projects add column if not exists responsible_usernames text[] not null default '{}';
alter table public.projects add column if not exists completed_responsible_usernames text[];
alter table public.projects add column if not exists project_type text not null default 'other';
alter table public.projects add column if not exists priority text not null default 'normal';
alter table public.projects add column if not exists objective text;
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists completed_at timestamptz;
alter table public.projects add column if not exists completed_by uuid references public.profiles(id) on delete set null;

do $$ begin
  alter table public.projects add constraint projects_project_type_check
    check (project_type in ('campaign','launch','content','brand-design','web-ecommerce','event','crm','operations','other'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.projects add constraint projects_priority_check
    check (priority in ('low','normal','high','urgent'));
exception when duplicate_object then null; end $$;

create index if not exists projects_completed_at_idx
  on public.projects (completed_at desc) where status = 'done';

alter table public.projects enable row level security;
grant select, insert, update, delete on table public.projects to authenticated;
