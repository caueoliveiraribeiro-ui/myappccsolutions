-- Run after invoice_due_date_delivery. No existing client dates are bulk changed.
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check check (status in ('draft','sent','awaiting_payment','paid','overdue','void'));

create or replace function public.orbit_complete_invoice_email(p_invoice uuid,p_token uuid,p_email_id text)
returns setof public.invoices language plpgsql security invoker set search_path=public
as $$
declare inv public.invoices%rowtype;
begin
  select * into inv from public.invoices where id=p_invoice and email_claim_token=p_token for update;
  if not found then return; end if;
  -- The same completion callback must not advance the client twice.
  if inv.sent_at is not null then return next inv; return; end if;
  if nullif(trim(p_email_id),'') is null then raise exception 'Email provider confirmation is required'; end if;

  if inv.status <> 'void' and inv.due_date is not null and inv.client_id is not null then
    update public.clients c set charge_date=case
      when lower(trim(coalesce(c.billing_frequency,''))) in ('monthly','once a month')
        then (c.charge_date + interval '1 month')::date
      when lower(trim(coalesce(c.billing_frequency,''))) in ('biweekly','bi-weekly')
        then c.charge_date + 14
      when lower(trim(coalesce(c.billing_frequency,''))) in ('one_time','one-time','one time','once')
        then null
      else c.charge_date end
    where c.id=inv.client_id and c.user_id=inv.user_id
      and not coalesce(c.archived,false)
      -- Protect dates edited by the user and older/out-of-order invoices.
      and c.charge_date=inv.due_date;
  end if;

  update public.invoices i set
    status=case when i.status in ('draft','sent','overdue','awaiting_payment') then 'awaiting_payment' else i.status end,
    sent_at=now(),email_provider_id=p_email_id,email_delivery_error=null,updated_at=now()
  where i.id=p_invoice returning i.* into inv;
  return next inv;
end $$;
revoke all on function public.orbit_complete_invoice_email(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.orbit_complete_invoice_email(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';

-- Allow a manually prepared awaiting-payment invoice to be emailed for the first
-- time. Automated sends still require draft status, due today, and the auto marker.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.orbit_claim_invoice_email(uuid,uuid,boolean)'::regprocedure) into definition;
 definition := replace(definition, '''draft'',''overdue''', '''draft'',''overdue'',''awaiting_payment''');
 execute definition;
end $$;
