import { db } from "@/lib/supabase"
import { open, seal } from "@/lib/secrets"

type R = Record<string, any>

async function getAccessToken(userId: string) {
  const rows = await db(
    `calendar_connections?user_id=eq.${userId}&select=*&limit=1`
  )

  const connection = rows?.[0]
  if (!connection) return null

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
          "Google Calendar authorization expired."
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

  return accessToken
}

function makeEventBody(input: {
  title: string
  date: string
  description?: string
  entityType: string
  entityId: string
}) {
  return {
    summary: input.title,
    description: input.description || "",
    start: {
      date: input.date,
    },
    end: {
      date: nextDate(input.date),
    },
    extendedProperties: {
      private: {
        orbitEntityType: input.entityType,
        orbitEntityId: input.entityId,
      },
    },
  }
}

function nextDate(date: string) {
  const value = new Date(`${date}T00:00:00`)
  value.setDate(value.getDate() + 1)
  return value.toISOString().slice(0, 10)
}

export async function syncCrmCalendarEvent(input: {
  userId: string
  entityType: string
  entityId: string
  title: string
  date?: string | null
  googleEventId?: string | null
  description?: string
}) {
  const accessToken = await getAccessToken(input.userId)

  if (!accessToken) {
    return {
      synced: false,
      reason: "calendar-not-connected",
    }
  }

  if (!input.date) {
    if (input.googleEventId) {
      await deleteGoogleEvent(
        accessToken,
        input.googleEventId
      )
    }

    return {
      synced: true,
      googleEventId: null,
    }
  }

  const eventBody = makeEventBody({
    title: input.title,
    date: input.date,
    description: input.description,
    entityType: input.entityType,
    entityId: input.entityId,
  })

  if (input.googleEventId) {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
        input.googleEventId
      )}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    )

    if (response.status !== 404 && !response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(
        data.error?.message ||
          "Could not update Google Calendar event."
      )
    }

    if (response.ok) {
      const data = await response.json()

      return {
        synced: true,
        googleEventId: data.id,
      }
    }
  }

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(eventBody),
    }
  )

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        "Could not create Google Calendar event."
    )
  }

  return {
    synced: true,
    googleEventId: data.id,
  }
}

export async function deleteCrmCalendarEvent(input: {
  userId: string
  googleEventId?: string | null
}) {
  if (!input.googleEventId) return

  const accessToken = await getAccessToken(input.userId)

  if (!accessToken) return

  await deleteGoogleEvent(
    accessToken,
    input.googleEventId
  )
}

async function deleteGoogleEvent(
  accessToken: string,
  eventId: string
) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
      eventId
    )}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok && response.status !== 404) {
    const data = await response.json().catch(() => ({}))

    throw new Error(
      data.error?.message ||
        "Could not delete Google Calendar event."
    )
  }
}