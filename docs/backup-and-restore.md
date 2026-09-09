# Orbit LM backup and recovery runbook

## Daily protection

Supabase provides managed database backups. Orbit’s archive flow is a separate convenience feature: deleted leads, clients, and projects remain recoverable for three months, but it is not a substitute for backups.

## Monthly restore drill

1. In Supabase, create a database backup or point-in-time restore in a separate non-production project.
2. Confirm the restored project contains representative accounts, invoices, payment records, client billing dates, and financial audit records.
3. Confirm RLS is enabled and that anonymous users cannot read invoices or subscriptions.
4. Do not connect the restored project to Hotmart, Resend, or production Google OAuth.
5. Record the drill date, restore point, duration, and result in the owner’s operations notes.

## Incident recovery

1. Pause affected automations and rotate any exposed provider secret in Vercel.
2. Identify the last known-good point in Supabase.
3. Restore into a separate project first and validate the data and access controls.
4. Obtain owner approval before routing production traffic or credentials to the restored environment.
5. Re-enable Hotmart, email, and invoice automation only after a controlled test succeeds.

## What must be retained independently

- Vercel production environment-variable inventory (names only, never secret values)
- Resend domain and sender setup
- Hotmart webhook URL and shared secret location
- Google OAuth consent and redirect configuration
- A current owner emergency-access and MFA recovery procedure
