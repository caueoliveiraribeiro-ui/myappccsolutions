# Orbit UI and safety review — September 8, 2026

## Shipped changes
- Light/dark dashboard preference, saved per browser, synchronized across browser tabs. Toggle beside sidebar collapse; stacked in the compact sidebar.
- Light surfaces and readable form/chart colors; cyan/purple brand retained. Financial orange and baby-blue cards retained.
- Refined card shapes, focus indicators, ambient fade and headline motion. Login form drift pauses while typing. Reduced-motion mode disables decorative CSS motion.
- Safe DOM creation for profile avatar (no HTML interpolation).
- Browser headers: nosniff, same-origin framing, strict-origin referrers, camera/microphone disabled.
- Invoice POST checks linked client/project ownership before insertion.
- Client edit no longer claims success before the server confirms it; duplicate lead-delete toast removed.
- Patched transitive PostCSS 8.5.28 and Sharp 0.35.3, pinned with workspace overrides and lockfile.

## Verification
- 13 regression suites pass, including plan isolation, authentication, financial conversions and invoice foreign-owner rejection.
- Browser tests with mocked data: 1440px desktop, 375px mobile, theme toggle/persistence, compact sidebar, mobile navigation, reduced motion and no uncaught page errors.
- Production dependency audit: zero known advisories after updates. Sharp image-generation smoke test passed.
- Supabase security advisor: no WARN/ERROR results. 37 informational RLS-without-policy notices reflect the server-only custom-auth data model; do not add permissive policies to silence them. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Read-only live checks: clients API 401, admin support 403, invoice cron 401 without credentials. GET /api/invoices is unsupported (405), not an authentication test.
- Billing-reminder and upcoming-payment cron jobs active; most recent runs succeeded. Retention cleanup active; no run yet at review time.

## Invoice automation correction
Confirmed the old SQL email regex rejected ui@example.com. Replaced the escaped-dot pattern with a character class. Added a per-owner transaction advisory lock to serialize overlapping draft runs. Preserved the two-days-before date rule, archived-client exclusion, branding and draft status. Applied migration: invoice_draft_email_and_concurrency_guard. Verified stored definition and executed against a random nonexistent workspace inside a rolled-back transaction.

```sql
do $block$
declare definition text; original text;
begin
 select pg_get_functiondef('public.orbit_create_invoice_drafts(uuid)'::regprocedure) into definition;
 original := definition;
 definition := regexp_replace(definition, '^      and email ~.*$', '      and email ~ ''^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$''', 'm');
 if position('invoice-drafts:' in definition)=0 then
 definition := replace(definition, E'begin\n  select', E'begin\n  perform pg_advisory_xact_lock(hashtextextended(''invoice-drafts:'' || p_owner::text, 0));\n  select');
 end if;
 if position('invoice-drafts:' in definition)=0 or position('[.][^@[:space:]]+$' in definition)=0 then raise exception 'Unexpected draft function shape'; end if;
 execute definition;
end $block$;
```

## Limits and next improvements
This is a targeted engineering review, not a complete penetration test or certification that all app paths are bug-free. Authenticated production mutations, real email delivery and checkout charges were not exercised. Invoice cron shown here creates drafts; email delivery needs a separate end-to-end test.
- Gradually replace hard-coded color utilities with semantic theme tokens; the compatibility layer minimizes disruption but needs visual review when new screens are added.
- Upgrade Recharts 2 to supported v3 in its own tested change, not alongside theme work.
- Add durable monitoring/alerts for failed scheduled jobs and delivery attempts.
- Add a unique client/due-date invariant for automated invoices after auditing historical duplicates; advisory locking currently protects concurrent runs of this generator.
- Automate multi-plan, multi-workspace browser tests with populated fixtures and real integration sandbox accounts.

## References
- [Theme hydration/persistence](https://github.com/pacocoursey/next-themes)
- [Sharp advisory](https://github.com/advisories/GHSA-f88m-g3jw-g9cj)
- [PostCSS advisory](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)
- [Postgres advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)

