-- Orbit LM / Supabase only. Run after orbit-workflow-update.sql.
-- Safe to rerun. Does not delete clients, projects or payment history.
BEGIN;
alter table public.payment_records add column if not exists status text not null default 'Payment received';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orbit_payment_status_check' AND conrelid='public.payment_records'::regclass) THEN
    ALTER TABLE public.payment_records ADD CONSTRAINT orbit_payment_status_check CHECK(status IN ('Awaiting payment','Payment received','Cancelled'));
  END IF;
END $$;
create or replace function public.orbit_capture_project_payment()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if pg_trigger_depth()>1 then return new; end if;
  if new.stage = 'Payment received' then
    if TG_OP = 'UPDATE' then
      if old.stage = 'Payment received' then return new; end if;
    end if;
    insert into public.payment_records
      (user_id,source_project_id,project_name,client_name,amount,currency,received_at,method,reference,notes,status)
    values
      (new.user_id,new.id,new.name,new.client,coalesce(new.budget,0)-coalesce(new.cost,0),
       nullif(new.currency,''),coalesce(new.payment_date,current_date),
       coalesce(nullif(new.payment_method,''),'Other'),coalesce(new.payment_reference,''),coalesce(new.payment_notes,''),'Payment received')
    on conflict (user_id,source_project_id) where source_project_id is not null
    do update set status='Payment received',amount=excluded.amount,currency=excluded.currency,received_at=excluded.received_at,
      project_name=excluded.project_name,client_name=excluded.client_name,
      method=excluded.method,reference=excluded.reference,notes=excluded.notes,updated_at=now();
  elsif new.stage in ('Awaiting payment','Cancelled') then
    update public.payment_records set status=new.stage,updated_at=now()
    where source_project_id=new.id and user_id=new.user_id;
  end if;
  return new;
end;
$$;

create or replace function public.orbit_sync_payment_project()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if pg_trigger_depth()>1 or new.source_project_id is null then return new; end if;
  update public.projects set stage=new.status,payment_date=new.received_at,
    payment_method=new.method,payment_reference=new.reference,payment_notes=new.notes,updated_at=now()
  where id=new.source_project_id and user_id=new.user_id;
  return new;
end;
$$;
drop trigger if exists orbit_payment_project_sync on public.payment_records;
create trigger orbit_payment_project_sync after insert or update on public.payment_records
for each row execute function public.orbit_sync_payment_project();



DROP TRIGGER IF EXISTS orbit_project_payment ON public.projects;
CREATE TRIGGER orbit_project_payment AFTER INSERT OR UPDATE OF stage ON public.projects FOR EACH ROW EXECUTE FUNCTION public.orbit_capture_project_payment();

alter table public.payment_records add column if not exists source_client_id uuid;
alter table public.payment_records add column if not exists billing_due_date date;
create unique index if not exists orbit_client_payment_unique on public.payment_records(user_id,source_client_id,billing_due_date) where source_client_id is not null;
-- Occurrences persist when a user deletes a generated payment so it is not recreated.
create table if not exists public.client_payment_occurrences(
 user_id uuid not null,client_id uuid not null,due_date date not null,payment_id uuid not null,
 created_at timestamptz not null default now(),primary key(user_id,client_id,due_date)
);
alter table public.client_payment_occurrences enable row level security;
create or replace function public.orbit_create_upcoming_payments(p_owner uuid default null)
returns integer language plpgsql security invoker set search_path=public as $$
declare inserted integer;
begin
 with eligible as (
 select c.* from public.clients c
 where (p_owner is null or c.user_id=p_owner)
 and coalesce(c.status,'Active') not in ('Lost','Past','Paused','Cancelled')
 and lower(trim(coalesce(c.billing_frequency,'One-time'))) in ('monthly','biweekly','once a month','one-time','one time','once')
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
revoke all on function public.orbit_create_upcoming_payments(uuid) from public;



-- These RPCs are called only by authenticated server routes using the service role.
REVOKE ALL ON FUNCTION public.orbit_create_upcoming_payments(uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.orbit_create_upcoming_payments(uuid) TO service_role;
REVOKE ALL ON TABLE public.client_payment_occurrences FROM public,anon,authenticated;
GRANT ALL ON TABLE public.client_payment_occurrences TO service_role;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS directory_hidden boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.orbit_deleted_payment_project()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF old.source_project_id IS NOT NULL THEN
  UPDATE public.projects SET stage='Awaiting payment',updated_at=now()
  WHERE id=old.source_project_id AND user_id=old.user_id;
 END IF;
 RETURN old;
END;
$$;
DROP TRIGGER IF EXISTS orbit_deleted_payment_project ON public.payment_records;
CREATE TRIGGER orbit_deleted_payment_project AFTER DELETE ON public.payment_records
FOR EACH ROW EXECUTE FUNCTION public.orbit_deleted_payment_project();

-- Import exactly three client fields, isolated to one authenticated owner.
CREATE OR REPLACE FUNCTION public.orbit_import_clients(p_owner uuid,p_clients jsonb)
RETURNS SETOF public.clients LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF p_owner IS NULL OR jsonb_typeof(p_clients) <> 'array' OR jsonb_array_length(p_clients) NOT BETWEEN 1 AND 500 THEN
  RAISE EXCEPTION 'Choose between 1 and 500 clients';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 RETURN QUERY
 WITH incoming AS (
  SELECT DISTINCT ON (lower(trim(x.email))) trim(x.name) AS name,lower(trim(x.email)) AS email,trim(x.phone) AS phone
  FROM jsonb_to_recordset(p_clients) AS x(name text,email text,phone text)
  WHERE length(trim(x.name)) BETWEEN 1 AND 200 AND length(trim(x.email)) BETWEEN 3 AND 254 AND length(trim(x.phone)) BETWEEN 1 AND 80
 )
 INSERT INTO public.clients(user_id,name,email,phone)
 SELECT p_owner,i.name,i.email,i.phone FROM incoming i
 WHERE NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.user_id=p_owner AND lower(trim(c.email))=i.email)
 RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.orbit_import_clients(uuid,jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.orbit_import_clients(uuid,jsonb) TO service_role;

-- Runs hourly when pg_cron is enabled; the app also checks every minute.
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  PERFORM cron.schedule('orbit-client-upcoming-payments','5 * * * *','SELECT public.orbit_create_upcoming_payments();');
 ELSE
  RAISE NOTICE 'Enable pg_cron and rerun this update for payments generated while the app is closed.';
 END IF;
END;
$$;
NOTIFY pgrst,'reload schema';
COMMIT;

