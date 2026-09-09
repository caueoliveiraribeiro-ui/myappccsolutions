import { NextResponse } from "next/server"
// Legacy Stripe checkout is retired. Orbit LM checkout is handled only by Hotmart.
export async function POST() { return NextResponse.json({ error: "This checkout endpoint has been retired. Please use the Hotmart plan links." }, { status: 410 }) }
