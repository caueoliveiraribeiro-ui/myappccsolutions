-- Orbit LM personal, health and savings update. Safe to run more than once.
create extension if not exists pgcrypto;

create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  category text not null,
  food_name text not null,
  grams numeric(10,2) not null check (grams > 0),
  calories numeric(10,2) not null check (calories >= 0),
  consumed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  currency text not null default 'USD',
  target_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists food_entries_user_consumed_idx on public.food_entries(user_id, consumed_at desc);
create index if not exists savings_goals_user_created_idx on public.savings_goals(user_id, created_at desc);

alter table public.food_entries enable row level security;
alter table public.savings_goals enable row level security;
revoke all on public.food_entries from public, anon, authenticated;
revoke all on public.savings_goals from public, anon, authenticated;
grant all on public.food_entries to service_role;
grant all on public.savings_goals to service_role;
