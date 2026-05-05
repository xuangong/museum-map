import { UsersRepo } from "~/repo/users"
import { generateToken } from "~/lib/crypto"

function slug(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
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
