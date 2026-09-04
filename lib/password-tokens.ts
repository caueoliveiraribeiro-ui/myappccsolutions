import { createHash } from "node:crypto"

export function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}
