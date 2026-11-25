import { Elysia } from "elysia"
import { STRATA_MODULE } from "~/ui/client/strata"
import { DYNASTY_TERRITORY_JSON } from "~/data/dynasty-territory"
import { PLACE_LINEAGES } from "~/data/place-names"
import { THREADS } from "~/data/threads"

function shortHash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

// Content-hashed URLs so assets can be cached forever and still update on deploy.
export const STRATA_SRC = `/assets/strata.js?v=${shortHash(STRATA_MODULE)}`
/** Approximate dynasty territories — shared by the 3D strata and the 2D map. */
export const TERRITORY_SRC = `/assets/territories.json?v=${shortHash(DYNASTY_TERRITORY_JSON)}`
const PLACE_NAMES_JSON = JSON.stringify(PLACE_LINEAGES)
/** City-level era names for 脚下千年, fetched the first time the panel opens. */
export const PLACE_NAMES_SRC = `/assets/place-names.json?v=${shortHash(PLACE_NAMES_JSON)}`
const THREADS_JSON = JSON.stringify(THREADS)
/** 循迹 threads, fetched when the tab or a back-link first needs them. */
export const THREADS_SRC = `/assets/threads.json?v=${shortHash(THREADS_JSON)}`

const IMMUTABLE = "public, max-age=31536000, immutable"

export const assetsRoute = new Elysia()
  .get(
    "/assets/strata.js",
    () =>
      new Response(STRATA_MODULE, {
        headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": IMMUTABLE },
      }),
  )
  .get(
    "/assets/territories.json",
    () =>
      new Response(DYNASTY_TERRITORY_JSON, {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": IMMUTABLE },
      }),
  )
  .get(
    "/assets/place-names.json",
    () =>
      new Response(PLACE_NAMES_JSON, {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": IMMUTABLE },
      }),
  )
  .get(
    "/assets/threads.json",
    () =>
      new Response(THREADS_JSON, {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": IMMUTABLE },
      }),
  )
