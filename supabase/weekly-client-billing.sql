-- Weekly client billing support. Safe to run more than once.
-- Adds Weekly to payment and task automation, and advances the next charge by 7 days after invoice delivery.
begin;

create or replace function public.orbit_create_upcoming_payments(p_owner uuid default null)
returns integer language plpgsql security invoker set search_path=public as $$
declare inserted integer;
begin
 with eligible as (
  select c.* from public.clients c
  where (p_owner is null or c.user_id=p_owner)
    and not coalesce(c.archived,false)
    and coalesce(c.status,'Active') not in ('Lost','Past','Paused','Cancelled')
    and lower(trim(coalesce(c.billing_frequency,'One-time'))) in ('weekly','every week','semanal','semanalmente','monthly','biweekly','once a month','one-time','one time','once')
    and c.charge_date between (now() at time zone 'UTC')::date and (now() at time zone 'UTC')::date+10
    and coalesce(c.service_amount,0)>0
 ), claimed as (
  insert into public.client_payment_occurrences(user_id,client_id,due_date,payment_id)
  select user_id,id,charge_date,gen_random_uuid() from eligible
  on conflict(user_id,client_id,due_date) do nothing
  returning *
 )
 insert into public.payment_records(id,user_id,source_client_id,billing_due_date,project_name,client_name,amount,currency,received_at,status,method,notes)
 select o.payment_id,c.user_id,c.id,c.charge_date,
   'Client payment · '||coalesce(nullif(c.service,''),c.name),c.name,c.service_amount,nullif(upper(trim(c.currency)),''),
   c.charge_date,'Awaiting payment','Other','Automatically created for the client charge due '||c.charge_date::text
 from claimed o join eligible c on c.id=o.client_id and c.user_id=o.user_id
 on conflict(user_id,source_client_id,billing_due_date) where source_client_id is not null do nothing;
 get diagnostics inserted=row_count;
 return inserted;
end;
$$;

create or replace function public.orbit_create_billing_reminders(p_owner uuid default null)
returns integer language plpgsql security invoker set search_path=public as $$
declare inserted integer;
begin
  insert into public.tasks(user_id,title,kind,status,priority,due_date,notes,billing_client_id,billing_due_date,billing_amount,billing_currency,invoice_number)
  select c.user_id,'Charge Client ('||c.name||')','Task','Open','High',c.charge_date,
    concat_ws(E'\n','Client: '||c.name,'Email: '||c.email,'Phone: '||c.phone,'Service: '||c.service,'Description: '||c.description,'Invoice number: pending'),
    c.id,c.charge_date,coalesce(c.service_amount,0),coalesce(nullif(c.currency,''),'USD'),''
  from public.clients c
  where (p_owner is null or c.user_id=p_owner)
    and not coalesce(c.archived,false)
    and lower(trim(coalesce(c.billing_frequency,''))) in ('weekly','every week','semanal','semanalmente','monthly','biweekly','once a month')
    and coalesce(c.status,'Active') not in ('Lost','Past','Paused','Cancelled')
    and c.charge_date <= (now() at time zone 'UTC')::date + 1
  on conflict(user_id,billing_client_id,billing_due_date) where billing_client_id is not null do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create or replace function public.orbit_complete_invoice_email(p_invoice uuid,p_token uuid,p_email_id text)
returns setof public.invoices language plpgsql security invoker set search_path=public as $$
declare inv public.invoices%rowtype;
begin
  select * into inv from public.invoices where id=p_invoice and email_claim_token=p_token for update;
  if not found then return; end if;
  if inv.sent_at is not null then return next inv; return; end if;
  if nullif(trim(p_email_id),'') is null then raise exception 'Email provider confirmation is required'; end if;
  if inv.status <> 'void' and inv.due_date is not null and inv.client_id is not null then
    update public.clients c set charge_date=case
      when lower(trim(coalesce(c.billing_frequency,''))) in ('weekly','every week','semanal','semanalmente') then c.charge_date + 7
      when lower(trim(coalesce(c.billing_frequency,''))) in ('monthly','once a month') then (c.charge_date + interval '1 month')::date
      when lower(trim(coalesce(c.billing_frequency,''))) in ('biweekly','bi-weekly') then c.charge_date + 14
      when lower(trim(coalesce(c.billing_frequency,''))) in ('one_time','one-time','one time','once') then null
      else c.charge_date end
    where c.id=inv.client_id and c.user_id=inv.user_id and not coalesce(c.archived,false) and c.charge_date=inv.due_date;
  end if;
  update public.invoices i set
    status=case when i.status in ('draft','sent','overdue','awaiting_payment') then 'awaiting_payment' else i.status end,
    sent_at=now(),email_provider_id=p_email_id,email_delivery_error=null,updated_at=now()
  where i.id=p_invoice returning i.* into inv;
  return next inv;
end;
$$;

revoke all on function public.orbit_create_upcoming_payments(uuid) from public,anon,authenticated;
grant execute on function public.orbit_create_upcoming_payments(uuid) to service_role;
revoke all on function public.orbit_create_billing_reminders(uuid) from public,anon,authenticated;
grant execute on function public.orbit_create_billing_reminders(uuid) to service_role;
revoke all on function public.orbit_complete_invoice_email(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.orbit_complete_invoice_email(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
