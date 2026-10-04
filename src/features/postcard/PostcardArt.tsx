import { useState } from 'react'
import { Stamp } from '../../components/art'
import type { BywaySummary, BywayStory } from '../../lib/types'
import { illustrationCaption, listingDescription } from '../../lib/format'
import { downloadBlob } from './download'
import { renderBywayPostcard } from './renderBywayPostcard'
import { ShareControl } from '../share/ShareControl'
import { usePhotos } from '../../lib/data'
import type { Photo } from '../../lib/types'
import s from './PostcardArt.module.css'
import { CardFront, useCardAssets } from './CardFront'
import { PostcardStudio } from './PostcardStudio'
import { useGarage } from '../../lib/garage'
import { cardKey, creditedPhoto, postcardDefaults, usePostcards } from '../../lib/postcards'
import { PhotoCredit } from '../photos/Photos'
import { milestoneMessage, type Milestone } from './cardData'

export function PostcardArt({
  byway,
  story,
  note,
  onNote,
  onSelect,
  selected,
  photo,
  milestone,
}: {
  byway: BywaySummary
  story?: BywayStory | null
  note: string
  onNote: (note: string) => void
  onSelect?: () => void
  selected?: boolean
  photo?: Photo
  milestone?: Milestone
}) {
  const photos = usePhotos(byway.id)
  const selectedPhoto = milestone ? milestone.photo : (photo ?? photos[0])
  const key = cardKey(byway.id, milestone?.id)
  const saved = usePostcards((state) => state.cards[key])
  const choices = saved ?? { ...postcardDefaults(selectedPhoto, milestone ? 'greetings' : byway.look.lettering), note }
  const updateNote = (value: string) => {
    usePostcards.getState().update(key, { note: value }, choices)
    onNote(value)
  }
  const garage = useGarage()
  const assets = useCardAssets(byway.id, choices, milestone)
  const credit = creditedPhoto(choices, selectedPhoto)
  const [studio, setStudio] = useState(false)
  const frontProps = { byway, story, photo: selectedPhoto, choices, garage, milestone, ...assets }
  const [turned, setTurned] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const caption = illustrationCaption(byway.name, byway.region, story?.motifs)
  const message = milestone ? milestoneMessage(byway, milestone) : (story?.tagline ?? listingDescription(byway))
  const postmark = `${byway.states[0] ?? 'USA'} · ${new Date().toLocaleDateString('en-US')}`
  const scene = <CardFront {...frontProps} />
  return (
    <div className={s.postcard}>
      <div className={s.viewport}>
        <div className={`${s.faces} ${turned ? s.turned : ''}`}>
          <div className={s.front} inert={turned} aria-hidden={turned}>
            {onSelect ? (
              <button className={s.select} aria-label={`Select ${byway.name}`} aria-pressed={selected} onClick={onSelect}>
                {scene}
              </button>
            ) : (
              scene
            )}
          </div>
          <div className={s.back} inert={!turned} aria-hidden={!turned}>
            <h3>POST CARD</h3>
            <div className={s.message}>
              <p>{message}</p>
              <label>
                Your note
                <textarea
                  maxLength={500}
                  value={choices.note}
                  onChange={(event) => updateNote(event.target.value)}
                  placeholder="A road to remember…"
                />
              </label>
              <small>Saved in this browser.</small>
            </div>
            <div className={s.address}>
              <div>
                <Stamp
                  look={byway.look}
                  family={byway.scene}
                  seed={byway.seed}
                  region={byway.region}
                  motifs={story?.motifs}
                  title={byway.name}
                  size={90}
                />
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
      {!turned && (
        <>
          {credit ? (
            <div className={s.photoCredit}>
              <div className="postcard-credit">
                <PhotoCredit photo={credit} />
              </div>
            </div>
          ) : (
            <span className={s.caption} tabIndex={0} title={caption}>
              {choices.front === 'own' ? 'Your photo' : 'Illustration'}
              <span className="visually-hidden">: {caption}</span>
            </span>
          )}
        </>
      )}
      <div className={s.tools}>
        <button className="btn btn-ghost" onClick={() => setStudio(true)}>
          Customize
        </button>
        <ShareControl byway={byway} story={story} note={choices.note} photo={selectedPhoto} milestone={milestone} />
        <button className="btn btn-ghost" aria-pressed={turned} onClick={() => setTurned(!turned)}>
          {turned ? 'Show front' : 'Turn over'}
        </button>
        <button
          className="btn btn-ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError('')
            try {
              const file = await (milestone
                ? renderBywayPostcard(byway, story, choices.note, selectedPhoto, milestone)
                : renderBywayPostcard(byway, story, choices.note, selectedPhoto))
              downloadBlob(file, file.name)
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
      {studio && <PostcardStudio {...frontProps} onNote={updateNote} onClose={() => setStudio(false)} />}
      {assets.photoError && <p role="alert">{assets.photoError}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
