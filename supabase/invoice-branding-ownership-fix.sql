-- Orbit uses public.app_users for application authentication.
-- invoice_branding.user_id is keyed by the application's user ID, not Supabase auth.users.
-- This removes an incorrect foreign key that blocked logo saves for every Orbit account.
alter table public.invoice_branding
  drop constraint if exists invoice_branding_user_id_fkey;
