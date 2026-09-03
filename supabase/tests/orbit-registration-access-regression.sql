BEGIN;
DO $test$
DECLARE e text:=gen_random_uuid()||'@example.invalid'; t text:=gen_random_uuid()::text; u uuid; n integer; blocked boolean;
BEGIN
 IF NOT public.orbit_registration_request(e,'Registration regression','salt','hash',t,'regression-ip') THEN RAISE EXCEPTION 'Request failed'; END IF;
 IF EXISTS(SELECT 1 FROM app_users WHERE email=e) THEN RAISE EXCEPTION 'Unverified user created';END IF;
 IF NOT public.orbit_registration_confirm(t) THEN RAISE EXCEPTION 'Confirmation failed';END IF;
 IF public.orbit_registration_confirm(t) THEN RAISE EXCEPTION 'Token reused';END IF;
 SELECT id INTO u FROM app_users WHERE email=e;
 IF EXISTS(SELECT 1 FROM account_subscriptions WHERE user_id=u) THEN RAISE EXCEPTION 'Free account granted plan';END IF;
 IF public.orbit_registration_request(e,'Duplicate','salt','hash','duplicate','regression-ip') THEN RAISE EXCEPTION 'Duplicate allowed';END IF;
 IF public.orbit_registration_request('caue.oliveira.ribeiro@gmail.com','Spoof','salt','hash','owner','regression-ip') THEN RAISE EXCEPTION 'Owner spoof';END IF;
 blocked:=false;
 BEGIN PERFORM public.orbit_assign_plan(u,u,'big_business','active',now()+interval '1 day');EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%OWNER_REQUIRED%' THEN RAISE;END IF;blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Non-owner assignment accepted';END IF;
 PERFORM public.orbit_assign_plan('c38a52ed-766f-47b1-abbd-bc8e152dcaa9',u,'small_business','active',now()+interval '1 day');
 IF NOT EXISTS(SELECT 1 FROM account_subscriptions WHERE user_id=u AND plan='small_business') THEN RAISE EXCEPTION 'Assignment failed';END IF;
 IF NOT EXISTS(SELECT 1 FROM orbit_plan_audit WHERE target=u) THEN RAISE EXCEPTION 'Audit missing';END IF;
 e:=gen_random_uuid()||'@example.invalid';
 FOR n IN 1..3 LOOP
  IF NOT public.orbit_registration_request(e,'Rate regression','salt','hash',gen_random_uuid()::text,'email-rate-test') THEN RAISE EXCEPTION 'Early rate denial';END IF;
 END LOOP;
 IF public.orbit_registration_request(e,'Rate regression','salt','hash',gen_random_uuid()::text,'email-rate-test') THEN RAISE EXCEPTION 'Email rate not enforced';END IF;
 UPDATE orbit_registration_pending SET expires_at=now()-interval '1 minute' WHERE email=e RETURNING token_hash INTO t;
 IF public.orbit_registration_confirm(t) THEN RAISE EXCEPTION 'Expired link accepted';END IF;
 FOR n IN 1..10 LOOP
  IF NOT public.orbit_registration_request(gen_random_uuid()||'@example.invalid','IP regression','salt','hash',gen_random_uuid()::text,'ip-rate-test') THEN RAISE EXCEPTION 'Early IP rate denial';END IF;
 END LOOP;
 IF public.orbit_registration_request(gen_random_uuid()||'@example.invalid','IP regression','salt','hash',gen_random_uuid()::text,'ip-rate-test') THEN RAISE EXCEPTION 'IP rate not enforced';END IF;
 IF has_function_privilege('anon','public.orbit_assign_plan(uuid,uuid,text,text,timestamptz)','EXECUTE') OR has_function_privilege('authenticated','public.orbit_registration_confirm(text)','EXECUTE') THEN RAISE EXCEPTION 'Public access to privileged RPC';END IF;
END $test$;
ROLLBACK;
SELECT 'PASS: verified registration, single-use/expired tokens, duplicate/owner protection, rate limits, audited owner-only assignment; test rows rolled back' AS result;

