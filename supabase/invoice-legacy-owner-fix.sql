-- Back the legacy owner session with its required app_users record.
-- Does not modify existing users or legacy owner authentication.
INSERT INTO public.app_users (id, name, email, password_salt, password_hash)
VALUES ('00000000-0000-4000-8000-000000000001', 'Orbit Owner', 'legacy-owner@orbit.invalid', encode(gen_random_bytes(24), 'hex'), encode(gen_random_bytes(64), 'hex'))
ON CONFLICT (id) DO NOTHING;
