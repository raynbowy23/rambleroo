import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router'
import { RoadVisual } from '../photos/RoadVisual'
import { firstPhoto, hasPhoto } from '../../lib/data'
import { Icon } from '../../components/art'
import { collections, useCatalog } from '../../lib/data'
import { filterByways, themes } from '../../lib/filters'
import { formatMiles, shortDesignation } from '../../lib/format'
import { states, stateNames } from '../../lib/states'
import { usePassport, passportCounts } from '../../lib/passport'
import { useHover } from '../map/hover'
import { Dialog } from '../../components/ui/Dialog'
import { useSheetDrag } from '../../lib/useSheetDrag'
import { Postcard } from './Postcard'
import styles from './Explore.module.css'
const BywayMap = lazy(() => import('../map/BywayMap').then((module) => ({ default: module.BywayMap })))
export default function ExplorePage() {
  const navigate = useNavigate()
  const catalog = useCatalog()
  const [params, setParams] = useSearchParams()
  const [failed, setFailed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [snap, setSnap] = useState(0)
  const [limit, setLimit] = useState(40)
  const opener = useRef<HTMLElement | null>(null)
  const focusHeading = useRef(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const sheet = useSheetDrag(snap, setSnap)
  const postcardSwipe = useSheetDrag(0, () => select(null), true)
  const q = params.get('q') ?? ''
  const state = params.get('state') ?? ''
  const themeKey = params.get('themes') ?? ''
  const selectedId = params.get('byway')
  const view = failed ? 'list' : ['map', 'gallery', 'list'].includes(params.get('view') ?? '') ? params.get('view')! : 'map'
  const activeThemes = useMemo(() => themes.filter((t) => themeKey.split(',').includes(t)), [themeKey])
  const filtered = useMemo(() => {
    const matches = filterByways(catalog.byways, { q, state, themes: activeThemes })
    // A typed search keeps its relevance order; browsing puts roads with real photos (and stories) first.
    if (q) return matches
    const rank = (id: string, status: string) => (status !== 'listing' ? 0 : hasPhoto(id) ? 1 : 2)
    return [...matches].sort((a, b) => rank(a.id, a.status) - rank(b.id, b.status))
  }, [catalog.byways, q, state, activeThemes])
  const active = Boolean(q || state || activeThemes.length)
  const ids = useMemo(() => (active ? filtered.map((b) => b.id) : null), [active, filtered])
  const selected = selectedId ? catalog.byId.get(selectedId) : undefined
  const passport = usePassport()
  const counts = passportCounts(passport, catalog.byways)
  const set = (key: string, value: string | null, replace = false) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace },
    )
  const select = (id: string | null, fromList = false) => {
    if (id) {
      opener.current = document.activeElement as HTMLElement
      focusHeading.current = fromList
    } else {
      opener.current?.focus()
      focusHeading.current = false
    }
    set('byway', id)
  }
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && selectedId) {
        setParams((p) => {
          const n = new URLSearchParams(p)
          n.delete('byway')
          return n
        })
        opener.current?.focus()
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [selectedId, setParams])
  useEffect(() => {
    setLimit(40)
  }, [q, state, themeKey])
  useEffect(() => {
    if (!selectedId) opener.current?.focus()
  }, [selectedId])
  useEffect(() => {
    if (view === 'gallery' && selectedId) {
      const index = filtered.findIndex((b) => b.id === selectedId)
      if (index >= limit) setLimit(Math.ceil((index + 1) / 40) * 40)
      requestAnimationFrame(() => document.getElementById(`gallery-${selectedId}`)?.scrollIntoView?.({ block: 'nearest' }))
    }
  }, [view, selectedId, filtered, limit])
  const clear = () =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      ;['themes', 'q', 'state'].forEach((k) => n.delete(k))
      return n
    })
  return (
    <main className={`${styles.explore} ${view !== 'map' ? styles.browse : ''}`}>
      {view === 'map' && catalog.status === 'ready' && (
        <Suspense fallback={null}>
          <BywayMap byways={catalog.byways} selected={selected} ids={ids} onSelect={(id) => select(id)} onFailure={() => setFailed(true)} />
        </Suspense>
      )}
      <aside
        ref={sheet.ref}
        data-snap={snap}
        style={sheet.style}
        data-map-panel="search"
        className={`${styles.panel} ${collapsed ? styles.collapsed : ''} ${styles[`snap${snap}`]} ${selected && view === 'map' ? styles.withSelection : ''}`}
        aria-label="Find a byway"
      >
        <button className={styles.handle} aria-label="Change results sheet height" {...sheet.handlers}>
          —
        </button>
        <div className={styles.panelContent}>
          <div className={styles.panelTop}>
            <h1>Explore scenic byways</h1>
            <button
              className="btn btn-icon btn-ghost"
              aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? '»' : '«'}
            </button>
          </div>
          {!collapsed && (
            <>
              <p className={styles.subline}>Find a road that catches your eye.</p>
              <div className={styles.segment} aria-label="Explorer view">
                {(['map', 'gallery', 'list'] as const).map((v) => (
                  <button key={v} aria-pressed={view === v} onClick={() => set('view', v)}>
                    <Icon name={v === 'gallery' ? 'grid' : v} size={16} />
                    {v}
                  </button>
                ))}
              </div>
              <label className="visually-hidden" htmlFor="byway-search">
                Search byway, state or designation
              </label>
              <div className={styles.search}>
                <Icon name="search" size={18} />
                <input
                  id="byway-search"
                  placeholder="Byway, state or designation"
                  value={q}
                  onChange={(e) => {
                    set('q', e.target.value, true)
                    if (e.target.value) setSnap(1)
                  }}
                />
                {q && (
                  <button className="btn btn-icon" aria-label="Clear search" onClick={() => set('q', null, true)}>
                    <Icon name="close" size={16} />
                  </button>
                )}
              </div>
              <button className={`btn btn-ghost ${styles.filtersButton}`} onClick={() => setFiltersOpen(true)}>
                Filters{active ? ' · Active' : ''}
              </button>
              <div className={styles.chips}>
                <button className="chip" aria-pressed={!activeThemes.length} onClick={() => set('themes', null)}>
                  All
                </button>
                {themes.map((t) => (
                  <button
                    className="chip"
                    aria-pressed={activeThemes.includes(t)}
                    key={t}
                    onClick={() =>
                      set('themes', (activeThemes.includes(t) ? activeThemes.filter((x) => x !== t) : [...activeThemes, t]).join(','))
                    }
                  >
                    <Icon name={`theme-${t}`} size={15} />
                    {t}
                  </button>
                ))}
              </div>
              <label className={styles.state}>
                State{' '}
                <select value={state} onChange={(e) => set('state', e.target.value)}>
                  <option value="">All states</option>
                  {Object.entries(states).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {state && states[state] && (
                <Link viewTransition className="btn btn-ghost" to={`/state/${state}`}>
                  Open the {states[state]} chapter
                </Link>
              )}
              <label className={styles.state}>
                Browse by state{' '}
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) navigate(`/state/${e.target.value}`, { viewTransition: true })
                  }}
                >
                  <option value="">Choose a chapter</option>
                  {Object.entries(states).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.resultCount} aria-live="polite">
                <span>{filtered.length} byways</span>
                {active && (
                  <button className="btn btn-ghost" onClick={clear}>
                    Clear filters
                  </button>
                )}
              </div>
              {catalog.status === 'loading' && <p role="status">Opening the map…</p>}
              {catalog.status === 'error' && <p role="alert">{catalog.error?.message}</p>}
              <div className={styles.results}>
                {filtered.slice(0, limit).map((b) => (
                  <div className={styles.resultRow} key={b.id}>
                    <RoadVisual bywayId={b.id} look={b.look} family={b.scene} region={b.region} seed={b.seed} variant="thumb" />
                    <button
                      className={styles.result}
                      aria-label={`${b.name} ${b.states.join(', ')} ${formatMiles(b.mappedMiles)}`}
                      key={b.id}
                      aria-pressed={selectedId === b.id}
                      onClick={() => select(b.id, true)}
                      onMouseEnter={() => useHover.getState().setId(b.id)}
                      onMouseLeave={() => useHover.getState().setId(null)}
                      onFocus={() => useHover.getState().setId(b.id)}
                      onBlur={() => useHover.getState().setId(null)}
                    >
                      <span>
                        <strong>{b.name}</strong>
                        <small>
                          {b.states.join(' · ')} · {formatMiles(b.mappedMiles)}
                        </small>
                        {b.status !== 'listing' && <em>Story</em>}
                      </span>
                    </button>
                  </div>
                ))}
                {!filtered.length && catalog.status === 'ready' && <p>No roads match yet. Try another name or clear the filters.</p>}
                {limit < filtered.length && (
                  <button className="btn btn-ghost" onClick={() => setLimit(limit + 40)}>
                    Show more
                  </button>
                )}
              </div>
              <button
                className={`btn btn-primary ${styles.surprise}`}
                disabled={!filtered.length}
                onClick={() => select(filtered[Math.floor(Math.random() * filtered.length)].id, true)}
              >
                <Icon name="dice" />
                Surprise me
              </button>
            </>
          )}
        </div>
      </aside>
      {filtersOpen && (
        <Dialog title="Filter byways" onClose={() => setFiltersOpen(false)}>
          <div className={styles.chips}>
            <button className="chip" aria-pressed={!activeThemes.length} onClick={() => set('themes', null)}>
              All
            </button>
            {themes.map((theme) => (
              <button
                key={theme}
                className="chip"
                aria-pressed={activeThemes.includes(theme)}
                onClick={() =>
                  set(
                    'themes',
                    (activeThemes.includes(theme) ? activeThemes.filter((t) => t !== theme) : [...activeThemes, theme]).join(','),
                  )
                }
              >
                {theme}
              </button>
            ))}
          </div>
          <label className={styles.state}>
            State{' '}
            <select value={state} onChange={(e) => set('state', e.target.value)}>
              <option value="">All states</option>
              {Object.entries(states).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <p>{filtered.length} byways</p>
          <button className="btn btn-ghost" onClick={clear}>
            Clear filters
          </button>{' '}
          <button className="btn btn-primary" onClick={() => setFiltersOpen(false)}>
            Show results
          </button>
        </Dialog>
      )}
      {view !== 'map' && (
        <section className={styles.content} aria-label={view === 'gallery' ? 'Byway gallery' : 'Byway list'}>
          {failed && (
            <p className={styles.notice} role="status">
              The map couldn't load here, so here's the list.
            </p>
          )}
          <div className={styles.browseTitle}>
            <span className="kicker">Scenic roads of America</span>
            <h2>{view === 'gallery' ? 'Find your next road' : 'The byway index'}</h2>
          </div>
          {view === 'gallery' ? (
            <div className={styles.gallery}>
              {filtered.slice(0, limit).map((b) => (
                <div id={`gallery-${b.id}`} key={b.id}>
                  <Postcard
                    byway={b}
                    selected={selectedId === b.id}
                    layout="gallery"
                    mapTo={`/?${new URLSearchParams({ ...Object.fromEntries(params), byway: b.id, view: 'map' })}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table role="table">
                <caption className="visually-hidden">Scenic byways matching your filters</caption>
                <thead role="rowgroup">
                  <tr role="row">
                    <th role="columnheader">Name</th>
                    <th role="columnheader">States</th>
                    <th role="columnheader">Miles</th>
                    <th role="columnheader">Designation</th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {filtered.slice(0, limit).map((b) => (
                    <tr role="row" key={b.id} aria-selected={selectedId === b.id}>
                      <td role="cell">
                        <div className={styles.listRoad}>
                          <RoadVisual bywayId={b.id} look={b.look} family={b.scene} region={b.region} seed={b.seed} variant="thumb" />
                          <button onClick={() => select(b.id, true)}>{b.name}</button>
                        </div>
                      </td>
                      <td role="cell">{stateNames(b.states)}</td>
                      <td role="cell">{formatMiles(b.mappedMiles)}</td>
                      <td role="cell">{shortDesignation(b)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {limit < filtered.length && (
            <button className="btn btn-ghost" onClick={() => setLimit(limit + 40)}>
              Show more
            </button>
          )}
          {!filtered.length && <p>No matching byways.</p>}
        </section>
      )}
      {selected && view !== 'gallery' && (
        <div ref={postcardSwipe.ref} style={postcardSwipe.style} data-map-panel="postcard" className={styles.postcard}>
          <button className={styles.handle} aria-label="Swipe down to close postcard" {...postcardSwipe.handlers}>
            —
          </button>
          <Postcard key={selected.id} byway={selected} onClose={() => select(null)} focusHeading={focusHeading.current} />
        </div>
      )}
      {selectedId && !selected && catalog.status === 'ready' && (
        <div className={styles.invalid} role="status">
          This byway isn't in the catalog.{' '}
          <button className="btn btn-ghost" onClick={() => select(null)}>
            Clear selection
          </button>
        </div>
      )}
      {view === 'map' && (
        <div data-map-decoration className={styles.rail}>
          <Link viewTransition className={styles.passport} to="/passport">
            <Icon name="stamp" size={30} />
            <span>
              <strong>Your passport</strong>
              <small>
                {counts.saved} saved · {counts.distinctVisited} visited
              </small>
            </span>
          </Link>
          <div className={styles.collections}>
            <span className="kicker">Collections</span>
            {collections.map((c, i) => (
              <div className={styles.collectionPreview} key={c.slug}>
                <RoadVisual bywayId={firstPhoto(c.bywayIds)?.bywayId} family={c.scene} seed={i} variant="thumb" />
                <Link viewTransition to={`/collections/${c.slug}`}>
                  {c.title}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
