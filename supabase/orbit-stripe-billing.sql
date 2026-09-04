-- Orbit LM Stripe billing.
-- Additive migration. Does not delete Paddle billing data.

BEGIN;

CREATE TABLE IF NOT EXISTS public.orbit_stripe_subscriptions(
  user_id uuid PRIMARY KEY REFERENCES public.app_users(id),
  subscription_id text NOT NULL UNIQUE,
  customer_id text NOT NULL,
  plan text NOT NULL CHECK(plan IN ('personal','small_business','big_business')),
  status text NOT NULL,
  paid_until timestamptz,
  observed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orbit_stripe_events(
  event_id text PRIMARY KEY,
  subscription_id text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orbit_password_setup_tokens(
  user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orbit_stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orbit_stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orbit_password_setup_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.orbit_stripe_subscriptions,
  public.orbit_stripe_events,
  public.orbit_password_setup_tokens
FROM public, anon, authenticated;

GRANT ALL ON
  public.orbit_stripe_subscriptions,
  public.orbit_stripe_events,
  public.orbit_password_setup_tokens
TO service_role;


-- Create an Orbit account after a verified Stripe Checkout if one
-- does not already exist.
--
-- The password supplied here is an unreachable random placeholder.
-- The customer will replace it through the one-time setup link.
CREATE OR REPLACE FUNCTION public.orbit_stripe_provision_user(
  p_email text,
  p_name text,
  p_password_salt text,
  p_password_hash text,
  p_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  normalized_email text;
  existing_id uuid;
  created_user boolean := false;
BEGIN
  normalized_email := lower(trim(p_email));

  IF
    normalized_email IS NULL OR
    normalized_email = '' OR
    length(normalized_email) > 254 OR
    normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;

  -- Protect the special Orbit owner identity from anonymous checkout.
  IF normalized_email = 'caue.oliveira.ribeiro@gmail.com' THEN
    RAISE EXCEPTION 'OWNER_PROTECTED';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(normalized_email, 1901)
  );

  SELECT id
  INTO existing_id
  FROM public.app_users
  WHERE lower(email) = normalized_email
  LIMIT 1;

  IF existing_id IS NULL THEN
    INSERT INTO public.app_users(
      name,
      email,
      password_salt,
      password_hash
    )
    VALUES(
      left(
        coalesce(
          nullif(trim(p_name), ''),
          split_part(normalized_email, '@', 1),
          'Orbit User'
        ),
        80
      ),
      normalized_email,
      p_password_salt,
      p_password_hash
    )
    RETURNING id INTO existing_id;

    created_user := true;

    INSERT INTO public.orbit_password_setup_tokens(
      user_id,
      token_hash,
      expires_at
    )
    VALUES(
      existing_id,
      p_token_hash,
      now() + interval '24 hours'
    )
    ON CONFLICT(user_id)
    DO UPDATE SET
      token_hash = excluded.token_hash,
      expires_at = excluded.expires_at,
      created_at = now();
  END IF;

  RETURN jsonb_build_object(
    'user_id', existing_id,
    'created', created_user
  );
END
$$;


-- Securely bind the Stripe subscription produced by Checkout
-- to the Orbit user before entitlement is granted.
CREATE OR REPLACE FUNCTION public.orbit_stripe_bind_subscription(
  p_user uuid,
  p_subscription text,
  p_customer text,
  p_plan text,
  p_observed timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  prior public.orbit_stripe_subscriptions;
BEGIN
  IF p_user IN (
    '00000000-0000-4000-8000-000000000001'::uuid,
    'c38a52ed-766f-47b1-abbd-bc8e152dcaa9'::uuid
  ) THEN
    RAISE EXCEPTION 'OWNER_PROTECTED';
  END IF;

  IF NOT EXISTS(
    SELECT 1
    FROM public.app_users
    WHERE id = p_user
  ) THEN
    RAISE EXCEPTION 'INVALID_USER';
  END IF;

  IF p_plan NOT IN (
    'personal',
    'small_business',
    'big_business'
  ) THEN
    RAISE EXCEPTION 'INVALID_PLAN';
  END IF;

  IF
    p_subscription IS NULL OR
    p_subscription !~ '^sub_' OR
    p_customer IS NULL OR
    p_customer !~ '^cus_'
  THEN
    RAISE EXCEPTION 'INVALID_STRIPE_BINDING';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user::text, 1902)
  );

  SELECT *
  INTO prior
  FROM public.orbit_stripe_subscriptions
  WHERE user_id = p_user
  FOR UPDATE;

  IF
    prior.subscription_id IS NOT NULL AND
    prior.subscription_id <> p_subscription AND
    prior.status NOT IN ('canceled','incomplete_expired')
  THEN
    RAISE EXCEPTION 'ORBIT_SUBSCRIPTION_EXISTS';
  END IF;

  INSERT INTO public.orbit_stripe_subscriptions(
    user_id,
    subscription_id,
    customer_id,
    plan,
    status,
    observed_at
  )
  VALUES(
    p_user,
    p_subscription,
    p_customer,
    p_plan,
    'pending',
    p_observed
  )
  ON CONFLICT(user_id)
  DO UPDATE SET
    subscription_id = excluded.subscription_id,
    customer_id = excluded.customer_id,
    plan = excluded.plan,
    status = excluded.status,
    observed_at = excluded.observed_at,
    updated_at = now();

  RETURN '{"bound":true}'::jsonb;
END
$$;


-- Apply a verified Stripe subscription lifecycle event.
--
-- A plan change is only applied when p_paid=true.
-- That prevents an unpaid upgrade from granting additional access.
CREATE OR REPLACE FUNCTION public.orbit_apply_stripe_event(
  p_event text,
  p_observed timestamptz,
  p_user uuid,
  p_subscription text,
  p_customer text,
  p_plan text,
  p_status text,
  p_paid_until timestamptz,
  p_paid boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  prior public.orbit_stripe_subscriptions;
  effective_plan text;
  effective_until timestamptz;
  access_status text;
BEGIN
  IF EXISTS(
    SELECT 1
    FROM public.orbit_stripe_events
    WHERE event_id = p_event
  ) THEN
    RETURN '{"duplicate":true}'::jsonb;
  END IF;

  IF p_user IN (
    '00000000-0000-4000-8000-000000000001'::uuid,
    'c38a52ed-766f-47b1-abbd-bc8e152dcaa9'::uuid
  ) THEN
    RETURN '{"ignored":true}'::jsonb;
  END IF;

  IF p_plan NOT IN (
    'personal',
    'small_business',
    'big_business'
  ) THEN
    RAISE EXCEPTION 'INVALID_PLAN';
  END IF;

  IF p_status NOT IN (
    'active',
    'trialing',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused'
  ) THEN
    RAISE EXCEPTION 'INVALID_SUBSCRIPTION_STATUS';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user::text, 1902)
  );

  SELECT *
  INTO prior
  FROM public.orbit_stripe_subscriptions
  WHERE user_id = p_user
  FOR UPDATE;

  IF prior.subscription_id IS NULL THEN
    RAISE EXCEPTION 'UNBOUND_SUBSCRIPTION';
  END IF;

  IF prior.subscription_id <> p_subscription THEN
    RAISE EXCEPTION 'SUBSCRIPTION_MISMATCH';
  END IF;

  IF prior.customer_id <> p_customer THEN
    RAISE EXCEPTION 'CUSTOMER_MISMATCH';
  END IF;

  IF prior.observed_at > p_observed THEN
    RAISE EXCEPTION 'RETRY_STALE_SNAPSHOT';
  END IF;

  effective_plan :=
    CASE
      WHEN p_paid THEN p_plan
      ELSE prior.plan
    END;

  effective_until :=
    CASE
      WHEN p_paid AND p_paid_until IS NOT NULL
        THEN greatest(prior.paid_until, p_paid_until)
      ELSE prior.paid_until
    END;

  access_status :=
    CASE
      WHEN
        p_status IN ('active','trialing') AND
        effective_until IS NOT NULL AND
        effective_until > now()
      THEN 'active'

      WHEN p_status = 'past_due'
      THEN 'past_due'

      WHEN p_status IN ('canceled','incomplete_expired')
      THEN 'canceled'

      ELSE 'inactive'
    END;

  UPDATE public.orbit_stripe_subscriptions
  SET
    plan = effective_plan,
    status = p_status,
    paid_until = effective_until,
    observed_at = p_observed,
    updated_at = now()
  WHERE user_id = p_user;

  INSERT INTO public.account_subscriptions(
    user_id,
    plan,
    status,
    access_until,
    stripe_customer_id,
    stripe_subscription_id
  )
  VALUES(
    p_user,
    effective_plan,
    access_status,
    effective_until,
    p_customer,
    p_subscription
  )
  ON CONFLICT(user_id)
  DO UPDATE SET
    plan = excluded.plan,
    status = excluded.status,
    access_until = excluded.access_until,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    updated_at = now();

  INSERT INTO public.orbit_stripe_events(
    event_id,
    subscription_id
  )
  VALUES(
    p_event,
    p_subscription
  );

  RETURN '{"received":true}'::jsonb;
END
$$;


REVOKE ALL ON FUNCTION
  public.orbit_stripe_provision_user(text,text,text,text,text),
  public.orbit_stripe_bind_subscription(uuid,text,text,text,timestamptz),
  public.orbit_apply_stripe_event(text,timestamptz,uuid,text,text,text,text,timestamptz,boolean)
FROM public,anon,authenticated;

GRANT EXECUTE ON FUNCTION
  public.orbit_stripe_provision_user(text,text,text,text,text),
  public.orbit_stripe_bind_subscription(uuid,text,text,text,timestamptz),
  public.orbit_apply_stripe_event(text,timestamptz,uuid,text,text,text,text,timestamptz,boolean)
TO service_role;

NOTIFY pgrst,'reload schema';

COMMIT;
-- Consume a Stripe-created password setup token exactly once
-- and replace the temporary internal password.

CREATE OR REPLACE FUNCTION public.orbit_stripe_set_password(
  p_token_hash text,
  p_password_salt text,
  p_password_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  target_user uuid;
BEGIN
  IF
    p_token_hash IS NULL OR
    length(p_token_hash) <> 64 OR
    p_password_salt IS NULL OR
    p_password_hash IS NULL
  THEN
    RETURN false;
  END IF;

  DELETE FROM public.orbit_password_setup_tokens
  WHERE
    token_hash = p_token_hash
    AND expires_at > now()
  RETURNING user_id INTO target_user;

  IF target_user IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.app_users
  SET
    password_salt = p_password_salt,
    password_hash = p_password_hash
  WHERE id = target_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORBIT_USER_NOT_FOUND';
  END IF;

  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION
  public.orbit_stripe_set_password(text,text,text)
FROM public,anon,authenticated;

GRANT EXECUTE ON FUNCTION
  public.orbit_stripe_set_password(text,text,text)
TO service_role;

NOTIFY pgrst,'reload schema';