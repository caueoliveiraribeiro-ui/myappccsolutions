create table if not exists app_users(id uuid primary key default gen_random_uuid(),name text not null,email text not null unique,password_salt text not null,password_hash text not null,created_at timestamptz default now());
alter table app_users enable row level security;
do $$ declare t text; begin foreach t in array array['leads','tasks','projects','assets','activities','clients','expenses','grocery_items','portfolios','holdings'] loop execute format('alter table %I add column if not exists user_id uuid',t);execute format('update %I set user_id = %L where user_id is null',t,'00000000-0000-4000-8000-000000000001');execute format('create index if not exists %I on %I(user_id)',t||'_user_id_idx',t);end loop;end $$;
-- The original administrator data belongs to caue.oliveira.ribeiro@gmail.com through the fixed owner ID above.

