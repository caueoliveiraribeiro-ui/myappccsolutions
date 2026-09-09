-- Paid shared-workspace invitations through Hotmart. Safe to run more than once.
-- A recipient receives their password-setup email only after a verified payment webhook.

begin;

alter table public.workspace_invites
  add column if not exists recipient_name text,
  add column if not exists checkout_token text,
  add column if not exists checkout_expires_at timestamptz,
  add column if not exists member_user_id uuid references public.app_users(id) on delete set null,
  add column if not exists hotmart_subscriber_code text,
  add column if not exists paid_at timestamptz,
  add column if not exists access_until timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists workspace_invites_checkout_token_key
  on public.workspace_invites(checkout_token)
  where checkout_token is not null;

create index if not exists workspace_invites_pending_email_idx
  on public.workspace_invites(lower(email), status)
  where status = 'awaiting_payment';

create table if not exists public.orbit_invite_subscriptions(
  subscriber_code text primary key,
  invite_id uuid not null unique references public.workspace_invites(id) on delete cascade,
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  offer_code text not null,
  status text not null check(status in ('active','canceled','inactive')),
  paid_until timestamptz,
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orbit_invite_subscriptions enable row level security;
revoke all on public.orbit_invite_subscriptions from public, anon, authenticated;
grant all on public.orbit_invite_subscriptions to service_role;

notify pgrst, 'reload schema';
commit;
