create table if not exists user_profiles(user_id uuid primary key,name text not null,email text not null,avatar_url text default '',created_at timestamptz default now(),updated_at timestamptz default now());
create table if not exists calendar_connections(user_id uuid primary key,provider text default 'google',access_token text not null,refresh_token text,expires_at timestamptz not null,created_at timestamptz default now(),updated_at timestamptz default now());
alter table user_profiles enable row level security;alter table calendar_connections enable row level security;
insert into user_profiles(user_id,name,email) values('00000000-0000-4000-8000-000000000001','Cauê Oliveira','caue.oliveira.ribeiro@gmail.com') on conflict(user_id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',true,2000000,array['image/jpeg','image/png','image/webp','image/gif']) on conflict(id) do update set public=true,file_size_limit=2000000;

