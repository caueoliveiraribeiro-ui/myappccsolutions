type Invoice = Record<string, unknown>

const safe = (value: unknown) => String(value ?? "").replace(/[^\x20-\x7E]/g, " ").replace(/[\\()]/g, "\\$&").trim()
const wrap = (value: unknown, width = 86) => {
  const words = safe(value).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width) { if (line) lines.push(line); line = word } else line = `${line} ${word}`.trim()
  }
  if (line) lines.push(line)
  return lines
}
const money = (amount: unknown, currency: unknown) => new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency || "USD"), minimumFractionDigits: 2 }).format(Number(amount || 0))

export function invoicePdf(invoice: Invoice) {
  const lines = [
    { text: "ORBIT LM", size: 24, color: "0.05 0.70 0.82" },
    { text: "Life Management", size: 10, color: "0.35 0.42 0.50" },
    { text: `INVOICE  ${safe(invoice.invoice_number)}`, size: 15, color: "0.08 0.12 0.20" },
    { text: `Issued: ${safe(String(invoice.issue_date || "").slice(0, 10))}`, size: 10, color: "0.35 0.42 0.50" },
    { text: `Due: ${safe(String(invoice.due_date || "On receipt").slice(0, 10) || "On receipt")}`, size: 10, color: "0.35 0.42 0.50" },
    { text: "BILL TO", size: 10, color: "0.05 0.70 0.82" },
    { text: safe(invoice.client_name), size: 13, color: "0.08 0.12 0.20" },
    { text: safe(invoice.client_email), size: 10, color: "0.35 0.42 0.50" },
    { text: "SERVICE", size: 10, color: "0.05 0.70 0.82" },
    ...wrap(invoice.service_name || "Professional services").map(text => ({ text, size: 12, color: "0.08 0.12 0.20" })),
    { text: `TOTAL DUE   ${money(invoice.amount, invoice.currency)}`, size: 17, color: "0.08 0.12 0.20" },
    ...wrap(invoice.notes ? `Notes: ${invoice.notes}` : "").map(text => ({ text, size: 10, color: "0.35 0.42 0.50" })),
    { text: "Thank you for choosing Orbit LM.", size: 10, color: "0.35 0.42 0.50" },
  ].filter(line => line.text)

  let y = 760
  const commands = ["0.96 0.99 1 rg 0 0 612 792 re f", "0.05 0.70 0.82 RG 48 704 m 564 704 l S"]
  for (const line of lines) {
    y -= line.size > 16 ? 34 : 21
    commands.push(`${line.color} rg BT /F1 ${line.size} Tf 48 ${y} Td (${safe(line.text)}) Tj ET`)
    if (y < 70) break
  }
  const stream = commands.join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  for (let index = 0; index < objects.length; index++) { offsets.push(Buffer.byteLength(pdf, "utf8")); pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n` }
  const xref = Buffer.byteLength(pdf, "utf8")
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, "utf8")
}
