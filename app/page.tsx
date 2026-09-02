import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { verifySession } from "@/lib/auth"
import { LoginForm } from "@/components/login-form"
export default async function Home(){const token=(await cookies()).get("orbit_session")?.value;if(token&&await verifySession(token))redirect("/dashboard");return <LoginForm/>}

