alter table user_profiles add column if not exists country text default 'US';
alter table holdings add column if not exists market text;
alter table holdings add column if not exists quote_currency text;
