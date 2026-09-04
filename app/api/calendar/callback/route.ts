import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/supabase";
import { seal } from "@/lib/secrets";

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
  const u = new URL(request.url);
  const jar = await cookies();

  const signedContext = jar.get("calendar_oauth_context")?.value;

  if (!signedContext) {
    return NextResponse.redirect(
      new URL("/dashboard?calendar=failed", request.url)
    );
  }

  const [context, receivedSignature] = signedContext.split(".");

  if (!context || !receivedSignature) {
    return NextResponse.redirect(
      new URL("/dashboard?calendar=failed", request.url)
    );
  }

  const expectedSignature = sign(context);

  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return NextResponse.redirect(
      new URL("/dashboard?calendar=failed", request.url)
    );
  }

  let oauthContext: {
    userId: string;
    state: string;
    expires: number;
  };

  try {
    oauthContext = JSON.parse(
      Buffer.from(context, "base64url").toString("utf8")
    );
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard?calendar=failed", request.url)
    );
  }

  if (
    oauthContext.expires < Date.now() ||
    oauthContext.state !== u.searchParams.get("state")
  ) {
    return NextResponse.redirect(
      new URL("/dashboard?calendar=failed", request.url)
    );
  }

  const code = u.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/dashboard?calendar=denied", request.url)
    );
  }

  const redirect = "https://orbit-lm.com/api/calendar/callback";

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  });

  const d = await r.json();

  if (!r.ok) {
    return NextResponse.redirect(
      new URL("/dashboard?calendar=failed", request.url)
    );
  }

  await db("calendar_connections?on_conflict=user_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      user_id: oauthContext.userId,
      access_token: seal(d.access_token),
      refresh_token: d.refresh_token ? seal(d.refresh_token) : null,
      expires_at: new Date(Date.now() + d.expires_in * 1000).toISOString(),
      provider: "google",
    }),
  });

  const out = NextResponse.redirect(
    new URL("/dashboard?calendar=connected", request.url)
  );

  out.cookies.set("calendar_oauth_context", "", {
    path: "/",
    maxAge: 0,
  });

  return out;
}