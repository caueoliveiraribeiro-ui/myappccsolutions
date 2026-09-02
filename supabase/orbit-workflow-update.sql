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

-- Preserve the original purchase currency for older holdings so changing the
-- user's default currency converts values instead of only changing the label.
update public.holdings as holding
set quote_currency = portfolio.currency
from public.portfolios as portfolio
where holding.portfolio_id = portfolio.id
  and (holding.quote_currency is null or holding.quote_currency = '')
  and portfolio.currency is not null;

update public.holdings
set quote_currency = case market
  when 'BR' then 'BRL' when 'US' then 'USD' when 'GB' then 'GBP'
  when 'CA' then 'CAD' when 'AU' then 'AUD' when 'JP' then 'JPY'
  when 'KR' then 'KRW' when 'MX' then 'MXN' when 'CH' then 'CHF'
  when 'DE' then 'EUR' when 'FR' then 'EUR' when 'ES' then 'EUR'
  when 'IT' then 'EUR' when 'PT' then 'EUR' when 'NL' then 'EUR'
  else quote_currency end
where quote_currency is null or quote_currency = '';

update public.leads set status = 'Client' where status = 'Won';

create unique index if not exists clients_user_source_lead_unique
  on public.clients (user_id, source_lead_id)
  where source_lead_id is not null;

create unique index if not exists projects_user_source_lead_unique
  on public.projects (user_id, source_lead_id)
  where source_lead_id is not null;

