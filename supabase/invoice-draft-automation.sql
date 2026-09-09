-- Daily automatic invoice drafts
-- Creates one draft per eligible Big Business / owner client up to two days before their charge date.
-- The small catch-up window means a newly configured client due tomorrow is not missed.
-- The production scheduler calls this function using the service role only.
create or replace function public.orbit_create_all_invoice_drafts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  created_count integer := 0;
begin
  for owner_id in
    select distinct c.user_id
    from public.clients c
    where coalesce(c.archived, false) = false
      and c.charge_date between current_date and current_date + 2
      and coalesce(c.service_amount, 0) > 0
      and c.email ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'
      and (
        c.user_id in ('00000000-0000-4000-8000-000000000001'::uuid, 'c38a52ed-766f-47b1-abbd-bc8e152dcaa9'::uuid)
        or exists (
          select 1
          from public.account_subscriptions s
          where s.user_id = c.user_id
            and s.plan = 'big_business'
            and s.status = 'active'
            and s.access_until > now()
        )
      )
  loop
    created_count := created_count + public.orbit_create_invoice_drafts(owner_id);
  end loop;
  return created_count;
end;
$$;
revoke execute on function public.orbit_create_all_invoice_drafts() from public, anon, authenticated;
grant execute on function public.orbit_create_all_invoice_drafts() to service_role;
