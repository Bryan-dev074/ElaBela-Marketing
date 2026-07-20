-- ============================================================
--  ElaBela · Esquema v3 (idempotente — seguro de re-ejecutar)
--  Pegar en Supabase → SQL Editor y ejecutar.
-- ============================================================

-- ---------- Perfiles (rol + username, ligados a auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text not null,
  role text not null default 'marketer' check (role in ('admin','marketer')),
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists avatar text; -- foto de perfil (data URL comprimida)
alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name, role)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role','marketer'))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------- helper: aplica RLS "cualquier autenticado" ----------
-- (se define por tabla más abajo con drop/create)

-- ---------- Migración v2 → v3: PKs de uuid a text ----------
-- Las tablas creadas con el esquema v2 tenían id uuid; la app genera ids text
-- ("pr1752…", "g1752…"). `create table if not exists` no altera tablas viejas,
-- así que convertimos acá (no-op si ya son text).
do $$
declare t text;
begin
  foreach t in array array['daily_tasks','projects','guiones','clients','brand_assets','credentials','tool_items','post_types','calendar_events']
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'id' and data_type = 'uuid'
    ) then
      execute format('alter table public.%I alter column id drop default', t);
      execute format('alter table public.%I alter column id type text using id::text', t);
    end if;
  end loop;
end $$;

-- ---------- Tareas diarias ----------
create table if not exists public.daily_tasks (
  id text primary key,
  name text not null,
  icon text default '✨',
  assignee text,
  state text not null default 'todo' check (state in ('todo','doing','done')),
  note text,
  rotation text[],
  sort int default 0,
  created_at timestamptz not null default now()
);
alter table public.daily_tasks add column if not exists rotation text[];
alter table public.daily_tasks add column if not exists sort int default 0;
alter table public.daily_tasks add column if not exists days int[]; -- días de la semana (0=Lun … 6=Dom); null = todos
alter table public.daily_tasks add column if not exists day_assignees text[]; -- modo «fija por día»: dueño por día (7 posiciones, '' = no se hace)
alter table public.daily_tasks add column if not exists post_type text; -- id del tipo de post relacionado (opcional)

alter table public.daily_tasks enable row level security;
drop policy if exists daily_tasks_all on public.daily_tasks;
create policy daily_tasks_all on public.daily_tasks for all to authenticated using (true) with check (true);

-- ---------- Proyectos ----------
create table if not exists public.projects (
  id text primary key,
  name text not null,
  owner text,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  created_at date not null default current_date,
  due_date date,
  archived boolean not null default false,
  content_mode text not null default 'steps' check (content_mode in ('steps','note')),
  steps jsonb not null default '[]'::jsonb,
  note text
);
alter table public.projects add column if not exists archived boolean not null default false;
alter table public.projects add column if not exists content_mode text not null default 'steps';
alter table public.projects add column if not exists note text;
alter table public.projects enable row level security;
drop policy if exists projects_all on public.projects;
create policy projects_all on public.projects for all to authenticated using (true) with check (true);

-- ---------- Productos ----------
create table if not exists public.products (
  code text primary key,
  name text not null,
  brand text,
  category text,
  duration_days int not null default 30,
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;
drop policy if exists products_all on public.products;
create policy products_all on public.products for all to authenticated using (true) with check (true);

-- ---------- Clientes ----------
create table if not exists public.clients (
  id text primary key,
  name text not null,
  whatsapp text,
  main_channel text,
  bought boolean not null default false,
  last_purchase date,
  next_contact date,
  created_at timestamptz not null default now()
);
alter table public.clients add column if not exists last_purchase date;
alter table public.clients enable row level security;
drop policy if exists clients_all on public.clients;
create policy clients_all on public.clients for all to authenticated using (true) with check (true);

-- ---------- Guiones ----------
create table if not exists public.guiones (
  id text primary key,
  name text not null,
  state text not null default 'falta' check (state in ('falta','editando','listo')),
  product text,
  brand text,
  record_date date,
  publish_date date,
  responsible text,
  types text[] default '{}',
  link text,
  body text,
  created_at timestamptz not null default now()
);
alter table public.guiones add column if not exists product text;
alter table public.guiones enable row level security;
drop policy if exists guiones_all on public.guiones;
create policy guiones_all on public.guiones for all to authenticated using (true) with check (true);

-- ---------- Tipos de post ----------
create table if not exists public.post_types (
  id text primary key,
  name text not null,
  icon text default '✨',
  descr text,
  accent text default '#d6ab99',
  example text,
  example_image text,
  sort int default 0,
  created_at timestamptz not null default now()
);
alter table public.post_types enable row level security;
drop policy if exists post_types_all on public.post_types;
create policy post_types_all on public.post_types for all to authenticated using (true) with check (true);

-- ---------- Config de historias (por plataforma) ----------
create table if not exists public.story_config (
  platform text primary key,
  icon text,
  min int not null default 1,
  max int not null default 2,
  schedules text[] default '{}',
  done int not null default 0,
  assignee text
);
alter table public.story_config add column if not exists done_date date; -- a qué día corresponde `done` (reseteo diario)
alter table public.story_config enable row level security;
drop policy if exists story_config_all on public.story_config;
create policy story_config_all on public.story_config for all to authenticated using (true) with check (true);

-- ---------- Recursos (Tools) ----------
create table if not exists public.tool_items (
  id text primary key,
  category text not null,
  kind text not null default 'link' check (kind in ('prompt','link')),
  title text not null,
  note text,
  href text,
  image text,
  icon text, -- emoji o data URL (imagen/GIF) elegido por el usuario
  created_at timestamptz not null default now()
);
alter table public.tool_items add column if not exists icon text;
alter table public.tool_items add column if not exists steps text; -- pasos para aplicar un prompt (uno por línea)
alter table public.tool_items enable row level security;
drop policy if exists tool_items_all on public.tool_items;
create policy tool_items_all on public.tool_items for all to authenticated using (true) with check (true);

-- ---------- Activos de marca ----------
create table if not exists public.brand_assets (
  id text primary key,
  kind text not null check (kind in ('color','font')),
  name text not null,
  value text not null,
  role_label text,
  created_at timestamptz not null default now()
);
alter table public.brand_assets enable row level security;
drop policy if exists brand_assets_all on public.brand_assets;
create policy brand_assets_all on public.brand_assets for all to authenticated using (true) with check (true);

-- ---------- Eventos del calendario ----------
create table if not exists public.calendar_events (
  id text primary key,
  event_date date not null,
  kind text not null check (kind in ('tarea','proyecto')),
  title text not null,
  owner text,
  created_at timestamptz not null default now()
);
alter table public.calendar_events enable row level security;
drop policy if exists calendar_events_all on public.calendar_events;
create policy calendar_events_all on public.calendar_events for all to authenticated using (true) with check (true);

-- ---------- Credenciales (secreto cifrado en app; acceso por nivel) ----------
create table if not exists public.credentials (
  id text primary key,
  owner_id uuid references public.profiles(id) on delete cascade,
  platform text not null,
  icon text default '🔑',
  id_type text default 'email' check (id_type in ('email','usuario')),
  identifier text,
  secret text,
  scope text not null default 'private' check (scope in ('shared','private')),
  created_at timestamptz not null default now()
);
alter table public.credentials add column if not exists icon text default '🔑';
alter table public.credentials add column if not exists id_type text default 'email';
alter table public.credentials add column if not exists identifier text;
alter table public.credentials add column if not exists secret text;
alter table public.credentials add column if not exists scope text not null default 'private';
alter table public.credentials enable row level security;
-- compartidas: las ve/edita todo el equipo; privadas: SOLO el dueño (ni el admin).
-- OJO: no usar FOR ALL con using(authenticated) — las políticas permisivas se
-- combinan con OR y eso volvería legibles las credenciales privadas ajenas.
drop policy if exists credentials_select on public.credentials;
create policy credentials_select on public.credentials for select to authenticated
  using (scope = 'shared' or owner_id = auth.uid() or owner_id is null);
drop policy if exists credentials_write on public.credentials;
drop policy if exists credentials_insert on public.credentials;
create policy credentials_insert on public.credentials for insert to authenticated
  with check (scope = 'shared' or owner_id = auth.uid() or owner_id is null);
drop policy if exists credentials_update on public.credentials;
create policy credentials_update on public.credentials for update to authenticated
  using (scope = 'shared' or owner_id = auth.uid() or owner_id is null)
  with check (scope = 'shared' or owner_id = auth.uid() or owner_id is null);
drop policy if exists credentials_delete on public.credentials;
create policy credentials_delete on public.credentials for delete to authenticated
  using (scope = 'shared' or owner_id = auth.uid() or owner_id is null);

-- ---------- Backfill de perfiles ----------
insert into public.profiles (id, username, full_name, role)
select id,
  coalesce(raw_user_meta_data->>'username', split_part(email,'@',1)),
  coalesce(raw_user_meta_data->>'full_name', split_part(email,'@',1)),
  coalesce(raw_user_meta_data->>'role','marketer')
from auth.users on conflict (id) do nothing;

-- ---------- Functional upgrades: persistence foundation ----------
-- These statements are deliberately additive so the canonical schema can be
-- re-run against an existing project without deleting legacy records.

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
  'elabela-assets',
  'elabela-assets',
  true,
  8388608,
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
