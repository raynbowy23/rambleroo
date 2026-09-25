import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useCatalog } from '../../lib/data'
import { usePassport, passportCounts, visitedBywayIds } from '../../lib/passport'
import { useMotionEnabled } from '../../lib/motion'
import { states } from '../../lib/states'
import type { Visit } from '../../lib/types'
import { Scene, Stamp } from '../../components/art'
import { BywayStamp } from '../../components/ui/BywayStamp'
import { PageStatus } from '../../components/ui/Content'
import { RouteMap } from '../../components/ui/RouteMap'
import { toast } from '../../components/ui/Toast'
import { Postcard } from '../explore/Postcard'
import { PassportData } from './PassportData'
import { PassportBook } from './PassportBook'
import { VisitEditor } from './VisitEditor'
import s from '../../components/ui/Content.module.css'
export default function PassportPage() {
  const passport = usePassport()
  const { byways, byId, status } = useCatalog()
  const counts = passportCounts(passport, byways)
  const motion = useMotionEnabled()
  const { hash } = useLocation()
  const [editing, setEditing] = useState<Visit>()
  const [deleting, setDeleting] = useState<string>()
  const visited = visitedBywayIds(passport)
  const saved = Object.keys(passport.saved)
  const roads = useMemo(
    () => byways.filter((b) => passport.saved[b.id] || passport.visits.some((v) => v.bywayId === b.id)),
    [byways, passport.saved, passport.visits],
  )
  const journal = [...passport.visits].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const latest = journal.filter((v, index) => journal.findIndex((other) => other.bywayId === v.bywayId) === index)
  const stateProgress = Object.keys(states)
    .map((code) => ({
      code,
      count: byways.filter(
        (b) => visited.has(b.id) && b.states.includes(code) && (b.states.length === 1 || b.stateMiles?.[code] !== undefined),
      ).length,
      total: byways.filter((b) => b.states.includes(code)).length,
    }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count || states[a.code].localeCompare(states[b.code]))
  useEffect(() => {
    if (status !== 'ready' || !passport.lastStampId) return
    const id = passport.lastStampId
    const timer = setTimeout(
      () => {
        if (usePassport.getState().lastStampId === id) usePassport.getState().clearLastStamp()
      },
      motion ? 750 : 0,
    )
    return () => clearTimeout(timer)
  }, [status, passport.lastStampId, motion])
  useEffect(() => {
    if (hash === '#saved' && status === 'ready') document.getElementById('saved')?.scrollIntoView?.({ block: 'start' })
  }, [hash, status])
  if (status === 'loading') return <PageStatus title="Opening your passport…" />
  if (status === 'error') return <PageStatus title="The catalog could not be loaded" error />
  return (
    <main className={s.page}>
      <header className={s.passportHeader}>
        <div>
          <PassportBook />
          <small className={s.muted}>Illustration</small>
        </div>
        <div>
          <span className="kicker">Your passport</span>
          <h1>
            {counts.distinctVisited} {counts.distinctVisited === 1 ? 'byway' : 'byways'} visited
          </h1>
          <p>
            {counts.visits} {counts.visits === 1 ? 'visit' : 'visits'} recorded
          </p>
          <p className={s.muted}>Saved in this browser. Accounts and sync come later.</p>
          <Link className="btn btn-primary" to="/">
            Find a road
          </Link>
        </div>
      </header>
      {!counts.saved && !counts.visits ? (
        <section className={s.empty}>
          <Scene family="forest" seed={17} variant="postcard" />
          <small>Illustration</small>
          <h2>More roads ahead</h2>
          <p>Save a road that catches your eye, or record a stretch you remember.</p>
          <Link className="btn btn-primary" to="/">
            Find a road
          </Link>
        </section>
      ) : (
        <>
          <section className={s.section}>
            <h2>My stamps</h2>
            <div className={s.stampGrid}>
              {latest.map((v) => {
                const b = byId.get(v.bywayId)
                return (
                  <Link to={`/byway/${v.bywayId}`} key={v.bywayId}>
                    <BywayStamp
                      byway={b}
                      title={b?.name ?? 'Road no longer in catalog'}
                      subtitle={b?.states.join(' · ')}
                      date={v.date}
                      visited
                      press={motion && v.id === passport.lastStampId}
                      size={150}
                    />
                    <span className={s.stampName}>{b?.name ?? 'Road no longer in catalog'}</span>
                  </Link>
                )
              })}
              <Stamp empty size={150} />
            </div>
            <p className={s.muted}>Illustrations · one stamp per visited road, with your latest visit date.</p>
          </section>
          <section className={s.section}>
            <h2>My travel map</h2>
            <RouteMap byways={roads} visited={[...visited]} saved={saved} label="Saved and visited roads" />
            <p className={s.muted}>Visited lines reflect your records, which may cover part of a road. Every road is also listed below.</p>
          </section>
          {!!stateProgress.length && (
            <section className={s.section}>
              <h2>Progress by state</h2>
              <p className={s.muted}>
                Distinct visited roads / catalog roads touching each state. A visit may cover part of a road; multi-state roads count toward
                each state they pass through.
              </p>
              {stateProgress.map(({ code, count, total }) => {
                return (
                  <div className={s.progress} key={code}>
                    <Link to={`/state/${code}`}>{states[code]}</Link>
                    <progress max={total} value={count} aria-label={`${states[code]}: ${count} of ${total} catalog roads visited`} />
                    <span>
                      {count} / {total}
                    </span>
                  </div>
                )
              })}
            </section>
          )}
          <section className={s.section}>
            <h2>Journal</h2>
            {!journal.length && <p>Your visits will appear here. A short stretch counts.</p>}
            {journal.map((v) => {
              const b = byId.get(v.bywayId)
              return (
                <article className={s.journal} key={v.id}>
                  <div>
                    {b && <Scene look={b.look} family={b.scene} region={b.region} seed={b.seed} variant="thumb" />}
                    <small className={s.muted}>Illustration</small>
                  </div>
                  <div>
                    <h3>
                      <Link to={`/byway/${v.bywayId}`}>{b?.name ?? 'Road no longer in catalog'}</Link>
                    </h3>
                    <p>
                      <time dateTime={v.date}>{v.date}</time> · {v.scope === 'part' ? 'Part of the road' : 'The whole road'}
                    </p>
                    {v.note && <p>{v.note}</p>}
                    <div className={s.actions}>
                      {b && (
                        <button className="btn btn-ghost" onClick={() => setEditing(v)}>
                          Edit visit
                        </button>
                      )}
                      {deleting === v.id ? (
                        <div role="group" aria-label="Confirm deletion" className={s.actions}>
                          <span>Delete?</span>
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              passport.deleteVisit(v.id)
                              setDeleting(undefined)
                              toast('Visit deleted')
                            }}
                          >
                            Yes
                          </button>
                          <button className="btn btn-ghost" onClick={() => setDeleting(undefined)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button className="btn btn-ghost" onClick={() => setDeleting(v.id)}>
                          Delete visit
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
          <section className={s.section} id="saved" style={{ scrollMarginTop: 88 }}>
            <h2>Saved roads</h2>
            <p className={s.muted}>Saved in this browser</p>
            <div className={s.grid}>
              {saved.map((id) => {
                const b = byId.get(id)
                return b ? (
                  <Postcard byway={b} key={id} layout="card" saveLabel="Remove" />
                ) : (
                  <article className={s.pending} key={id}>
                    <h3>Road no longer in catalog</h3>
                    <button className="btn btn-ghost" onClick={() => passport.toggleSave(id)}>
                      Remove
                    </button>
                  </article>
                )
              })}
            </div>
            {!saved.length && <p>No saved roads yet.</p>}
          </section>
        </>
      )}
      <PassportData />
      <footer className={s.section}>
        <Link to="/about">About the data</Link>
      </footer>
      {editing && byId.has(editing.bywayId) && (
        <VisitEditor byway={byId.get(editing.bywayId)!} visit={editing} onClose={() => setEditing(undefined)} />
      )}
    </main>
  )
}
