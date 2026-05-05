import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto"

const N = 16384
const r = 8
const p = 1
const KEYLEN = 32
const SALT_BYTES = 16

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_BYTES)
  const hash = scryptSync(plain, salt, KEYLEN, { N, r, p })
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored || typeof stored !== "string") return false
  const parts = stored.split("$")
  if (parts.length !== 3 || parts[0] !== "scrypt") return false
  try {
    const salt = Buffer.from(parts[1]!, "base64")
    const expected = Buffer.from(parts[2]!, "base64")
    const actual = scryptSync(plain, salt, expected.length, { N, r, p })
    if (actual.length !== expected.length) return false
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function generateToken(byteLen: number): string {
  return randomBytes(byteLen).toString("hex")
}
