-- Weekly invoice draft eligibility. Safe to run once on an existing Orbit database.

do $block$
declare
  definition text;
  original text;
begin
  select pg_get_functiondef('public.orbit_create_invoice_drafts(uuid)'::regprocedure) into definition;
  original := definition;
  definition := replace(
    definition,
    '''monthly'', ''biweekly'', ''one_time'', ''one-time'', ''once''',
    '''weekly'', ''every week'', ''semanal'', ''semanalmente'', ''monthly'', ''biweekly'', ''one_time'', ''one-time'', ''once'''
  );
  if definition = original then
    raise exception 'Could not find the billing-frequency allowlist in orbit_create_invoice_drafts';
  end if;
  execute definition;
end
$block$;

revoke execute on function public.orbit_create_invoice_drafts(uuid) from public, anon, authenticated;
grant execute on function public.orbit_create_invoice_drafts(uuid) to service_role;
notify pgrst, 'reload schema';
