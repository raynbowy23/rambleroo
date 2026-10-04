import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { stateChapters, useCatalog, firstPhoto } from '../../lib/data'
import { states } from '../../lib/states'
import type { Theme } from '../../lib/types'
import { Hero, PageStatus, Sources, ThemeChips } from '../../components/ui/Content'
import { RouteMap } from '../../components/ui/RouteMap'
import { Postcard } from '../explore/Postcard'
import s from '../../components/ui/Content.module.css'
export default function StatePage() {
  const code = (useParams().code ?? '').toUpperCase()
  const chapter = stateChapters[code]
  const { byways, byId, status } = useCatalog()
  const [theme, setTheme] = useState<Theme | ''>('')
  const roads = useMemo(
    () =>
      byways
        .filter((b) => b.states.includes(code))
        .sort((a, b) => Number(a.status === 'listing') - Number(b.status === 'listing') || a.name.localeCompare(b.name)),
    [byways, code],
  )
  if (!states[code]) return <PageStatus title="State not found" />
  if (status === 'loading') return <PageStatus title={`Opening ${states[code]}…`} />
  if (status === 'error') return <PageStatus title="The catalog could not be loaded" error />
  const members = chapter?.programs.flatMap((p) => p.members.flatMap((m) => (m.bywayId ? [m.bywayId] : []))) ?? []
  const first = byId.get(members[0]) ?? roads[0]
  return (
    <main>
      <Hero
        photo={firstPhoto([...members, ...roads.map((road) => road.id)])}
        region={first?.region}
        family={first?.scene ?? 'prairie'}
        seed={first?.seed ?? 1}
        title={states[code]}
        kicker="State chapter"
      >
        {chapter ? (
          <>
            <p className={s.subline}>{chapter.tagline}</p>
            <p>{chapter.intro}</p>
          </>
        ) : (
          <>
            <p className={s.subline}>
              {roads.length} byways in the catalog touching {states[code]}.
            </p>
            <p>This chapter hasn't been curated yet.</p>
          </>
        )}
        <div className={s.actions}>
          <Link viewTransition className="btn btn-primary" to={`/?state=${code}`}>
            Explore {states[code]} on the map
          </Link>
        </div>
      </Hero>
      <div className={s.page}>
        <RouteMap
          byways={roads}
          bbox={chapter?.bbox as [number, number, number, number] | undefined}
          emphasized={members}
          label={`Byways touching ${states[code]}`}
        />
        {chapter && (
          <p className={s.muted}>
            Programme members have heavier lines. The map includes catalog roads touching {states[code]}; multi-state roads continue beyond
            the state.
          </p>
        )}
        <ThemeChips value={theme} onChange={setTheme} />
        {chapter ? (
          chapter.programs.map((program, index) => {
            const mapped = program.members.filter((m) => m.bywayId && byId.has(m.bywayId))
            const visible = program.members.filter((m) => !m.bywayId || !theme || byId.get(m.bywayId)?.themes.includes(theme))
            return (
              <section className={s.section} key={program.label}>
                <span className="kicker">{index === 0 ? 'State designation' : 'Federal designation'}</span>
                <h2>
                  {program.label} · {program.issuer === 'Wisconsin Department of Transportation' ? 'WisDOT' : program.issuer}
                </h2>
                <p>
                  {program.members.length} in {index === 0 ? 'the state program' : 'this program'}, {mapped.length} with mapped lines
                </p>
                {theme && <p className={s.muted}>Pending routes remain visible because their themes have not been cataloged.</p>}
                <div className={s.grid}>
                  {visible.map((m) => {
                    const road = m.bywayId ? byId.get(m.bywayId) : undefined
                    return road ? (
                      <div className={s.member} key={m.name}>
                        <Postcard layout="card" byway={road} stateCode={code} officialUrl={m.url} description={m.blurb} />
                        {m.note && <p className={s.muted}>{m.note}</p>}
                      </div>
                    ) : (
                      <article className={s.pending} key={m.name}>
                        <span className="kicker">Route line pending</span>
                        <h3>{m.name}</h3>
                        {m.url && (
                          <small>
                            <a href={m.url}>Official page</a>
                          </small>
                        )}
                        {m.blurb && <p className={s.blurb}>{m.blurb}</p>}
                        <p>{'note' in m ? m.note : 'This route is not available in the catalog.'}</p>
                      </article>
                    )
                  })}
                </div>
                {!visible.length && <p>No roads in this program match this theme.</p>}
              </section>
            )
          })
        ) : (
          <section className={s.section}>
            <h2>Roads through {states[code]}</h2>
            <div className={s.grid}>
              {roads
                .filter((b) => !theme || b.themes.includes(theme))
                .map((b) => (
                  <Postcard layout="card" key={b.id} byway={b} stateCode={code} />
                ))}
            </div>
            {!roads.some((b) => !theme || b.themes.includes(theme)) && <p>No catalog roads match this selection.</p>}
          </section>
        )}
        {chapter && <Sources sources={chapter.sources} />}
      </div>
    </main>
  )
}
