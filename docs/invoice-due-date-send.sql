-- Expand-only production update. Service-role access only (Orbit uses custom server auth).
alter table public.invoices add column if not exists email_claim_token uuid;
alter table public.invoices add column if not exists email_claimed_at timestamptz;
alter table public.invoices add column if not exists email_provider_id text;
alter table public.invoices add column if not exists email_delivery_error text;

create or replace function public.orbit_due_invoice_emails()
returns table(id uuid, user_id uuid, reply_to text)
language sql security invoker set search_path = public
as $$
  select i.id, i.user_id, u.email
  from public.invoices i join public.app_users u on u.id = i.user_id
  join public.clients c on c.id=i.client_id and c.user_id=i.user_id
  where i.status='draft' and i.sent_at is null and i.email_claim_token is null
    and i.due_date=(now() at time zone 'UTC')::date
    and i.notes='Created automatically two days before the client charge date.'
    and not coalesce(c.archived,false)
    and i.client_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
  order by i.id
  limit 200
$$;

create or replace function public.orbit_claim_invoice_email(p_invoice uuid, p_owner uuid, p_automatic boolean default false)
returns setof public.invoices language sql security invoker set search_path=public
as $$
  update public.invoices i set email_claim_token=gen_random_uuid(),email_claimed_at=now(),email_delivery_error=null
  where i.id=p_invoice and i.user_id=p_owner
    and i.status in ('draft','overdue') and i.sent_at is null and i.email_claim_token is null
    and i.client_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    and (not p_automatic or (
      i.status='draft' and i.due_date=(now() at time zone 'UTC')::date
      and i.notes='Created automatically two days before the client charge date.'
      and exists(select 1 from public.clients c where c.id=i.client_id and c.user_id=i.user_id and not coalesce(c.archived,false))
    ))
  returning i.*
$$;

create or replace function public.orbit_complete_invoice_email(p_invoice uuid,p_token uuid,p_email_id text)
returns setof public.invoices language sql security invoker set search_path=public
as $$
  update public.invoices i set
    status=case when i.status in ('draft','overdue') then 'sent' else i.status end,
    sent_at=coalesce(i.sent_at,now()),email_provider_id=p_email_id,email_delivery_error=null,updated_at=now()
  where i.id=p_invoice and i.email_claim_token=p_token
  returning i.*
$$;
revoke all on function public.orbit_due_invoice_emails() from public,anon,authenticated;
revoke all on function public.orbit_claim_invoice_email(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.orbit_complete_invoice_email(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.orbit_due_invoice_emails() to service_role;
grant execute on function public.orbit_claim_invoice_email(uuid,uuid,boolean) to service_role;
grant execute on function public.orbit_complete_invoice_email(uuid,uuid,text) to service_role;

-- Correct the existing wrapper's over-escaped email regex without changing its eligibility rules.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.orbit_create_all_invoice_drafts()'::regprocedure) into definition;
  definition := replace(definition, chr(92)||chr(92)||'.', '[.]');
  execute definition;
end $$;
notify pgrst,'reload schema';
