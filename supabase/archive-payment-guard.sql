do $block$
declare definition text;
begin
 select pg_get_functiondef('public.orbit_create_upcoming_payments(uuid)'::regprocedure) into definition;
 definition := replace(definition, 'and coalesce(c.status', 'and not coalesce(c.archived,false) and coalesce(c.status');
 execute definition;
end $block$;
