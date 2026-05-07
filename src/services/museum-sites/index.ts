import type { MuseumSiteAdapter } from "./types"
import * as gugong from "./gugong"
import * as chnmuseum from "./chnmuseum"
import * as shanghaimuseum from "./shanghaimuseum"
import * as njmuseum from "./njmuseum"
import * as sxhm from "./sxhm"

export const MUSEUM_SITE_ADAPTERS: MuseumSiteAdapter[] = [
  { museumId: "gugong",   sourceLabel: gugong.sourceLabel,         find: gugong.find },
  { museumId: "guobo",    sourceLabel: chnmuseum.sourceLabel,      find: chnmuseum.find },
  { museumId: "shanghai", sourceLabel: shanghaimuseum.sourceLabel, find: shanghaimuseum.find },
  { museumId: "nanjing",  sourceLabel: njmuseum.sourceLabel,       find: njmuseum.find },
  { museumId: "shaanxi",  sourceLabel: sxhm.sourceLabel,           find: sxhm.find },
]

export function findAdapterFor(museumId: string): MuseumSiteAdapter | null {
  return MUSEUM_SITE_ADAPTERS.find((a) => a.museumId === museumId) ?? null
}
