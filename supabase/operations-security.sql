-- Operations, audit, and administrator MFA records.
-- Run in Supabase SQL Editor before deploying this release.
begin;

create table if not exists public.orbit_operational_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  severity text not null check (severity in ('info','warning','error')),
  source text not null check (source in ('invoice_cron','invoice_email','hotmart_webhook')),
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists orbit_operational_events_recent_idx on public.orbit_operational_events (occurred_at desc);
alter table public.orbit_operational_events enable row level security;
revoke all on public.orbit_operational_events from public, anon, authenticated;
grant all on public.orbit_operational_events to service_role;

create table if not exists public.financial_audit_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid null references public.app_users(id) on delete set null,
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  resource_type text not null check (resource_type in ('invoice','payment','client_billing')),
  resource_id uuid not null,
  action text not null check (action in ('created','updated','deleted','sent','automation')),
  before_data jsonb null,
  after_data jsonb null,
  request_source text not null default 'application'
);
create index if not exists financial_audit_log_owner_recent_idx on public.financial_audit_log (owner_user_id, occurred_at desc);
alter table public.financial_audit_log enable row level security;
revoke all on public.financial_audit_log from public, anon, authenticated;
grant insert, select on public.financial_audit_log to service_role;

-- This table is intentionally append-only. No UPDATE/DELETE grants are issued.
create table if not exists public.orbit_admin_mfa (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  secret_ciphertext text not null,
  recovery_code_hashes jsonb not null default '[]'::jsonb,
  enabled_at timestamptz null,
  last_verified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orbit_admin_mfa enable row level security;
revoke all on public.orbit_admin_mfa from public, anon, authenticated;
grant all on public.orbit_admin_mfa to service_role;
commit;
