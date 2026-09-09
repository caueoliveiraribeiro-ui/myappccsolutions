import { NextResponse } from "next/server"
// Legacy Stripe webhook is retired. Hotmart is Orbit LM's active billing provider.
export async function POST() { return NextResponse.json({ error: "This webhook has been retired." }, { status: 410 }) }
