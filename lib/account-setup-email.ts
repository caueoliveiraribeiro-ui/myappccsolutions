import { APP_ORIGIN } from "@/lib/registration"

export async function sendAccountSetupEmail(email: string, token: string) {
  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!resendKey || !from) {
    throw new Error("ORBIT_SETUP_EMAIL_NOT_CONFIGURED")
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Set up your Orbit LM password",
      text: `Welcome to Orbit LM.\n\nYour purchase has been confirmed and your Orbit account is ready.\n\nCreate your password using this secure one-time link:\n${APP_ORIGIN}/set-password?token=${token}\n\nThis link expires in 24 hours and can only be used once. If you did not make this purchase, contact Orbit Support.`,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`ORBIT_SETUP_EMAIL_FAILED:${response.status}:${detail}`)
  }
}
