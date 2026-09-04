import { requestFeature } from "@/lib/plan-access";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { createHmac, randomBytes } from "node:crypto";

function sign(value: string) {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }

  return createHmac("sha256", secret)
    .update(value)
    .digest("base64url");
}

export async function GET(request: Request) {
  const planDenied = await requestFeature("calendar");
  if (planDenied) return planDenied;

  const token = (await cookies()).get("orbit_session")?.value;
  const user = token ? await getSession(token) : null;

  if (!user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Google Calendar OAuth is not configured" },
      { status: 503 }
    );
  }

  const state = randomBytes(24).toString("hex");

  const context = Buffer.from(
    JSON.stringify({
      userId: user.id,
      state,
      expires: Date.now() + 10 * 60 * 1000,
    })
  ).toString("base64url");

  const signedContext = `${context}.${sign(context)}`;

  const redirect = "https://orbit-lm.com/api/calendar/callback";

  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  u.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirect,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();

  const response = NextResponse.redirect(u);

  response.cookies.set("calendar_oauth_context", signedContext, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}