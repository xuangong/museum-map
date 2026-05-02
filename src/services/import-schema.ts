export interface MuseumArtifact {
  name: string
  period?: string
  description?: string
}

export interface MuseumDynastyConnection {
  dynasty: string
  description?: string
}

export interface MuseumPayload {
  name: string
  lat: number
  lng: number
  location?: string
  level?: string
  corePeriod?: string
  specialty?: string
  dynastyCoverage?: string
  timeline?: string
  treasures?: string[]
  halls?: string[]
  artifacts?: MuseumArtifact[]
  dynastyConnections?: MuseumDynastyConnection[]
  sources?: string[]
}

export const MUSEUM_PAYLOAD_SCHEMA = {
  type: "object",
  required: ["name", "lat", "lng"],
  properties: {
    name: { type: "string" },
    lat: { type: "number" },
    lng: { type: "number" },
    location: { type: "string" },
    level: { type: "string" },
    corePeriod: { type: "string" },
    specialty: { type: "string" },
    dynastyCoverage: { type: "string" },
    timeline: { type: "string" },
    treasures: { type: "array", items: { type: "string" } },
    halls: { type: "array", items: { type: "string" } },
    artifacts: {
      type: "array",
      items: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          period: { type: "string" },
          description: { type: "string" },
        },
      },
    },
    dynastyConnections: {
      type: "array",
      items: {
        type: "object",
        required: ["dynasty"],
        properties: {
          dynasty: { type: "string" },
          description: { type: "string" },
        },
      },
    },
    sources: { type: "array", items: { type: "string" } },
  },
}

export const MUSEUM_FRAGMENT_SCHEMA = {
  ...MUSEUM_PAYLOAD_SCHEMA,
  required: [],
}

export function validateMuseumPayload(
  input: any,
): { ok: true; value: MuseumPayload } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "payload must be an object" }
  if (typeof input.name !== "string" || !input.name.trim()) return { ok: false, error: "name required" }
  if (typeof input.lat !== "number" || !Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) {
    return { ok: false, error: "lat must be a number in [-90, 90]" }
  }
  if (typeof input.lng !== "number" || !Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) {
    return { ok: false, error: "lng must be a number in [-180, 180]" }
  }
  return { ok: true, value: input as MuseumPayload }
}

/** Per-field source URLs.
 * - scalar fields: single URL string (the last fragment that supplied a non-empty value)
 * - array fields: parallel array of URLs (one per item, in the same order as the value array)
 */
export interface Provenance {
  name?: string
  lat?: string
  lng?: string
  location?: string
  level?: string
  corePeriod?: string
  specialty?: string
  dynastyCoverage?: string
  timeline?: string
  treasures?: string[]
  halls?: string[]
  artifacts?: string[]
  dynastyConnections?: string[]
  sources?: string[]
}

/** Merge a partial fragment into accumulator. Scalars: later wins (if non-empty). Arrays: concat + dedupe by lower-cased key. */
export function mergeFragment(
  acc: Partial<MuseumPayload>,
  frag: Partial<MuseumPayload>,
): Partial<MuseumPayload> {
  return mergeFragmentWithProvenance({ payload: acc, provenance: {} }, frag, "").payload
}

/** Same as mergeFragment but also tracks where each field came from. */
export function mergeFragmentWithProvenance(
  state: { payload: Partial<MuseumPayload>; provenance: Provenance },
  frag: Partial<MuseumPayload>,
  fragUrl: string,
): { payload: Partial<MuseumPayload>; provenance: Provenance } {
  const out: any = { ...state.payload }
  const prov: any = { ...state.provenance }
  const scalarKeys = ["name", "lat", "lng", "location", "level", "corePeriod", "specialty", "dynastyCoverage", "timeline"]
  for (const k of scalarKeys) {
    const v = (frag as any)[k]
    if (v !== undefined && v !== null && v !== "") {
      out[k] = v
      if (fragUrl) prov[k] = fragUrl
    }
  }
  const treas = mergeArrayWithProv(
    state.payload.treasures ?? [],
    state.provenance.treasures ?? [],
    frag.treasures ?? [],
    fragUrl,
    (s) => s,
  )
  out.treasures = treas.values
  prov.treasures = treas.urls

  const halls = mergeArrayWithProv(
    state.payload.halls ?? [],
    state.provenance.halls ?? [],
    frag.halls ?? [],
    fragUrl,
    (s) => s,
  )
  out.halls = halls.values
  prov.halls = halls.urls

  const sources = mergeArrayWithProv(
    state.payload.sources ?? [],
    state.provenance.sources ?? [],
    frag.sources ?? [],
    fragUrl,
    (s) => s,
  )
  out.sources = sources.values
  prov.sources = sources.urls

  const arts = mergeArrayWithProv(
    state.payload.artifacts ?? [],
    state.provenance.artifacts ?? [],
    frag.artifacts ?? [],
    fragUrl,
    (a: any) => a.name,
  )
  out.artifacts = arts.values
  prov.artifacts = arts.urls

  const dyns = mergeArrayWithProv(
    state.payload.dynastyConnections ?? [],
    state.provenance.dynastyConnections ?? [],
    frag.dynastyConnections ?? [],
    fragUrl,
    (d: any) => d.dynasty,
  )
  out.dynastyConnections = dyns.values
  prov.dynastyConnections = dyns.urls

  return { payload: out, provenance: prov }
}

export interface FlatProvenanceRow {
  field_path: string
  source_url: string | null
  authority: string | null
  recorded_at: number
}

/** Walk a payload + Provenance map and emit one flat row per scalar leaf.
 * Sources array is intentionally skipped (recording provenance for source URLs is meta-circular).
 * `now` and `classify` are injected to keep this module pure / testable. */
export function flattenProvenance(
  payload: Partial<MuseumPayload>,
  prov: Provenance,
  classify: (url: string) => string,
  now: () => number = Date.now,
): FlatProvenanceRow[] {
  const out: FlatProvenanceRow[] = []
  const ts = now()
  const push = (path: string, url?: string | null) => {
    const u = url && url.trim() ? url : null
    out.push({
      field_path: path,
      source_url: u,
      authority: u ? classify(u) : null,
      recorded_at: ts,
    })
  }

  const scalarKeys: (keyof Provenance)[] = [
    "name",
    "lat",
    "lng",
    "location",
    "level",
    "corePeriod",
    "specialty",
    "dynastyCoverage",
    "timeline",
  ]
  for (const k of scalarKeys) {
    const v = (payload as any)[k]
    if (v === undefined || v === null || v === "") continue
    const url = (prov as any)[k] as string | undefined
    push(String(k), url)
  }

  ;(payload.treasures ?? []).forEach((_, i) => {
    push(`treasures[${i}]`, prov.treasures?.[i])
  })
  ;(payload.halls ?? []).forEach((_, i) => {
    push(`halls[${i}]`, prov.halls?.[i])
  })
  ;(payload.artifacts ?? []).forEach((a, i) => {
    const url = prov.artifacts?.[i]
    push(`artifacts[${i}].name`, url)
    if (a.period) push(`artifacts[${i}].period`, url)
    if (a.description) push(`artifacts[${i}].description`, url)
  })
  ;(payload.dynastyConnections ?? []).forEach((c, i) => {
    const url = prov.dynastyConnections?.[i]
    push(`dynastyConnections[${i}].dynasty`, url)
    if (c.description) push(`dynastyConnections[${i}].description`, url)
  })

  return out
}

function mergeArrayWithProv<T>(
  accVals: T[],
  accUrls: string[],
  fragVals: T[],
  fragUrl: string,
  key: (x: T) => string,
): { values: T[]; urls: string[] } {
  const seen = new Map<string, number>()
  const values: T[] = []
  const urls: string[] = []
  for (let i = 0; i < accVals.length; i++) {
    const k = String(key(accVals[i]!)).trim().toLowerCase()
    if (!k || seen.has(k)) continue
    seen.set(k, values.length)
    values.push(accVals[i]!)
    urls.push(accUrls[i] ?? "")
  }
  for (const v of fragVals) {
    const k = String(key(v)).trim().toLowerCase()
    if (!k || seen.has(k)) continue
    seen.set(k, values.length)
    values.push(v)
    urls.push(fragUrl)
  }
  return { values, urls }
}
