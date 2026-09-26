import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Scene } from '../art'
import { themes } from '../../lib/filters'
import { useMotionEnabled } from '../../lib/motion'
import type { SceneFamily, Theme, Region, Motif, PostcardLook, Photo } from '../../lib/types'
import { illustrationCaption } from '../../lib/format'
import { PhotoImage, PhotoCredit } from '../../features/photos/Photos'
import s from './Content.module.css'
export function Hero({
  photo,
  allowIllustration = false,
  look,
  region,
  motifs,
  editorial = false,
  mobileArtBand = false,
  family,
  seed,
  title,
  kicker,
  children,
}: {
  photo?: Photo
  allowIllustration?: boolean
  look?: PostcardLook
  region?: Region
  motifs?: Motif[]
  editorial?: boolean
  mobileArtBand?: boolean
  family: SceneFamily
  seed: number
  title: string
  kicker: string
  children?: ReactNode
}) {
  const [illustration, setIllustration] = useState(false)
  const motion = useMotionEnabled()
  const caption = region ? illustrationCaption(title, region, motifs) : 'Illustrated landscape. Not a photograph.'
  return (
    <header
      className={`${s.hero} ${editorial ? s.collectionHero : ''} ${mobileArtBand ? s.mobileArtBand : ''} ${photo ? s.photoHero : ''}`}
    >
      <div className={s.heroArt}>
        {photo && !illustration ? (
          <PhotoImage photo={photo} hero />
        ) : (
          <Scene
            look={look}
            family={family}
            seed={seed}
            region={region}
            motifs={motifs}
            framed
            title={caption}
            variant="hero"
            animate={motion}
          />
        )}
      </div>
      {editorial && <span className={s.editorial}>Editorial</span>}
      <div className={s.heroText}>
        <span className="kicker">{kicker}</span>
        <h1>{title}</h1>
        {children}
      </div>
      <div className={s.heroCredit}>
        {photo && !illustration ? (
          <PhotoCredit photo={photo} />
        ) : (
          <span className={s.muted}>{photo ? 'Illustration' : 'Illustration · no photo yet'}</span>
        )}
        {photo && allowIllustration && (
          <button className={s.illustrationAction} onClick={() => setIllustration(!illustration)}>
            {illustration ? 'See photo' : 'See illustration'}
          </button>
        )}
      </div>
    </header>
  )
}
export function ThemeChips({ value, onChange }: { value: Theme | ''; onChange: (value: Theme | '') => void }) {
  return (
    <div className={s.chips} aria-label="Filter by theme">
      <button className="chip" aria-pressed={!value} onClick={() => onChange('')}>
        All themes
      </button>
      {themes.map((t) => (
        <button className="chip" key={t} aria-pressed={value === t} onClick={() => onChange(value === t ? '' : t)}>
          {t}
        </button>
      ))}
    </div>
  )
}
export function Sources({ sources }: { sources: { label: string; url: string }[] }) {
  return (
    <section className={s.section}>
      <h2>Sources</h2>
      <ul className={s.sources}>
        {sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.label} ↗
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
export function PageStatus({ title, error }: { title: string; error?: boolean }) {
  return (
    <main className={s.page}>
      <h1>{title}</h1>
      {error && <p role="alert">Please refresh to try again.</p>}
      <Link viewTransition className="btn btn-ghost" to="/">
        Back to the map
      </Link>
    </main>
  )
}
