export type LandmarkKind = 'lighthouse' | 'bridge' | 'waterfall' | 'mountain' | 'rock' | 'mill' | 'boat' | 'tree' | 'town'

export function landmarkKind(kind: string, scene: string, motifs: readonly string[] = []): LandmarkKind {
  const detail = [kind, ...motifs].join(' ').toLowerCase()
  if (/lighthouse/.test(detail)) return 'lighthouse'
  if (/bridge|viaduct/.test(detail)) return 'bridge'
  if (/waterfall|falls/.test(detail)) return 'waterfall'
  if (/snow-peaks|switchbacks|peak|\bpass\b|summit|dome|mount|knob|bald|ridge|\bgap\b|notch|glacier/.test(detail)) return 'mountain'
  if (/hoodoo|rock|limestone|ledge|canyon|butte|arch|gorge/.test(detail)) return 'rock'
  if (/mill/.test(detail)) return 'mill'
  if (/harbour|harbor|boat|\blake\b|springs/.test(detail)) return 'boat'
  if (/forest|tree|grove|meadow|visitor center/.test(detail)) return 'tree'
  if (/town|steeple/.test(detail)) return 'town'
  return scene === 'mountain'
    ? 'mountain'
    : scene === 'desert'
      ? 'rock'
      : scene === 'forest'
        ? 'tree'
        : scene === 'coast' || scene === 'river'
          ? 'boat'
          : 'town'
}

const shapes: Record<LandmarkKind, string[]> = {
  lighthouse: ['M17 39 20 15h8l3 24Z', 'M18 15V9h12v6ZM17 9l7-5 7 5', 'M21 23h6M20 30h8'],
  bridge: ['M5 39V22h38v17h-7c0-20-24-20-24 0Z', 'M5 17h38M9 17v5m8-5v5m14-5v5m8-5v5'],
  waterfall: ['M6 8h14v31H6ZM29 8h13v31H29Z', 'M20 10h9v30h-9ZM24 15v18', 'M8 42h32'],
  mountain: ['M4 40 20 8l10 18 5-9 10 23Z', 'm14-20 6-12 7 13-7-4Z'],
  rock: ['M13 40 17 24l-3-6 4-10h13l4 10-5 6 5 16Z', 'M14 18h21M17 24h13'],
  mill: ['M15 40V22l9-8 9 8v18Z', 'M24 22 9 7m15 15L39 7M24 22 9 37m15-15 15 15', 'M21 40v-9h6v9'],
  boat: ['M6 31h36l-8 10H14Z', 'M24 30V6L9 27h15Zm3-20 12 17H27Z'],
  tree: ['M21 41V27h6v14Z', 'M24 5 10 24h7L8 33h32l-9-9h7Z'],
  town: ['M9 40V23h18v17Zm18 0V16h10v24Z', 'M6 23 18 13l12 10M25 16l7-11 7 11', 'M15 40V29h6v11M31 22h2'],
}

export function LandmarkIcon({ kind }: { kind: LandmarkKind }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width="48"
      height="48"
      aria-hidden="true"
      fill="none"
      stroke="#202925"
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {shapes[kind].map((d, i) => (
        <path key={i} d={d} fill={i === 0 ? '#a4b39a' : '#f7f4ed'} />
      ))}
    </svg>
  )
}
