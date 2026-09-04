import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { getSession } from "@/lib/auth"
import { requestFeature } from "@/lib/plan-access"
import { open, seal } from "@/lib/secrets"
import { db } from "@/lib/supabase"

type R = Record<string, any>

async function getCalendarAccessToken(userId: string) {
  const rows = await db(
    `calendar_connections?user_id=eq.${userId}&select=*&limit=1`
  )

  const connection = rows?.[0]

  if (!connection) {
    return {
      connected: false as const,
      accessToken: "",
    }
  }

  let accessToken = open(connection.access_token)

  const expiresAt = new Date(connection.expires_at).getTime()

  if (
    expiresAt < Date.now() + 60_000 &&
    connection.refresh_token
  ) {
    const response = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: open(connection.refresh_token),
          grant_type: "refresh_token",
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(
        data.error_description ||
          data.error ||
          "Unable to refresh Google Calendar access."
      )
    }

    accessToken = data.access_token

    await db(
      `calendar_connections?user_id=eq.${userId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          access_token: seal(accessToken),
          expires_at: new Date(
            Date.now() + Number(data.expires_in || 3600) * 1000
          ).toISOString(),
        }),
      }
    )
  }

  return {
    connected: true as const,
    accessToken,
  }
}

async function getUser() {
  const token = (await cookies()).get("orbit_session")?.value

  if (!token) return null

  return getSession(token)
}

function googleEventPayload(body: R) {
  const payload: R = {}

  if (body.title !== undefined) {
    payload.summary = body.title || "Untitled event"
  }

  if (body.description !== undefined) {
    payload.description = body.description || ""
  }

  if (body.location !== undefined) {
    payload.location = body.location || ""
  }

  if (body.start) {
    payload.start = {
      dateTime: body.start,
    }
  }

  if (body.end) {
    payload.end = {
      dateTime: body.end,
    }
  }

  if (body.reminderMinutes !== undefined) {
    const minutes = Number(body.reminderMinutes)

    payload.reminders =
      minutes > 0
        ? {
            useDefault: false,
            overrides: [
              {
                method: "popup",
                minutes,
              },
            ],
          }
        : {
            useDefault: false,
            overrides: [],
          }
  }

  const recurrence = recurrenceRule(body.recurrence)

  if (recurrence) {
    payload.recurrence = [recurrence]
  }

  return payload
}

function recurrenceRule(value?: string) {
  switch (value) {
    case "daily":
      return "RRULE:FREQ=DAILY"
    case "weekly":
      return "RRULE:FREQ=WEEKLY"
    case "biweekly":
      return "RRULE:FREQ=WEEKLY;INTERVAL=2"
    case "monthly":
      return "RRULE:FREQ=MONTHLY"
    case "yearly":
      return "RRULE:FREQ=YEARLY"
    default:
      return undefined
  }
}

function mapGoogleEvent(item: R) {
  const reminderMinutes =
    item.reminders?.overrides?.[0]?.minutes ?? undefined

  return {
    id: item.id,
    title: item.summary || "Untitled event",
    start: item.start?.dateTime || item.start?.date,
    end: item.end?.dateTime || item.end?.date,
    description: item.description || "",
    location: item.location || "",
    link: item.htmlLink || "",
    meetingLink: item.hangoutLink || "",
    reminderMinutes,
    recurrence: item.recurrence?.[0] || "",
  }
}

export async function GET(request: Request) {
  const planDenied = await requestFeature("calendar")

  if (planDenied) return planDenied

  const user = await getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  const calendar = await getCalendarAccessToken(user.id)

  if (!calendar.connected) {
    return NextResponse.json({
      connected: false,
      events: [],
    })
  }

  const url = new URL(request.url)

  const from =
    url.searchParams.get("from") ||
    new Date().toISOString()

  const to =
    url.searchParams.get("to") ||
    new Date(Date.now() + 45 * 86_400_000).toISOString()

  const googleUrl =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?" +
    new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: from,
      timeMax: to,
      maxResults: "2500",
    })

  const response = await fetch(googleUrl, {
    headers: {
      Authorization: `Bearer ${calendar.accessToken}`,
    },
    cache: "no-store",
  })

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json(
      {
        connected: true,
        error:
          data.error?.message ||
          "Calendar unavailable.",
        events: [],
      },
      { status: 502 }
    )
  }

  return NextResponse.json({
    connected: true,
    events: (data.items || []).map(mapGoogleEvent),
  })
}

export async function POST(request: Request) {
  const planDenied = await requestFeature("calendar")

  if (planDenied) return planDenied

  const user = await getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  const calendar = await getCalendarAccessToken(user.id)

  if (!calendar.connected) {
    return NextResponse.json(
      { error: "Google Calendar is not connected." },
      { status: 409 }
    )
  }

  const body = await request.json()

  if (!body.title || !body.start) {
    return NextResponse.json(
      {
        error: "Title and start time are required.",
      },
      { status: 400 }
    )
  }

  const payload = googleEventPayload(body)

  if (!payload.end && body.start) {
    payload.end = {
      dateTime: new Date(
        new Date(body.start).getTime() + 60 * 60 * 1000
      ).toISOString(),
    }
  }

  if (body.meetingLink) {
    payload.description = [
      payload.description || "",
      `Meeting link: ${body.meetingLink}`,
    ]
      .filter(Boolean)
      .join("\n\n")
  }

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${calendar.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json(
      {
        error:
          data.error?.message ||
          "Unable to create calendar event.",
      },
      { status: response.status || 502 }
    )
  }

  return NextResponse.json({
    event: mapGoogleEvent(data),
  })
}

export async function PATCH(request: Request) {
  const planDenied = await requestFeature("calendar")

  if (planDenied) return planDenied

  const user = await getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  const calendar = await getCalendarAccessToken(user.id)

  if (!calendar.connected) {
    return NextResponse.json(
      { error: "Google Calendar is not connected." },
      { status: 409 }
    )
  }

  const body = await request.json()

  if (!body.id) {
    return NextResponse.json(
      { error: "Event ID is required." },
      { status: 400 }
    )
  }

  const payload = googleEventPayload(body)

  if (body.meetingLink !== undefined) {
    payload.description = [
      body.description || "",
      body.meetingLink
        ? `Meeting link: ${body.meetingLink}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n")
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
      body.id
    )}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${calendar.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json(
      {
        error:
          data.error?.message ||
          "Unable to update calendar event.",
      },
      { status: response.status || 502 }
    )
  }

  return NextResponse.json({
    event: mapGoogleEvent(data),
  })
}

export async function DELETE(request: Request) {
  const planDenied = await requestFeature("calendar")

  if (planDenied) return planDenied

  const user = await getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  const calendar = await getCalendarAccessToken(user.id)

  if (!calendar.connected) {
    return NextResponse.json(
      { error: "Google Calendar is not connected." },
      { status: 409 }
    )
  }

  const body = await request.json()

  if (!body.id) {
    return NextResponse.json(
      { error: "Event ID is required." },
      { status: 400 }
    )
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
      body.id
    )}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${calendar.accessToken}`,
      },
    }
  )

  if (!response.ok && response.status !== 204) {
    const data = await response.json().catch(() => ({}))

    return NextResponse.json(
      {
        error:
          data.error?.message ||
          "Unable to delete calendar event.",
      },
      { status: response.status || 502 }
    )
  }

  return NextResponse.json({
    ok: true,
  })
}