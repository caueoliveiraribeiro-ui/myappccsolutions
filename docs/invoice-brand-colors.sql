alter table public.invoice_branding add column if not exists primary_color text not null default '#07111F' check (primary_color ~ '^#[0-9A-Fa-f]{6}$');
alter table public.invoice_branding add column if not exists accent_color text not null default '#12BDE0' check (accent_color ~ '^#[0-9A-Fa-f]{6}$');
alter table public.invoices add column if not exists issuer_primary_color text;
alter table public.invoices add column if not exists issuer_accent_color text;
create or replace function public.orbit_snapshot_invoice_style()
returns trigger language plpgsql security invoker set search_path = public as $$
declare b record; original_currency text;
begin
 select primary_color,accent_color into b from public.invoice_branding where user_id=new.user_id;
 new.issuer_primary_color := coalesce(b.primary_color,'#07111F');
 new.issuer_accent_color := coalesce(b.accent_color,'#12BDE0');
 if new.client_id is not null then
   select nullif(upper(trim(currency)),'') into original_currency from public.clients where id=new.client_id and user_id=new.user_id;
   if original_currency is not null then new.currency := original_currency; end if;
 end if;
 return new;
end $$;
revoke all on function public.orbit_snapshot_invoice_style() from public, anon, authenticated;
grant execute on function public.orbit_snapshot_invoice_style() to service_role;
create trigger orbit_snapshot_invoice_style before insert on public.invoices
for each row execute function public.orbit_snapshot_invoice_style();
notify pgrst, 'reload schema';
