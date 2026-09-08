-- Daily automatic invoice drafts
-- Creates one draft per eligible client exactly two days before their charge date.
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
    select distinct user_id
    from public.clients
    where coalesce(archived, false) = false
      and charge_date = current_date + 2
      and coalesce(service_amount, 0) > 0
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'
  loop
    created_count := created_count + public.orbit_create_invoice_drafts(owner_id);
  end loop;
  return created_count;
end;
$$;
revoke execute on function public.orbit_create_all_invoice_drafts() from public, anon, authenticated;
grant execute on function public.orbit_create_all_invoice_drafts() to service_role;
