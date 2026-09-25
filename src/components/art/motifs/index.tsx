import type { ComponentType } from 'react'
import type { Motif, PostcardLook, SceneFamily } from '../../../lib/types'
import type { Inks, MotifProps } from './types'
import { RiverBluffs, LakeWide, LockAndDam, Paddlewheeler, Sandbars, LimestoneLedges, Lighthouse, SeaRock, WaterfallCove } from './water'
import { RollingRidges, SnowPeaks, Switchbacks, Hoodoos, SlickrockRidge, Aspens, Orchard, RhododendronBald } from './terrain'
import { SteepleTown, HarborVillage, Gristmill, Viaduct, ArchBridge, MiningTown } from './buildings'

export const landmarks = {
  'river-bluffs': { draw: RiverBluffs, family: 'river' },
  'lake-wide': { draw: LakeWide, family: 'river' },
  'lock-and-dam': { draw: LockAndDam, family: 'river' },
  paddlewheeler: { draw: Paddlewheeler, family: 'river' },
  sandbars: { draw: Sandbars, family: 'river' },
  'steeple-town': { draw: SteepleTown, family: 'town' },
  'harbor-village': { draw: HarborVillage, family: 'coast' },
  lighthouse: { draw: Lighthouse, family: 'coast' },
  'limestone-ledges': { draw: LimestoneLedges, family: 'coast' },
  orchard: { draw: Orchard, family: 'prairie' },
  'rolling-ridges': { draw: RollingRidges, family: 'mountain' },
  gristmill: { draw: Gristmill, family: 'forest' },
  viaduct: { draw: Viaduct, family: 'mountain' },
  'rhododendron-bald': { draw: RhododendronBald, family: 'mountain' },
  'snow-peaks': { draw: SnowPeaks, family: 'mountain' },
  switchbacks: { draw: Switchbacks, family: 'mountain' },
  'mining-town': { draw: MiningTown, family: 'mountain' },
  aspens: { draw: Aspens, family: 'forest' },
  hoodoos: { draw: Hoodoos, family: 'desert' },
  'slickrock-ridge': { draw: SlickrockRidge, family: 'desert' },
  'arch-bridge': { draw: ArchBridge, family: 'coast' },
  'sea-rock': { draw: SeaRock, family: 'coast' },
  'waterfall-cove': { draw: WaterfallCove, family: 'coast' },
} satisfies Record<Motif, { draw: ComponentType<MotifProps>; family: SceneFamily }>

export function Motifs({
  motifs,
  inks,
  height,
  hero,
  look,
}: {
  motifs: Motif[]
  inks: Inks
  height: number
  hero: boolean
  look?: PostcardLook
}) {
  const selected = [...new Set(motifs)].slice(0, 3)
  const distantLandform = (motif: Motif) => motif === 'snow-peaks' || motif === 'rolling-ridges' || motif === 'lake-wide'
  // In heroes, bring the landmark forward while keeping broad terrain behind it.
  if (hero) selected.sort((a, b) => Number(distantLandform(a)) - Number(distantLandform(b)))
  const islandLight = selected.includes('lighthouse') && selected.includes('sea-rock')
  // Combine the island and tower in the higher-priority slot.
  const combined = islandLight ? selected.filter((m) => m !== (selected[0] === 'sea-rock' ? 'lighthouse' : 'sea-rock')) : selected
  const scale = Math.min(1, height / 260)
  const isBackdrop = (motif: Motif, index: number) => index > 0 && distantLandform(motif)
  // Distant landforms go behind even the smallest foreground detail.
  const layers = combined
    .map((motif, index) => ({ motif, index }))
    .sort((a, b) => Number(isBackdrop(b.motif, b.index)) - Number(isBackdrop(a.motif, a.index)) || b.index - a.index)
  return (
    <g stroke={inks.dark} strokeWidth=".8" strokeLinejoin="round">
      {layers.map(({ motif, index }) => {
        const Draw = islandLight && (motif === 'lighthouse' || motif === 'sea-rock') ? SeaRock : landmarks[motif].draw
        const backdrop = isBackdrop(motif, index)
        const size = backdrop ? scale * 1.25 : scale * (index === 0 ? (hero ? 0.82 : 1) : index === 1 ? 0.62 : 0.43)
        // Motifs occupy roughly 200 units; center the hero lead in the right 55%.
        const center = index === 0 ? 290 : index === 1 ? 345 : 365
        const x = hero ? (backdrop ? 155 : center - 100 * size) : backdrop ? 25 : index === 0 ? 166 : index === 1 ? 12 : 92
        const offset = look ? [0, -100, -45][look.layout % 3] : 0
        const ground = height * (backdrop ? (hero ? 0.62 : 0.76) : index === 2 ? 0.94 : index === 1 ? 0.67 : 0.84)
        return (
          <g
            key={motif}
            data-motif={motif}
            transform={`translate(${x + (index === 0 && !hero ? offset : 0)} ${ground - 150 * size}) scale(${size})`}
          >
            <Draw inks={inks} lighthouse={islandLight} />
          </g>
        )
      })}
    </g>
  )
}
