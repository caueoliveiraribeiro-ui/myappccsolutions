# Orbit plan access (manual assignments, before Stripe)

Applied only to Orbit LM. Registration stays closed. Checkout links and Stripe webhook provisioning are not implemented by this change.

## Features
- Personal: Overview, Stocks, Projects, Groceries, Expenses, Calendar, Today Focus, invitations.
- Small Business: Personal plus Crypto, Clients, Leads Management, History, Reports.
- Big Business: Small Business plus Tasks & Follow-ups and Pipeline.
- Owner: all features, no subscription expiry or database quotas.
- Settings, profile and logout remain accessible without an active assignment.

## Limits
- Small Business: 50 clients, 100 live leads, 50 archived leads.
- Big Business: unlimited clients, 300 live leads, 100 archived leads.
- Non-archived Client/Won/Lost leads are history, not live leads.
- Limits apply per record owner. Imports and restores pass through the same database triggers; imports roll back completely if they exceed the limit.
- Concurrent writes use a per-owner transaction advisory lock. Deleting a record releases capacity.
- Existing records are not deleted on downgrade; an over-limit account may edit existing records but cannot increase a capped bucket.

## Enforcement
`lib/plan-features.ts` is the UI/server feature map.
`lib/plan-access.ts` reads server-controlled `account_subscriptions` on requests. Non-owner assignments require an active status and a future access_until timestamp. Missing, expired and failed lookups deny access. Client requests cannot set their own plan.
Typed assets and tasks are filtered on reads and checked on writes. Crypto types cannot be changed to Stock to bypass a restriction. Today Focus uses kind=Focus.
Shared edits require editor membership and the feature on both the actor and the record owner's plans. Invitations never grant a higher plan; no team-seat limit has been invented. While registration is closed, invitations can only target existing accounts.
The Overview-only payment endpoint returns monthly received totals without client/payment identities or notes, preserving Personal's summary while keeping detailed ledger CRUD in Reports.
Tab content locks and access refreshes are presentation only; APIs enforce permissions independently.
The two verified owner account IDs are explicitly preserved in the code and migration. Editable email/profile fields cannot grant owner rights.

## Deployment and assignment
Apply `supabase/orbit-plan-access.sql` before deploying the API changes. This is additive and does not delete business records. Subscription RLS is enabled; anon/authenticated cannot modify assignments.
Administrators can assign a known existing account in the Supabase SQL editor by upserting user_id, plan, status='active', access_until. Verify the account UUID first. Do not accept these values from a checkout return URL or client body.
Future Stripe webhooks must verify Stripe signatures, bind checkout to the authenticated account, map trusted Price IDs to these plans, handle renewals/cancellations idempotently, and update access_until. Do not reopen signup until explicitly authorized.

## Verification
- `node scripts/plan-access-regression.cjs`
- `node scripts/orbit-payments-regression.cjs`
- `node scripts/workflow-regression.cjs`
- `node scripts/registration-closed-regression.cjs`
- `node scripts/session-account-regression.cjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `npm run build`
- `supabase/tests/orbit-plan-access-regression.sql`: transaction-only quota tests; all synthetic data rolled back.

