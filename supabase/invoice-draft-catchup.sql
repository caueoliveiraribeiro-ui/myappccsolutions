-- Invoice draft catch-up window. Safe to run once on an existing Orbit database.
-- Changes the owner-level and all-workspace draft functions from an exact two-day match
-- to a 0–2 day window. The existing invoice idempotency guard prevents duplicates.

do $block$
declare
  definition text;
  original text;
begin
  select pg_get_functiondef('public.orbit_create_invoice_drafts(uuid)'::regprocedure) into definition;
  original := definition;
  definition := regexp_replace(
    definition,
    'charge_date[[:space:]]*=[[:space:]]*current_date[[:space:]]*\+[[:space:]]*2',
    'charge_date between current_date and current_date + 2',
    'g'
  );
  if definition = original then
    raise exception 'Could not find the exact two-day rule in orbit_create_invoice_drafts';
  end if;
  execute definition;

  select pg_get_functiondef('public.orbit_create_all_invoice_drafts()'::regprocedure) into definition;
  original := definition;
  definition := regexp_replace(
    definition,
    'charge_date[[:space:]]*=[[:space:]]*current_date[[:space:]]*\+[[:space:]]*2',
    'charge_date between current_date and current_date + 2',
    'g'
  );
  if definition = original then
    raise exception 'Could not find the exact two-day rule in orbit_create_all_invoice_drafts';
  end if;
  execute definition;
end
$block$;

revoke execute on function public.orbit_create_invoice_drafts(uuid) from public, anon, authenticated;
grant execute on function public.orbit_create_invoice_drafts(uuid) to service_role;
revoke execute on function public.orbit_create_all_invoice_drafts() from public, anon, authenticated;
grant execute on function public.orbit_create_all_invoice_drafts() to service_role;
notify pgrst, 'reload schema';
