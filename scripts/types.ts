export interface MuseumJson {
  id: string
  name: string
  lat: number
  lng: number
  location?: string
  level?: string
  corePeriod?: string
  specialty?: string
  treasures?: string[]
  halls?: string[]
  artifacts?: { name: string; period?: string; description?: string }[]
  dynastyCoverage?: string
  timeline?: string
  dynastyConnections?: { dynasty: string; description?: string }[]
  sources?: string[]
}

export interface DynastyEventJson {
  date: string
  event: string
  lat?: number
  lng?: number
}

export interface DynastyCultureJson {
  category: string
  description?: string
}

export interface DynastyRecommendedMuseumJson {
  museumId?: string
  name: string
  location?: string
  reason?: string
}

export interface DynastyJson {
  id: string
  name: string
  period?: string
  center?: { lat?: number; lng?: number }
  overview?: string
  events?: DynastyEventJson[]
  culture?: DynastyCultureJson[]
  recommendedMuseums?: DynastyRecommendedMuseumJson[]
}

export interface DataJson {
  museums: MuseumJson[]
  dynasties: DynastyJson[]
}
