# CRM flow recovery

Lead creation and stage changes use a server-side transaction with workspace permission checks. Linked records are reused; paid projects and payment records are preserved. Clients without a source lead receive one when returned to the pipeline. Normal deletion uses the three-month archive; permanent deletion requires an archived record and typed DELETE.

## Applied production SQL

```sql
create or replace function public.orbit_transition_lead(p_owner uuid,p_id uuid,p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare l public.leads; n public.leads; cid uuid; cname text;
begin
 perform pg_advisory_xact_lock(hashtextextended('crm-flow:'||p_owner::text,0));
 if p_id is null then
  insert into public.leads(user_id,company,status) values(p_owner,coalesce(nullif(p_changes->>'company',''),'New lead'),'Registered') returning id into p_id;
 end if;
 select * into l from public.leads where id=p_id and user_id=p_owner for update;
 if not found then raise exception 'Lead unavailable'; end if;
 select * into n from jsonb_populate_record(l,p_changes);
 n.status := case when n.status='Won' then 'Client' else n.status end;
 if n.status not in ('Registered','New','Contacted','Qualified','Proposal','Client','Lost') then raise exception 'Invalid lead status'; end if;
 update public.leads set company=n.company,contact_name=n.contact_name,email=n.email,phone=n.phone,address=n.address,
 city=n.city,country=n.country,service=n.service,description=n.description,notes=n.notes,estimated_value=n.estimated_value,
 currency=n.currency,last_call_date=n.last_call_date,next_follow_up_date=n.next_follow_up_date,status=n.status,
 archived=case when p_changes ? 'status' then false else n.archived end,
 directory_hidden=case when p_changes ? 'status' then false else n.directory_hidden end,updated_at=now()
 where id=p_id and user_id=p_owner returning * into n;
 cname := coalesce(nullif(n.contact_name,''),n.company);
 select id into cid from public.clients where user_id=p_owner and
 (source_lead_id=p_id or source='Lead:'||p_id::text) order by created_at limit 1 for update;
 if cid is null and n.status='Client' then
  select id into cid from public.clients where user_id=p_owner and source_lead_id is null
   and nullif(trim(n.email),'') is not null and lower(trim(email))=lower(trim(n.email)) order by created_at limit 1 for update;
 end if;
 if cid is not null then
  update public.clients set source_lead_id=p_id,source='Lead:'||p_id::text,
   name=cname,company_name=n.company,email=n.email,phone=n.phone,address=n.address,description=n.description,
   service=n.service,last_call_date=n.last_call_date,status=case when n.status='Client' then 'Active' else n.status end,
   archived=case when n.status='Client' then false else archived end,updated_at=now()
   where id=cid and user_id=p_owner;
 elsif n.status='Client' then
  insert into public.clients(user_id,name,company_name,email,phone,address,description,status,source,source_lead_id,service,city,country,service_amount,currency,last_call_date)
   values(p_owner,cname,n.company,n.email,n.phone,n.address,n.description,'Active','Lead:'||p_id::text,p_id,n.service,n.city,n.country,coalesce(n.estimated_value,0),coalesce(n.currency,'USD'),n.last_call_date) returning id into cid;
 end if;
 if n.status='Client' and not exists(select 1 from public.projects where user_id=p_owner and (source_lead_id=p_id or notes like '%Lead ID: '||p_id::text||'%')) then
  insert into public.projects(user_id,name,client,kind,stage,budget,cost,progress,description,notes,source_lead_id,currency,contact_email,contact_phone)
   values(p_owner,n.company||' · '||coalesce(nullif(n.service,''),'Project'),cname,coalesce(nullif(n.service,''),'Full Service'),'Brief',coalesce(n.estimated_value,0),0,0,n.description,'Created from won lead. Lead ID: '||p_id::text,p_id,coalesce(n.currency,'USD'),n.email,n.phone);
 end if;
 -- Never overwrite paid project status, amounts or payment ledger when reopening a lead.
 return jsonb_build_object('lead',to_jsonb(n));
end $$;
revoke all on function public.orbit_transition_lead(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.orbit_transition_lead(uuid,uuid,jsonb) to service_role;
create or replace function public.orbit_reenter_client(p_owner uuid,p_client uuid,p_status text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare c public.clients; lid uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('crm-flow:'||p_owner::text,0));
 select * into c from public.clients where id=p_client and user_id=p_owner for update;
 if not found then raise exception 'Client unavailable'; end if;
 select id into lid from public.leads where user_id=p_owner and id=c.source_lead_id;
 if lid is null then
  insert into public.leads(user_id,company,contact_name,email,phone,address,service,description,currency,estimated_value,status)
  values(p_owner,coalesce(nullif(c.company_name,''),c.name),c.name,c.email,c.phone,c.address,c.service,c.description,c.currency,c.service_amount,'Registered') returning id into lid;
  update public.clients set source_lead_id=lid,source='Lead:'||lid::text where id=p_client and user_id=p_owner;
 end if;
 return public.orbit_transition_lead(p_owner,lid,jsonb_build_object('status',p_status,'contact_name',c.name,'company',coalesce(nullif(c.company_name,''),c.name),'email',c.email,'phone',c.phone,'address',c.address,'description',c.description,'service',c.service,'last_call_date',c.last_call_date));
end $$;
revoke all on function public.orbit_reenter_client(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.orbit_reenter_client(uuid,uuid,text) to service_role;

```
