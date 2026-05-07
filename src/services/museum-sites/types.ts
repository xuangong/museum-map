export interface MuseumSiteCandidate {
  url: string       // direct image URL
  title: string     // site's own caption / artifact name
  pageUrl: string   // collection page where the image lives (for attribution)
}

export interface MuseumSiteAdapter {
  /** Stable id matching the museum row's primary key in D1 */
  museumId: string
  /** Human label used in attribution captions */
  sourceLabel: string
  find: (opts: {
    artifactName: string
    period?: string | null
    fetcher?: typeof fetch
  }) => Promise<MuseumSiteCandidate[]>
}
