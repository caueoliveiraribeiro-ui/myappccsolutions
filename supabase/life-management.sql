create extension if not exists pgcrypto;

create table if not exists clients(
  id uuid primary key default gen_random_uuid(), name text not null, company_name text default '',
  email text default '', phone text default '', website text default '', description text default '',
  status text not null default 'Active', source text default 'Manual', service text default 'Website',
  address text default '', city text default '', country text default '', tags text default '',
  lifetime_value numeric default 0, next_follow_up date, notes text default '',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists expenses(
  id uuid primary key default gen_random_uuid(), item_name text not null, category text not null default 'Other',
  amount numeric not null default 0, expense_date date default current_date, recurrence text default 'One-time',
  kind text default 'Personal', paid boolean default true, notes text default '',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists grocery_items(
  id uuid primary key default gen_random_uuid(), name text not null, category text default 'Pantry',
  quantity numeric default 1, estimated_cost numeric default 0, actual_cost numeric default 0,
  month text default to_char(current_date,'YYYY-MM'), purchased boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists portfolios(
  id uuid primary key default gen_random_uuid(), name text not null, portfolio_type text not null check(portfolio_type in ('Stock','Crypto')),
  currency text default 'USD', description text default '', created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists holdings(
  id uuid primary key default gen_random_uuid(), portfolio_id uuid not null references portfolios(id) on delete cascade,
  symbol text not null, asset_name text default '', asset_type text not null check(asset_type in ('Stock','Crypto')),
  quantity numeric default 0, buy_price numeric default 0, current_price numeric default 0,
  purchased_at date default current_date, created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table leads add column if not exists platform text default 'Google';
alter table leads add column if not exists listing_url text default '';
alter table leads add column if not exists description text default '';
alter table clients enable row level security;
alter table expenses enable row level security;
alter table grocery_items enable row level security;
alter table portfolios enable row level security;
alter table holdings enable row level security;
create index if not exists clients_email_idx on clients(email);
create index if not exists expenses_date_idx on expenses(expense_date desc);
create index if not exists grocery_month_idx on grocery_items(month);
create index if not exists holdings_portfolio_idx on holdings(portfolio_id);

