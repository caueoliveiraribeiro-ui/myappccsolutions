import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { verifySession } from "@/lib/auth"
import { OperationsDashboard } from "@/components/operations-dashboard"

export default async function Dashboard() {
  const token = (await cookies()).get("orbit_session")?.value
  if (!token || !await verifySession(token)) redirect("/")
  return <OperationsDashboard />
}
