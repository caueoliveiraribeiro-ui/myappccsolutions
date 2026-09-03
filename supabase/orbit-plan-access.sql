-- Orbit only. Manual entitlements until verified Stripe webhooks are installed.
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
