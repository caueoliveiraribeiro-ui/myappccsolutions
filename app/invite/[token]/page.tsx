import { notFound } from "next/navigation"
import { HotmartSubscription } from "@/components/hotmart-subscription"
import { db } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const checkoutBase = "https://pay.hotmart.com/U107532997T?off=l697xvib"

export default async function InviteCheckoutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[a-f0-9]{64}$/.test(token)) notFound()

  const invites = await db(`workspace_invites?checkout_token=eq.${encodeURIComponent(token)}&select=id,email,recipient_name,owner_user_id,status,checkout_expires_at&limit=1`)
  const invite = invites?.[0]
  if (!invite || invite.status !== "awaiting_payment" || new Date(invite.checkout_expires_at).getTime() < Date.now()) notFound()

  const owners = await db(`app_users?id=eq.${encodeURIComponent(invite.owner_user_id)}&select=name&limit=1`)
  const ownerName = String(owners?.[0]?.name || "an Orbit LM member")
  const checkout = new URL(checkoutBase)
  checkout.searchParams.set("email", invite.email)
  checkout.searchParams.set("name", invite.recipient_name || invite.email.split("@")[0])
  checkout.searchParams.set("sck", token)

  return (
    <HotmartSubscription
      name={`Join ${ownerName}'s Orbit`}
      formattedPrice="US$12.99"
      checkoutUrl={checkout.toString()}
      email={invite.email}
      owner={false}
      description="Your own secure login, shared access to the inviter’s workspace, and the same workspace permissions they selected for you."
    />
  )
}
