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

type PdfImage = { bytes: Buffer; width: number; height: number }
function jpegLogo(value: unknown): PdfImage | null {
  const match = String(value || "").match(/^data:image\/jpeg;base64,([a-z0-9+/=\s]+)$/i)
  if (!match) return null
  const bytes = Buffer.from(match[1], "base64")
  if (bytes.length < 10 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  for (let offset = 2; offset + 8 < bytes.length;) {
    if (bytes[offset] !== 0xff) { offset += 1; continue }
    while (bytes[offset] === 0xff) offset += 1
    const marker = bytes[offset++]
    if (marker === 0xd8 || marker === 0xd9) continue
    if (offset + 2 > bytes.length) return null
    const length = bytes.readUInt16BE(offset)
    if (length < 2 || offset + length > bytes.length) return null
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      const height = bytes.readUInt16BE(offset + 3), width = bytes.readUInt16BE(offset + 5)
      return width > 0 && height > 0 ? { bytes, width, height } : null
    }
    offset += length
  }
  return null
}
function fit(image: PdfImage, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height)
  return { width: Number((image.width * scale).toFixed(2)), height: Number((image.height * scale).toFixed(2)) }
}

export function invoicePdf(invoice: Invoice) {
  const navy = rgb("07111F"), ink = rgb("102033"), muted = rgb("53677B"), cyan = rgb("12BDE0")
  const cyanSoft = rgb("DDF8FC"), pale = rgb("F5FAFC"), line = rgb("C6E9F0"), white = rgb("FFFFFF"), green = rgb("0D9F7D")
  const company = plain(invoice.issuer_company_name) || plain(invoice.client_company_name) || plain(invoice.client_name) || "YOUR COMPANY"
  const number = plain(invoice.invoice_number) || "DRAFT"
  const displayNumber = number.replace(/^ORB-/i, "INV-")
  const issued = plain(String(invoice.issue_date || "").slice(0, 10)) || "On creation"
  const due = plain(String(invoice.due_date || "").slice(0, 10)) || "On receipt"
  const clientName = plain(invoice.client_name) || "Client"
  const clientEmail = plain(invoice.client_email)
  const clientAddress = wrap(invoice.client_address, 48).slice(0, 4)
  const service = [...wrap(invoice.service_name || "Professional services", 44), ...wrap(invoice.description || "", 44)].slice(0, 16)
  const status = ["draft", "sent", "paid", "overdue", "void"].includes(String(invoice.status || "").toLowerCase()) ? String(invoice.status).toUpperCase() : "DRAFT"
  const total = money(invoice.amount, invoice.currency)
  const logo = jpegLogo(invoice.issuer_logo_data)
  const logoSize = logo ? fit(logo, 170, 64) : null
  const rightText = (value: string, size: number, right: number, y: number, color: string, font = "F1") => {
    const safe = plain(value)
    // Conservative fitting keeps long invoice references and totals within their columns.
    const fittedSize = Math.min(size, 190 / Math.max(1, safe.length * 0.6))
    return text(safe, fittedSize, right - safe.length * fittedSize * 0.56, y, color, font)
  }
  const headerBrand = logo && logoSize
    ? [rect(42, 720, 194, 88, white),
       `q ${logoSize.width} 0 0 ${logoSize.height} ${42 + (194 - logoSize.width) / 2} ${720 + (88 - logoSize.height) / 2} cm /Logo Do Q`]
    : wrap(company, 24).slice(0, 2).map((value, index) => text(value, 21, 42, 779 - index * 27, white, "F2"))
  const tableTop = 482
  const tableBottom = tableTop - Math.max(112, service.length * 17 + 58)
  const summaryY = tableBottom - 103
  const commands = [
    rect(0, 0, 595, 842, white),
    rect(0, 702, 595, 140, navy),
    rect(0, 698, 595, 4, cyan),
    ...headerBrand,
    rightText("INVOICE", 24, 553, 783, white, "F2"),
    rightText(`# ${displayNumber}`, 12, 553, 758, rgb("9AEAF5"), "F2"),
    rect(435, 715, 118, 25, status === "PAID" ? rgb("DDF8EF") : cyanSoft),
    text(status, 9, 450, 724, status === "PAID" ? green : ink, "F2"),
    text("BILL TO", 9, 42, 660, cyan, "F2"),
    ...wrap(clientName, 30).slice(0, 2).map((value,index) => text(value, 15, 42, 637-index*18, ink, "F2")),
    ...(clientEmail ? [text(clientEmail, 9, 42, 592, muted)] : []),
    ...clientAddress.map((value, index) => text(value, 9, 42, 575 - index * 13, muted)),
    rect(363, 554, 190, 112, pale),
    text("ISSUE DATE", 8, 379, 643, muted, "F2"),
    text(issued, 11, 379, 626, ink),
    text("DUE DATE", 8, 379, 602, muted, "F2"),
    text(due, 11, 379, 585, ink, "F2"),
    text("SERVICE DETAILS", 9, 42, 505, cyan, "F2"),
    rect(42, tableBottom, 511, tableTop-tableBottom, pale),
    rect(42, tableTop-32, 511, 32, navy),
    text("DESCRIPTION", 9, 58, tableTop-21, white, "F2"),
    rightText("AMOUNT", 9, 537, tableTop-21, white, "F2"),
    ...service.map((value,index) => text(value, 11, 58, tableTop-58-index*17, ink)),
    rightText(total, 13, 537, tableTop-58, ink, "F2"),
    stroke(42, tableBottom, 511, tableTop-tableBottom, line),
    text("PAYMENT REFERENCE", 8, 42, summaryY+61, muted, "F2"),
    ...wrap(displayNumber, 34).map((value,index) => text(value, 10, 42, summaryY+42-index*14, ink)),
    text("Please include this reference with your payment.", 8, 42, summaryY+10, muted),
    rect(330, summaryY, 223, 80, navy),
    rect(330, summaryY, 4, 80, cyan),
    text("INVOICE TOTAL", 9, 349, summaryY+57, rgb("9AEAF5"), "F2"),
    rightText(total, 24, 537, summaryY+23, white, "F2"),
    `${line} RG 0.7 w 42 105 m 553 105 l S`,
    text("Thank you for your business.", 12, 42, 80, ink, "F2"),
    text(company.slice(0, 65), 9, 42, 61, muted),
    rightText("1 / 1", 8, 553, 61, muted),
  ]

  const stream = commands.join("\n")
  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >>${logo ? " /XObject << /Logo 7 0 R >>" : ""} >> /Contents 4 0 R >>`),
    Buffer.from(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"),
    ...(logo ? [Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`), logo.bytes, Buffer.from("\nendstream")])] : []),
  ]
  let pdf = Buffer.from("%PDF-1.4\n")
  const offsets = [0]
  for (let index = 0; index < objects.length; index++) {
    offsets.push(pdf.length)
    pdf = Buffer.concat([pdf, Buffer.from(`${index + 1} 0 obj\n`), objects[index], Buffer.from("\nendobj\n")])
  }
  const xref = pdf.length
  const trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.concat([pdf, Buffer.from(trailer)])
}
