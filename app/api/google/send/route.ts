import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createDecipheriv } from "node:crypto";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/supabase";

function decryptRefreshToken(encryptedToken: string) {
  const encodedKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;

  if (!encodedKey) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY is not configured");
  }

  const key = Buffer.from(encodedKey, "base64");

  if (key.length !== 32) {
    throw new Error("Invalid Gmail encryption key");
  }

  const [ivPart, tagPart, encryptedPart] =
    encryptedToken.split(".");

  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Invalid encrypted Gmail token");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const encrypted = Buffer.from(encryptedPart, "base64url");

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function encodeSubject(subject: string) {
  return `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
}

export async function POST(request: NextRequest) {
  try {
    const sessionToken =
      request.cookies.get("orbit_session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const session = await getSession(sessionToken);

    if (!session) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const to =
      typeof body.to === "string"
        ? body.to.trim()
        : "";

    const subject =
      typeof body.subject === "string"
        ? body.subject.trim()
        : "";

    const message =
      typeof body.message === "string"
        ? body.message
        : "";

    if (!to || !subject || !message) {
      return NextResponse.json(
        {
          error:
            "to, subject and message are required",
        },
        { status: 400 }
      );
    }

    const connections = await db(
      `gmail_connections?user_id=eq.${encodeURIComponent(
        session.id
      )}&select=google_email,refresh_token&limit=1`
    );

    const connection = connections?.[0];

    if (
      !connection?.google_email ||
      !connection?.refresh_token
    ) {
      return NextResponse.json(
        { error: "Gmail account is not connected" },
        { status: 400 }
      );
    }

    const refreshToken = decryptRefreshToken(
      connection.refresh_token
    );

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "https://orbit-lm.com/api/google/callback"
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const emailLines = [
      `From: ${connection.google_email}`,
      `To: ${to}`,
      `Subject: ${encodeSubject(subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      message,
    ];

    const rawMessage = Buffer.from(
      emailLines.join("\r\n")
    ).toString("base64url");

    const sent = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawMessage,
      },
    });

    return NextResponse.json({
      success: true,
      messageId: sent.data.id,
      from: connection.google_email,
      to,
    });
  } catch (error) {
    console.error("Gmail send error:", error);

    return NextResponse.json(
      { error: "Unable to send Gmail message" },
      { status: 500 }
    );
  }
}