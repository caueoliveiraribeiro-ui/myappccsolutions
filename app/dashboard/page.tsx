import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { verifySession } from "@/lib/auth"
import { CRMDashboard } from "@/components/crm-dashboard"
export default async function Dashboard(){const token=(await cookies()).get("orbit_session")?.value;if(!token||!await verifySession(token))redirect("/");return <CRMDashboard/>}

