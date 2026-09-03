-- Orbit only. Manual entitlements until verified Paddle webhooks are installed.
-- Does not open registration or modify/delete existing business data.
BEGIN;
CREATE TABLE IF NOT EXISTS public.account_subscriptions(
 user_id uuid PRIMARY KEY,
 plan text NOT NULL CHECK(plan IN ('personal','small_business','big_business','owner')),
 status text NOT NULL DEFAULT 'inactive' CHECK(status IN ('active','inactive','past_due','canceled')),
 access_until timestamptz,
 stripe_customer_id text,
 stripe_subscription_id text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_subscriptions FROM public,anon,authenticated;
GRANT ALL ON public.account_subscriptions TO service_role;
INSERT INTO public.account_subscriptions(user_id,plan,status)
VALUES ('00000000-0000-4000-8000-000000000001','owner','active'),('c38a52ed-766f-47b1-abbd-bc8e152dcaa9','owner','active')
ON CONFLICT(user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.orbit_guard_plan_quota()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE p text; cap integer; bucket text; old_bucket text; total bigint;
BEGIN
 IF TG_OP='UPDATE' AND new.user_id IS DISTINCT FROM old.user_id THEN RAISE EXCEPTION 'ORBIT_PLAN_REQUIRED: ownership cannot change'; END IF;
 IF new.user_id IN ('00000000-0000-4000-8000-000000000001'::uuid,'c38a52ed-766f-47b1-abbd-bc8e152dcaa9'::uuid) THEN RETURN new; END IF;
 -- Same per-owner lock as imports; row triggers also protect batch and simultaneous writes.
 PERFORM pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 SELECT plan INTO p FROM public.account_subscriptions
 WHERE user_id=new.user_id AND status='active' AND access_until>now();
 IF p IS NULL OR p NOT IN ('small_business','big_business') THEN RAISE EXCEPTION 'ORBIT_PLAN_REQUIRED'; END IF;
 IF TG_TABLE_NAME='clients' THEN
   IF TG_OP='UPDATE' THEN RETURN new; END IF;
   cap:=CASE WHEN p='big_business' THEN 100 ELSE 50 END;
   SELECT count(*) INTO total FROM public.clients WHERE user_id=new.user_id AND id<>new.id;
 ELSE
   bucket:=CASE WHEN coalesce(new.archived,false) THEN 'archive' WHEN coalesce(new.status,'New') NOT IN ('Client','Won','Lost') THEN 'live' ELSE 'history' END;
   IF TG_OP='UPDATE' THEN
     old_bucket:=CASE WHEN coalesce(old.archived,false) THEN 'archive' WHEN coalesce(old.status,'New') NOT IN ('Client','Won','Lost') THEN 'live' ELSE 'history' END;
     IF bucket=old_bucket THEN RETURN new; END IF;
   END IF;
   IF bucket='history' THEN RETURN new; END IF;
   cap:=CASE WHEN bucket='archive' THEN CASE WHEN p='big_business' THEN 100 ELSE 50 END ELSE CASE WHEN p='big_business' THEN 300 ELSE 100 END END;
   SELECT count(*) INTO total FROM public.leads
    WHERE user_id=new.user_id AND id<>new.id AND
      CASE WHEN bucket='archive' THEN coalesce(archived,false)
      ELSE NOT coalesce(archived,false) AND coalesce(status,'New') NOT IN ('Client','Won','Lost') END;
 END IF;
 IF total>=cap THEN RAISE EXCEPTION 'ORBIT_QUOTA_%: limit %',TG_TABLE_NAME,cap; END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.orbit_guard_plan_quota() FROM public,anon,authenticated;
DROP TRIGGER IF EXISTS orbit_clients_plan_quota ON public.clients;
CREATE TRIGGER orbit_clients_plan_quota BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.orbit_guard_plan_quota();
DROP TRIGGER IF EXISTS orbit_leads_plan_quota ON public.leads;
CREATE TRIGGER orbit_leads_plan_quota BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.orbit_guard_plan_quota();
NOTIFY pgrst,'reload schema';
COMMIT;

BEGIN;
CREATE TABLE IF NOT EXISTS public.orbit_registration_pending(email text PRIMARY KEY,name text NOT NULL,password_salt text NOT NULL,password_hash text NOT NULL,token_hash text UNIQUE NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS public.orbit_registration_rates(bucket text PRIMARY KEY,hits integer NOT NULL,reset_at timestamptz NOT NULL);
ALTER TABLE public.orbit_registration_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orbit_registration_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orbit_registration_pending,public.orbit_registration_rates FROM public,anon,authenticated;
GRANT ALL ON public.orbit_registration_pending,public.orbit_registration_rates TO service_role;

CREATE OR REPLACE FUNCTION public.orbit_registration_request(p_email text,p_name text,p_password_salt text,p_password_hash text,p_token_hash text,p_ip_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer; k text;
BEGIN
 DELETE FROM public.orbit_registration_rates WHERE reset_at<now()-interval '1 day';
 DELETE FROM public.orbit_registration_pending WHERE expires_at<now();
 FOREACH k IN ARRAY ARRAY['ip:'||p_ip_hash,'email:'||p_email] LOOP
  INSERT INTO public.orbit_registration_rates(bucket,hits,reset_at) VALUES(k,1,now()+interval '1 hour')
  ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN orbit_registration_rates.reset_at<now() THEN 1 ELSE orbit_registration_rates.hits+1 END,reset_at=CASE WHEN orbit_registration_rates.reset_at<now() THEN now()+interval '1 hour' ELSE orbit_registration_rates.reset_at END RETURNING hits INTO n;
  IF n>(CASE WHEN k LIKE 'ip:%' THEN 10 ELSE 3 END) THEN RETURN false; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.app_users WHERE lower(email)=p_email) OR p_email='caue.oliveira.ribeiro@gmail.com' THEN RETURN false; END IF;
 INSERT INTO public.orbit_registration_pending VALUES(p_email,p_name,p_password_salt,p_password_hash,p_token_hash,now()+interval '30 minutes')
 ON CONFLICT(email) DO UPDATE SET name=excluded.name,password_salt=excluded.password_salt,password_hash=excluded.password_hash,token_hash=excluded.token_hash,expires_at=excluded.expires_at;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.orbit_registration_confirm(p_token_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pending public.orbit_registration_pending; new_id uuid;
BEGIN
 DELETE FROM public.orbit_registration_pending WHERE token_hash=p_token_hash AND expires_at>now() RETURNING * INTO pending;
 IF NOT FOUND THEN RETURN false; END IF;
 IF pending.email='caue.oliveira.ribeiro@gmail.com' THEN RETURN false; END IF;
 INSERT INTO public.app_users(name,email,password_salt,password_hash) VALUES(pending.name,pending.email,pending.password_salt,pending.password_hash) ON CONFLICT(email) DO NOTHING RETURNING id INTO new_id;
 IF new_id IS NULL THEN RETURN false; END IF;
 -- No subscription or owner assignment is granted during registration.
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.orbit_plan_usage(p_user_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('clients',(SELECT count(*) FROM public.clients WHERE user_id=p_user_id),'activeLeads',(SELECT count(*) FROM public.leads WHERE user_id=p_user_id AND NOT coalesce(archived,false) AND coalesce(status,'New') NOT IN ('Client','Won','Lost')),'archivedLeads',(SELECT count(*) FROM public.leads WHERE user_id=p_user_id AND coalesce(archived,false)))
$$;
REVOKE ALL ON FUNCTION public.orbit_registration_request(text,text,text,text,text,text),public.orbit_registration_confirm(text),public.orbit_plan_usage(uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.orbit_registration_request(text,text,text,text,text,text),public.orbit_registration_confirm(text),public.orbit_plan_usage(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
BEGIN;
CREATE TABLE IF NOT EXISTS public.orbit_plan_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor uuid NOT NULL,target uuid NOT NULL,plan text NOT NULL,status text NOT NULL,access_until timestamptz,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.orbit_plan_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orbit_plan_audit FROM public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.orbit_assign_plan(p_actor uuid,p_target uuid,p_plan text,p_status text,p_until timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_actor NOT IN ('00000000-0000-4000-8000-000000000001'::uuid,'c38a52ed-766f-47b1-abbd-bc8e152dcaa9'::uuid) OR p_actor IS NULL THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
 IF p_target IN ('00000000-0000-4000-8000-000000000001'::uuid,'c38a52ed-766f-47b1-abbd-bc8e152dcaa9'::uuid) OR NOT EXISTS(SELECT 1 FROM public.app_users WHERE id=p_target) THEN RAISE EXCEPTION 'INVALID_TARGET'; END IF;
 IF p_plan IS NULL OR p_plan NOT IN ('personal','small_business','big_business') OR p_status IS NULL OR p_status NOT IN ('active','inactive','past_due','canceled') OR (p_status='active' AND (p_until IS NULL OR p_until<=now())) THEN RAISE EXCEPTION 'INVALID_ASSIGNMENT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_target::text,0));
 INSERT INTO public.account_subscriptions(user_id,plan,status,access_until) VALUES(p_target,p_plan,p_status,p_until) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,access_until=excluded.access_until,updated_at=now();
 INSERT INTO public.orbit_plan_audit(actor,target,plan,status,access_until) VALUES(p_actor,p_target,p_plan,p_status,p_until);
END $$;
REVOKE ALL ON FUNCTION public.orbit_assign_plan(uuid,uuid,text,text,timestamptz) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.orbit_assign_plan(uuid,uuid,text,text,timestamptz) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
