-- Transaction-only regression: all test records are rolled back.
BEGIN;
DO $test$
DECLARE small_id uuid:=gen_random_uuid(); big_id uuid:=gen_random_uuid(); personal_id uuid:=gen_random_uuid(); record_id uuid; blocked boolean; n integer;
BEGIN
 INSERT INTO public.account_subscriptions(user_id,plan,status,access_until) VALUES
 (small_id,'small_business','active',now()+interval '1 day'),
 (big_id,'big_business','active',now()+interval '1 day'),
 (personal_id,'personal','active',now()+interval '1 day');
 INSERT INTO public.clients(user_id,name,email,phone) SELECT small_id,'Quota test '||i,'quota'||i||'@example.invalid','000' FROM generate_series(1,49) i;
 blocked:=false;
 BEGIN
 PERFORM * FROM public.orbit_import_clients(small_id,'[{"name":"Import A","email":"import-a@example.invalid","phone":"000"},{"name":"Import B","email":"import-b@example.invalid","phone":"000"}]'::jsonb);
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%ORBIT_QUOTA_clients%' THEN RAISE; END IF;blocked:=true;END;
 IF NOT blocked OR (SELECT count(*) FROM public.clients WHERE user_id=small_id)<>49 THEN RAISE EXCEPTION 'Import quota/atomicity failed';END IF;
 PERFORM * FROM public.orbit_import_clients(small_id,'[{"name":"Import A","email":"import-a@example.invalid","phone":"000"}]'::jsonb);
 blocked:=false;
 BEGIN INSERT INTO public.clients(user_id,name) VALUES(small_id,'Overflow');EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%ORBIT_QUOTA_clients%' THEN RAISE;END IF;blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Client quota failed';END IF;
 UPDATE public.clients SET notes='Allowed existing edit' WHERE user_id=small_id;
 INSERT INTO public.leads(user_id,company,status) SELECT small_id,'Lead '||i,'New' FROM generate_series(1,100) i;
 INSERT INTO public.leads(user_id,company,status,archived) SELECT small_id,'Archive '||i,'New',true FROM generate_series(1,50) i;
 SELECT id INTO record_id FROM public.leads WHERE user_id=small_id AND archived LIMIT 1;
 blocked:=false;
 BEGIN UPDATE public.leads SET archived=false WHERE id=record_id;EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%ORBIT_QUOTA_leads%' THEN RAISE;END IF;blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Restoration quota failed';END IF;
 blocked:=false;
 BEGIN INSERT INTO public.leads(user_id,company,archived) VALUES(small_id,'Archive overflow',true);EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%ORBIT_QUOTA_leads%' THEN RAISE;END IF;blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Archive quota failed';END IF;
 INSERT INTO public.leads(user_id,company,status) VALUES(small_id,'History lead','Lost') RETURNING id INTO record_id;
 blocked:=false;
 BEGIN UPDATE public.leads SET status='New' WHERE id=record_id;EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%ORBIT_QUOTA_leads%' THEN RAISE;END IF;blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'History restoration quota failed';END IF;
 INSERT INTO public.clients(user_id,name,email) SELECT big_id,'Big client '||i,'big'||i||'@example.invalid' FROM generate_series(1,51) i;
 INSERT INTO public.leads(user_id,company,status) SELECT big_id,'Big lead '||i,'New' FROM generate_series(1,300) i;
 INSERT INTO public.leads(user_id,company,archived) SELECT big_id,'Big archive '||i,true FROM generate_series(1,100) i;
 blocked:=false;
 BEGIN INSERT INTO public.leads(user_id,company) VALUES(big_id,'Overflow');EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%ORBIT_QUOTA_leads%' THEN RAISE;END IF;blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Big live quota failed';END IF;
 blocked:=false;
 BEGIN INSERT INTO public.leads(user_id,company,archived) VALUES(big_id,'Overflow',true);EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%ORBIT_QUOTA_leads%' THEN RAISE;END IF;blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Big archive quota failed';END IF;
 blocked:=false;
 BEGIN INSERT INTO public.clients(user_id,name) VALUES(personal_id,'Forbidden');EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%ORBIT_PLAN_REQUIRED%' THEN RAISE;END IF;blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Personal client restriction failed';END IF;
 UPDATE public.account_subscriptions SET access_until=now()-interval '1 day' WHERE user_id=big_id;
 blocked:=false;
 BEGIN INSERT INTO public.clients(user_id,name) VALUES(big_id,'Expired');EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%ORBIT_PLAN_REQUIRED%' THEN RAISE;END IF;blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Expired plan failed';END IF;
END $test$;
ROLLBACK;
SELECT jsonb_build_object('tests','PASS: client/import/live/archive/restore/expired quotas; all test rows rolled back','owner_assignments',(SELECT count(*) FROM public.account_subscriptions WHERE plan='owner' AND status='active'),'subscription_rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.account_subscriptions'::regclass),'anon_can_write',has_table_privilege('anon','public.account_subscriptions','INSERT'),'authenticated_can_write',has_table_privilege('authenticated','public.account_subscriptions','UPDATE')) AS audit;

