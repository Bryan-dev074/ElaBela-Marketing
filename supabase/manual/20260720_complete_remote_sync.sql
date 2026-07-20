-- ElaBela: reconciliación completa de un remoto parcialmente actualizado.
-- En Supabase Dashboard > SQL Editor, pegá y ejecutá este archivo completo una sola vez.
-- Es seguro volver a ejecutarlo; las incompatibilidades abortan la transacción sin borrar datos.

begin;

-- RECONCILIATION BODY START
do $prerequisites$
declare
  missing_tables text;
begin
  select string_agg(required.table_name, ', ' order by required.ordinality)
  into missing_tables
  from unnest(array[
    'profiles',
    'daily_tasks',
    'story_config',
    'post_types',
    'tool_items',
    'brand_assets',
    'credentials',
    'projects'
  ]::text[]) with ordinality as required(table_name, ordinality)
  where not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = required.table_name
  );

  if missing_tables is not null then
    raise exception 'Faltan tablas base requeridas: %', missing_tables;
  end if;
end
$prerequisites$;

alter table public.profiles add column if not exists avatar text;

alter table public.daily_tasks add column if not exists assignee text;
alter table public.daily_tasks add column if not exists rotation text[];
alter table public.daily_tasks add column if not exists sort integer default 0;
alter table public.daily_tasks add column if not exists days integer[];
alter table public.daily_tasks add column if not exists day_assignees text[];
alter table public.daily_tasks add column if not exists post_type text;
alter table public.daily_tasks alter column assignee drop not null;

alter table public.projects add column if not exists archived boolean not null default false;
alter table public.projects add column if not exists content_mode text not null default 'steps';
alter table public.projects add column if not exists note text;
alter table public.clients add column if not exists last_purchase date;
alter table public.guiones add column if not exists product text;
alter table public.story_config add column if not exists done_date date;
alter table public.tool_items add column if not exists icon text;
alter table public.tool_items add column if not exists steps text;
alter table public.credentials add column if not exists icon text default '🔑';
alter table public.credentials add column if not exists id_type text default 'email';
alter table public.credentials add column if not exists identifier text;
alter table public.credentials add column if not exists secret text;
alter table public.credentials add column if not exists scope text not null default 'private';

alter table public.post_types add column if not exists example_images text[] not null default '{}';
alter table public.post_types add column if not exists guide text not null default '';
alter table public.post_types add column if not exists tool_ids text[] not null default '{}';

alter table public.brand_assets add column if not exists file_url text;
alter table public.brand_assets add column if not exists file_format text;
alter table public.brand_assets add column if not exists storage_path text;

create table if not exists public.tool_categories (
  id text constraint tool_categories_pkey primary key,
  name text not null,
  icon text not null default '✨',
  accent text not null default '#d6ab99',
  kind text not null default 'link',
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  constraint tool_categories_kind_check check (kind in ('prompt', 'link')),
  constraint tool_categories_name_nonblank check (char_length(btrim(name)) > 0)
);
alter table public.tool_categories add column if not exists id text;
alter table public.tool_categories add column if not exists name text;
alter table public.tool_categories add column if not exists icon text default '✨';
alter table public.tool_categories add column if not exists accent text default '#d6ab99';
alter table public.tool_categories add column if not exists kind text default 'link';
alter table public.tool_categories add column if not exists sort integer default 0;
alter table public.tool_categories add column if not exists created_at timestamptz default now();

do $tool_column_types$
declare
  incompatible_columns text;
begin
  select string_agg(required.column_name, ', ' order by required.ordinality)
  into incompatible_columns
  from unnest(array['id', 'name', 'icon', 'accent', 'kind', 'sort', 'created_at']::text[])
       with ordinality as required(column_name, ordinality)
  join pg_attribute attribute
    on attribute.attrelid = 'public.tool_categories'::regclass
   and attribute.attname = required.column_name and not attribute.attisdropped
  where format_type(attribute.atttypid, attribute.atttypmod)
        <> (array['text', 'text', 'text', 'text', 'text', 'integer', 'timestamp with time zone'])[required.ordinality::integer];
  if incompatible_columns is not null then
    raise exception 'Hay columnas con tipos incompatibles en public.tool_categories: %', incompatible_columns;
  end if;
end
$tool_column_types$;

update public.tool_categories set icon = '✨' where icon is null;
update public.tool_categories set accent = '#d6ab99' where accent is null;
update public.tool_categories set kind = 'link' where kind is null;
update public.tool_categories set sort = 0 where sort is null;
update public.tool_categories set created_at = now() where created_at is null;

do $tool_integrity$
declare
  actual_definition text;
  named_matches boolean;
begin
  if exists (
    select 1 from public.tool_categories
    where id is null or name is null
  ) then
    raise exception 'Faltan valores obligatorios en public.tool_categories (id o name); no existe una corrección semántica segura.';
  end if;
  if exists (
    select 1 from public.tool_categories
    where char_length(btrim(name)) = 0 or kind not in ('prompt', 'link')
  ) then
    raise exception 'Hay valores incompatibles en public.tool_categories (name o kind); corríjalos antes de reintentar.';
  end if;

  select c.contype = 'p'
         and cardinality(c.conkey) = 1
         and a.attname = 'id'
  into named_matches
  from pg_constraint c
  left join pg_attribute a
    on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.conrelid = 'public.tool_categories'::regclass
    and c.conname = 'tool_categories_pkey';
  if named_matches is false then
    raise exception 'La restricción tool_categories_pkey existe con otra definición.';
  end if;
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.conrelid = 'public.tool_categories'::regclass
      and c.contype = 'p' and cardinality(c.conkey) = 1 and a.attname = 'id'
  ) then
    if exists (select id from public.tool_categories group by id having count(*) > 1) then
      raise exception 'No se puede crear la clave primaria de public.tool_categories: existen IDs duplicados.';
    end if;
    alter table public.tool_categories
      add constraint tool_categories_pkey primary key (id);
  end if;

  select regexp_replace(lower(pg_get_constraintdef(oid)), '\s+', '', 'g')
  into actual_definition
  from pg_constraint
  where conrelid = 'public.tool_categories'::regclass
    and conname = 'tool_categories_kind_check';
  if actual_definition is null then
    alter table public.tool_categories
      add constraint tool_categories_kind_check check (kind in ('prompt', 'link'));
  elsif actual_definition <> 'check((kind=any(array[''prompt''::text,''link''::text])))' then
    raise exception 'La restricción tool_categories_kind_check existe con otra definición: %', actual_definition;
  end if;

  select regexp_replace(lower(pg_get_constraintdef(oid)), '\s+', '', 'g')
  into actual_definition
  from pg_constraint
  where conrelid = 'public.tool_categories'::regclass
    and conname = 'tool_categories_name_nonblank';
  if actual_definition is null then
    alter table public.tool_categories
      add constraint tool_categories_name_nonblank check (char_length(btrim(name)) > 0);
  elsif actual_definition <> 'check((char_length(btrim(name))>0))' then
    raise exception 'La restricción tool_categories_name_nonblank existe con otra definición: %', actual_definition;
  end if;
end
$tool_integrity$;

alter table public.tool_categories alter column icon set default '✨';
alter table public.tool_categories alter column accent set default '#d6ab99';
alter table public.tool_categories alter column kind set default 'link';
alter table public.tool_categories alter column sort set default 0;
alter table public.tool_categories alter column created_at set default now();
alter table public.tool_categories alter column id set not null;
alter table public.tool_categories alter column name set not null;
alter table public.tool_categories alter column icon set not null;
alter table public.tool_categories alter column accent set not null;
alter table public.tool_categories alter column kind set not null;
alter table public.tool_categories alter column sort set not null;
alter table public.tool_categories alter column created_at set not null;
alter table public.tool_categories enable row level security;

do $tool_unique$
declare
  index_matches boolean;
begin
  select i.indisunique and i.indisvalid and i.indisready
         and i.indnkeyatts = 1 and i.indnatts = 1
         and regexp_replace(lower(pg_get_indexdef(i.indexrelid, 1, false)), '\s+', '', 'g') = 'lower(btrim(name))'
         and i.indpred is null
  into index_matches
  from pg_index i
  join pg_class index_relation on index_relation.oid = i.indexrelid
  join pg_am access_method
    on access_method.oid = index_relation.relam and access_method.amname = 'btree'
  where i.indexrelid = to_regclass('public.tool_categories_name_ci_unique')
    and i.indrelid = 'public.tool_categories'::regclass;
  if to_regclass('public.tool_categories_name_ci_unique') is not null
     and index_matches is distinct from true then
    raise exception 'El índice tool_categories_name_ci_unique existe con otra definición.';
  end if;
  if to_regclass('public.tool_categories_name_ci_unique') is null then
    if exists (
      select 1 from public.tool_categories
      group by lower(btrim(name)) having count(*) > 1
    ) then
      raise exception 'No se puede crear el índice tool_categories_name_ci_unique: existen nombres duplicados sin distinguir mayúsculas.';
    end if;
    create unique index tool_categories_name_ci_unique
      on public.tool_categories (lower(btrim(name)));
  end if;
end
$tool_unique$;

insert into public.tool_categories (id, name, icon, accent, kind, sort) values
  ('prompts', 'Prompts', '💬', '#d6ab99', 'prompt', 0),
  ('ia', 'IA', '🤖', '#818cf8', 'link', 1),
  ('apps', 'Apps', '📲', '#22d3ee', 'link', 2),
  ('ads', 'Ads', '📢', '#f59e0b', 'link', 3),
  ('enlaces', 'Enlaces', '🔗', '#34d399', 'link', 4),
  ('redes-sociales', 'Redes Sociales', '📱', '#f472b6', 'link', 5)
on conflict (id) do nothing;

alter table public.tool_items add column if not exists category_id text;

do $tool_category_fk$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute source_column
      on source_column.attrelid = c.conrelid
     and source_column.attnum = c.conkey[1]
    join pg_attribute target_column
      on target_column.attrelid = c.confrelid
     and target_column.attnum = c.confkey[1]
    where c.conrelid = 'public.tool_items'::regclass
      and c.contype = 'f'
      and cardinality(c.conkey) = 1
      and source_column.attname = 'category_id'
      and c.confrelid = 'public.tool_categories'::regclass
      and target_column.attname = 'id'
      and c.confdeltype = 'a'
  ) then
    if exists (
      select 1 from pg_constraint
      where conrelid = 'public.tool_items'::regclass
        and conname = 'tool_items_category_id_fkey'
    ) then
      raise exception 'La restricción tool_items_category_id_fkey existe con otra definición.';
    end if;
    alter table public.tool_items
      add constraint tool_items_category_id_fkey
      foreign key (category_id) references public.tool_categories(id) not valid;
  end if;
end
$tool_category_fk$;

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

create table if not exists public.credential_categories (
  id text constraint credential_categories_pkey primary key,
  name text not null,
  icon text not null default '🔑',
  scope text not null,
  owner_id uuid,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  constraint credential_categories_scope_check check (scope in ('shared', 'private')),
  constraint credential_categories_owner_scope_check check (
    (scope = 'shared' and owner_id is null)
    or (scope = 'private' and owner_id is not null)
  ),
  constraint credential_categories_name_nonblank check (char_length(btrim(name)) > 0),
  constraint credential_categories_name_trimmed check (name = btrim(name)),
  constraint credential_categories_owner_id_fkey foreign key (owner_id)
    references public.profiles(id) on delete cascade
);
alter table public.credential_categories add column if not exists id text;
alter table public.credential_categories add column if not exists name text;
alter table public.credential_categories add column if not exists icon text default '🔑';
alter table public.credential_categories add column if not exists scope text;
alter table public.credential_categories add column if not exists owner_id uuid;
alter table public.credential_categories add column if not exists sort integer default 0;
alter table public.credential_categories add column if not exists created_at timestamptz default now();

do $credential_column_types$
declare
  incompatible_columns text;
begin
  select string_agg(required.column_name, ', ' order by required.ordinality)
  into incompatible_columns
  from unnest(array['id', 'name', 'icon', 'scope', 'owner_id', 'sort', 'created_at']::text[])
       with ordinality as required(column_name, ordinality)
  join pg_attribute attribute
    on attribute.attrelid = 'public.credential_categories'::regclass
   and attribute.attname = required.column_name and not attribute.attisdropped
  where format_type(attribute.atttypid, attribute.atttypmod)
        <> (array['text', 'text', 'text', 'text', 'uuid', 'integer', 'timestamp with time zone'])[required.ordinality::integer];
  if incompatible_columns is not null then
    raise exception 'Hay columnas con tipos incompatibles en public.credential_categories: %', incompatible_columns;
  end if;
end
$credential_column_types$;

update public.credential_categories set icon = '🔑' where icon is null;
update public.credential_categories set sort = 0 where sort is null;
update public.credential_categories set created_at = now() where created_at is null;

do $credential_integrity$
declare
  actual_definition text;
  named_matches boolean;
begin
  if exists (
    select 1 from public.credential_categories
    where id is null or name is null or scope is null
  ) then
    raise exception 'Faltan valores obligatorios en public.credential_categories (id, name o scope); no existe una corrección semántica segura.';
  end if;
  if exists (
    select 1 from public.credential_categories
    where scope not in ('shared', 'private')
       or char_length(btrim(name)) = 0
       or name is distinct from btrim(name)
       or (scope = 'shared' and owner_id is not null)
       or (scope = 'private' and owner_id is null)
  ) then
    raise exception 'Hay valores incompatibles en public.credential_categories; corríjalos antes de reintentar.';
  end if;

  select c.contype = 'p' and cardinality(c.conkey) = 1 and a.attname = 'id'
  into named_matches
  from pg_constraint c
  left join pg_attribute a
    on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.conrelid = 'public.credential_categories'::regclass
    and c.conname = 'credential_categories_pkey';
  if named_matches is false then
    raise exception 'La restricción credential_categories_pkey existe con otra definición.';
  end if;
  if not exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.conrelid = 'public.credential_categories'::regclass
      and c.contype = 'p' and cardinality(c.conkey) = 1 and a.attname = 'id'
  ) then
    if exists (select id from public.credential_categories group by id having count(*) > 1) then
      raise exception 'No se puede crear la clave primaria de public.credential_categories: existen IDs duplicados.';
    end if;
    alter table public.credential_categories
      add constraint credential_categories_pkey primary key (id);
  end if;

  select regexp_replace(lower(pg_get_constraintdef(oid)), '\s+', '', 'g')
  into actual_definition from pg_constraint
  where conrelid = 'public.credential_categories'::regclass
    and conname = 'credential_categories_scope_check';
  if actual_definition is null then
    alter table public.credential_categories add constraint credential_categories_scope_check
      check (scope in ('shared', 'private'));
  elsif actual_definition <> 'check((scope=any(array[''shared''::text,''private''::text])))' then
    raise exception 'La restricción credential_categories_scope_check existe con otra definición: %', actual_definition;
  end if;

  select regexp_replace(lower(pg_get_constraintdef(oid)), '\s+', '', 'g')
  into actual_definition from pg_constraint
  where conrelid = 'public.credential_categories'::regclass
    and conname = 'credential_categories_owner_scope_check';
  if actual_definition is null then
    alter table public.credential_categories add constraint credential_categories_owner_scope_check check (
      (scope = 'shared' and owner_id is null)
      or (scope = 'private' and owner_id is not null)
    );
  elsif actual_definition <> 'check((((scope=''shared''::text)and(owner_idisnull))or((scope=''private''::text)and(owner_idisnotnull))))' then
    raise exception 'La restricción credential_categories_owner_scope_check existe con otra definición: %', actual_definition;
  end if;

  select regexp_replace(lower(pg_get_constraintdef(oid)), '\s+', '', 'g')
  into actual_definition from pg_constraint
  where conrelid = 'public.credential_categories'::regclass
    and conname = 'credential_categories_name_nonblank';
  if actual_definition is null then
    alter table public.credential_categories add constraint credential_categories_name_nonblank
      check (char_length(btrim(name)) > 0);
  elsif actual_definition <> 'check((char_length(btrim(name))>0))' then
    raise exception 'La restricción credential_categories_name_nonblank existe con otra definición: %', actual_definition;
  end if;

  select regexp_replace(lower(pg_get_constraintdef(oid)), '\s+', '', 'g')
  into actual_definition from pg_constraint
  where conrelid = 'public.credential_categories'::regclass
    and conname = 'credential_categories_name_trimmed';
  if actual_definition is null then
    alter table public.credential_categories add constraint credential_categories_name_trimmed
      check (name = btrim(name));
  elsif actual_definition <> 'check((name=btrim(name)))' then
    raise exception 'La restricción credential_categories_name_trimmed existe con otra definición: %', actual_definition;
  end if;

  select c.contype = 'f' and cardinality(c.conkey) = 1
         and source_column.attname = 'owner_id'
         and c.confrelid = 'public.profiles'::regclass
         and target_column.attname = 'id' and c.confdeltype = 'c'
  into named_matches
  from pg_constraint c
  left join pg_attribute source_column
    on source_column.attrelid = c.conrelid and source_column.attnum = c.conkey[1]
  left join pg_attribute target_column
    on target_column.attrelid = c.confrelid and target_column.attnum = c.confkey[1]
  where c.conrelid = 'public.credential_categories'::regclass
    and c.conname = 'credential_categories_owner_id_fkey';
  if named_matches is false then
    raise exception 'La restricción credential_categories_owner_id_fkey existe con otra definición.';
  end if;
  if not exists (
    select 1 from pg_constraint c
    join pg_attribute source_column
      on source_column.attrelid = c.conrelid and source_column.attnum = c.conkey[1]
    join pg_attribute target_column
      on target_column.attrelid = c.confrelid and target_column.attnum = c.confkey[1]
    where c.conrelid = 'public.credential_categories'::regclass
      and c.contype = 'f' and cardinality(c.conkey) = 1
      and source_column.attname = 'owner_id'
      and c.confrelid = 'public.profiles'::regclass
      and target_column.attname = 'id' and c.confdeltype = 'c'
  ) then
    alter table public.credential_categories
      add constraint credential_categories_owner_id_fkey
      foreign key (owner_id) references public.profiles(id)
      on delete cascade not valid;
  end if;
end
$credential_integrity$;

alter table public.credential_categories alter column icon set default '🔑';
alter table public.credential_categories alter column sort set default 0;
alter table public.credential_categories alter column created_at set default now();
alter table public.credential_categories alter column id set not null;
alter table public.credential_categories alter column name set not null;
alter table public.credential_categories alter column icon set not null;
alter table public.credential_categories alter column scope set not null;
alter table public.credential_categories alter column sort set not null;
alter table public.credential_categories alter column created_at set not null;
alter table public.credential_categories enable row level security;

do $credential_shared_unique$
declare
  index_matches boolean;
begin
  select i.indisunique and i.indisvalid and i.indisready
         and i.indnkeyatts = 1 and i.indnatts = 1
         and regexp_replace(lower(pg_get_indexdef(i.indexrelid, 1, false)), '\s+', '', 'g') = 'lower(btrim(name))'
         and replace(replace(replace(regexp_replace(lower(pg_get_expr(i.indpred, i.indrelid)), '\s+', '', 'g'), '::text', ''), '(', ''), ')', '') = 'scope=''shared'''
  into index_matches
  from pg_index i
  join pg_class index_relation on index_relation.oid = i.indexrelid
  join pg_am access_method
    on access_method.oid = index_relation.relam and access_method.amname = 'btree'
  where i.indexrelid = to_regclass('public.credential_categories_shared_name_ci_unique')
    and i.indrelid = 'public.credential_categories'::regclass;
  if to_regclass('public.credential_categories_shared_name_ci_unique') is not null
     and index_matches is distinct from true then
    raise exception 'El índice credential_categories_shared_name_ci_unique existe con otra definición.';
  end if;
  if to_regclass('public.credential_categories_shared_name_ci_unique') is null then
    if exists (
      select 1 from public.credential_categories where scope = 'shared'
      group by lower(btrim(name)) having count(*) > 1
    ) then
      raise exception 'No se puede crear el índice credential_categories_shared_name_ci_unique: existen nombres compartidos duplicados.';
    end if;
    create unique index credential_categories_shared_name_ci_unique
      on public.credential_categories (lower(btrim(name))) where scope = 'shared';
  end if;
end
$credential_shared_unique$;

do $credential_private_unique$
declare
  index_matches boolean;
begin
  select i.indisunique and i.indisvalid and i.indisready
         and i.indnkeyatts = 2 and i.indnatts = 2
         and regexp_replace(lower(pg_get_indexdef(i.indexrelid, 1, false)), '\s+', '', 'g') = 'owner_id'
         and regexp_replace(lower(pg_get_indexdef(i.indexrelid, 2, false)), '\s+', '', 'g') = 'lower(btrim(name))'
         and replace(replace(replace(regexp_replace(lower(pg_get_expr(i.indpred, i.indrelid)), '\s+', '', 'g'), '::text', ''), '(', ''), ')', '') = 'scope=''private'''
  into index_matches
  from pg_index i
  join pg_class index_relation on index_relation.oid = i.indexrelid
  join pg_am access_method
    on access_method.oid = index_relation.relam and access_method.amname = 'btree'
  where i.indexrelid = to_regclass('public.credential_categories_private_name_ci_unique')
    and i.indrelid = 'public.credential_categories'::regclass;
  if to_regclass('public.credential_categories_private_name_ci_unique') is not null
     and index_matches is distinct from true then
    raise exception 'El índice credential_categories_private_name_ci_unique existe con otra definición.';
  end if;
  if to_regclass('public.credential_categories_private_name_ci_unique') is null then
    if exists (
      select 1 from public.credential_categories where scope = 'private'
      group by owner_id, lower(btrim(name)) having count(*) > 1
    ) then
      raise exception 'No se puede crear el índice credential_categories_private_name_ci_unique: existen nombres privados duplicados.';
    end if;
    create unique index credential_categories_private_name_ci_unique
      on public.credential_categories (owner_id, lower(btrim(name))) where scope = 'private';
  end if;
end
$credential_private_unique$;

alter table public.credentials add column if not exists category_id text;

do $credential_category_fk$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute source_column
      on source_column.attrelid = c.conrelid
     and source_column.attnum = c.conkey[1]
    join pg_attribute target_column
      on target_column.attrelid = c.confrelid
     and target_column.attnum = c.confkey[1]
    where c.conrelid = 'public.credentials'::regclass
      and c.contype = 'f'
      and cardinality(c.conkey) = 1
      and source_column.attname = 'category_id'
      and c.confrelid = 'public.credential_categories'::regclass
      and target_column.attname = 'id'
      and c.confdeltype = 'n'
  ) then
    if exists (
      select 1 from pg_constraint
      where conrelid = 'public.credentials'::regclass
        and conname = 'credentials_category_id_fkey'
    ) then
      raise exception 'La restricción credentials_category_id_fkey existe con otra definición.';
    end if;
    alter table public.credentials
      add constraint credentials_category_id_fkey
      foreign key (category_id) references public.credential_categories(id)
      on delete set null not valid;
  end if;
end
$credential_category_fk$;

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
    select 1 from public.credentials where category_id = old.id
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
  id uuid constraint daily_task_logs_pkey primary key default gen_random_uuid(),
  task_id text not null,
  activity_date date not null,
  state text not null default 'todo',
  task_name_snapshot text not null,
  task_icon_snapshot text not null default '✨',
  assignee_snapshot text,
  completed_by uuid,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint daily_task_logs_state_check check (state in ('todo', 'doing', 'done')),
  constraint daily_task_logs_task_activity_unique unique (task_id, activity_date),
  constraint daily_task_logs_completion_consistency check (
    (state = 'done' and completed_at is not null)
    or (state <> 'done' and completed_by is null and completed_at is null)
  )
);
alter table public.daily_task_logs add column if not exists id uuid default gen_random_uuid();
alter table public.daily_task_logs add column if not exists task_id text;
alter table public.daily_task_logs add column if not exists activity_date date;
alter table public.daily_task_logs add column if not exists state text default 'todo';
alter table public.daily_task_logs add column if not exists task_name_snapshot text;
alter table public.daily_task_logs add column if not exists task_icon_snapshot text default '✨';
alter table public.daily_task_logs add column if not exists assignee_snapshot text;
alter table public.daily_task_logs add column if not exists completed_by uuid;
alter table public.daily_task_logs add column if not exists completed_at timestamptz;
alter table public.daily_task_logs add column if not exists updated_at timestamptz default now();

do $daily_log_column_types$
declare
  incompatible_columns text;
begin
  select string_agg(required.column_name, ', ' order by required.ordinality)
  into incompatible_columns
  from unnest(array[
    'id', 'task_id', 'activity_date', 'state', 'task_name_snapshot',
    'task_icon_snapshot', 'assignee_snapshot', 'completed_by', 'completed_at', 'updated_at'
  ]::text[]) with ordinality as required(column_name, ordinality)
  join pg_attribute attribute
    on attribute.attrelid = 'public.daily_task_logs'::regclass
   and attribute.attname = required.column_name and not attribute.attisdropped
  where format_type(attribute.atttypid, attribute.atttypmod) <> (array[
    'uuid', 'text', 'date', 'text', 'text', 'text', 'text', 'uuid',
    'timestamp with time zone', 'timestamp with time zone'
  ])[required.ordinality::integer];
  if incompatible_columns is not null then
    raise exception 'Hay columnas con tipos incompatibles en public.daily_task_logs: %', incompatible_columns;
  end if;
end
$daily_log_column_types$;

update public.daily_task_logs set id = gen_random_uuid() where id is null;
update public.daily_task_logs set state = 'todo' where state is null;
update public.daily_task_logs set task_icon_snapshot = '✨' where task_icon_snapshot is null;
update public.daily_task_logs set updated_at = now() where updated_at is null;

do $daily_log_integrity$
declare
  actual_definition text;
  named_matches boolean;
begin
  if exists (
    select 1 from public.daily_task_logs
    where task_id is null or activity_date is null or task_name_snapshot is null
  ) then
    raise exception 'Faltan valores obligatorios en public.daily_task_logs (task_id, activity_date o task_name_snapshot); no existe una corrección semántica segura.';
  end if;
  if exists (
    select 1 from public.daily_task_logs
    where state not in ('todo', 'doing', 'done')
       or (state = 'done' and completed_at is null)
       or (state <> 'done' and (completed_by is not null or completed_at is not null))
  ) then
    raise exception 'Hay valores incompatibles en public.daily_task_logs (state o datos de finalización); corríjalos antes de reintentar.';
  end if;

  select c.contype = 'p' and cardinality(c.conkey) = 1 and a.attname = 'id'
  into named_matches
  from pg_constraint c
  left join pg_attribute a
    on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.conrelid = 'public.daily_task_logs'::regclass
    and c.conname = 'daily_task_logs_pkey';
  if named_matches is false then
    raise exception 'La restricción daily_task_logs_pkey existe con otra definición.';
  end if;
  if not exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.conrelid = 'public.daily_task_logs'::regclass
      and c.contype = 'p' and cardinality(c.conkey) = 1 and a.attname = 'id'
  ) then
    if exists (select id from public.daily_task_logs group by id having count(*) > 1) then
      raise exception 'No se puede crear la clave primaria de public.daily_task_logs: existen IDs duplicados.';
    end if;
    alter table public.daily_task_logs
      add constraint daily_task_logs_pkey primary key (id);
  end if;

  select regexp_replace(lower(pg_get_constraintdef(oid)), '\s+', '', 'g')
  into actual_definition from pg_constraint
  where conrelid = 'public.daily_task_logs'::regclass
    and conname = 'daily_task_logs_state_check';
  if actual_definition is null then
    alter table public.daily_task_logs add constraint daily_task_logs_state_check
      check (state in ('todo', 'doing', 'done'));
  elsif actual_definition <> 'check((state=any(array[''todo''::text,''doing''::text,''done''::text])))' then
    raise exception 'La restricción daily_task_logs_state_check existe con otra definición: %', actual_definition;
  end if;

  select c.contype = 'u' and cardinality(c.conkey) = 2
         and first_column.attname = 'task_id'
         and second_column.attname = 'activity_date'
  into named_matches
  from pg_constraint c
  left join pg_attribute first_column
    on first_column.attrelid = c.conrelid and first_column.attnum = c.conkey[1]
  left join pg_attribute second_column
    on second_column.attrelid = c.conrelid and second_column.attnum = c.conkey[2]
  where c.conrelid = 'public.daily_task_logs'::regclass
    and c.conname = 'daily_task_logs_task_activity_unique';
  if named_matches is false then
    raise exception 'La restricción daily_task_logs_task_activity_unique existe con otra definición.';
  end if;
  if not exists (
    select 1 from pg_constraint c
    join pg_attribute first_column
      on first_column.attrelid = c.conrelid and first_column.attnum = c.conkey[1]
    join pg_attribute second_column
      on second_column.attrelid = c.conrelid and second_column.attnum = c.conkey[2]
    where c.conrelid = 'public.daily_task_logs'::regclass
      and c.contype = 'u' and cardinality(c.conkey) = 2
      and first_column.attname = 'task_id' and second_column.attname = 'activity_date'
  ) then
    if exists (
      select 1 from public.daily_task_logs
      group by task_id, activity_date having count(*) > 1
    ) then
      raise exception 'No se puede crear la unicidad de public.daily_task_logs: existen task_id y activity_date duplicados.';
    end if;
    alter table public.daily_task_logs add constraint daily_task_logs_task_activity_unique
      unique (task_id, activity_date);
  end if;

  select regexp_replace(lower(pg_get_constraintdef(oid)), '\s+', '', 'g')
  into actual_definition from pg_constraint
  where conrelid = 'public.daily_task_logs'::regclass
    and conname = 'daily_task_logs_completion_consistency';
  if actual_definition is null then
    alter table public.daily_task_logs add constraint daily_task_logs_completion_consistency check (
      (state = 'done' and completed_at is not null)
      or (state <> 'done' and completed_by is null and completed_at is null)
    );
  elsif actual_definition <> 'check((((state=''done''::text)and(completed_atisnotnull))or((state<>''done''::text)and(completed_byisnull)and(completed_atisnull))))' then
    raise exception 'La restricción daily_task_logs_completion_consistency existe con otra definición: %', actual_definition;
  end if;
end
$daily_log_integrity$;

alter table public.daily_task_logs alter column id set default gen_random_uuid();
alter table public.daily_task_logs alter column state set default 'todo';
alter table public.daily_task_logs alter column task_icon_snapshot set default '✨';
alter table public.daily_task_logs alter column updated_at set default now();
alter table public.daily_task_logs alter column id set not null;
alter table public.daily_task_logs alter column task_id set not null;
alter table public.daily_task_logs alter column activity_date set not null;
alter table public.daily_task_logs alter column state set not null;
alter table public.daily_task_logs alter column task_name_snapshot set not null;
alter table public.daily_task_logs alter column task_icon_snapshot set not null;
alter table public.daily_task_logs alter column updated_at set not null;

do $daily_log_completer_fk$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute source_column
      on source_column.attrelid = c.conrelid
     and source_column.attnum = c.conkey[1]
    join pg_attribute target_column
      on target_column.attrelid = c.confrelid
     and target_column.attnum = c.confkey[1]
    where c.conrelid = 'public.daily_task_logs'::regclass
      and c.contype = 'f'
      and cardinality(c.conkey) = 1
      and source_column.attname = 'completed_by'
      and c.confrelid = 'public.profiles'::regclass
      and target_column.attname = 'id'
      and c.confdeltype = 'n'
  ) then
    if exists (
      select 1 from pg_constraint
      where conrelid = 'public.daily_task_logs'::regclass
        and conname = 'daily_task_logs_completed_by_fkey'
    ) then
      raise exception 'La restricción daily_task_logs_completed_by_fkey existe con otra definición.';
    end if;
    alter table public.daily_task_logs
      add constraint daily_task_logs_completed_by_fkey
      foreign key (completed_by) references public.profiles(id)
      on delete set null not valid;
  end if;
end
$daily_log_completer_fk$;

alter table public.daily_task_logs enable row level security;

alter table public.projects add column if not exists responsible_usernames text[] not null default '{}';
alter table public.projects add column if not exists completed_responsible_usernames text[];
alter table public.projects add column if not exists project_type text not null default 'other';
alter table public.projects add column if not exists priority text not null default 'normal';
alter table public.projects add column if not exists objective text;
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists completed_at timestamptz;
alter table public.projects add column if not exists completed_by uuid;

update public.projects
set project_type = 'other'
where project_type is null or project_type not in (
  'campaign', 'launch', 'content', 'brand-design', 'web-ecommerce',
  'event', 'crm', 'operations', 'other'
);
update public.projects
set priority = 'normal'
where priority is null or priority not in ('low', 'normal', 'high', 'urgent');
alter table public.projects alter column project_type set default 'other';
alter table public.projects alter column project_type set not null;
alter table public.projects alter column priority set default 'normal';
alter table public.projects alter column priority set not null;

do $project_type_check$
declare
  actual_definition text;
  expected_definition constant text := 'check((project_type=any(array[''campaign''::text,''launch''::text,''content''::text,''brand-design''::text,''web-ecommerce''::text,''event''::text,''crm''::text,''operations''::text,''other''::text])))';
begin
  select regexp_replace(lower(pg_get_constraintdef(oid)), '\s+', '', 'g')
  into actual_definition
  from pg_constraint
  where conrelid = 'public.projects'::regclass
    and conname = 'projects_project_type_check';

  if actual_definition is null then
    alter table public.projects add constraint projects_project_type_check
      check (project_type in (
        'campaign', 'launch', 'content', 'brand-design', 'web-ecommerce',
        'event', 'crm', 'operations', 'other'
      ));
  elsif actual_definition <> expected_definition then
    raise exception 'La restricción projects_project_type_check existe con otra definición: %', actual_definition;
  end if;
end
$project_type_check$;

do $project_priority_check$
declare
  actual_definition text;
  expected_definition constant text := 'check((priority=any(array[''low''::text,''normal''::text,''high''::text,''urgent''::text])))';
begin
  select regexp_replace(lower(pg_get_constraintdef(oid)), '\s+', '', 'g')
  into actual_definition
  from pg_constraint
  where conrelid = 'public.projects'::regclass
    and conname = 'projects_priority_check';

  if actual_definition is null then
    alter table public.projects add constraint projects_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent'));
  elsif actual_definition <> expected_definition then
    raise exception 'La restricción projects_priority_check existe con otra definición: %', actual_definition;
  end if;
end
$project_priority_check$;

do $project_completer_fk$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute source_column
      on source_column.attrelid = c.conrelid
     and source_column.attnum = c.conkey[1]
    join pg_attribute target_column
      on target_column.attrelid = c.confrelid
     and target_column.attnum = c.confkey[1]
    where c.conrelid = 'public.projects'::regclass
      and c.contype = 'f'
      and cardinality(c.conkey) = 1
      and source_column.attname = 'completed_by'
      and c.confrelid = 'public.profiles'::regclass
      and target_column.attname = 'id'
      and c.confdeltype = 'n'
  ) then
    if exists (
      select 1 from pg_constraint
      where conrelid = 'public.projects'::regclass
        and conname = 'projects_completed_by_fkey'
    ) then
      raise exception 'La restricción projects_completed_by_fkey existe con otra definición.';
    end if;
    alter table public.projects
      add constraint projects_completed_by_fkey
      foreign key (completed_by) references public.profiles(id)
      on delete set null not valid;
  end if;
end
$project_completer_fk$;

do $projects_completed_at_index$
declare
  index_matches boolean;
begin
  select not i.indisunique and i.indisvalid and i.indisready
         and i.indnkeyatts = 1 and i.indnatts = 1
         and regexp_replace(lower(pg_get_indexdef(i.indexrelid, 1, false)), '\s+', '', 'g') = 'completed_atdesc'
         and i.indoption[0] = 3
         and replace(replace(replace(regexp_replace(lower(pg_get_expr(i.indpred, i.indrelid)), '\s+', '', 'g'), '::text', ''), '(', ''), ')', '') = 'status=''done'''
  into index_matches
  from pg_index i
  join pg_class index_relation on index_relation.oid = i.indexrelid
  join pg_am access_method
    on access_method.oid = index_relation.relam and access_method.amname = 'btree'
  where i.indexrelid = to_regclass('public.projects_completed_at_idx')
    and i.indrelid = 'public.projects'::regclass;
  if to_regclass('public.projects_completed_at_idx') is not null
     and index_matches is distinct from true then
    raise exception 'El índice projects_completed_at_idx existe con otra definición.';
  end if;
  if to_regclass('public.projects_completed_at_idx') is null then
    create index if not exists projects_completed_at_idx
      on public.projects (completed_at desc) where status = 'done';
  end if;
end
$projects_completed_at_index$;
alter table public.projects enable row level security;

do $simple_index_integrity$
declare
  required record;
  index_matches boolean;
begin
  for required in
    select * from (values
      ('tool_items_category_id_idx', 'public.tool_items', 'category_id', 'none',
       'create index tool_items_category_id_idx on public.tool_items (category_id)'),
      ('credentials_category_id_idx', 'public.credentials', 'category_id', 'none',
       'create index credentials_category_id_idx on public.credentials (category_id)'),
      ('daily_task_logs_activity_date_idx', 'public.daily_task_logs', 'activity_date', 'none',
       'create index daily_task_logs_activity_date_idx on public.daily_task_logs (activity_date)'),
      ('daily_task_logs_completed_at_idx', 'public.daily_task_logs', 'completed_at', 'state_done',
       'create index daily_task_logs_completed_at_idx on public.daily_task_logs (completed_at) where state = ''done'''),
      ('daily_task_logs_completed_by_idx', 'public.daily_task_logs', 'completed_by', 'none',
       'create index daily_task_logs_completed_by_idx on public.daily_task_logs (completed_by)'),
      ('projects_completed_by_idx', 'public.projects', 'completed_by', 'none',
       'create index projects_completed_by_idx on public.projects (completed_by)')
    ) as expected(index_name, table_name, column_name, predicate_key, create_sql)
  loop
    select not index_state.indisunique
           and index_state.indisvalid and index_state.indisready
           and index_state.indrelid = to_regclass(required.table_name)
           and index_state.indnkeyatts = 1 and index_state.indnatts = 1
           and regexp_replace(lower(pg_get_indexdef(index_state.indexrelid, 1, false)), '\s+', '', 'g') = required.column_name
           and index_state.indoption[0] = 0
           and case required.predicate_key
             when 'none' then index_state.indpred is null
             when 'state_done' then
               replace(replace(replace(regexp_replace(lower(pg_get_expr(index_state.indpred, index_state.indrelid)), '\s+', '', 'g'), '::text', ''), '(', ''), ')', '') = 'state=''done'''
             else false
           end
    into index_matches
    from pg_index index_state
    join pg_class index_relation on index_relation.oid = index_state.indexrelid
    join pg_am access_method
      on access_method.oid = index_relation.relam and access_method.amname = 'btree'
    where index_state.indexrelid = to_regclass('public.' || required.index_name);

    if to_regclass('public.' || required.index_name) is not null
       and index_matches is distinct from true then
      raise exception 'El índice % existe con otra definición.', required.index_name;
    end if;
    if to_regclass('public.' || required.index_name) is null then
      execute required.create_sql;
    end if;
  end loop;
end
$simple_index_integrity$;

do $named_foreign_key_integrity$
declare
  required record;
begin
  for required in
    select * from (values
      ('tool_items_category_id_fkey', 'public.tool_items', 'category_id', 'public.tool_categories', 'id', 'a'),
      ('credentials_category_id_fkey', 'public.credentials', 'category_id', 'public.credential_categories', 'id', 'n'),
      ('daily_task_logs_completed_by_fkey', 'public.daily_task_logs', 'completed_by', 'public.profiles', 'id', 'n'),
      ('projects_completed_by_fkey', 'public.projects', 'completed_by', 'public.profiles', 'id', 'n'),
      ('credential_categories_owner_id_fkey', 'public.credential_categories', 'owner_id', 'public.profiles', 'id', 'c')
    ) as expected(constraint_name, source_table, source_column, target_table, target_column, delete_action)
  loop
    if exists (
      select 1 from pg_constraint named
      where named.conrelid = to_regclass(required.source_table)
        and named.conname = required.constraint_name
    ) and not exists (
      select 1
      from pg_constraint named
      join pg_attribute source_column
        on source_column.attrelid = named.conrelid and source_column.attnum = named.conkey[1]
      join pg_attribute target_column
        on target_column.attrelid = named.confrelid and target_column.attnum = named.confkey[1]
      where named.conrelid = to_regclass(required.source_table)
        and named.conname = required.constraint_name
        and named.contype = 'f' and cardinality(named.conkey) = 1
        and source_column.attname = required.source_column
        and named.confrelid = to_regclass(required.target_table)
        and target_column.attname = required.target_column
        and named.confdeltype = required.delete_action
    ) then
      raise exception 'La restricción % existe con otra definición.', required.constraint_name;
    end if;
  end loop;
end
$named_foreign_key_integrity$;

do $foreign_key_validation$
declare
  foreign_key record;
begin
  if exists (
    select 1 from public.tool_items child
    left join public.tool_categories parent on parent.id = child.category_id
    where child.category_id is not null and parent.id is null
  ) then
    raise exception 'Hay referencias incompatibles en public.tool_items.category_id; corríjalas antes de reintentar.';
  end if;
  if exists (
    select 1 from public.credentials child
    left join public.credential_categories parent on parent.id = child.category_id
    where child.category_id is not null and parent.id is null
  ) then
    raise exception 'Hay referencias incompatibles en public.credentials.category_id; corríjalas antes de reintentar.';
  end if;
  if exists (
    select 1 from public.credential_categories child
    left join public.profiles parent on parent.id = child.owner_id
    where child.owner_id is not null and parent.id is null
  ) then
    raise exception 'Hay referencias incompatibles en public.credential_categories.owner_id; corríjalas antes de reintentar.';
  end if;
  if exists (
    select 1 from public.daily_task_logs child
    left join public.profiles parent on parent.id = child.completed_by
    where child.completed_by is not null and parent.id is null
  ) then
    raise exception 'Hay referencias incompatibles en public.daily_task_logs.completed_by; corríjalas antes de reintentar.';
  end if;
  if exists (
    select 1 from public.projects child
    left join public.profiles parent on parent.id = child.completed_by
    where child.completed_by is not null and parent.id is null
  ) then
    raise exception 'Hay referencias incompatibles en public.projects.completed_by; corríjalas antes de reintentar.';
  end if;

  for foreign_key in
    select c.conrelid::regclass as table_name, c.conname
    from pg_constraint c
    join pg_attribute source_column
      on source_column.attrelid = c.conrelid and source_column.attnum = c.conkey[1]
    join pg_attribute target_column
      on target_column.attrelid = c.confrelid and target_column.attnum = c.confkey[1]
    where c.contype = 'f' and cardinality(c.conkey) = 1 and not c.convalidated
      and (
        (c.conrelid = 'public.tool_items'::regclass and source_column.attname = 'category_id'
         and c.confrelid = 'public.tool_categories'::regclass and target_column.attname = 'id' and c.confdeltype = 'a')
        or (c.conrelid = 'public.credentials'::regclass and source_column.attname = 'category_id'
            and c.confrelid = 'public.credential_categories'::regclass and target_column.attname = 'id' and c.confdeltype = 'n')
        or (c.conrelid = 'public.credential_categories'::regclass and source_column.attname = 'owner_id'
            and c.confrelid = 'public.profiles'::regclass and target_column.attname = 'id' and c.confdeltype = 'c')
        or (c.conrelid = 'public.daily_task_logs'::regclass and source_column.attname = 'completed_by'
            and c.confrelid = 'public.profiles'::regclass and target_column.attname = 'id' and c.confdeltype = 'n')
        or (c.conrelid = 'public.projects'::regclass and source_column.attname = 'completed_by'
            and c.confrelid = 'public.profiles'::regclass and target_column.attname = 'id' and c.confdeltype = 'n')
      )
  loop
    execute format('alter table %s validate constraint %I', foreign_key.table_name, foreign_key.conname);
  end loop;
end
$foreign_key_validation$;

do $check_constraint_validation$
declare
  check_constraint record;
begin
  for check_constraint in
    select c.conrelid::regclass as table_name, c.conname
    from pg_constraint c
    where c.contype = 'c' and not c.convalidated
      and (c.conrelid, c.conname) in (
        ('public.tool_categories'::regclass, 'tool_categories_kind_check'),
        ('public.tool_categories'::regclass, 'tool_categories_name_nonblank'),
        ('public.credential_categories'::regclass, 'credential_categories_scope_check'),
        ('public.credential_categories'::regclass, 'credential_categories_owner_scope_check'),
        ('public.credential_categories'::regclass, 'credential_categories_name_nonblank'),
        ('public.credential_categories'::regclass, 'credential_categories_name_trimmed'),
        ('public.daily_task_logs'::regclass, 'daily_task_logs_state_check'),
        ('public.daily_task_logs'::regclass, 'daily_task_logs_completion_consistency'),
        ('public.projects'::regclass, 'projects_project_type_check'),
        ('public.projects'::regclass, 'projects_priority_check')
      )
  loop
    execute format('alter table %s validate constraint %I', check_constraint.table_name, check_constraint.conname);
  end loop;
end
$check_constraint_validation$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'elabela-assets',
  'elabela-assets',
  true,
  8388608,
  array[
    'image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp',
    'application/font-woff', 'application/font-woff2',
    'font/otf', 'font/ttf', 'font/woff', 'font/woff2'
  ]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.credentials enable row level security;

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

revoke execute on function public.move_and_delete_tool_category(text, text) from public;
revoke execute on function public.reorder_tool_categories(text[]) from public;
revoke execute on function public.delete_empty_credential_category(text) from public;
revoke execute on function public.reorder_credential_categories(text, text[]) from public;
grant execute on function public.move_and_delete_tool_category(text, text) to authenticated;
grant execute on function public.reorder_tool_categories(text[]) to authenticated;
grant execute on function public.delete_empty_credential_category(text) to authenticated;
grant execute on function public.reorder_credential_categories(text, text[]) to authenticated;
-- RECONCILIATION BODY END
commit;

notify pgrst, 'reload schema';

-- VERIFICATION: devuelve una sola columna booleana y solo consulta catálogos/metadatos.
with
  required_columns(table_name, column_name, expected_type, expected_not_null, default_key) as (
    values
      ('profiles', 'avatar', 'text', false, 'none'),
      ('daily_tasks', 'assignee', 'text', false, 'none'),
      ('daily_tasks', 'rotation', 'text[]', false, 'none'),
      ('daily_tasks', 'sort', 'integer', false, 'zero'),
      ('daily_tasks', 'days', 'integer[]', false, 'none'),
      ('daily_tasks', 'day_assignees', 'text[]', false, 'none'),
      ('daily_tasks', 'post_type', 'text', false, 'none'),
      ('projects', 'archived', 'boolean', true, 'false'),
      ('projects', 'content_mode', 'text', true, 'steps'),
      ('projects', 'note', 'text', false, 'none'),
      ('clients', 'last_purchase', 'date', false, 'none'),
      ('guiones', 'product', 'text', false, 'none'),
      ('story_config', 'done_date', 'date', false, 'none'),
      ('tool_items', 'icon', 'text', false, 'none'),
      ('tool_items', 'steps', 'text', false, 'none'),
      ('credentials', 'icon', 'text', false, 'key'),
      ('credentials', 'id_type', 'text', false, 'email'),
      ('credentials', 'identifier', 'text', false, 'none'),
      ('credentials', 'secret', 'text', false, 'none'),
      ('credentials', 'scope', 'text', true, 'private'),
      ('post_types', 'example_images', 'text[]', true, 'empty_text_array'),
      ('post_types', 'guide', 'text', true, 'empty_text'),
      ('post_types', 'tool_ids', 'text[]', true, 'empty_text_array'),
      ('brand_assets', 'file_url', 'text', false, 'none'),
      ('brand_assets', 'file_format', 'text', false, 'none'),
      ('brand_assets', 'storage_path', 'text', false, 'none'),
      ('tool_items', 'category_id', 'text', false, 'none'),
      ('credentials', 'category_id', 'text', false, 'none'),
      ('projects', 'responsible_usernames', 'text[]', true, 'empty_text_array'),
      ('projects', 'completed_responsible_usernames', 'text[]', false, 'none'),
      ('projects', 'project_type', 'text', true, 'other'),
      ('projects', 'priority', 'text', true, 'normal'),
      ('projects', 'objective', 'text', false, 'none'),
      ('projects', 'start_date', 'date', false, 'none'),
      ('projects', 'completed_at', 'timestamp with time zone', false, 'none'),
      ('projects', 'completed_by', 'uuid', false, 'none'),
      ('tool_categories', 'id', 'text', true, 'none'),
      ('tool_categories', 'name', 'text', true, 'none'),
      ('tool_categories', 'icon', 'text', true, 'sparkle'),
      ('tool_categories', 'accent', 'text', true, 'accent'),
      ('tool_categories', 'kind', 'text', true, 'link'),
      ('tool_categories', 'sort', 'integer', true, 'zero'),
      ('tool_categories', 'created_at', 'timestamp with time zone', true, 'now'),
      ('credential_categories', 'id', 'text', true, 'none'),
      ('credential_categories', 'name', 'text', true, 'none'),
      ('credential_categories', 'icon', 'text', true, 'key'),
      ('credential_categories', 'scope', 'text', true, 'none'),
      ('credential_categories', 'owner_id', 'uuid', false, 'none'),
      ('credential_categories', 'sort', 'integer', true, 'zero'),
      ('credential_categories', 'created_at', 'timestamp with time zone', true, 'now'),
      ('daily_task_logs', 'id', 'uuid', true, 'gen_random_uuid'),
      ('daily_task_logs', 'task_id', 'text', true, 'none'),
      ('daily_task_logs', 'activity_date', 'date', true, 'none'),
      ('daily_task_logs', 'state', 'text', true, 'todo'),
      ('daily_task_logs', 'task_name_snapshot', 'text', true, 'none'),
      ('daily_task_logs', 'task_icon_snapshot', 'text', true, 'sparkle'),
      ('daily_task_logs', 'assignee_snapshot', 'text', false, 'none'),
      ('daily_task_logs', 'completed_by', 'uuid', false, 'none'),
      ('daily_task_logs', 'completed_at', 'timestamp with time zone', false, 'none'),
      ('daily_task_logs', 'updated_at', 'timestamp with time zone', true, 'now')
  ),
  column_state as (
    select
      required.*,
      information_column.column_name is not null as exists_in_information_schema,
      coalesce(format_type(attribute.atttypid, attribute.atttypmod) = required.expected_type, false) as type_matches,
      coalesce(attribute.attnotnull = required.expected_not_null, false) as nullability_matches,
      regexp_replace(
        lower(coalesce(pg_get_expr(default_value.adbin, default_value.adrelid), 'none')),
        '[[:space:]]+', '', 'g'
      ) as actual_default
    from required_columns required
    left join pg_namespace namespace on namespace.nspname = 'public'
    left join pg_class table_state
      on table_state.relnamespace = namespace.oid and table_state.relname = required.table_name
    left join pg_attribute attribute
      on attribute.attrelid = table_state.oid
     and attribute.attname = required.column_name
     and attribute.attnum > 0 and not attribute.attisdropped
    left join pg_attrdef default_value
      on default_value.adrelid = attribute.attrelid and default_value.adnum = attribute.attnum
    left join information_schema.columns information_column
      on information_column.table_schema = 'public'
     and information_column.table_name = required.table_name
     and information_column.column_name = required.column_name
  ),
  columns_ok as (
    select coalesce(bool_and(
      required.exists_in_information_schema
      and required.type_matches
      and required.nullability_matches
      and case required.default_key
        when 'none' then required.actual_default = 'none'
        when 'zero' then required.actual_default = '0'
        when 'false' then required.actual_default = 'false'
        when 'steps' then required.actual_default = '''steps''::text'
        when 'private' then required.actual_default = '''private''::text'
        when 'empty_text_array' then required.actual_default = '''{}''::text[]'
        when 'empty_text' then required.actual_default = '''''::text'
        when 'other' then required.actual_default = '''other''::text'
        when 'normal' then required.actual_default = '''normal''::text'
        when 'sparkle' then required.actual_default = '''✨''::text'
        when 'key' then required.actual_default = '''🔑''::text'
        when 'email' then required.actual_default = '''email''::text'
        when 'link' then required.actual_default = '''link''::text'
        when 'accent' then required.actual_default = '''#d6ab99''::text'
        when 'now' then required.actual_default = 'now()'
        when 'gen_random_uuid' then required.actual_default = 'gen_random_uuid()'
        when 'todo' then required.actual_default = '''todo''::text'
        else false
      end
      and (
        not (required.table_name = 'daily_tasks' and required.column_name = 'assignee')
        or required.expected_not_null = false
      )
    ), false) as ok
    from column_state required
  ),
  required_rls_tables(schema_name, table_name) as (
    values
      ('public', 'projects'),
      ('public', 'credentials'),
      ('public', 'tool_categories'),
      ('public', 'credential_categories'),
      ('public', 'daily_task_logs')
  ),
  rls_ok as (
    select coalesce(bool_and(coalesce(table_state.relrowsecurity, false)), false) as ok
    from required_rls_tables required
    left join pg_namespace namespace on namespace.nspname = required.schema_name
    left join pg_class table_state
      on table_state.relnamespace = namespace.oid and table_state.relname = required.table_name
  ),
  required_policies(schema_name, table_name, policy_name, command_name, using_key, check_key) as (
    values
      ('public', 'tool_categories', 'tool_categories_all', 'ALL', 'true', 'true'),
      ('public', 'credential_categories', 'credential_categories_select', 'SELECT', 'category_visible', 'none'),
      ('public', 'credential_categories', 'credential_categories_insert', 'INSERT', 'none', 'category_valid'),
      ('public', 'credential_categories', 'credential_categories_update', 'UPDATE', 'category_visible', 'category_valid'),
      ('public', 'credential_categories', 'credential_categories_delete', 'DELETE', 'category_visible', 'none'),
      ('public', 'credentials', 'credentials_select', 'SELECT', 'credential_visible', 'none'),
      ('public', 'credentials', 'credentials_insert', 'INSERT', 'none', 'credential_visible'),
      ('public', 'credentials', 'credentials_update', 'UPDATE', 'credential_visible', 'credential_visible'),
      ('public', 'credentials', 'credentials_delete', 'DELETE', 'credential_visible', 'none'),
      ('public', 'daily_task_logs', 'daily_task_logs_select', 'SELECT', 'true', 'none'),
      ('public', 'daily_task_logs', 'daily_task_logs_insert', 'INSERT', 'none', 'log_write'),
      ('public', 'daily_task_logs', 'daily_task_logs_update', 'UPDATE', 'true', 'log_write'),
      ('public', 'daily_task_logs', 'daily_task_logs_delete', 'DELETE', 'true', 'none'),
      ('storage', 'objects', 'elabela_assets_insert', 'INSERT', 'none', 'bucket'),
      ('storage', 'objects', 'elabela_assets_select', 'SELECT', 'bucket', 'none'),
      ('storage', 'objects', 'elabela_assets_update', 'UPDATE', 'bucket', 'bucket'),
      ('storage', 'objects', 'elabela_assets_delete', 'DELETE', 'bucket', 'none')
  ),
  policy_state as (
    select
      required.*,
      policy.oid is not null as policy_exists,
      coalesce(policy.polcmd = case required.command_name
        when 'ALL' then '*'
        when 'SELECT' then 'r'
        when 'INSERT' then 'a'
        when 'UPDATE' then 'w'
        when 'DELETE' then 'd'
      end, false) as command_matches,
      coalesce(policy.polroles = array[authenticated_role.oid]::oid[], false) as roles_match,
      replace(
        regexp_replace(
          coalesce(pg_get_expr(policy.polqual, policy.polrelid), 'none'),
          '[[:space:]]+', '', 'g'
        ),
        '(SELECTauth.uid()ASuid)', 'auth.uid()'
      ) as using_expression,
      replace(
        regexp_replace(
          coalesce(pg_get_expr(policy.polwithcheck, policy.polrelid), 'none'),
          '[[:space:]]+', '', 'g'
        ),
        '(SELECTauth.uid()ASuid)', 'auth.uid()'
      ) as check_expression
    from required_policies required
    join pg_roles authenticated_role on authenticated_role.rolname = 'authenticated'
    left join pg_namespace namespace on namespace.nspname = required.schema_name
    left join pg_class table_state
      on table_state.relnamespace = namespace.oid and table_state.relname = required.table_name
    left join pg_policy policy
      on policy.polrelid = table_state.oid and policy.polname = required.policy_name
  ),
  policies_ok as (
    select coalesce(bool_and(
      policy_state.policy_exists
      and policy_state.command_matches
      and policy_state.roles_match
      and policy_state.using_expression = case policy_state.using_key
        when 'none' then 'none'
        when 'true' then 'true'
        when 'category_visible' then '((scope=''shared''::text)OR(owner_id=auth.uid()))'
        when 'category_valid' then '(((scope=''shared''::text)AND(owner_idISNULL))OR((scope=''private''::text)AND(owner_id=auth.uid())))'
        when 'credential_visible' then '((scope=''shared''::text)OR(owner_id=auth.uid())OR(owner_idISNULL))'
        when 'log_write' then '(((state=''done''::text)AND(completed_by=auth.uid())AND(completed_atISNOTNULL))OR((state<>''done''::text)AND(completed_byISNULL)AND(completed_atISNULL)))'
        when 'bucket' then '(bucket_id=''elabela-assets''::text)'
      end
      and policy_state.check_expression = case policy_state.check_key
        when 'none' then 'none'
        when 'true' then 'true'
        when 'category_visible' then '((scope=''shared''::text)OR(owner_id=auth.uid()))'
        when 'category_valid' then '(((scope=''shared''::text)AND(owner_idISNULL))OR((scope=''private''::text)AND(owner_id=auth.uid())))'
        when 'credential_visible' then '((scope=''shared''::text)OR(owner_id=auth.uid())OR(owner_idISNULL))'
        when 'log_write' then '(((state=''done''::text)AND(completed_by=auth.uid())AND(completed_atISNOTNULL))OR((state<>''done''::text)AND(completed_byISNULL)AND(completed_atISNULL)))'
        when 'bucket' then '(bucket_id=''elabela-assets''::text)'
      end
    ), false) as ok
    from policy_state
  ),
  required_foreign_keys(constraint_name, source_table, source_column, target_table, target_column, delete_action) as (
    values
      ('tool_items_category_id_fkey', 'tool_items', 'category_id', 'tool_categories', 'id', 'a'),
      ('credentials_category_id_fkey', 'credentials', 'category_id', 'credential_categories', 'id', 'n'),
      ('daily_task_logs_completed_by_fkey', 'daily_task_logs', 'completed_by', 'profiles', 'id', 'n'),
      ('projects_completed_by_fkey', 'projects', 'completed_by', 'profiles', 'id', 'n'),
      ('credential_categories_owner_id_fkey', 'credential_categories', 'owner_id', 'profiles', 'id', 'c')
  ),
  foreign_key_state as (
    select required.*, exists (
      select 1
      from pg_constraint foreign_key
      join pg_attribute source_attribute
        on source_attribute.attrelid = foreign_key.conrelid
       and source_attribute.attnum = foreign_key.conkey[1]
      join pg_attribute target_attribute
        on target_attribute.attrelid = foreign_key.confrelid
       and target_attribute.attnum = foreign_key.confkey[1]
      where foreign_key.conrelid = ('public.' || required.source_table)::regclass
        and foreign_key.contype = 'f' and cardinality(foreign_key.conkey) = 1
        and source_attribute.attname = required.source_column
        and foreign_key.confrelid = ('public.' || required.target_table)::regclass
        and target_attribute.attname = required.target_column
        and foreign_key.confdeltype = required.delete_action
        and foreign_key.convalidated
    ) as definition_matches
    from required_foreign_keys required
  ),
  foreign_keys_ok as (
    select coalesce(bool_and(definition_matches), false) as ok from foreign_key_state
  ),
  required_checks(table_name, constraint_name, expected_definition) as (
    values
      ('tool_categories', 'tool_categories_kind_check', 'check((kind=any(array[''prompt''::text,''link''::text])))'),
      ('tool_categories', 'tool_categories_name_nonblank', 'check((char_length(btrim(name))>0))'),
      ('credential_categories', 'credential_categories_scope_check', 'check((scope=any(array[''shared''::text,''private''::text])))'),
      ('credential_categories', 'credential_categories_owner_scope_check', 'check((((scope=''shared''::text)and(owner_idisnull))or((scope=''private''::text)and(owner_idisnotnull))))'),
      ('credential_categories', 'credential_categories_name_nonblank', 'check((char_length(btrim(name))>0))'),
      ('credential_categories', 'credential_categories_name_trimmed', 'check((name=btrim(name)))'),
      ('daily_task_logs', 'daily_task_logs_state_check', 'check((state=any(array[''todo''::text,''doing''::text,''done''::text])))'),
      ('daily_task_logs', 'daily_task_logs_completion_consistency', 'check((((state=''done''::text)and(completed_atisnotnull))or((state<>''done''::text)and(completed_byisnull)and(completed_atisnull))))'),
      ('projects', 'projects_project_type_check', 'check((project_type=any(array[''campaign''::text,''launch''::text,''content''::text,''brand-design''::text,''web-ecommerce''::text,''event''::text,''crm''::text,''operations''::text,''other''::text])))'),
      ('projects', 'projects_priority_check', 'check((priority=any(array[''low''::text,''normal''::text,''high''::text,''urgent''::text])))')
  ),
  checks_ok as (
    select coalesce(bool_and(
      constraint_state.oid is not null
      and constraint_state.contype = 'c'
      and constraint_state.convalidated
      and regexp_replace(lower(pg_get_constraintdef(constraint_state.oid)), '[[:space:]]+', '', 'g') = required.expected_definition
    ), false) as ok
    from required_checks required
    left join pg_constraint constraint_state
      on constraint_state.conrelid = ('public.' || required.table_name)::regclass
     and constraint_state.conname = required.constraint_name
  ),
  required_key_constraints(table_name, constraint_name, constraint_type, column_names) as (
    values
      ('tool_categories', 'tool_categories_pkey', 'p', array['id']::text[]),
      ('credential_categories', 'credential_categories_pkey', 'p', array['id']::text[]),
      ('daily_task_logs', 'daily_task_logs_pkey', 'p', array['id']::text[]),
      ('daily_task_logs', 'daily_task_logs_task_activity_unique', 'u', array['task_id', 'activity_date']::text[])
  ),
  key_constraints_ok as (
    select coalesce(bool_and(exists (
      select 1
      from pg_constraint constraint_state
      where constraint_state.conrelid = ('public.' || required.table_name)::regclass
        and constraint_state.contype = required.constraint_type::"char"
        and (
          select array_agg(attribute.attname order by key_column.ordinality)
          from unnest(constraint_state.conkey) with ordinality as key_column(attnum, ordinality)
          join pg_attribute attribute
            on attribute.attrelid = constraint_state.conrelid and attribute.attnum = key_column.attnum
        ) = required.column_names
    )), false) as ok
    from required_key_constraints required
  ),
  required_indexes(table_name, index_name, expected_unique, expected_key_count, first_expression, second_expression, expected_desc, expected_nulls_first, expected_predicate_key) as (
    values
      ('tool_categories', 'tool_categories_name_ci_unique', true, 1, 'lower(btrim(name))', 'none', false, false, 'none'),
      ('credential_categories', 'credential_categories_shared_name_ci_unique', true, 1, 'lower(btrim(name))', 'none', false, false, 'scope_shared'),
      ('credential_categories', 'credential_categories_private_name_ci_unique', true, 2, 'owner_id', 'lower(btrim(name))', false, false, 'scope_private'),
      ('projects', 'projects_completed_at_idx', false, 1, 'completed_atdesc', 'none', true, true, 'status_done'),
      ('tool_items', 'tool_items_category_id_idx', false, 1, 'category_id', 'none', false, false, 'none'),
      ('credentials', 'credentials_category_id_idx', false, 1, 'category_id', 'none', false, false, 'none'),
      ('daily_task_logs', 'daily_task_logs_activity_date_idx', false, 1, 'activity_date', 'none', false, false, 'none'),
      ('daily_task_logs', 'daily_task_logs_completed_at_idx', false, 1, 'completed_at', 'none', false, false, 'state_done'),
      ('daily_task_logs', 'daily_task_logs_completed_by_idx', false, 1, 'completed_by', 'none', false, false, 'none'),
      ('projects', 'projects_completed_by_idx', false, 1, 'completed_by', 'none', false, false, 'none')
  ),
  index_state as (
    select
      required.*,
      index_catalog.indexrelid is not null as index_exists,
      coalesce(index_catalog.indrelid = ('public.' || required.table_name)::regclass, false) as table_matches,
      coalesce(access_method.oid is not null, false) as method_matches,
      coalesce(index_catalog.indisunique = required.expected_unique, false) as uniqueness_matches,
      coalesce(index_catalog.indisvalid and index_catalog.indisready, false) as usable,
      coalesce(index_catalog.indnkeyatts = required.expected_key_count and index_catalog.indnatts = required.expected_key_count, false) as key_count_matches,
      regexp_replace(lower(coalesce(pg_get_indexdef(index_catalog.indexrelid, 1, false), 'none')), '[[:space:]]+', '', 'g') as actual_first_expression,
      regexp_replace(lower(coalesce(pg_get_indexdef(index_catalog.indexrelid, 2, false), 'none')), '[[:space:]]+', '', 'g') as actual_second_expression,
      coalesce((index_catalog.indoption[0] & 1) = 1, false) as is_desc,
      coalesce((index_catalog.indoption[0] & 2) = 2, false) as nulls_first,
      case replace(replace(replace(
        regexp_replace(lower(coalesce(pg_get_expr(index_catalog.indpred, index_catalog.indrelid), 'none')), '[[:space:]]+', '', 'g'),
        '::text', ''), '(', ''), ')', '')
        when 'none' then 'none'
        when 'scope=''shared''' then 'scope_shared'
        when 'scope=''private''' then 'scope_private'
        when 'status=''done''' then 'status_done'
        when 'state=''done''' then 'state_done'
        else 'unexpected'
      end as predicate_key
    from required_indexes required
    left join pg_namespace index_namespace on index_namespace.nspname = 'public'
    left join pg_class index_relation
      on index_relation.relnamespace = index_namespace.oid and index_relation.relname = required.index_name
    left join pg_index index_catalog on index_catalog.indexrelid = index_relation.oid
    left join pg_am access_method
      on access_method.oid = index_relation.relam and access_method.amname = 'btree'
  ),
  indexes_ok as (
    select coalesce(bool_and(
      index_state.index_exists and index_state.table_matches and index_state.method_matches
      and index_state.uniqueness_matches and index_state.usable and index_state.key_count_matches
      and index_state.actual_first_expression = index_state.first_expression
      and index_state.actual_second_expression = index_state.second_expression
      and index_state.is_desc = index_state.expected_desc
      and index_state.nulls_first = index_state.expected_nulls_first
      and index_state.predicate_key = index_state.expected_predicate_key
    ), false) as ok
    from index_state
  ),
  required_table_grants(table_name) as (
    values
      ('daily_tasks'), ('projects'), ('products'), ('clients'), ('guiones'),
      ('post_types'), ('story_config'), ('tool_items'), ('brand_assets'),
      ('calendar_events'), ('credentials'), ('tool_categories'),
      ('credential_categories'), ('daily_task_logs')
  ),
  table_grants_ok as (
    select coalesce(bool_and(
      has_table_privilege('authenticated', format('public.%I', required.table_name), 'SELECT')
      and has_table_privilege('authenticated', format('public.%I', required.table_name), 'INSERT')
      and has_table_privilege('authenticated', format('public.%I', required.table_name), 'UPDATE')
      and has_table_privilege('authenticated', format('public.%I', required.table_name), 'DELETE')
    ), false) as ok
    from required_table_grants required
  ),
  required_rpcs(signature) as (
    values
      ('public.move_and_delete_tool_category(text,text)'),
      ('public.reorder_tool_categories(text[])'),
      ('public.delete_empty_credential_category(text)'),
      ('public.reorder_credential_categories(text,text[])')
  ),
  rpcs_ok as (
    select coalesce(bool_and(
      procedure.oid is not null
      and procedure.prosecdef = false
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and not exists (
        select 1
        from aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) acl
        where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
      )
    ), false) as ok
    from required_rpcs required
    left join pg_proc procedure on procedure.oid = to_regprocedure(required.signature)
  ),
  bucket_ok as (
    select exists (
      select 1 from storage.buckets bucket
      where bucket.id = 'elabela-assets'
        and bucket.name = 'elabela-assets'
        and bucket.public = true
        and bucket.file_size_limit = 8388608
        and bucket.allowed_mime_types = array[
          'image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp',
          'application/font-woff', 'application/font-woff2',
          'font/otf', 'font/ttf', 'font/woff', 'font/woff2'
        ]::text[]
    ) as ok
  )
select (
  columns_ok.ok
  and rls_ok.ok
  and policies_ok.ok
  and foreign_keys_ok.ok
  and checks_ok.ok
  and key_constraints_ok.ok
  and indexes_ok.ok
  and table_grants_ok.ok
  and rpcs_ok.ok
  and bucket_ok.ok
) as ok
from columns_ok
cross join rls_ok
cross join policies_ok
cross join foreign_keys_ok
cross join checks_ok
cross join key_constraints_ok
cross join indexes_ok
cross join table_grants_ok
cross join rpcs_ok
cross join bucket_ok;
