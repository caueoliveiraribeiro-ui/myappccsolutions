# Due-date invoice delivery

The existing production cron runs daily at 08:00 UTC. It creates drafts for
clients due in two days, then sends eligible automatically generated drafts due
today. Manual drafts, paid/void invoices, previously sent invoices, inactive
plans, and archived/deleted clients are excluded. No overdue backlog is mailed.

The PDF uses the saved invoice logo/address/description snapshot, exactly like
manual export. Replies go to the workspace owner's email.

Both manual send and cron use an atomic database claim. Provider retries use the
same payload and idempotency key. Successful acceptance records provider ID and
sent time. This means accepted by the email provider, not guaranteed inbox delivery.

Uncertain failures are held, not blindly resent after Resend's 24-hour deduplication
window. Check INVOICE_EMAIL_REVIEW_REQUIRED in Vercel and the provider's email
records before an operator clears a claim. If accepted, reconcile sent_at/status
instead of sending again. Never reset a claim just because its HTTP request timed out.

The daily sweep is bounded to 200 records and a 220-second processing budget.
An incomplete batch is logged as an error requiring operator review on the same
UTC date. Increase scheduling/queue capacity before growing beyond this volume.
Required production variables: CRON_SECRET, RESEND_API_KEY, RESEND_FROM_EMAIL.

After applying invoice-billing-cycle.sql, confirmed sends set Awaiting payment.
The matching client's current charge date advances one calendar month (clamped
to the last valid day) or 14 days for biweekly billing. One-time billing clears
the next charge date. Dates already moved by the user and archived clients are
not overwritten. Duplicate completion calls do not advance the date again.
The update is transactional with the invoice status. This does not mark income
as received or alter existing payment records. No historical dates are backfilled.

Database SQL is recorded in invoice-due-date-send.sql and applied through the
Supabase migration API. The local CLI was unavailable due to a configuration
directory permission error. Regression tests never send real email.
