-- Orbit LM Hotmart billing support.
-- Additive migration. Keeps existing Stripe/Paddle data intact.

BEGIN;

ALTER TABLE public.account_subscriptions
  ADD COLUMN IF NOT EXISTS billing_provider text,
  ADD COLUMN IF NOT EXISTS hotmart_subscriber_code text,
  ADD COLUMN IF NOT EXISTS hotmart_offer_code text;

CREATE TABLE IF NOT EXISTS public.orbit_hotmart_subscriptions(
  user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  subscriber_code text UNIQUE,
  offer_code text NOT NULL,
  plan text NOT NULL CHECK(plan IN ('personal','small_business','big_business')),
  status text NOT NULL,
  paid_until timestamptz,
  observed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orbit_hotmart_events(
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  transaction_id text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orbit_hotmart_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orbit_hotmart_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.orbit_hotmart_subscriptions, public.orbit_hotmart_events
FROM public, anon, authenticated;

GRANT ALL ON public.orbit_hotmart_subscriptions, public.orbit_hotmart_events
TO service_role;

NOTIFY pgrst,'reload schema';

COMMIT;
