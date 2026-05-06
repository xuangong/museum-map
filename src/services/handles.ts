import { UsersRepo } from "~/repo/users"
import { generateToken } from "~/lib/crypto"

function slug(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
}

// Public validator: returns the canonical handle if valid, else null.
// Rules: 2..24 chars after normalization, allowed chars [a-z 0-9 CJK -].
export function normalizeHandle(input: string): string | null {
  const s = slug(input)
  if (s.length < 2) return null
  return s
}

export async function ensureHandle(repo: UsersRepo, userId: string, hint?: string | null): Promise<string> {
  const me = await repo.findById(userId)
  if (!me) throw new Error("user_not_found")
  if (me.handle) return me.handle
  const seedRaw = (hint || me.display_name || me.email.split("@")[0] || "user").trim()
  const seed = slug(seedRaw) || "user"
  const candidates = [seed, `${seed}-${generateToken(2)}`, `${seed}-${generateToken(3)}`, `u-${generateToken(4)}`]
  for (const c of candidates) {
    if (!c) continue
    const existing = await repo.findByHandle(c)
    if (!existing) {
      await repo.setHandle(userId, c)
      return c
    }
  }
  // Fallback: random
  const fallback = `u-${generateToken(6)}`
  await repo.setHandle(userId, fallback)
  return fallback
}
