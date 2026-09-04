export type OrbitSupportContext = {
  page?: string
  plan?: string
  features?: string[]
}

export type OrbitSupportResult = {
  reply: string
  suggestions?: string[]
  needsHuman?: boolean
  mode: "knowledge"
}

const normalize = (value: string) => value.trim().toLowerCase()

/**
 * Stable server-side seam for the native Orbit AI agent.
 *
 * The dashboard talks only to /api/support/chat and never to an AI provider
 * directly. Today this resolver provides safe first-party product guidance.
 * Later, the native AI provider can be plugged in here without changing the
 * dashboard UI or exposing provider keys to the browser.
 */
export async function answerOrbitSupport(
  message: string,
  _context: OrbitSupportContext = {},
): Promise<OrbitSupportResult> {
  const text = normalize(message)

  if (/human|person|agent|representative|talk to support|speak to support/.test(text)) {
    return {
      mode: "knowledge",
      needsHuman: true,
      reply:
        "Human handoff is being added to Orbit Support. For now, describe what happened and I’ll help you narrow down the issue and the safest next step.",
      suggestions: ["Report a problem", "Account help"],
    }
  }

  if (/billing|plan|subscription|upgrade|price|payment|charge|invoice/.test(text)) {
    return {
      mode: "knowledge",
      reply:
        "I can help with plans, subscription access and billing questions. Orbit keeps plan access tied to the account that purchased it. You can review available plans on the Plans page, and account or subscription controls are available from Settings. If you’re troubleshooting a charge, tell me what you see without sharing card numbers or banking details.",
      suggestions: ["Why is a feature locked?", "Where are my account settings?"],
    }
  }

  if (/password|login|sign in|account|email|forgot|reset/.test(text)) {
    return {
      mode: "knowledge",
      reply:
        "For account access, use Orbit’s sign-in and password-reset flow rather than sharing credentials in chat. If you forgot your password, choose “Forgot password?” on the sign-in screen and follow the secure reset link sent to your account email. Never send your password, reset token, API keys or recovery codes here.",
      suggestions: ["I can’t sign in", "Billing & plans"],
    }
  }

  if (/calendar|google calendar|schedule|event/.test(text)) {
    return {
      mode: "knowledge",
      reply:
        "Orbit supports Google Calendar integration for calendar events. Open Calendar in Orbit and use the connection controls to authorize your Google account. Once connected, Orbit can work with your calendar events without asking you to paste Google credentials into the app.",
      suggestions: ["How do I use Projects?", "How do I use Tasks?"],
    }
  }

  if (/gmail|email send|send email|mail/.test(text)) {
    return {
      mode: "knowledge",
      reply:
        "Orbit can connect to Gmail for sending messages from supported areas of the app. The connection uses Google authorization, so you should never paste your Gmail password into Orbit Support. If sending fails, tell me which Orbit screen you’re on and what error message appears.",
      suggestions: ["Report a problem", "Account help"],
    }
  }

  if (/lead|client|pipeline|crm/.test(text)) {
    return {
      mode: "knowledge",
      reply:
        "Orbit’s CRM tools connect leads, clients and your sales pipeline. Leads can be tracked through their stages, and qualified or won opportunities can flow into client and project management so you can keep the relationship and work history organized in one place.",
      suggestions: ["How do Projects work?", "How do Tasks work?"],
    }
  }

  if (/project/.test(text)) {
    return {
      mode: "knowledge",
      reply:
        "Projects help you organize active work, client details, progress, budget and the next steps needed to deliver. Use Projects when an opportunity becomes real work, then connect Tasks and Calendar activity around it so the work stays visible.",
      suggestions: ["How do Tasks work?", "How does the CRM work?"],
    }
  }

  if (/task|follow.?up|todo|to-do/.test(text)) {
    return {
      mode: "knowledge",
      reply:
        "Tasks & Follow-ups are for the actions that move your work forward. Add the task, set the relevant timing or follow-up information, and use Calendar alongside it when the action needs a specific date or schedule.",
      suggestions: ["How do Projects work?", "Google Calendar help"],
    }
  }

  if (/finance|expense|money|stock|crypto|investment|report/.test(text)) {
    return {
      mode: "knowledge",
      reply:
        "Orbit brings financial organization, expenses, supported investment views and reports into the same workspace. Availability depends on your plan. For privacy, describe the feature you need help with rather than pasting bank credentials, complete account numbers or other sensitive financial information.",
      suggestions: ["Why is a feature locked?", "Billing & plans"],
    }
  }

  if (/invite|sharing|share|collaborat/.test(text)) {
    return {
      mode: "knowledge",
      reply:
        "Invite & Sharing lets you bring other people into the parts of Orbit designed for collaboration while keeping account access controlled. Use the Invite & sharing area to manage invitations rather than sharing your own login credentials.",
      suggestions: ["Account help", "How do Projects work?"],
    }
  }

  if (/bug|problem|broken|error|not working|doesn.?t work|issue/.test(text)) {
    return {
      mode: "knowledge",
      needsHuman: true,
      reply:
        "I can help troubleshoot it. Tell me which Orbit screen you were using, what you expected to happen, what actually happened, and the exact error message if one appeared. Please don’t include passwords, API keys, payment-card details or private tokens.",
      suggestions: ["Account help", "Calendar help"],
    }
  }

  return {
    mode: "knowledge",
    reply:
      "I can help you with Orbit features, account access, plans and billing, Google Calendar, Gmail, clients, leads, pipeline, projects, tasks, finances, investments, reports, and Invite & Sharing. Tell me what you’re trying to do and I’ll point you in the right direction.",
    suggestions: ["How do I use Orbit?", "Billing & plans", "Report a problem"],
  }
}
