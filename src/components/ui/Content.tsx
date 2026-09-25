import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Scene } from '../art'
import { themes } from '../../lib/filters'
import { useMotionEnabled } from '../../lib/motion'
import type { SceneFamily, Theme } from '../../lib/types'
import s from './Content.module.css'
export function Hero({
  family,
  seed,
  title,
  kicker,
  children,
}: {
  family: SceneFamily
  seed: number
  title: string
  kicker: string
  children?: ReactNode
}) {
  const motion = useMotionEnabled()
  return (
    <header className={s.hero}>
      <div className={s.heroArt}>
        <Scene family={family} seed={seed} variant="hero" animate={motion} />
      </div>
      <div className={s.heroText}>
        <span className="kicker">{kicker}</span>
        <h1>{title}</h1>
        {children}
      </div>
      <span className={s.credit}>Illustration</span>
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
      <Link className="btn btn-ghost" to="/">
        Back to the atlas
      </Link>
    </main>
  )
}
