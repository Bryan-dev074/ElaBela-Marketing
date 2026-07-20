-- Persistence foundation for the functional upgrades.  The migration is
-- additive and intentionally leaves legacy weekly_tasks and archived projects intact.

alter table public.post_types add column if not exists example_images text[] not null default '{}';
alter table public.post_types add column if not exists guide text not null default '';
alter table public.post_types add column if not exists tool_ids text[] not null default '{}';

create table if not exists public.tool_categories (
  id text primary key,
  name text not null,
  icon text not null default '✨',
  accent text not null default '#d6ab99',
  kind text not null default 'link' check (kind in ('prompt', 'link')),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.tool_categories enable row level security;

insert into public.tool_categories (id, name, icon, accent, kind, sort) values
  ('prompts', 'Prompts', '💬', '#d6ab99', 'prompt', 0),
  ('ia', 'IA', '🤖', '#818cf8', 'link', 1),
  ('apps', 'Apps', '📲', '#22d3ee', 'link', 2),
  ('ads', 'Ads', '📢', '#f59e0b', 'link', 3),
  ('enlaces', 'Enlaces', '🔗', '#34d399', 'link', 4),
  ('redes-sociales', 'Redes Sociales', '📱', '#f472b6', 'link', 5)
on conflict (id) do nothing;

alter table public.tool_items add column if not exists category_id text references public.tool_categories(id);
update public.tool_items
set category_id = case category
  when 'gems' then 'enlaces'
  when 'links' then 'redes-sociales'
  when 'prompts' then 'prompts'
  when 'ia' then 'ia'
  when 'apps' then 'apps'
  when 'ads' then 'ads'
  else null
end
where category_id is null;

alter table public.brand_assets add column if not exists file_url text;
alter table public.brand_assets add column if not exists file_format text;
alter table public.brand_assets add column if not exists storage_path text;

create table if not exists public.credential_categories (
  id text primary key,
  name text not null,
  icon text not null default '🔑',
  scope text not null check (scope in ('shared', 'private')),
  owner_id uuid references public.profiles(id) on delete cascade,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  check ((scope = 'shared' and owner_id is null) or (scope = 'private' and owner_id is not null))
);
alter table public.credential_categories enable row level security;
alter table public.credentials add column if not exists category_id text references public.credential_categories(id) on delete set null;

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
alter table public.daily_task_logs enable row level security;

alter table public.projects add column if not exists completed_at timestamptz;
alter table public.projects add column if not exists completed_by uuid references public.profiles(id) on delete set null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'elabela-assets', 'elabela-assets', true, 8388608,
  array[
    'image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp',
    'application/font-woff', 'application/font-woff2', 'application/vnd.ms-fontobject',
    'font/otf', 'font/ttf', 'font/woff', 'font/woff2'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tool_categories_all on public.tool_categories;
create policy tool_categories_all on public.tool_categories for all to authenticated
  using (true) with check (true);
drop policy if exists credential_categories_select on public.credential_categories;
create policy credential_categories_select on public.credential_categories for select to authenticated
  using (scope = 'shared' or owner_id = (select auth.uid()));
drop policy if exists credential_categories_insert on public.credential_categories;
create policy credential_categories_insert on public.credential_categories for insert to authenticated
  with check ((scope = 'shared' and owner_id is null) or (scope = 'private' and owner_id = (select auth.uid())));
drop policy if exists credential_categories_update on public.credential_categories;
create policy credential_categories_update on public.credential_categories for update to authenticated
  using (scope = 'shared' or owner_id = (select auth.uid()))
  with check ((scope = 'shared' and owner_id is null) or (scope = 'private' and owner_id = (select auth.uid())));
drop policy if exists credential_categories_delete on public.credential_categories;
create policy credential_categories_delete on public.credential_categories for delete to authenticated
  using (scope = 'shared' or owner_id = (select auth.uid()));
drop policy if exists daily_task_logs_all on public.daily_task_logs;
create policy daily_task_logs_all on public.daily_task_logs for all to authenticated
  using (true) with check (true);

drop policy if exists elabela_assets_insert on storage.objects;
create policy elabela_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'elabela-assets');
drop policy if exists elabela_assets_select on storage.objects;
create policy elabela_assets_select on storage.objects for select to authenticated
  using (bucket_id = 'elabela-assets');
drop policy if exists elabela_assets_update on storage.objects;
create policy elabela_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'elabela-assets') with check (bucket_id = 'elabela-assets');
drop policy if exists elabela_assets_delete on storage.objects;
create policy elabela_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'elabela-assets');

grant select, insert, update, delete on table
  public.daily_tasks,
  public.projects,
  public.products,
  public.clients,
  public.guiones,
  public.post_types,
  public.story_config,
  public.tool_items,
  public.brand_assets,
  public.calendar_events,
  public.credentials,
  public.tool_categories,
  public.credential_categories,
  public.daily_task_logs
to authenticated;
