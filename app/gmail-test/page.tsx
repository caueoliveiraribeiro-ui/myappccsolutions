"use client";

import { useState } from "react";

export default function GmailTestPage() {
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function sendTest() {
    setSending(true);
    setStatus("Sending...");

    try {
      const response = await fetch("/api/google/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          subject: "Orbit Gmail API test",
          message:
            "This email was sent through my connected Gmail account using Orbit.",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Send failed");
      }

      setStatus(
        `Success! Message ID: ${data.messageId || "sent"}`
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `Error: ${error.message}`
          : "Error sending email"
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 600,
        margin: "80px auto",
        padding: 24,
      }}
    >
      <h1>Gmail API Test</h1>

      <p>
        Send a test email using the Gmail account connected
        to your Orbit account.
      </p>

      <input
        type="email"
        placeholder="Email recipient"
        value={to}
        onChange={(event) => setTo(event.target.value)}
        style={{
          width: "100%",
          padding: 12,
          marginBottom: 16,
        }}
      />

      <button
        onClick={sendTest}
        disabled={sending || !to}
        style={{
          padding: "12px 20px",
          cursor: "pointer",
        }}
      >
        {sending ? "Sending..." : "Send Gmail Test"}
      </button>

      {status && (
        <p style={{ marginTop: 20 }}>
          {status}
        </p>
      )}
    </main>
  );
}