import { APP_ORIGIN } from "@/lib/registration"

export async function sendInviteAccountSetupEmail(email: string, token: string, inviterName: string) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!key || !from) throw new Error("ORBIT_SETUP_EMAIL_NOT_CONFIGURED")

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      from,
      to: [email],
      subject: `Create your Orbit LM login for ${inviterName}'s workspace`,
      text: `Your US$12.99/month shared-access subscription has been confirmed.\n\nCreate your own secure Orbit LM password using this one-time link:\n${APP_ORIGIN}/set-password?token=${token}\n\nAfter setting your password, sign in with ${email}. You will join ${inviterName}'s shared workspace with the access they selected for you. This link expires in 24 hours and can only be used once.`,
    }),
  })
  if (!response.ok) throw new Error(`ORBIT_INVITE_SETUP_EMAIL_FAILED:${response.status}`)
}
