-- Invoice client branding. Safe to run more than once.
alter table public.clients add column if not exists company_logo_url text;
alter table public.invoices add column if not exists client_company_name text;
alter table public.invoices add column if not exists client_logo_url text;
