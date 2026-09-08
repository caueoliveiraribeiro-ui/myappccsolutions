-- Invoice billing-address snapshot and automatic invoice branding
-- Applied to Supabase as migration: add_client_address_to_invoices
-- Safe to use as a reference for a fresh Orbit LM database.

alter table public.invoices
  add column if not exists client_address text;

-- The production migration also updates orbit_create_invoice_drafts so it snapshots
-- clients.address and the user’s saved invoice_branding on automatic draft invoices.
