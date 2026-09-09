export type OrbitSupportContext = {
  page?: string
  plan?: string
  features?: string[]
  authenticated?: boolean
  history?: {role: "user" | "assistant"; content: string}[]
}

export type OrbitSupportResult = {
  reply: string
  suggestions?: string[]
  needsHuman?: boolean
  mode: "knowledge" | "ai"
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
  context: OrbitSupportContext = {},
): Promise<OrbitSupportResult> {
  let text = normalize(message)
  const previous = [...(context.history || [])].reverse().find(item => item.role === "user")
  if (/^(yes|no|how|where|and|it|that|still)\b/.test(text) && previous) {
    const topic = normalize(previous.content).match(/\b(invoice|health|calorie|calendar|project|task|client|lead|stock|crypto|expense|report|plan)\w*\b/)
    if (topic) text += " " + topic[0]
  }
  const pageHint = context.page ? ` Since you are on ${context.page}, ` : " "

  if (/^(hi|hello|hey)[!.\s]*$/.test(text)) return {mode:"knowledge",reply:"Hi! What would you like to do in Orbit today? I can help you choose a plan or walk through a feature.",suggestions:["Compare plans","How do invoices work?","How do I track calories?"]}
  if (/^(thanks|thank you)[!.\s]*$/.test(text)) return {mode:"knowledge",reply:"You're welcome! What else would you like help with?",suggestions:["How do Projects work?","Compare plans"]}
  if (/not working|won.?t|will not|could not|error|failed|wrong/.test(text)) return {
    mode:"knowledge",
    reply:"Let's narrow this down. What did you try, and what exact message appeared? If a save or payment seems uncertain, check whether the record or charge already exists before retrying. I can guide you, but I cannot inspect or change your records from this chat.",
    suggestions:["Talk to support","Account help"],
  }

  if (/\b(human|representative|support agent)\b|talk to support|speak to support/.test(text)) {
    return {
      mode: "knowledge",
      needsHuman: Boolean(context.authenticated),
      reply:
        context.authenticated ? "I'll flag this conversation for the support team. Tell us what happened and the screen involved. Return to this chat to see replies; I cannot promise a response time." : "You can ask product questions here without signing in. For account-specific human support, sign in and choose Talk to support. Never send passwords or reset links here.",
      suggestions: ["Report a problem", "Account help"],
    }
  }

  if (/billing|plan|subscription|upgrade|price/.test(text) && !/invoice/.test(text)) {
    return {
      mode: "knowledge",
      reply:
        "Compare plans at /plans: Personal is US$29.99/month, Small Business US$99.99/month, and Big Business US$189.99/month. Invoices require Big Business or owner access. Business Customization is US$599.99/month for a separately tailored workspace. Final taxes and billing terms are shown by Hotmart before payment. Which feature do you need?",
      suggestions: ["Why is a feature locked?", "Where are my account settings?"],
    }
  }

  if (/password|login|sign in|account|forgot|reset/.test(text) && !/invoice/.test(text)) {
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

  if (/health|calorie|food|meal|nutrition/.test(text)) {
    return {
      mode: "knowledge",
      reply: "Open Personal → Health. Choose the date you ate the food, pick the food group and item, and enter your portion in grams. Select Add to selected day.\n\nOpen a date in Daily consumption history to review its foods, edit a portion or delete an entry. The day's calorie total recalculates automatically. These are tracking estimates, not medical advice.",
      suggestions: ["How do I use Expenses?", "How do I use Investments?"],
    }
  }

  if (/invoice|receipt|pdf/.test(text)) {
    return {
      mode: "knowledge",
      reply: "To create an invoice:\n1. Open Clients → Invoices (Big Business or owner access).\n2. Save your company details and logo, then choose a client or project.\n3. Review the recipient, address, description, amount and due date before saving.\n4. Open the saved invoice to edit it, download its PDF or send it by email.\n\nI can guide you, but I cannot save or send an invoice from this chat.",
      suggestions: ["How do Projects work?", "Billing & plans"],
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

  if (/report|payment/.test(text)) return {
    mode: "knowledge",
    reply: "Open Reports → Payment ledger. Add a payment, choose the client, amount, currency and date, then set Awaiting payment or Payment received. You can edit or delete a record from its dropdown.\n\nOnly received payments count as received income; awaiting payments stay separate. Use the month and client filters to check the records behind a total before changing it.",
    suggestions: ["How do invoices work?", "Talk to support"],
  }

  if (/personal|finance|expense|money|stock|crypto|investment|currency|conversion/.test(text)) {
    return {
      mode: "knowledge",
      reply:
        "Use Personal for expenses and groceries, Investments for stock, crypto and savings tracking, and Reports for payment and financial summaries. Your selected default currency drives Orbit’s display conversion. If a number looks wrong, tell me the tab, ticker or record, selected currency and what you expected — never send account or card details.",
      suggestions: ["How do I use Investments?", "How do Reports work?"],
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
      needsHuman: Boolean(context.authenticated),
      reply:
        `I’m sorry that happened.${pageHint}Tell me what you clicked, what you expected, and what Orbit did instead. A screenshot or the exact error text is perfect. Please leave out passwords, API keys, payment-card details and private tokens.`,
      suggestions: ["Account help", "Calendar help"],
    }
  }

  return {
    mode: "knowledge",
    reply:
      "I can guide you through the exact Orbit area you need: Personal (health, groceries and expenses), Investments (stocks, crypto and savings), Clients, Leads, Pipeline, Projects, Tasks, Calendar, Reports, invoices, plans and sharing. Tell me the page you are on and the result you want, and I’ll give you the next steps.",
    suggestions: ["How do I use Personal?", "How do I use Investments?", "Report a problem"],
  }
}

