-- Orbit LM workflow and data-stability update
-- Safe to run more than once in the Supabase SQL editor.

alter table if exists public.projects add column if not exists description text default '';
alter table if exists public.projects add column if not exists cost numeric default 0;
alter table if exists public.projects add column if not exists source_lead_id uuid;
alter table if exists public.projects add column if not exists currency text;
alter table if exists public.projects add column if not exists contact_email text default '';
alter table if exists public.projects add column if not exists contact_phone text default '';
alter table if exists public.projects add column if not exists payment_date date;
alter table if exists public.projects add column if not exists payment_method text default '';
alter table if exists public.projects add column if not exists payment_reference text default '';
alter table if exists public.projects add column if not exists payment_notes text default '';

alter table if exists public.clients add column if not exists description text default '';
alter table if exists public.clients add column if not exists last_call_date date;
alter table if exists public.clients add column if not exists source_lead_id uuid;
alter table if exists public.clients add column if not exists charge_date date;
alter table if exists public.clients add column if not exists service_amount numeric default 0;
alter table if exists public.clients add column if not exists billing_frequency text default 'One-time';
alter table if exists public.clients add column if not exists currency text;

alter table if exists public.leads add column if not exists phone text default '';
alter table if exists public.leads add column if not exists description text default '';
alter table if exists public.leads add column if not exists last_call_date date;
alter table if exists public.leads add column if not exists directory_hidden boolean default false;
alter table if exists public.leads add column if not exists currency text;
alter table if exists public.leads add column if not exists next_follow_up_date date;

alter table if exists public.tasks add column if not exists start_time time;

alter table if exists public.expenses add column if not exists subcategory text default '';
alter table if exists public.expenses add column if not exists notes text default '';
alter table if exists public.expenses add column if not exists currency text;
alter table if exists public.grocery_items add column if not exists subcategory text default '';
alter table if exists public.grocery_items add column if not exists currency text;

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

update public.projects as item set currency = profile.currency from public.user_profiles as profile where item.user_id = profile.user_id and item.currency is null;
update public.clients as item set currency = profile.currency from public.user_profiles as profile where item.user_id = profile.user_id and item.currency is null;
update public.leads as item set currency = profile.currency from public.user_profiles as profile where item.user_id = profile.user_id and item.currency is null;
update public.expenses as item set currency = profile.currency from public.user_profiles as profile where item.user_id = profile.user_id and item.currency is null;
update public.grocery_items as item set currency = profile.currency from public.user_profiles as profile where item.user_id = profile.user_id and item.currency is null;

update public.leads set status = 'Client' where status = 'Won';

create unique index if not exists clients_user_source_lead_unique
  on public.clients (user_id, source_lead_id)
  where source_lead_id is not null;

create unique index if not exists projects_user_source_lead_unique
  on public.projects (user_id, source_lead_id)
  where source_lead_id is not null;

-- Payment records live independently from projects, clients and leads. This
-- intentionally has no foreign key so received payments survive record cleanup.
create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_project_id uuid,
  project_name text not null default '',
  client_name text default '',
  amount numeric default 0,
  currency text default 'USD',
  received_at date default current_date,
  method text default 'Other',
  reference text default '',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists payment_records_user_id_idx
  on public.payment_records (user_id);

create unique index if not exists payment_records_user_source_project_unique
  on public.payment_records (user_id, source_project_id)
  where source_project_id is not null;

alter table public.payment_records enable row level security;

-- Capture payment in the same transaction as the project status change.
create or replace function public.orbit_capture_project_payment()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.stage = 'Payment received' then
    if TG_OP = 'UPDATE' then
      if old.stage = 'Payment received' then return new; end if;
    end if;
    insert into public.payment_records
      (user_id,source_project_id,project_name,client_name,amount,currency,received_at,method,reference,notes)
    values
      (new.user_id,new.id,new.name,new.client,coalesce(new.budget,0)-coalesce(new.cost,0),
       coalesce(nullif(new.currency,''),'USD'),coalesce(new.payment_date,current_date),
       coalesce(nullif(new.payment_method,''),'Other'),coalesce(new.payment_reference,''),coalesce(new.payment_notes,''))
    on conflict (user_id,source_project_id) where source_project_id is not null
    do update set amount=excluded.amount,currency=excluded.currency,received_at=excluded.received_at,
      project_name=excluded.project_name,client_name=excluded.client_name,
      method=excluded.method,reference=excluded.reference,notes=excluded.notes,updated_at=now();
  end if;
  return new;
end;
$$;
drop trigger if exists orbit_project_payment on public.projects;
create trigger orbit_project_payment after insert or update of stage on public.projects
for each row execute function public.orbit_capture_project_payment();

insert into public.payment_records
  (user_id,source_project_id,project_name,client_name,amount,currency,received_at,method,reference,notes)
select user_id,id,name,client,coalesce(budget,0)-coalesce(cost,0),coalesce(nullif(currency,''),'USD'),
  coalesce(payment_date,updated_at::date,current_date),coalesce(nullif(payment_method,''),'Other'),
  coalesce(payment_reference,''),coalesce(payment_notes,'')
from public.projects where stage='Payment received'
on conflict (user_id,source_project_id) where source_project_id is not null do nothing;

-- Lead archiving does not delete related clients, projects or payment history.
alter table public.leads add column if not exists archived boolean not null default false;
create index if not exists leads_owner_archive_idx on public.leads(user_id,archived);

-- Reminder snapshots survive deletion of a client; invoices are not generated yet.
alter table public.tasks add column if not exists billing_client_id uuid;
alter table public.tasks add column if not exists billing_due_date date;
alter table public.tasks add column if not exists billing_amount numeric default 0;
alter table public.tasks add column if not exists billing_currency text default 'USD';
alter table public.tasks add column if not exists invoice_number text default '';
alter table public.tasks add column if not exists kind text default 'Task';
alter table public.tasks add column if not exists notes text default '';
create unique index if not exists tasks_billing_occurrence_unique
  on public.tasks(user_id,billing_client_id,billing_due_date)
  where billing_client_id is not null;

create or replace function public.orbit_create_billing_reminders(p_owner uuid default null)
returns integer language plpgsql security invoker set search_path=public as $$
declare inserted integer;
begin
  insert into public.tasks(user_id,title,kind,status,priority,due_date,notes,
    billing_client_id,billing_due_date,billing_amount,billing_currency,invoice_number)
  select c.user_id,'Charge Client ('||c.name||')','Task','Open','High',c.charge_date,
    concat_ws(E'\n','Client: '||c.name,'Email: '||c.email,'Phone: '||c.phone,
      'Service: '||c.service,'Description: '||c.description,'Invoice number: pending'),
    c.id,c.charge_date,coalesce(c.service_amount,0),coalesce(nullif(c.currency,''),'USD'),''
  from public.clients c
  where (p_owner is null or c.user_id=p_owner)
    and lower(c.billing_frequency) in ('monthly','biweekly','once a month')
    and coalesce(c.status,'Active') not in ('Lost','Past','Paused')
    and c.charge_date <= (now() at time zone 'UTC')::date + 1
  on conflict(user_id,billing_client_id,billing_due_date) where billing_client_id is not null
  do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
revoke all on function public.orbit_create_billing_reminders(uuid) from public,anon,authenticated;
grant execute on function public.orbit_create_billing_reminders(uuid) to service_role;

-- Enable pg_cron in Supabase Database > Extensions for reminders while the app
-- is closed. Rerunning this file updates the same job instead of duplicating it.
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('orbit-client-billing-reminders','0 * * * *',
      'select public.orbit_create_billing_reminders();');
  else
    raise notice 'Enable pg_cron and rerun for background reminders. The app also checks on opening and every minute.';
  end if;
end;
$$;
select public.orbit_create_billing_reminders();
