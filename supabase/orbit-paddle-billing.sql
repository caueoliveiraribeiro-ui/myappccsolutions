-- Orbit LM only. Additive migration; no business records or existing entitlements deleted.
BEGIN;
CREATE TABLE IF NOT EXISTS public.orbit_paddle_checkouts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.app_users(id),
 plan text NOT NULL CHECK(plan IN ('personal','small_business','big_business')),
 price_id text NOT NULL,
 transaction_id text UNIQUE,customer_id text,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','completed','expired')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS orbit_one_pending_checkout ON public.orbit_paddle_checkouts(user_id) WHERE state='pending';
CREATE TABLE IF NOT EXISTS public.orbit_paddle_subscriptions(
 user_id uuid PRIMARY KEY REFERENCES public.app_users(id),
 subscription_id text NOT NULL UNIQUE,customer_id text NOT NULL,
 plan text NOT NULL CHECK(plan IN ('personal','small_business','big_business')),
 status text NOT NULL,paid_until timestamptz,refunded_until timestamptz,
 last_transaction_id text,observed_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.orbit_paddle_events(
 event_id text PRIMARY KEY,subscription_id text NOT NULL,
 processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orbit_paddle_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orbit_paddle_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orbit_paddle_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orbit_paddle_checkouts,public.orbit_paddle_subscriptions,public.orbit_paddle_events FROM public,anon,authenticated;
GRANT ALL ON public.orbit_paddle_checkouts,public.orbit_paddle_subscriptions,public.orbit_paddle_events TO service_role;

CREATE OR REPLACE FUNCTION public.orbit_begin_paddle_checkout(p_user uuid,p_plan text,p_price text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE item public.orbit_paddle_checkouts; expected text;
BEGIN
 IF p_user IN ('00000000-0000-4000-8000-000000000001'::uuid,'c38a52ed-766f-47b1-abbd-bc8e152dcaa9'::uuid) THEN RAISE EXCEPTION 'OWNER_PROTECTED'; END IF;
 expected:=CASE p_plan WHEN 'personal' THEN 'pri_01m1k78k8ch7vb99p81x4fms3y' WHEN 'small_business' THEN 'pri_01m1k79h2fwkwvpdnkk8vj1wsn' WHEN 'big_business' THEN 'pri_01m1k7abwhe5wvzqeax5hqj3ej' ELSE NULL END;
 IF expected IS NULL OR p_price IS DISTINCT FROM expected THEN RAISE EXCEPTION 'INVALID_PLAN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,1701));
 IF EXISTS(SELECT 1 FROM public.orbit_paddle_subscriptions WHERE user_id=p_user AND status<>'canceled') THEN RAISE EXCEPTION 'ORBIT_SUBSCRIPTION_EXISTS'; END IF;
 SELECT * INTO item FROM public.orbit_paddle_checkouts WHERE user_id=p_user AND state='pending';
 IF FOUND THEN
   -- Do not expire a prepared transaction: an old checkout link could still be paid.
   IF item.transaction_id IS NOT NULL THEN
     IF item.plan<>p_plan THEN RAISE EXCEPTION 'ORBIT_CHECKOUT_BUSY'; END IF;
     RETURN to_jsonb(item);
   END IF;
   IF item.created_at>now()-interval '15 minutes' THEN RAISE EXCEPTION 'ORBIT_CHECKOUT_BUSY'; END IF;
   UPDATE public.orbit_paddle_checkouts SET state='expired' WHERE id=item.id;
 END IF;
 INSERT INTO public.orbit_paddle_checkouts(user_id,plan,price_id) VALUES(p_user,p_plan,p_price) RETURNING * INTO item;
 RETURN to_jsonb(item);
END $$;

CREATE OR REPLACE FUNCTION public.orbit_apply_paddle_event(
 p_event text,p_observed timestamptz,p_sub text,p_user uuid,p_customer text,p_plan text,p_status text,
 p_paid_until timestamptz,p_checkout uuid,p_transaction text,p_refund boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE prior public.orbit_paddle_subscriptions; effective_until timestamptz; refund_until timestamptz; effective_plan text; access_status text;
BEGIN
 IF p_user IN ('00000000-0000-4000-8000-000000000001'::uuid,'c38a52ed-766f-47b1-abbd-bc8e152dcaa9'::uuid) THEN RETURN '{"ignored":true}'::jsonb; END IF;
 IF p_plan NOT IN ('personal','small_business','big_business') OR p_status NOT IN ('active','past_due','paused','canceled','trialing') THEN RAISE EXCEPTION 'INVALID_SUBSCRIPTION'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,1701));
 IF EXISTS(SELECT 1 FROM public.orbit_paddle_events WHERE event_id=p_event) THEN RETURN '{"duplicate":true}'::jsonb; END IF;
 SELECT * INTO prior FROM public.orbit_paddle_subscriptions WHERE user_id=p_user FOR UPDATE;
 IF prior.subscription_id IS DISTINCT FROM p_sub THEN
   IF p_checkout IS NULL OR p_paid_until IS NULL OR p_refund THEN RAISE EXCEPTION 'UNBOUND_SUBSCRIPTION'; END IF;
   IF prior.subscription_id IS NOT NULL AND prior.status<>'canceled' THEN RAISE EXCEPTION 'ORBIT_SUBSCRIPTION_EXISTS'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.orbit_paddle_checkouts WHERE id=p_checkout AND user_id=p_user AND plan=p_plan AND transaction_id=p_transaction) THEN RAISE EXCEPTION 'INVALID_CHECKOUT'; END IF;
   prior:=NULL;
 ELSE
   IF prior.customer_id<>p_customer THEN RAISE EXCEPTION 'CUSTOMER_MISMATCH'; END IF;
 END IF;
 -- Observed snapshots are monotonic. Paid events still retry until they can safely be applied.
 IF prior.observed_at>p_observed THEN RAISE EXCEPTION 'RETRY_STALE_SNAPSHOT'; END IF;
 effective_until:=greatest(prior.paid_until,p_paid_until);
 refund_until:=prior.refunded_until;
 IF p_refund AND p_transaction=prior.last_transaction_id THEN refund_until:=effective_until; END IF;
 -- A subscription update cannot grant an unpaid upgrade.
 effective_plan:=CASE WHEN p_paid_until IS NOT NULL THEN p_plan ELSE coalesce(prior.plan,p_plan) END;
 access_status:=CASE WHEN p_status='active' AND effective_until>now() AND (refund_until IS NULL OR effective_until>refund_until) THEN 'active'
   WHEN p_status='past_due' THEN 'past_due' WHEN p_status='canceled' THEN 'canceled' ELSE 'inactive' END;
 INSERT INTO public.orbit_paddle_subscriptions(user_id,subscription_id,customer_id,plan,status,paid_until,refunded_until,last_transaction_id,observed_at)
 VALUES(p_user,p_sub,p_customer,effective_plan,p_status,effective_until,refund_until,CASE WHEN p_paid_until IS NOT NULL AND p_paid_until>=coalesce(prior.paid_until,p_paid_until) THEN p_transaction ELSE prior.last_transaction_id END,p_observed)
 ON CONFLICT(user_id) DO UPDATE SET subscription_id=excluded.subscription_id,customer_id=excluded.customer_id,plan=excluded.plan,status=excluded.status,
 paid_until=excluded.paid_until,refunded_until=excluded.refunded_until,last_transaction_id=excluded.last_transaction_id,observed_at=excluded.observed_at,updated_at=now();
 INSERT INTO public.account_subscriptions(user_id,plan,status,access_until)
 VALUES(p_user,effective_plan,access_status,effective_until)
 ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,access_until=excluded.access_until,updated_at=now();
 IF p_checkout IS NOT NULL THEN UPDATE public.orbit_paddle_checkouts SET state='completed' WHERE id=p_checkout AND user_id=p_user; END IF;
 INSERT INTO public.orbit_paddle_events(event_id,subscription_id) VALUES(p_event,p_sub);
 RETURN '{"received":true}'::jsonb;
END $$;
REVOKE ALL ON FUNCTION public.orbit_begin_paddle_checkout(uuid,text,text) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.orbit_apply_paddle_event(text,timestamptz,text,uuid,text,text,text,timestamptz,uuid,text,boolean) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.orbit_begin_paddle_checkout(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.orbit_apply_paddle_event(text,timestamptz,text,uuid,text,text,text,timestamptz,uuid,text,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
