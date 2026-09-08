-- Applied to Orbit production as lead_address_invoice_description.
-- Additive only: existing records, website fields and access rules are preserved.
alter table public.leads add column if not exists address text;
alter table public.invoices add column if not exists description text;
notify pgrst, 'reload schema';
