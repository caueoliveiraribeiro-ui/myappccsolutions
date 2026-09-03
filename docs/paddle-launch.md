# Orbit LM — Paddle launch checklist

## Implemented
- Personal: pri_01m1k78k8ch7vb99p81x4fms3y — USD 29.99/month.
- Small Business: pri_01m1k79h2fwkwvpdnkk8vj1wsn — USD 99.99/month.
- Big Business: pri_01m1k7abwhe5wvzqeax5hqj3ej — USD 189.99/month.
- Only authenticated, verified Orbit accounts can start checkout. Account identity comes from the session, never a submitted user ID or payment email.
- Existing plan feature/limit guards remain authoritative. Owner IDs cannot be charged or reassigned.
- Payment, subscription, and refund events use verified signatures, live API checks, persisted transaction/account bindings, atomic database writes and duplicate-event protection.
- Paid subscriptions are independent of customer projects/payment ledgers; subscription purchases do not become the customer's business income.
- Failed/paused/canceled subscriptions cannot grant access. Scheduled cancellation retains access through the already-paid period while Paddle status remains active.
- Full refunds/chargebacks of the current paid transaction suspend that period; refunds of older periods do not suspend a newer paid period.
- No price ID grants access to another user's workspace.
- Landing-page visuals remain unchanged. Standard cards link to /subscribe?plan=personal, small_business, or big_business.

## Deliberately not enabled
- Live checkout is fail-closed unless PADDLE_CHECKOUT_ENABLED=true and all required live credentials are configured.
- Business Customization ID pri_01m1k7b93xzr810gk1jv1wc3g1 is cataloged, NOT accepted by standard checkout. Confirm initial USD 599.99 and recurring USD 299.99 price IDs before implementing separate onboarding.
- Invite Friend ID pri_01m1kbfnsgsz1z9jmv2kxg0vkc is cataloged, NOT accepted by standard checkout. The paid invitation/password-setup/shared-workspace flow is still a separate pending implementation. Legacy collaboration is unchanged.
- Existing Paddle purchases outside the account-bound Orbit checkout do not automatically claim an account. They require a verified migration/assignment.
- Automatic plan switching/proration is not implemented. New checkout is blocked when a non-canceled Paddle subscription exists, preventing double subscriptions.
- An abandoned prepared checkout is reused for the same plan. Changing that pending offer requires canceling the old transaction and expiring its intent through an owner operation; do not delete a binding for a payable transaction.

## Production setup (main app project myappccsolutions, not the landing project)
1. Run supabase/orbit-paddle-billing.sql in Orbit's Supabase project puzjrhlksgdrieopupgu. Migration is additive, rerunnable and does not change current entitlements.
2. In Vercel Settings > Environment Variables > Production:
   PADDLE_ENV=production
   PADDLE_API_KEY=<live secret API key>
   PADDLE_WEBHOOK_SECRET=<notification destination secret>
   NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=<live client-side token>
   PADDLE_CHECKOUT_ENABLED=false
3. API key permissions: read prices, customers, subscriptions, transactions, adjustments; write customers, transactions, customer portal sessions. Keep the secret API key server-only. Never prefix it NEXT_PUBLIC.
4. In Paddle's live dashboard, approve the main app checkout domain and configure a default payment link for https://orbit-lifemanagement.vercel.app/subscribe?plan=personal.
5. Add a URL notification destination:
   https://orbit-lifemanagement.vercel.app/api/webhooks/paddle
   Subscribe to transaction.completed; subscription.created, subscription.activated, subscription.updated, subscription.resumed, subscription.paused, subscription.canceled, subscription.past_due; adjustment.updated.
6. Copy that destination's secret into PADDLE_WEBHOOK_SECRET in Vercel. Redeploy after changing environment variables.
7. Validate provider configuration and webhook delivery before changing PADDLE_CHECKOUT_ENABLED to true. Do not submit a live charge without explicit authorization.
8. Production IDs must not be reused against sandbox. Sandbox end-to-end checkout requires separate sandbox credentials and prices plus a sandbox-configured test deployment; this production checkout intentionally only accepts the supplied live catalog.
9. Check paid account isolation, assigned feature set/quotas, renewal, duplicate events, payment failures, cancellation, refund, and billing portal. A success-screen redirect alone must never grant access.

## Automated local checks
npx tsc --noEmit
node scripts/plan-access-regression.cjs
node scripts/registration-access-regression.cjs
node scripts/paddle-billing-regression.cjs
npm run build

For real PostgreSQL-compatible migration/transaction tests, set PGLITE_MODULE to an isolated installed @electric-sql/pglite directory before running paddle-billing-regression.cjs. This dependency is test-only, not an application dependency.

## Recovery
Webhook failures return non-2xx so Paddle retries. Inspect notification delivery errors without logging API secrets or full financial payloads.
Do not acknowledge failed database writes as success.
Existing manual owner controls remain available. Revoking entitlements does not delete customer business records.
