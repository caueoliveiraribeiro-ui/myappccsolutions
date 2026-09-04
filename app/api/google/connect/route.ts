import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth";

function sign(value: string) {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }

  return createHmac("sha256", secret)
    .update(value)
    .digest("base64url");
}

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get("orbit_session")?.value;

  if (!sessionToken) {
    return NextResponse.redirect(
      new URL("/?gmail=login-required", request.url)
    );
  }

  const session = await getSession(sessionToken);

  if (!session) {
    return NextResponse.redirect(
      new URL("/?gmail=login-required", request.url)
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "https://orbit-lm.com/api/google/callback"
  );

  const state = randomBytes(32).toString("hex");
  const requestedReturn = request.nextUrl.searchParams.get("return");
  const returnTo = requestedReturn === "leads" ? "leads" : "dashboard";

  const context = Buffer.from(
    JSON.stringify({
      userId: session.id,
      state,
      returnTo,
      expires: Date.now() + 10 * 60 * 1000,
    })
  ).toString("base64url");

  const signedContext = `${context}.${sign(context)}`;

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state,
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar.events",
      "openid",
      "email",
    ],
  });

  const response = NextResponse.redirect(authorizationUrl);

  response.cookies.set("google_oauth_context", signedContext, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}