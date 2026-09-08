type Invoice = Record<string, unknown>

const plain = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/[\\()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const wrap = (value: unknown, width: number) => {
  const words = plain(value).split(" ").filter(Boolean)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > width && line) { lines.push(line); line = word } else line = next
  }
  if (line) lines.push(line)
  return lines
}

const money = (amount: unknown, currency: unknown) => {
  const code = /^[A-Z]{3}$/.test(String(currency || "").toUpperCase()) ? String(currency).toUpperCase() : "USD"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code, minimumFractionDigits: 2 }).format(Number(amount || 0))
}

const rgb = (hex: string) => hex.match(/[A-Fa-f0-9]{2}/g)!.map(value => (parseInt(value, 16) / 255).toFixed(3)).join(" ")
const text = (value: string, size: number, x: number, y: number, color: string, font = "F1") =>
  `${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${plain(value)}) Tj ET`
const rect = (x: number, y: number, width: number, height: number, color: string) =>
  `${color} rg ${x} ${y} ${width} ${height} re f`
const stroke = (x: number, y: number, width: number, height: number, color: string) =>
  `${color} RG 0.7 w ${x} ${y} ${width} ${height} re S`

export function invoicePdf(invoice: Invoice) {
  const navy = rgb("07111F"), ink = rgb("102033"), muted = rgb("53677B"), cyan = rgb("12BDE0")
  const cyanSoft = rgb("DDF8FC"), pale = rgb("F5FAFC"), line = rgb("C6E9F0"), white = rgb("FFFFFF"), green = rgb("0D9F7D")
  const company = plain(invoice.issuer_company_name) || plain(invoice.client_company_name) || plain(invoice.client_name) || "YOUR COMPANY"
  const number = plain(invoice.invoice_number) || "DRAFT"
  const issued = plain(String(invoice.issue_date || "").slice(0, 10)) || "On creation"
  const due = plain(String(invoice.due_date || "").slice(0, 10)) || "On receipt"
  const clientName = plain(invoice.client_name) || "Client"
  const clientEmail = plain(invoice.client_email)
  const service = wrap(invoice.service_name || "Professional services", 56).slice(0, 2)
  const notes = wrap(invoice.notes || "Thank you for choosing Orbit LM.", 78).slice(0, 3)
  const status = ["draft", "sent", "paid", "overdue", "void"].includes(String(invoice.status || "").toLowerCase()) ? String(invoice.status).toUpperCase() : "DRAFT"
  const total = money(invoice.amount, invoice.currency)

  const commands = [
    rect(0, 0, 595, 842, pale),
    rect(0, 717, 595, 125, navy),
    rect(0, 709, 595, 8, cyan),
    text(company.slice(0, 34), 24, 48, 782, white, "F2"),
    text(invoice.issuer_logo_data ? "INVOICE · VERIFIED BRAND" : "CLIENT BILLING", 8, 49, 765, rgb("92DCEC")),
    text("INVOICE", 10, 426, 786, rgb("9AEAF5"), "F2"),
    text(`# ${number}`, 15, 426, 764, white, "F2"),
    rect(48, 650, 499, 43, white),
    stroke(48, 650, 499, 43, line),
    text("ISSUED", 8, 63, 675, muted, "F2"),
    text(issued, 10, 63, 660, ink),
    text("DUE DATE", 8, 242, 675, muted, "F2"),
    text(due, 10, 242, 660, ink),
    rect(451, 659, 78, 22, status === "PAID" ? rgb("DDF8EF") : cyanSoft),
    text(status, 8, 463, 667, status === "PAID" ? green : cyan, "F2"),
    text("BILL TO", 9, 48, 613, cyan, "F2"),
    text(clientName, 16, 48, 588, ink, "F2"),
    ...(clientEmail ? [text(clientEmail, 10, 48, 570, muted)] : []),
    text("SERVICE SUMMARY", 9, 48, 519, cyan, "F2"),
    rect(48, 424, 499, 72, white),
    stroke(48, 424, 499, 72, line),
    text("DESCRIPTION", 8, 64, 474, muted, "F2"),
    text("AMOUNT", 8, 455, 474, muted, "F2"),
    ...service.map((value, index) => text(value, 12, 64, 452 - index * 15, ink, index === 0 ? "F2" : "F1")),
    text(total, 15, 421, 446, ink, "F2"),
    rect(318, 344, 229, 56, navy),
    text("TOTAL DUE", 9, 337, 378, rgb("9AEAF5"), "F2"),
    text(total, 22, 337, 355, white, "F2"),
    text("NOTES", 9, 48, 349, cyan, "F2"),
    ...notes.map((value, index) => text(value, 10, 48, 326 - index * 16, muted)),
    `${line} RG 0.7 w 48 114 m 547 114 l S`,
    text(company.slice(0, 54), 9, 48, 88, ink, "F2"),
    text("Thank you for your business.", 9, 48, 70, muted),
    text(`Invoice ${number}`, 8, 460, 72, muted),
  ]

  const stream = commands.join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ]
  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  for (let index = 0; index < objects.length; index++) { offsets.push(Buffer.byteLength(pdf, "utf8")); pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n` }
  const xref = Buffer.byteLength(pdf, "utf8")
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, "utf8")
}
