-- Persistence foundation for the functional upgrades.  The migration is
-- additive and intentionally leaves legacy weekly_tasks and archived projects intact.

alter table public.daily_tasks alter column assignee drop not null;

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

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tool_categories'::regclass
      and conname = 'tool_categories_name_nonblank'
  ) then
    alter table public.tool_categories
      add constraint tool_categories_name_nonblank check (char_length(btrim(name)) > 0);
  end if;
end
$$;
create unique index if not exists tool_categories_name_ci_unique
  on public.tool_categories (lower(btrim(name)));

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
set category_id = case lower(btrim(category))
  when 'gems' then 'ia'
  when 'gems de gemini' then 'ia'
  when 'links' then 'redes-sociales'
  when 'enlaces oficiales' then 'redes-sociales'
  when 'prompts' then 'prompts'
  when 'ia' then 'ia'
  when 'apps' then 'apps'
  when 'ads' then 'ads'
  when 'enlaces' then 'enlaces'
  when 'redes-sociales' then 'redes-sociales'
  else null
end
where category_id is null;

insert into public.tool_items (id, category, category_id, kind, title, note, href, icon)
select
  'links-downloader',
  'apps',
  'apps',
  'link',
  'Links Downloader',
  'Descarga videos públicos de TikTok e Instagram sin registro.',
  'https://links-downloader.vercel.app/',
  '⬇️'
where not exists (
  select 1 from public.tool_items
  where id = 'links-downloader'
     or lower(btrim(title)) = 'links downloader'
     or href = 'https://links-downloader.vercel.app/'
)
on conflict (id) do nothing;

create or replace function public.move_and_delete_tool_category(
  p_category_id text,
  p_destination_id text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  referenced_count bigint;
  destination_kind text;
begin
  if p_destination_id = p_category_id then
    raise exception 'La categoría de destino debe ser diferente.';
  end if;

  select count(*) into referenced_count
  from public.tool_items
  where category_id = p_category_id;

  if referenced_count > 0 and p_destination_id is null then
    raise exception 'La categoría tiene % recursos; elegí un destino.', referenced_count;
  end if;

  if p_destination_id is not null then
    select kind into destination_kind
    from public.tool_categories
    where id = p_destination_id;
    if destination_kind is null then
      raise exception 'La categoría de destino no existe.';
    end if;

    update public.tool_items
    set category_id = p_destination_id,
        category = case when p_destination_id = 'redes-sociales' then 'links' else p_destination_id end,
        kind = destination_kind
    where category_id = p_category_id;
  end if;

  delete from public.tool_categories where id = p_category_id;
  if not found then
    raise exception 'La categoría no existe.';
  end if;
end;
$$;

create or replace function public.sync_tool_category_kind()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.kind is distinct from old.kind then
    update public.tool_items
    set kind = new.kind
    where category_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_tool_category_kind on public.tool_categories;
create trigger sync_tool_category_kind
after update of kind on public.tool_categories
for each row execute function public.sync_tool_category_kind();

create or replace function public.reorder_tool_categories(p_category_ids text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requested_count integer := coalesce(cardinality(p_category_ids), 0);
  stored_count integer;
  matched_count integer;
begin
  if requested_count = 0 then
    raise exception 'La lista de categorías no puede estar vacía.';
  end if;
  if exists (
    select 1 from unnest(p_category_ids) as requested(id)
    group by requested.id having count(*) > 1
  ) then
    raise exception 'La lista de categorías contiene IDs repetidos.';
  end if;

  select count(*) into stored_count from public.tool_categories;
  select count(*) into matched_count
  from public.tool_categories
  where id = any(p_category_ids);
  if stored_count <> requested_count or matched_count <> requested_count then
    raise exception 'La lista de categorías está desactualizada.';
  end if;

  update public.tool_categories as category
  set sort = requested.ordinality - 1
  from unnest(p_category_ids) with ordinality as requested(id, ordinality)
  where category.id = requested.id;
end;
$$;

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

update public.credential_categories
set name = btrim(name)
where name is distinct from btrim(name)
  and char_length(btrim(name)) > 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.credential_categories'::regclass
      and conname = 'credential_categories_name_nonblank'
  ) then
    alter table public.credential_categories
      add constraint credential_categories_name_nonblank check (char_length(btrim(name)) > 0);
  end if;
end
$$;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.credential_categories'::regclass
      and conname = 'credential_categories_name_trimmed'
  ) then
    alter table public.credential_categories
      add constraint credential_categories_name_trimmed check (name = btrim(name));
  end if;
end
$$;
create unique index if not exists credential_categories_shared_name_ci_unique
  on public.credential_categories (lower(btrim(name))) where scope = 'shared';
create unique index if not exists credential_categories_private_name_ci_unique
  on public.credential_categories (owner_id, lower(btrim(name))) where scope = 'private';

create or replace function public.enforce_credential_category_compatibility()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  category public.credential_categories%rowtype;
begin
  if new.category_id is null then
    return new;
  end if;

  select * into category
  from public.credential_categories
  where id = new.category_id
  for share;
  if not found then
    raise exception 'La categoría de credencial no existe o no es compatible.' using errcode = '23514';
  end if;
  if category.scope = 'shared' and new.scope = 'shared' then
    return new;
  end if;
  if category.scope = 'private'
     and new.scope = 'private'
     and new.owner_id = category.owner_id then
    return new;
  end if;
  raise exception 'La categoría de credencial no existe o no es compatible.' using errcode = '23514';
end;
$$;

drop trigger if exists enforce_credential_category_compatibility on public.credentials;
create trigger enforce_credential_category_compatibility
before insert or update of category_id, scope, owner_id on public.credentials
for each row execute function public.enforce_credential_category_compatibility();

create or replace function public.enforce_category_credential_compatibility()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.credentials
    where category_id = new.id
      and not (
        (new.scope = 'shared' and scope = 'shared')
        or (new.scope = 'private' and scope = 'private' and owner_id = new.owner_id)
      )
  ) then
    raise exception 'La categoría tiene credenciales incompatibles.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_category_credential_compatibility on public.credential_categories;
create trigger enforce_category_credential_compatibility
before update of scope, owner_id on public.credential_categories
for each row execute function public.enforce_category_credential_compatibility();

create or replace function public.prevent_nonempty_credential_category_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.credentials
    where category_id = old.id
  ) then
    raise exception 'La categoría no está vacía.' using errcode = '23503';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_nonempty_credential_category_delete on public.credential_categories;
create trigger prevent_nonempty_credential_category_delete
before delete on public.credential_categories
for each row execute function public.prevent_nonempty_credential_category_delete();

create or replace function public.delete_empty_credential_category(p_category_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  category public.credential_categories%rowtype;
begin
  select * into category
  from public.credential_categories
  where id = p_category_id
  for update;
  if not found then
    raise exception 'La categoría no existe.';
  end if;
  if exists (select 1 from public.credentials where category_id = p_category_id) then
    raise exception 'La categoría no está vacía.';
  end if;
  delete from public.credential_categories where id = p_category_id;
end;
$$;

create or replace function public.reorder_credential_categories(p_scope text, p_category_ids text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid;
  requested_count integer := coalesce(cardinality(p_category_ids), 0);
  stored_count integer;
  matched_count integer;
begin
  actor_id := (select auth.uid());
  if p_scope not in ('shared', 'private') then
    raise exception 'El alcance de categorías no es válido.';
  end if;
  if p_scope = 'private' and actor_id is null then
    raise exception 'No hay un usuario autenticado.';
  end if;
  lock table public.credential_categories in share row exclusive mode;
  if requested_count = 0 then
    raise exception 'La lista de categorías no puede estar vacía.';
  end if;
  if exists (
    select 1 from unnest(p_category_ids) as requested(id)
    group by requested.id having count(*) > 1
  ) then
    raise exception 'La lista de categorías contiene IDs repetidos.';
  end if;

  select count(*) into stored_count
  from public.credential_categories
  where scope = p_scope
    and ((p_scope = 'shared' and owner_id is null) or (p_scope = 'private' and owner_id = actor_id));
  select count(*) into matched_count
  from public.credential_categories
  where id = any(p_category_ids)
    and scope = p_scope
    and ((p_scope = 'shared' and owner_id is null) or (p_scope = 'private' and owner_id = actor_id));
  if stored_count <> requested_count or matched_count <> requested_count then
    raise exception 'La lista de categorías está desactualizada.';
  end if;

  update public.credential_categories as category
  set sort = requested.ordinality - 1
  from unnest(p_category_ids) with ordinality as requested(id, ordinality)
  where category.id = requested.id
    and category.scope = p_scope
    and ((p_scope = 'shared' and category.owner_id is null) or (p_scope = 'private' and category.owner_id = actor_id));
end;
$$;

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
    select 1 from pg_constraint
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
  on public.daily_task_logs (completed_at) where state = 'done';
alter table public.daily_task_logs enable row level security;

alter table public.projects add column if not exists completed_at timestamptz;
alter table public.projects add column if not exists completed_by uuid references public.profiles(id) on delete set null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'elabela-assets', 'elabela-assets', true, 8388608,
  array[
    'image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp',
    'application/font-woff', 'application/font-woff2',
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
drop policy if exists credentials_select on public.credentials;
create policy credentials_select on public.credentials for select to authenticated
  using (scope = 'shared' or owner_id = (select auth.uid()) or owner_id is null);
drop policy if exists credentials_write on public.credentials;
drop policy if exists credentials_insert on public.credentials;
create policy credentials_insert on public.credentials for insert to authenticated
  with check (scope = 'shared' or owner_id = (select auth.uid()) or owner_id is null);
drop policy if exists credentials_update on public.credentials;
create policy credentials_update on public.credentials for update to authenticated
  using (scope = 'shared' or owner_id = (select auth.uid()) or owner_id is null)
  with check (scope = 'shared' or owner_id = (select auth.uid()) or owner_id is null);
drop policy if exists credentials_delete on public.credentials;
create policy credentials_delete on public.credentials for delete to authenticated
  using (scope = 'shared' or owner_id = (select auth.uid()) or owner_id is null);
drop policy if exists daily_task_logs_all on public.daily_task_logs;
drop policy if exists daily_task_logs_select on public.daily_task_logs;
create policy daily_task_logs_select on public.daily_task_logs for select to authenticated
  using (true);
drop policy if exists daily_task_logs_insert on public.daily_task_logs;
create policy daily_task_logs_insert on public.daily_task_logs for insert to authenticated
  with check (
    (state = 'done' and completed_by = (select auth.uid()) and completed_at is not null)
    or (state <> 'done' and completed_by is null and completed_at is null)
  );
drop policy if exists daily_task_logs_update on public.daily_task_logs;
create policy daily_task_logs_update on public.daily_task_logs for update to authenticated
  using (true)
  with check (
    (state = 'done' and completed_by = (select auth.uid()) and completed_at is not null)
    or (state <> 'done' and completed_by is null and completed_at is null)
  );
drop policy if exists daily_task_logs_delete on public.daily_task_logs;
create policy daily_task_logs_delete on public.daily_task_logs for delete to authenticated
  using (true);

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

grant execute on function public.move_and_delete_tool_category(text, text) to authenticated;
grant execute on function public.reorder_tool_categories(text[]) to authenticated;
revoke execute on function public.delete_empty_credential_category(text) from public;
revoke execute on function public.reorder_credential_categories(text, text[]) from public;
grant execute on function public.delete_empty_credential_category(text) to authenticated;
grant execute on function public.reorder_credential_categories(text, text[]) to authenticated;
