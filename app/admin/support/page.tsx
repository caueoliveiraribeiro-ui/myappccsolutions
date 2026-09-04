import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { ownerAccountIds } from "@/lib/plan-access"
import { AdminSupportInbox } from "@/components/admin-support-inbox"

export default async function AdminSupportPage() {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  if (!user || !ownerAccountIds.has(user.id)) redirect("/dashboard")
  return <AdminSupportInbox />
}
