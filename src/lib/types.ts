// Shared data contract between the ingest scripts (scripts/ingest) and the app.
// Byway IDs are stable slugs `<name-slug>-<BYWAY_ID>` and are used everywhere: map feature ids, URLs, collections, passport records.

export type Theme = 'water' | 'coast' | 'mountain' | 'forest' | 'desert' | 'historic' | 'countryside'

/** Illustration family used for postcards, heroes, and stamps. */
export type SceneFamily = 'river' | 'coast' | 'mountain' | 'forest' | 'desert' | 'town' | 'prairie'

/** Landscape region, inferred from the state containing the byway's label point. Drives regional vegetation, landforms and palette in illustrations. */
export type Region =
  | 'pacific-northwest'
  | 'california'
  | 'southwest'
  | 'rockies'
  | 'great-plains'
  | 'upper-midwest'
  | 'great-lakes'
  | 'ozarks'
  | 'deep-south'
  | 'florida'
  | 'appalachia'
  | 'mid-atlantic'
  | 'new-england'
  | 'alaska'
  | 'hawaii'

/** Named landmark or landform drawn into an illustration. Only used where editorial content says the place has it. */
export type Motif =
  | 'river-bluffs'
  | 'lake-wide'
  | 'lock-and-dam'
  | 'paddlewheeler'
  | 'sandbars'
  | 'steeple-town'
  | 'harbor-village'
  | 'lighthouse'
  | 'limestone-ledges'
  | 'orchard'
  | 'rolling-ridges'
  | 'gristmill'
  | 'viaduct'
  | 'rhododendron-bald'
  | 'snow-peaks'
  | 'switchbacks'
  | 'mining-town'
  | 'aspens'
  | 'hoodoos'
  | 'slickrock-ridge'
  | 'arch-bridge'
  | 'sea-rock'
  | 'waterfall-cove'

/** Postcard art direction assigned at build time so no two byways share the same combination (see scripts/ingest/looks.ts). */
export interface PostcardLook {
  /** Index into the scene family's palette set. */
  palette: number
  /** Composition template within the family. */
  layout: number
  /** Seasonal colouring; the art kit softens it for regions where a season doesn't read (e.g. no snow in Florida). */
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  time: 'dawn' | 'day' | 'golden' | 'dusk'
  /** Postcard title lettering style. */
  lettering: 'greetings' | 'ribbon' | 'block' | 'script' | 'banner'
  border: 'white' | 'deckle' | 'linen' | 'scallop'
  mirror: boolean
}

/** A rights-cleared photograph with its credit. Stored locally under public/photos/. */
export interface Photo {
  bywayId: string
  /** Story moment title this photo shows, if any. */
  moment?: string
  file: string
  width: number
  height: number
  title: string
  alt: string
  author: string
  license: string
  licenseUrl: string
  sourceUrl: string
}

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
  region: Region
  look: PostcardLook
  /** Deterministic seed for procedural illustration variety. */
  seed: number
}

export interface StoryMoment {
  title: string
  kind: 'roadside' | 'short walk' | 'separate excursion' | 'town'
  text: string
  scene: SceneFamily
  /** Landmark motifs for the illustration; omit when no specific landmark applies. */
  motifs?: Motif[]
  /** [lng, lat] approximate anchor for the companion map. */
  at?: [number, number]
}

export interface BywayStory {
  id: string
  tagline: string
  /** Motifs for the story hero and postcard, most characteristic first. */
  motifs?: Motif[]
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
