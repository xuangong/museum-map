import { Elysia } from "elysia"
import { STRATA_MODULE } from "~/ui/client/strata"

function shortHash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

// Content-hashed URL so the module can be cached forever and still update on deploy.
export const STRATA_SRC = `/assets/strata.js?v=${shortHash(STRATA_MODULE)}`

export const assetsRoute = new Elysia().get(
  "/assets/strata.js",
  () =>
    new Response(STRATA_MODULE, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    }),
)
