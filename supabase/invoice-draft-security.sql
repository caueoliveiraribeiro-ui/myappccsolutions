-- Invoice draft generator access hardening
-- The application calls this function using the server-only service role.
revoke execute on function public.orbit_create_invoice_drafts(uuid) from public, anon, authenticated;
grant execute on function public.orbit_create_invoice_drafts(uuid) to service_role;
