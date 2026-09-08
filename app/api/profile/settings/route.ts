import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/supabase"

const countries = ["US","BR","GB","DE","FR","ES","IT","PT","CA","AU","JP","KR","MX","NL","CH"]
const languages = ["en","pt","es","de","fr","it","nl","ja","ko"]
const currencies = ["USD","BRL","EUR","GBP","CAD","AUD","JPY","KRW","MXN","CHF"]
const markets = ["US","BR","GB","DE","FR","ES","IT","PT","CA","AU","JP","KR","MX","NL","CH"]

function text(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max)
}

function looksLikeSchemaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "")
  return /PGRST20\d|schema cache|column .* does not exist|could not find .* column/i.test(message)
}

export async function POST(request: Request) {
  const token = (await cookies()).get("orbit_session")?.value
  const user = token ? await getSession(token) : null
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const name = text(body.name, 80)
    const country = String(body.country || "US").toUpperCase()
    const language = String(body.language || "en").toLowerCase()
    const currency = String(body.currency || "USD").toUpperCase()
    const preferredMarket = String(body.preferred_market || country).toUpperCase()

    if (!name) {
      return NextResponse.json({ error: "Enter a profile name between 1 and 80 characters." }, { status: 400 })
    }
    if (!countries.includes(country) || !languages.includes(language) || !currencies.includes(currency) || !markets.includes(preferredMarket)) {
      return NextResponse.json({ error: "Invalid profile preference." }, { status: 400 })
    }

    const profile: Record<string, any> = {
      user_id: user.id,
      name,
      email: user.email,
      country,
      language,
      currency,
      preferred_market: preferredMarket,
      phone: text(body.phone, 40),
      job_title: text(body.job_title, 80),
      company: text(body.company, 120),
      website: text(body.website, 240),
      address_line1: text(body.address_line1, 160),
      city: text(body.city, 100),
      region: text(body.region, 100),
      postal_code: text(body.postal_code, 30),
      bio: text(body.bio, 500),
      updated_at: new Date().toISOString(),
    }

    let saved: Record<string, any> | null = null
    let missingFields: string[] = []

    try {
      const rows = await db("user_profiles?on_conflict=user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(profile),
      })
      saved = rows?.[0] || profile
    } catch (fullSaveError) {
      // Older Orbit databases may not yet have every newer profile column.
      // One optional field must not prevent core preferences from being persisted.
      const existingRows = await db(`user_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=*&limit=1`)
      const existing = existingRows?.[0]

      if (!existing) {
        if (!looksLikeSchemaError(fullSaveError)) throw fullSaveError

        // Legacy databases can be missing both the newer columns and the
        // user's profile row. Create the smallest row supported by the
        // original user_profiles schema so the account is never stuck in a
        // permanent save failure while the migration is pending.
        const coreProfile = {
          user_id: user.id,
          name,
          email: user.email,
          updated_at: profile.updated_at,
        }
        const rows = await db("user_profiles?on_conflict=user_id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify(coreProfile),
        })
        saved = rows?.[0] || coreProfile
        missingFields = Object.keys(profile).filter(
          (key) => !["user_id", "name", "email", "updated_at"].includes(key),
        )
      } else {
        const supported = new Set(Object.keys(existing))
        const changes = Object.fromEntries(
          Object.entries(profile).filter(([key]) => key !== "user_id" && supported.has(key)),
        )
        missingFields = Object.keys(profile).filter(
          (key) => key !== "user_id" && !supported.has(key),
        )

        const rows = await db(`user_profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
          method: "PATCH",
          body: JSON.stringify(changes),
        })
        saved = rows?.[0] || { ...existing, ...changes }

        if (!looksLikeSchemaError(fullSaveError) && missingFields.length === 0) {
          throw fullSaveError
        }
      }
    }

    // Keep the account directory name aligned with the user-facing profile
    // when this identity also exists in app_users. Protected owner fallback
    // identities may not have an app_users row, so this synchronization is soft.
    try {
      await db(`app_users?id=eq.${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      })
    } catch {}

    return NextResponse.json({
      ...(saved || profile),
      partial: missingFields.length > 0,
      missing_fields: missingFields,
    })
  } catch (error) {
    console.error("Profile settings update failed", error)
    if (looksLikeSchemaError(error)) {
      return NextResponse.json({
        error: "Your Orbit profile database needs the latest profile update before all fields can be saved.",
        code: "PROFILE_SCHEMA_UPDATE_REQUIRED",
      }, { status: 503 })
    }
    return NextResponse.json({ error: "We could not save your profile. Please try again." }, { status: 500 })
  }
}

