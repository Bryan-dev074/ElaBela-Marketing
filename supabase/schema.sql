-- ============================================================
--  ElaBela · Esquema de base de datos (Supabase / Postgres)
--  Ejecutar en el SQL Editor de Supabase (o `supabase db push`).
--  Diseñado a partir del canvas "CRM ElaBela".
-- ============================================================

-- ---------- Perfiles (rol + username, ligados a auth.users) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  full_name   text not null,
  role        text not null default 'marketer' check (role in ('admin','marketer')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper: ¿el usuario actual es admin? (SECURITY DEFINER evita recursión de RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Al crearse un usuario en auth, se crea su perfil con los metadatos.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'marketer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Políticas de perfiles: cada uno ve/edita el suyo; el admin ve todos.
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- ---------- Tareas diarias ----------
create table if not exists public.daily_tasks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  icon        text default '✨',
  assignee    text,                       -- username asignado
  state       text not null default 'todo' check (state in ('todo','doing','done')),
  note        text,
  created_at  timestamptz not null default now()
);
alter table public.daily_tasks enable row level security;
create policy "daily_tasks_read" on public.daily_tasks for select using (auth.role() = 'authenticated');
create policy "daily_tasks_update" on public.daily_tasks for update using (auth.role() = 'authenticated');
create policy "daily_tasks_admin_write" on public.daily_tasks for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.task_history (
  id          uuid primary key default gen_random_uuid(),
  task_name   text not null,
  assignee    text,
  closed_on   date not null default current_date,
  created_at  timestamptz not null default now()
);
alter table public.task_history enable row level security;
create policy "task_history_read" on public.task_history for select using (auth.role() = 'authenticated');

-- ---------- Proyectos ----------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner       text,
  status      text not null default 'todo' check (status in ('todo','doing','done')),
  due_date    date,
  description text,
  steps       jsonb not null default '[]'::jsonb,   -- [{label, done}]
  created_at  timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "projects_rw" on public.projects for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- Clientes / Productos (HUB) ----------
create table if not exists public.products (
  code          text primary key,
  name          text not null,
  brand         text,
  category      text,
  duration_days int not null default 30
);
alter table public.products enable row level security;
create policy "products_rw" on public.products for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  whatsapp      text,
  main_channel  text,
  bought        boolean not null default false,
  purchases     jsonb not null default '[]'::jsonb,  -- [{product, date}]
  next_contact  date,
  created_at    timestamptz not null default now()
);
alter table public.clients enable row level security;
create policy "clients_rw" on public.clients for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- Guiones ----------
create table if not exists public.guiones (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  state         text not null default 'falta' check (state in ('falta','editando','listo')),
  product_code  text references public.products(code),
  brand         text,
  record_date   date,
  publish_date  date,
  responsible   text,
  types         text[] default '{}',
  link          text,
  body          text,
  created_at    timestamptz not null default now()
);
alter table public.guiones enable row level security;
create policy "guiones_rw" on public.guiones for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------- Activos de marca (colores / fuentes) ----------
create table if not exists public.brand_assets (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('color','font')),
  name        text not null,
  value       text not null,   -- hex o nombre de fuente
  role_label  text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
alter table public.brand_assets enable row level security;
create policy "brand_assets_read" on public.brand_assets for select using (auth.role() = 'authenticated');
create policy "brand_assets_insert" on public.brand_assets for insert with check (auth.role() = 'authenticated');

-- ---------- Credenciales (secreto encriptado, acceso por nivel) ----------
create table if not exists public.credentials (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid references public.profiles(id) on delete cascade,
  platform          text not null,
  username          text,
  secret_encrypted  text,               -- NUNCA texto plano; cifrar antes de guardar
  access_level      text not null default 'personal' check (access_level in ('personal','admin')),
  created_at        timestamptz not null default now()
);
alter table public.credentials enable row level security;
-- Cada quien ve/gestiona lo personal propio; el admin ve todo.
create policy "credentials_select" on public.credentials
  for select using (owner_id = auth.uid() or public.is_admin());
create policy "credentials_modify" on public.credentials
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- ---------- Backfill: crea perfiles para usuarios ya existentes ----------
-- (por si los usuarios se crearon antes de aplicar este esquema)
insert into public.profiles (id, username, full_name, role)
select
  id,
  coalesce(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  coalesce(raw_user_meta_data->>'role', 'marketer')
from auth.users
on conflict (id) do nothing;

-- Fin del esquema.
