import {cookies} from "next/headers"
import {getSession} from "@/lib/auth"
import {accountAccess} from "@/lib/plan-access"
import {LoginForm} from "@/components/login-form"
import {PaddleSubscription} from "@/components/paddle-subscription"
import {isStandardPlan,paddleOffers} from "@/lib/paddle-plans"
import {billingReady} from "@/lib/paddle"
export const dynamic="force-dynamic"
export default async function Subscribe({searchParams}:{searchParams:Promise<{plan?:string}>}){
 const params=await searchParams,plan=params.plan
 if(!isStandardPlan(plan))return <main className="min-h-screen bg-[#050812] p-10 text-white"><h1 className="text-3xl">Choose your Orbit</h1><p className="my-5">Select a standard plan to continue. Customized workspaces and friend invitations use separate onboarding.</p><a className="text-cyan-300" href="https://orbit-landing-page-rose.vercel.app/#plans">Explore plans →</a></main>
 const token=(await cookies()).get("orbit_session")?.value,user=token?await getSession(token):null
 if(!user)return <LoginForm returnTo={"/subscribe?plan="+plan}/>
 const access=await accountAccess(user.id)
 return <PaddleSubscription plan={plan} name={paddleOffers[plan].name} monthlyUsd={paddleOffers[plan].monthlyUsd}
 email={user.email} ready={billingReady()} owner={access.plan==="owner"} token={process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN||""}/>
}
