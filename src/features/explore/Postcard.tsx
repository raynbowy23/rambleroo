import { ShareControl } from '../share/ShareControl'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Icon, Scene } from '../../components/art'
import type { BywaySummary } from '../../lib/types'
import { useStory } from '../../lib/data'
import { usePassport } from '../../lib/passport'
import { formatMiles, shortDesignation, listingDescription, illustrationCaption } from '../../lib/format'
import { stateNames } from '../../lib/states'
import { toast } from '../../components/ui/Toast'
import styles from './Postcard.module.css'
import { PostcardArt } from '../postcard/PostcardArt'
import { VisitEditor } from '../passport/VisitEditor'
export function Postcard({
  byway: b,
  onClose,
  onSelect,
  mapTo,
  selected = false,
  focusHeading = false,
  layout,
  saveLabel,
  stateCode,
}: {
  byway: BywaySummary
  onClose?: () => void
  onSelect?: () => void
  mapTo?: string
  selected?: boolean
  focusHeading?: boolean
  layout?: 'card' | 'gallery'
  saveLabel?: string
  stateCode?: string
}) {
  const gallery = layout === 'gallery'
  const [editing, setEditing] = useState(false)
  const { story } = useStory(b.id)
  const [note, setNote] = useState('')
  const saved = usePassport((s) => Boolean(s.saved[b.id]))
  const toggleSave = usePassport((s) => s.toggleSave)
  useEffect(() => setNote(''), [b.id])
  const heading = useRef<HTMLHeadingElement>(null)
  const id = useId()
  useEffect(() => {
    if (focusHeading) heading.current?.focus()
  }, [b.id, focusHeading])
  return (
    <>
      <article
        className={`${styles.card} ${layout ? styles.gridCard : ''} ${selected ? styles.selected : ''}`}
        role={onClose ? 'dialog' : undefined}
        aria-labelledby={id}
      >
        <div className={styles.art}>
          {gallery ? (
            <Scene
              look={b.look}
              lettering={{ title: b.name, subtitle: b.states.join(' · ') }}
              family={b.scene}
              seed={b.seed}
              region={b.region}
              motifs={story?.motifs}
              framed
              variant="postcard"
              title={illustrationCaption(b.name, b.region, story?.motifs)}
            />
          ) : (
            <PostcardArt key={b.id} byway={b} story={story} note={note} onNote={setNote} onSelect={onSelect} selected={selected} />
          )}
          {onClose && (
            <button className={`btn btn-icon ${styles.close}`} aria-label="Back to results" onClick={onClose}>
              <Icon name="close" />
              <span className={styles.backLabel}>Back to results</span>
            </button>
          )}
        </div>
        <div className={styles.body}>
          <span className="kicker">{shortDesignation(b)}</span>
          <h2 ref={heading} tabIndex={-1} id={id}>
            {onSelect && !gallery ? (
              <button className={styles.title} onClick={onSelect} aria-pressed={selected}>
                {b.name}
              </button>
            ) : (
              b.name
            )}
          </h2>
          <p className={styles.tagline}>{story?.tagline ?? listingDescription(b)}</p>
          <div className={styles.facts}>
            <span>{stateNames(b.states)}</span>
            <span>
              {stateCode && b.stateMiles?.[stateCode] !== undefined
                ? `${formatMiles(b.stateMiles[stateCode])} in ${stateNames([stateCode])} · ${formatMiles(b.mappedMiles)} in total`
                : `${formatMiles(b.mappedMiles)} in total`}
            </span>
            <span>{story ? (story.reviewed ? 'Story' : 'Draft story · pending review') : 'Listing'}</span>
            {mapTo && <Link to={mapTo}>Show on map</Link>}
          </div>
          <div className={styles.actions}>
            {gallery && <ShareControl byway={b} story={story} small />}
            <Link className="btn btn-primary" to={`/byway/${b.id}`}>
              {b.status === 'listing' ? 'Open details' : 'View story'}
              <Icon name="arrow-right" size={16} />
            </Link>
            <button
              className={`btn btn-ghost ${saved ? styles.saved : ''}`}
              aria-pressed={saved}
              onClick={() => {
                toggleSave(b.id)
                if (!saved) toast('Saved in this browser')
              }}
            >
              <Icon name={saved ? 'bookmark-filled' : 'bookmark'} />
              {saved ? (saveLabel ?? 'Saved') : 'Save'}
            </button>
          </div>
          {!gallery && (
            <button className={`btn btn-ghost ${styles.mapButton}`} onClick={() => setEditing(true)}>
              Record a visit
            </button>
          )}
          {saved && <small>Saved in this browser</small>}
        </div>
      </article>
      {editing && <VisitEditor byway={b} initialNote={note} onClose={() => setEditing(false)} />}
    </>
  )
}
