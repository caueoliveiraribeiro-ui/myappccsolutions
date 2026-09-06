import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/supabase"

const countries = ["US","BR","GB","DE","FR","ES","IT","PT","CA","AU","JP","KR","MX","NL","CH"]
const languages = ["en","pt","es","de","fr","it","nl","ja","ko"]
const currencies = ["USD","BRL","EUR","GBP","CAD","AUD","JPY","KRW","MXN","CHF"]

function text(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max)
}

export async function POST(request: Request) {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const name = text(body.name, 80)
    const country = String(body.country || "US")
    const language = String(body.language || "en")
    const currency = String(body.currency || "USD").toUpperCase()
    if (!name) return NextResponse.json({ error: "Enter a profile name between 1 and 80 characters." }, { status: 400 })
    if (!countries.includes(country) || !languages.includes(language) || !currencies.includes(currency)) {
      return NextResponse.json({ error: "Invalid preference" }, { status: 400 })
    }

    const profile = {
      user_id: user.id,
      name,
      email: user.email,
      country,
      language,
      currency,
      phone: text(body.phone, 40),
      job_title: text(body.job_title, 80),
      company: text(body.company, 120),
      website: text(body.website, 240),
      address_line1: text(body.address_line1, 160),
      address_line2: text(body.address_line2, 160),
      city: text(body.city, 100),
      region: text(body.region, 100),
      postal_code: text(body.postal_code, 30),
      timezone: text(body.timezone, 80),
      bio: text(body.bio, 500),
      updated_at: new Date().toISOString(),
    }

    const rows = await db("user_profiles?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(profile),
    })
    return NextResponse.json(rows?.[0] || profile)
  } catch (error) {
    console.error("Profile settings update failed", error)
    return NextResponse.json({ error: "We could not save your profile." }, { status: 500 })
  }
}
