BEGIN;

CREATE TABLE IF NOT EXISTS public.orbit_password_reset_tokens(
  user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orbit_password_reset_rates(
  bucket text PRIMARY KEY,
  hits integer NOT NULL,
  reset_at timestamptz NOT NULL
);

ALTER TABLE public.orbit_password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orbit_password_reset_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orbit_password_reset_tokens, public.orbit_password_reset_rates FROM public, anon, authenticated;
GRANT ALL ON public.orbit_password_reset_tokens, public.orbit_password_reset_rates TO service_role;

CREATE OR REPLACE FUNCTION public.orbit_password_reset_request(
  p_email text,
  p_token_hash text,
  p_ip_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  normalized_email text;
  target_user uuid;
  n integer;
  k text;
BEGIN
  normalized_email := lower(trim(p_email));
  DELETE FROM public.orbit_password_reset_rates WHERE reset_at < now() - interval '1 day';
  DELETE FROM public.orbit_password_reset_tokens WHERE expires_at < now();

  FOREACH k IN ARRAY ARRAY['ip:' || p_ip_hash, 'email:' || normalized_email] LOOP
    INSERT INTO public.orbit_password_reset_rates(bucket,hits,reset_at)
    VALUES(k,1,now()+interval '1 hour')
    ON CONFLICT(bucket) DO UPDATE SET
      hits = CASE WHEN orbit_password_reset_rates.reset_at < now() THEN 1 ELSE orbit_password_reset_rates.hits + 1 END,
      reset_at = CASE WHEN orbit_password_reset_rates.reset_at < now() THEN now()+interval '1 hour' ELSE orbit_password_reset_rates.reset_at END
    RETURNING hits INTO n;

    IF n > (CASE WHEN k LIKE 'ip:%' THEN 10 ELSE 3 END) THEN
      RETURN false;
    END IF;
  END LOOP;

  SELECT id INTO target_user
  FROM public.app_users
  WHERE lower(email)=normalized_email
  LIMIT 1;

  IF target_user IS NULL THEN
    RETURN false;
  END IF;

  IF target_user IN (
    '00000000-0000-4000-8000-000000000001'::uuid,
    'c38a52ed-766f-47b1-abbd-bc8e152dcaa9'::uuid
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.orbit_password_reset_tokens(user_id,token_hash,expires_at)
  VALUES(target_user,p_token_hash,now()+interval '30 minutes')
  ON CONFLICT(user_id) DO UPDATE SET
    token_hash=excluded.token_hash,
    expires_at=excluded.expires_at,
    created_at=now();

  RETURN true;
END
$$;

CREATE OR REPLACE FUNCTION public.orbit_password_reset_consume(
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
  IF p_token_hash IS NULL OR length(p_token_hash)<>64 OR p_password_salt IS NULL OR p_password_hash IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.orbit_password_reset_tokens
  WHERE token_hash=p_token_hash AND expires_at>now()
  RETURNING user_id INTO target_user;

  IF target_user IS NULL THEN
    RETURN false;
  END IF;

  IF target_user IN (
    '00000000-0000-4000-8000-000000000001'::uuid,
    'c38a52ed-766f-47b1-abbd-bc8e152dcaa9'::uuid
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.app_users
  SET password_salt=p_password_salt,
      password_hash=p_password_hash
  WHERE id=target_user;

  RETURN FOUND;
END
$$;

REVOKE ALL ON FUNCTION public.orbit_password_reset_request(text,text,text), public.orbit_password_reset_consume(text,text,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.orbit_password_reset_request(text,text,text), public.orbit_password_reset_consume(text,text,text) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
