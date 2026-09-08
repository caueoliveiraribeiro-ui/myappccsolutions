-- Orbit profile market preference. Safe to run once.
alter table public.user_profiles
  add column if not exists preferred_market varchar(2);

update public.user_profiles
set preferred_market = country
where preferred_market is null or preferred_market = '';

