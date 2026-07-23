-- Add an optional direct access link to each credential.
alter table if exists public.credentials
  add column if not exists url text;
