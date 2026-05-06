export interface MuseumListItem {
  id: string
  name: string
  lat: number
  lng: number
  level: string | null
  tiers: string[]
  corePeriod: string | null
  dynastyCoverage: string | null
  pinyin?: string
  pinyinInitials?: string
}

export interface MuseumArtifact {
  name: string
  period: string | null
  description: string | null
  image: string | null
  imageLicense: string | null
  imageAttribution: string | null
}

export interface MuseumDynastyConnection {
  dynasty: string
  description: string | null
}

export interface MuseumFull extends MuseumListItem {
  location: string | null
  specialty: string | null
  timeline: string | null
  treasures: string[]
  halls: string[]
  artifacts: MuseumArtifact[]
  dynastyConnections: MuseumDynastyConnection[]
  sources: string[]
}

export interface DynastyEvent {
  date: string
  event: string
  lat: number | null
  lng: number | null
}

export interface DynastyCulture {
  category: string
  description: string | null
}

export interface DynastyRecommendedMuseum {
  museumId: string | null
  name: string
  location: string | null
  reason: string | null
}

export interface DynastyRelatedMuseum {
  museumId: string
  name: string
  location: string | null
  reason: string
}

export interface DynastyFull {
  id: string
  name: string
  period: string | null
  center: { lat: number | null; lng: number | null }
  overview: string | null
  events: DynastyEvent[]
  culture: DynastyCulture[]
  recommendedMuseums: DynastyRecommendedMuseum[]
  relatedMuseums: DynastyRelatedMuseum[]
}
