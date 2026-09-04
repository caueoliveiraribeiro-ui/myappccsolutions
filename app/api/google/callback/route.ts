import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

import {
  createCipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { db } from "@/lib/supabase";

function verifySignedContext(value: string) {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }

  const [context, signature] = value.split(".");

  if (!context || !signature) {
    return null;
  }

  const expected = createHmac("sha256", secret)
    .update(context)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(context, "base64url").toString("utf8")
    );
  } catch {
    return null;
  }
}

function encryptRefreshToken(token: string) {
  const encodedKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;

  if (!encodedKey) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY is not configured");
  }

  const key = Buffer.from(encodedKey, "base64");

  if (key.length !== 32) {
    throw new Error("Invalid Gmail encryption key");
  }

  const iv = randomBytes(12);

  const cipher = createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");

    const signedContext =
      request.cookies.get("google_oauth_context")?.value;

    if (!code || !state || !signedContext) {
      return NextResponse.redirect(
        new URL("/google-connected?gmail=invalid-request", request.url)
      );
    }

    const context = verifySignedContext(signedContext);

    if (
      !context ||
      context.state !== state ||
      context.expires < Date.now() ||
      !context.userId
    ) {
      return NextResponse.redirect(
        new URL("/google-connected?gmail=invalid-state", request.url)
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "https://orbit-lm.com/api/google/callback"
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      const target = new URL("/google-connected", request.url);
      target.searchParams.set("gmail", "no-refresh-token");
      target.searchParams.set("return", context.returnTo === "leads" ? "leads" : "dashboard");
      return NextResponse.redirect(target);
    }

    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      version: "v2",
      auth: oauth2Client,
    });

    const profile = await oauth2.userinfo.get();
    const googleEmail = profile.data.email;

    if (!googleEmail) {
      throw new Error("Google account email was not returned");
    }

    const encryptedRefreshToken = encryptRefreshToken(tokens.refresh_token);

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null;

    await db(
      `gmail_connections?on_conflict=user_id`,
      {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          user_id: context.userId,
          google_email: googleEmail,
          refresh_token: encryptedRefreshToken,
          access_token: null,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    const target = new URL("/google-connected", request.url);
    target.searchParams.set("gmail", "connected");
    target.searchParams.set("return", context.returnTo === "leads" ? "leads" : "dashboard");

    const response = NextResponse.redirect(target);
    response.cookies.delete("google_oauth_context");
    return response;
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/google-connected?gmail=error", request.url)
    );
  }
}