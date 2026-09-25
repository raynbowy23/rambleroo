import { useRef, useState } from 'react'
import { Scene, Stamp } from '../../components/art'
import type { BywaySummary, BywayStory } from '../../lib/types'
import { illustrationCaption, listingDescription } from '../../lib/format'
import { useMotionEnabled } from '../../lib/motion'
import { downloadPostcard } from './download'
import s from './PostcardArt.module.css'

export function PostcardArt({
  byway,
  story,
  note,
  onNote,
  onSelect,
  selected,
}: {
  byway: BywaySummary
  story?: BywayStory | null
  note: string
  onNote: (note: string) => void
  onSelect?: () => void
  selected?: boolean
}) {
  const [turned, setTurned] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const front = useRef<HTMLDivElement>(null)
  const stamp = useRef<HTMLDivElement>(null)
  const motion = useMotionEnabled()
  const caption = illustrationCaption(byway.name, byway.region, story?.motifs)
  const message = story?.tagline ?? listingDescription(byway)
  const postmark = `${byway.states[0] ?? 'USA'} · ${new Date().toLocaleDateString('en-US')}`
  const scene = (
    <Scene
      family={byway.scene}
      seed={byway.seed}
      region={byway.region}
      motifs={story?.motifs}
      framed
      variant="postcard"
      title={caption}
      animate={motion && !turned}
    />
  )
  return (
    <div className={s.postcard}>
      <div className={s.viewport}>
        <div className={`${s.faces} ${turned ? s.turned : ''}`}>
          <div className={s.front} ref={front} inert={turned} aria-hidden={turned}>
            {onSelect ? (
              <button className={s.select} aria-label={`Select ${byway.name}`} aria-pressed={selected} onClick={onSelect}>
                {scene}
              </button>
            ) : (
              scene
            )}
            <span className={s.caption} tabIndex={0} title={caption}>
              Illustration<span className="visually-hidden">: {caption}</span>
            </span>
          </div>
          <div className={s.back} inert={!turned} aria-hidden={!turned}>
            <h3>POST CARD</h3>
            <div className={s.message}>
              <p>{message}</p>
              <label>
                Your note
                <textarea maxLength={500} value={note} onChange={(event) => onNote(event.target.value)} placeholder="A road to remember…" />
              </label>
              <small>Local only. Saved only if you save a visit.</small>
            </div>
            <div className={s.address}>
              <div ref={stamp}>
                <Stamp family={byway.scene} seed={byway.seed} region={byway.region} motifs={story?.motifs} title={byway.name} size={90} />
              </div>
              <span className={s.postmark}>{postmark}</span>
              <div className={s.rules} aria-label="Three blank address lines">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={s.tools}>
        <button className="btn btn-ghost" aria-pressed={turned} onClick={() => setTurned(!turned)}>
          {turned ? 'Show front' : 'Turn over'}
        </button>
        <button
          className="btn btn-ghost"
          disabled={busy}
          onClick={async () => {
            const scene = front.current?.querySelector('svg')
            const stampSvg = stamp.current?.querySelector('svg')
            if (!scene || !stampSvg) return
            setBusy(true)
            setError('')
            try {
              await downloadPostcard({ scene, stamp: stampSvg, id: byway.id, name: byway.name, message, note, postmark, caption })
            } catch {
              setError('Could not download this postcard. Please try again.')
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Preparing postcard…' : 'Download postcard'}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
