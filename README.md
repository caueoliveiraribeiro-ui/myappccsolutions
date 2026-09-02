# Orbit CRM

Secure Next.js CRM for global lead discovery, creative-service sales and stock/crypto tracking.

## Local setup

1. Run `pnpm install`.
2. Run `pnpm credentials` and copy the generated values to a new `.env.local`.
3. Add an optional `GOOGLE_PLACES_API_KEY` with Places API (New) enabled.
4. Run `pnpm dev`.

## Vercel deployment

Import this folder in Vercel, then add every variable shown in `.env.example` under Project Settings → Environment Variables. Generate credentials locally; never place the real values in source control.

The Google lead finder uses the official Places Text Search API and retains only results with no website listed. Restrict the Google key to the Places API and your production environment.

## Security notes

- Passwords are compared against a scrypt hash and are never stored in plaintext.
- Login uses constant-time comparison, generic failures, basic IP rate limiting and a signed HTTP-only, SameSite=Strict session cookie.
- Production cookies are Secure.
- Rotate `SESSION_SECRET` and the administrator password if either is exposed.
- For a multi-user deployment, replace the single-owner authentication with an external identity provider and a persistent server-side rate limiter.

## Data

The current build saves CRM and portfolio records in the signed-in browser. This makes the app immediately usable on one device without a database. For multi-device/team use, connect the models to a hosted database before entering critical business data.

Airbnb is treated as a research source only. The app does not scrape Airbnb; use authorized or manually collected public information and follow platform terms and local privacy/marketing laws.

