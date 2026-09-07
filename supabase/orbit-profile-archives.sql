-- Orbit LM: client/project archives and richer user profiles
-- Safe to run more than once in Supabase SQL Editor.

alter table if exists public.clients add column if not exists archived boolean not null default false;
alter table if exists public.projects add column if not exists archived boolean not null default false;
create index if not exists clients_user_archived_idx on public.clients(user_id, archived);
create index if not exists projects_user_archived_idx on public.projects(user_id, archived);

-- Keep every profile preference used by the Orbit profile popup in one
-- idempotent migration so a missing optional field can never block the save.
alter table if exists public.user_profiles add column if not exists country text default 'US';
alter table if exists public.user_profiles add column if not exists language text default 'en';
alter table if exists public.user_profiles add column if not exists currency text default 'USD';
alter table if exists public.user_profiles add column if not exists phone text default '';
alter table if exists public.user_profiles add column if not exists job_title text default '';
alter table if exists public.user_profiles add column if not exists company text default '';
alter table if exists public.user_profiles add column if not exists website text default '';
alter table if exists public.user_profiles add column if not exists address_line1 text default '';
alter table if exists public.user_profiles add column if not exists address_line2 text default '';
alter table if exists public.user_profiles add column if not exists city text default '';
alter table if exists public.user_profiles add column if not exists region text default '';
alter table if exists public.user_profiles add column if not exists postal_code text default '';
alter table if exists public.user_profiles add column if not exists timezone text default '';
alter table if exists public.user_profiles add column if not exists bio text default '';

create table if not exists public.orbit_owner_credentials (
  user_id uuid primary key,
  password_salt text not null,
  password_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.orbit_owner_credentials enable row level security;
revoke all on table public.orbit_owner_credentials from anon, authenticated, public;

-- PostgREST can otherwise keep an older column list for a short period after
-- ALTER TABLE and reject valid profile fields as missing from its schema cache.
notify pgrst, 'reload schema';
