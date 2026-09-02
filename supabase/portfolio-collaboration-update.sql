-- Orbit LM portfolio safety and shared dashboards
alter table holdings alter column portfolio_id drop not null;
alter table holdings drop constraint if exists holdings_portfolio_id_fkey;
alter table holdings add constraint holdings_portfolio_id_fkey foreign key(portfolio_id) references portfolios(id) on delete set null;

create table if not exists workspace_members(
  owner_user_id uuid not null,
  member_user_id uuid not null,
  member_email text not null,
  relationship text not null default 'Friend',
  permission text not null default 'editor' check(permission in ('viewer','editor')),
  created_at timestamptz default now(),
  primary key(owner_user_id,member_user_id)
);
create table if not exists workspace_invites(
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null,
  email text not null, relationship text not null default 'Friend',
  permission text not null default 'editor' check(permission in ('viewer','editor')),
  status text not null default 'pending', created_at timestamptz default now(),
  unique(owner_user_id,email)
);
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
create index if not exists workspace_members_member_idx on workspace_members(member_user_id);
create index if not exists workspace_invites_email_idx on workspace_invites(lower(email));

