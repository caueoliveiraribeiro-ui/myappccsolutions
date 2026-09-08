-- Orbit invoices. Safe to run once.
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  client_id uuid null references public.clients(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,
  invoice_number text not null,
  client_name text not null,
  client_email text,
  service_name text,
  amount numeric not null default 0 check (amount >= 0),
  currency text not null default 'USD',
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'draft' check (status in ('draft','sent','paid','overdue','void')),
  notes text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, invoice_number)
);

create index if not exists invoices_user_date_idx on public.invoices(user_id, issue_date desc);
alter table public.invoices enable row level security;
revoke all on public.invoices from anon, authenticated;
grant select, insert, update, delete on public.invoices to service_role;

