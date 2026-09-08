# Production domain

The canonical Orbit app address is https://orbit-lm.com.
Keep the Vercel project `ccsolutionsme/myappccsolutions`: it serves the app and its API routes.
The `www.orbit-lm.com` domain redirects to the canonical address.
Removing a secondary domain alias is not the same as deleting the project or Production environment.

## External integrations

- Google Calendar OAuth callback: `https://orbit-lm.com/api/calendar/callback`
- Hotmart notifications: `https://orbit-lm.com/api/webhooks/hotmart`
- Retained Stripe notifications: `https://orbit-lm.com/api/webhooks/stripe`
- Verify these URLs in the respective provider consoles before retiring any secondary domain.
- Existing customers' billing must be managed at their payment provider; source removal does not cancel a subscription.

## Retired integration

The unused legacy billing integration was removed on 2026-09-08. Its three tables were verified empty before removal, along with its two RPCs. Other billing tables and entitlements were preserved. The applied database migration is `retire_unused_billing_provider`.
Source deletions are recoverable through Git history.

