import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Scene, Icon } from '../../components/art'
import type { BywaySummary } from '../../lib/types'
import { useStory } from '../../lib/data'
import { useMotionEnabled } from '../../lib/motion'
import { usePassport } from '../../lib/passport'
import { formatMiles, shortDesignation, listingDescription } from '../../lib/format'
import { stateNames } from '../../lib/states'
import { toast } from '../../components/ui/Toast'
import styles from './Postcard.module.css'
import { VisitEditor } from '../passport/VisitEditor'
export function Postcard({
  byway: b,
  onClose,
  onSelect,
  onShowMap,
  selected = false,
  focusHeading = false,
  layout,
  saveLabel,
  stateCode,
}: {
  byway: BywaySummary
  onClose?: () => void
  onSelect?: () => void
  onShowMap?: () => void
  selected?: boolean
  focusHeading?: boolean
  layout?: 'card'
  saveLabel?: string
  stateCode?: string
}) {
  const [editing, setEditing] = useState(false)
  const { story } = useStory(b.id)
  const motion = useMotionEnabled()
  const saved = usePassport((s) => Boolean(s.saved[b.id]))
  const toggleSave = usePassport((s) => s.toggleSave)
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
          {onSelect ? (
            <button className={styles.artButton} aria-label={`Select ${b.name}`} aria-pressed={selected} onClick={onSelect}>
              <Scene family={b.scene} seed={b.seed} variant="postcard" animate={motion && selected} />
            </button>
          ) : (
            <Scene family={b.scene} seed={b.seed} variant="postcard" animate={motion} />
          )}
          <span className={styles.credit}>Illustration</span>
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
            {onSelect ? (
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
          </div>
          <div className={styles.actions}>
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
          <button className={`btn btn-ghost ${styles.mapButton}`} onClick={() => setEditing(true)}>
            Record a visit
          </button>
          {saved && <small>Saved in this browser</small>}
          {onShowMap && (
            <button className={`btn btn-ghost ${styles.mapButton}`} onClick={onShowMap}>
              <Icon name="map" />
              Show on map
            </button>
          )}
        </div>
      </article>
      {editing && <VisitEditor byway={b} onClose={() => setEditing(false)} />}
    </>
  )
}
