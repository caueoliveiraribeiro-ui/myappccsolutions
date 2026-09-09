import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { db } from "@/lib/supabase"

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const key = () => createHash("sha256").update(process.env.SESSION_SECRET || "").digest()
const base32 = (bytes: Buffer) => {
  let bits = 0, value = 0, out = ""
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5 } }
  return bits ? out + alphabet[(value << (5 - bits)) & 31] : out
}
const decode = (value: string) => {
  let bits = 0, buffer = 0; const out: number[] = []
  for (const char of value.replace(/\s|=/g, "").toUpperCase()) { const index = alphabet.indexOf(char); if (index < 0) throw new Error("Invalid authenticator secret."); buffer = (buffer << 5) | index; bits += 5; if (bits >= 8) { out.push((buffer >>> (bits - 8)) & 255); bits -= 8 } }
  return Buffer.from(out)
}
const encrypt = (plain: string) => { const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv); const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]); return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".") }
const decrypt = (encoded: string) => { const [iv, tag, body] = encoded.split("."); const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url")); decipher.setAuthTag(Buffer.from(tag, "base64url")); return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8") }
const hotp = (secret: string, counter: number) => { const bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(BigInt(counter)); const digest = createHmac("sha1", decode(secret)).update(bytes).digest(); const offset = digest[digest.length - 1] & 15; return String(((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000)).padStart(6, "0") }
export const verifyTotp = (secret: string, code: string) => { if (!/^\d{6}$/.test(code)) return false; const current = Math.floor(Date.now() / 30_000); return [-1, 0, 1].some(offset => { const expected = Buffer.from(hotp(secret, current + offset)); const supplied = Buffer.from(code); return expected.length === supplied.length && timingSafeEqual(expected, supplied) }) }
const hashRecovery = (value: string) => createHash("sha256").update(value).digest("hex")

export async function mfaRecord(userId: string) { const rows = await db(`orbit_admin_mfa?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`).catch(() => []); return rows?.[0] || null }
export async function createMfaSetup(userId: string, email: string) {
  const secret = base32(randomBytes(20)); const recoveryCodes = Array.from({ length: 8 }, () => randomBytes(5).toString("hex").toUpperCase())
  await db("orbit_admin_mfa?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ user_id: userId, secret_ciphertext: encrypt(secret), recovery_code_hashes: recoveryCodes.map(hashRecovery), enabled_at: null, updated_at: new Date().toISOString() }) })
  return { secret, recoveryCodes, uri: `otpauth://totp/Orbit%20LM:${encodeURIComponent(email)}?secret=${secret}&issuer=Orbit%20LM&algorithm=SHA1&digits=6&period=30` }
}
export async function confirmMfa(userId: string, code: string) { const record = await mfaRecord(userId); if (!record || !verifyTotp(decrypt(record.secret_ciphertext), code)) return false; await db(`orbit_admin_mfa?user_id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify({ enabled_at: record.enabled_at || new Date().toISOString(), last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }) }); return true }
export async function verifyMfa(userId: string, code: string) { const record = await mfaRecord(userId); if (!record?.enabled_at) return { required: false, valid: true }; const secret = decrypt(record.secret_ciphertext); let valid = verifyTotp(secret, code); if (!valid && /^[A-F0-9]{10}$/i.test(code)) { const hashes = Array.isArray(record.recovery_code_hashes) ? record.recovery_code_hashes : []; const wanted = hashRecovery(code.toUpperCase()); if (hashes.includes(wanted)) { valid = true; await db(`orbit_admin_mfa?user_id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify({ recovery_code_hashes: hashes.filter((hash: string) => hash !== wanted), last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }) } ) } }
  if (valid) await db(`orbit_admin_mfa?user_id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify({ last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }) })
  return { required: true, valid }
}
