-- Orbit uses server-side service-role access after checking account ownership.
-- Direct public client access must not expose logos belonging to other users.
alter table public.invoice_branding enable row level security;
revoke all on table public.invoice_branding from anon, authenticated;
