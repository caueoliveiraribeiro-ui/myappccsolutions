# Optional Gemini support

Disabled by default. Existing product guidance and human support still work without an API key.

Before enabling, approve Google's data terms, update your public privacy notice to describe this provider and the chat data sent, and tell users not to submit private account, payment or health details. The free tier may use content for product improvement. See https://ai.google.dev/gemini-api/terms and https://ai.google.dev/gemini-api/docs/pricing.

In the Orbit Vercel project, add server-only settings:

- GEMINI_API_KEY: key created in Google AI Studio. Never use NEXT_PUBLIC for this.
- GEMINI_MODEL: gemini-2.5-flash-lite (verify current availability).
- ORBIT_SUPPORT_AI_ENABLED: true only after the above steps; otherwise leave unset or false.

Redeploy. Test a general product question, a follow-up and a request for human support.
Only the current message and up to six recent chat messages go to Google. Workspace records, tokens, database access and tools are not provided.

An eight-second timeout, invalid response or provider quota failure falls back to built-in guidance. The ten-requests-per-minute in-memory guard is per server instance, not a distributed billing cap. Set provider quotas and deployment-level rate limits before enabling public traffic. Free quotas can change; don't assume unlimited free service. Disable the environment flag and redeploy to stop external AI requests.
