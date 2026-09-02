alter table user_profiles add column if not exists language text default 'en';
alter table user_profiles add column if not exists currency text default 'USD';
alter table holdings add column if not exists change_24h numeric default 0;

