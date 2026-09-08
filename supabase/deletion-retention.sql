-- Three-calendar-month recovery for deleted records; manual archives never expire.
alter table public.leads add column if not exists deleted_at timestamptz, add column if not exists delete_after timestamptz;
alter table public.clients add column if not exists deleted_at timestamptz, add column if not exists delete_after timestamptz;
alter table public.projects add column if not exists deleted_at timestamptz, add column if not exists delete_after timestamptz;
create or replace function public.orbit_deletion_retention() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if not coalesce(new.archived,false) then
    new.deleted_at := null; new.delete_after := null;
  elsif old.deleted_at is not null then
    new.deleted_at := old.deleted_at; new.delete_after := old.delete_after;
  elsif new.deleted_at is not null then
    new.deleted_at := now(); new.delete_after := now() + interval '3 months';
  else
    new.delete_after := null;
  end if;
  return new;
end $$;
revoke all on function public.orbit_deletion_retention() from public,anon,authenticated;
create trigger orbit_retention before update on public.leads for each row execute function public.orbit_deletion_retention();
create trigger orbit_retention before update on public.clients for each row execute function public.orbit_deletion_retention();
create trigger orbit_retention before update on public.projects for each row execute function public.orbit_deletion_retention();
create index if not exists orbit_leads_expiry on public.leads(delete_after) where deleted_at is not null;
create index if not exists orbit_clients_expiry on public.clients(delete_after) where deleted_at is not null;
create index if not exists orbit_projects_expiry on public.projects(delete_after) where deleted_at is not null;
-- Preserve activity history when its deleted lead eventually expires.
alter table public.activities drop constraint activities_lead_id_fkey;
alter table public.activities add constraint activities_lead_id_fkey foreign key (lead_id) references public.leads(id) on delete set null;
-- Existing reminder generation must ignore archived/deleted clients.
do $block$
declare definition text;
begin
  select pg_get_functiondef('public.orbit_create_billing_reminders(uuid)'::regprocedure) into definition;
  definition := replace(definition,'and lower(c.billing_frequency)', 'and not coalesce(c.archived,false) and lower(c.billing_frequency)');
  execute definition;
end $block$;
select cron.schedule('orbit-expire-deleted-records','17 3 * * *',$job$
delete from public.projects where archived and deleted_at is not null and delete_after <= now();
delete from public.clients where archived and deleted_at is not null and delete_after <= now();
delete from public.leads where archived and deleted_at is not null and delete_after <= now();
$job$);
notify pgrst,'reload schema';
