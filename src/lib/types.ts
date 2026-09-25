// Shared data contract between the ingest scripts (scripts/ingest) and the app.
// Byway IDs are stable slugs `<name-slug>-<BYWAY_ID>` and are used everywhere: map feature ids, URLs, collections, passport records.

export type Theme = 'water' | 'coast' | 'mountain' | 'forest' | 'desert' | 'historic' | 'countryside'

/** Illustration family used for postcards, heroes, and stamps. */
export type SceneFamily = 'river' | 'coast' | 'mountain' | 'forest' | 'desert' | 'town' | 'prairie'

/** Editorial completeness, not road condition. See blueprint §7. */
export type EditorialStatus = 'listing' | 'draft-story' | 'curated-story'

export interface BywaySummary {
  id: string
  sourceId: number
  name: string
  states: string[]
  designations: string[]
  nationalScenicByway: boolean
  allAmericanRoad: boolean
  /** Sum of source LENGTH (miles) over all mapped segments. Divided carriageways can be counted twice. */
  mappedMiles: number
  /** Per-state mapped miles, assigned by segment midpoint. Only present for multi-state byways. */
  stateMiles?: Record<string, number>
  bbox: [number, number, number, number]
  center: [number, number]
  themes: Theme[]
  themeSource: 'inferred' | 'curated'
  scene: SceneFamily
  status: EditorialStatus
  /** Deterministic seed for procedural illustration variety. */
  seed: number
}

export interface StoryMoment {
  title: string
  kind: 'roadside' | 'short walk' | 'separate excursion' | 'town'
  text: string
  scene: SceneFamily
  /** [lng, lat] approximate anchor for the companion map. */
  at?: [number, number]
}

export interface BywayStory {
  id: string
  tagline: string
  intro: string[]
  moments: StoryMoment[]
  season?: string
  practical?: string[]
  sources: { label: string; url: string }[]
  reviewed: boolean
}

export interface Collection {
  slug: string
  title: string
  kicker: string
  intro: string
  scene: SceneFamily
  bywayIds: string[]
}

export type VisitScope = 'part' | 'whole'

export interface Visit {
  id: string
  bywayId: string
  date: string
  scope: VisitScope
  note: string
  createdAt: string
}
