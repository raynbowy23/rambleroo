import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { collections, useCatalog } from '../../lib/data'
import { usePassport, visitedBywayIds } from '../../lib/passport'
import type { Theme } from '../../lib/types'
import { Scene } from '../../components/art'
import { Hero, PageStatus, ThemeChips } from '../../components/ui/Content'
import { RouteMap } from '../../components/ui/RouteMap'
import { Postcard } from '../explore/Postcard'
import s from '../../components/ui/Content.module.css'
export default function CollectionsPage() {
  const { slug } = useParams()
  const collection = collections.find((c) => c.slug === slug)
  const { byId, status } = useCatalog()
  const passport = usePassport()
  const [theme, setTheme] = useState<Theme | ''>('')
  const roads = useMemo(
    () =>
      collection?.bywayIds.flatMap((id) => {
        const b = byId.get(id)
        return b ? [b] : []
      }) ?? [],
    [collection, byId],
  )
  if (slug && !collection) return <PageStatus title="Collection not found" />
  if (status === 'error') return <PageStatus title="The catalog could not be loaded" error />
  if (status === 'loading') return <PageStatus title="Opening collections…" />
  if (collection) {
    const visited = visitedBywayIds(passport)
    return (
      <main>
        <Hero
          family={collection.scene}
          seed={collections.indexOf(collection) + 1}
          title={collection.title}
          kicker={collection.kicker}
          editorial
        >
          <p className={s.subline}>{collection.intro}</p>
          <p>
            {collection.bywayIds.length} byways · You've visited {collection.bywayIds.filter((id) => visited.has(id)).length} of{' '}
            {collection.bywayIds.length}
          </p>
          <div className={s.actions}>
            <Link viewTransition className="btn btn-ghost" to="/collections">
              All collections
            </Link>
          </div>
        </Hero>
        <div className={s.page}>
          <RouteMap byways={roads} label={`Roads in ${collection.title}`} />
          <section className={s.section}>
            <h2>The roads in this collection</h2>
            <div className={s.grid}>
              {collection.bywayIds.map((id) => {
                const b = byId.get(id)
                return b ? (
                  <Postcard layout="card" key={id} byway={b} />
                ) : (
                  <article className={s.pending} key={id}>
                    <h3>Road unavailable</h3>
                    <p>This member is not currently in the catalog.</p>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </main>
    )
  }
  const shown = collections.filter((c) => !theme || c.bywayIds.some((id) => byId.get(id)?.themes.includes(theme)))
  return (
    <main className={s.page}>
      <div className={s.collectionIntro}>
        <span className="kicker">Editorial collections</span>
        <h1>Collections</h1>
        <p className={s.subline}>A few roads with something in common.</p>
        <p>Explore small, handpicked sets from the byway catalog.</p>
      </div>
      <ThemeChips value={theme} onChange={setTheme} />
      <div className={s.grid}>
        {shown.map((c) => (
          <Link viewTransition className={s.cover} to={`/collections/${c.slug}`} key={c.slug}>
            <Scene family={c.scene} seed={collections.indexOf(c) + 1} variant="cover" />
            <span className={s.editorial}>Editorial</span>
            <span className={s.credit}>Illustration</span>
            <div className={s.coverText}>
              <span className="kicker">{c.kicker}</span>
              <h2>{c.title}</h2>
              <div className={s.coverFooter}>
                <span>{c.bywayIds.length} byways</span>
                <span className={s.arrow} aria-hidden="true">
                  →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {!shown.length && <p>No collections match this theme yet.</p>}
      {!!Object.keys(passport.saved).length && (
        <section className={s.section}>
          <Link viewTransition className={s.personal} to="/passport#saved">
            <span className="kicker">Yours</span>
            <h2>Your saved roads →</h2>
            <p>{Object.keys(passport.saved).length} saved roads · Saved in this browser</p>
          </Link>
        </section>
      )}
    </main>
  )
}
