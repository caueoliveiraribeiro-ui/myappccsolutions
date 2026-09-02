-- Orbit LM workflow and data-stability update
-- Safe to run more than once in the Supabase SQL editor.

alter table if exists public.projects add column if not exists description text default '';
alter table if exists public.projects add column if not exists cost numeric default 0;
alter table if exists public.projects add column if not exists source_lead_id uuid;

alter table if exists public.clients add column if not exists description text default '';
alter table if exists public.clients add column if not exists last_call_date date;
alter table if exists public.clients add column if not exists source_lead_id uuid;
alter table if exists public.clients add column if not exists charge_date date;
alter table if exists public.clients add column if not exists service_amount numeric default 0;
alter table if exists public.clients add column if not exists billing_frequency text default 'One-time';

alter table if exists public.leads add column if not exists phone text default '';
alter table if exists public.leads add column if not exists description text default '';
alter table if exists public.leads add column if not exists last_call_date date;
alter table if exists public.leads add column if not exists directory_hidden boolean default false;

alter table if exists public.expenses add column if not exists subcategory text default '';
alter table if exists public.expenses add column if not exists notes text default '';
alter table if exists public.grocery_items add column if not exists subcategory text default '';

alter table if exists public.holdings add column if not exists remaining_quantity numeric;
alter table if exists public.holdings add column if not exists market text;
alter table if exists public.holdings add column if not exists quote_currency text;
alter table if exists public.holdings add column if not exists change_24h numeric default 0;

update public.leads set status = 'Client' where status = 'Won';

create unique index if not exists clients_user_source_lead_unique
  on public.clients (user_id, source_lead_id)
  where source_lead_id is not null;

create unique index if not exists projects_user_source_lead_unique
  on public.projects (user_id, source_lead_id)
  where source_lead_id is not null;

