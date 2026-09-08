-- Rollback-only integration test. No email requests are made.
begin;
do $test$
declare owner_key uuid; client_key uuid; invoice_key uuid; tok uuid; next_date date; scenario record;
begin
 select c.user_id,c.id into owner_key,client_key from clients c
 where not coalesce(c.archived,false) and c.user_id in ('00000000-0000-4000-8000-000000000001','c38a52ed-766f-47b1-abbd-bc8e152dcaa9') limit 1;
 if client_key is null then raise exception 'Missing rollback fixture'; end if;
 for scenario in select * from (values
 ('Monthly','2027-01-31'::date,'2027-02-28'::date),
 ('Monthly','2028-01-31'::date,'2028-02-29'::date),
 ('Biweekly','2026-12-25'::date,'2027-01-08'::date),
 ('One-time','2026-09-09'::date,null::date)
 ) as x(frequency,due,expected)
 loop
 update clients set billing_frequency=scenario.frequency,charge_date=scenario.due where id=client_key;
 tok:=gen_random_uuid();
 insert into invoices(user_id,client_id,invoice_number,client_name,client_email,service_name,amount,currency,issue_date,due_date,status,email_claim_token)
 values(owner_key,client_key,'INV-CYCLE-TEST-'||gen_random_uuid(),'Fixture','fixture@example.test','Test',1,'USD',current_date,scenario.due,'draft',tok) returning id into invoice_key;
 perform orbit_complete_invoice_email(invoice_key,tok,'test-provider');
 select charge_date into next_date from clients where id=client_key;
 if next_date is distinct from scenario.expected then raise exception 'Wrong cycle date for %: %',scenario.frequency,next_date; end if;
 if not exists(select 1 from invoices where id=invoice_key and status='awaiting_payment' and sent_at is not null) then raise exception 'Wrong sent status'; end if;
 perform orbit_complete_invoice_email(invoice_key,tok,'test-provider');
 select charge_date into next_date from clients where id=client_key;
 if next_date is distinct from scenario.expected then raise exception 'Advanced twice'; end if;
 end loop;
 -- Never overwrite a date manually moved to another cycle.
 update clients set charge_date='2027-04-15',billing_frequency='Monthly' where id=client_key;
 tok:=gen_random_uuid();
 insert into invoices(user_id,client_id,invoice_number,client_name,amount,currency,issue_date,due_date,status,email_claim_token)
 values(owner_key,client_key,'INV-CYCLE-TEST-'||gen_random_uuid(),'Fixture',1,'USD',current_date,'2027-03-15','draft',tok) returning id into invoice_key;
 perform orbit_complete_invoice_email(invoice_key,tok,'test-provider');
 if not exists(select 1 from clients where id=client_key and charge_date='2027-04-15') then raise exception 'Manual date overwritten'; end if;
 if has_function_privilege('anon','public.orbit_complete_invoice_email(uuid,uuid,text)','execute') then raise exception 'Public completion access'; end if;
end $test$;
rollback;
