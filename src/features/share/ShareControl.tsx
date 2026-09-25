import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BywaySummary, BywayStory, Photo } from '../../lib/types'
import { toast } from '../../components/ui/Toast'
import { renderBywayPostcard } from '../postcard/renderBywayPostcard'
import { downloadBlob } from '../postcard/download'
import { buildShareLinks } from './links'
import s from './ShareControl.module.css'

export function ShareControl({
  byway,
  story,
  note = '',
  photo,
  small = false,
}: {
  byway: BywaySummary
  story?: BywayStory | null
  note?: string
  photo?: Photo
  small?: boolean
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const url = new URL(`/byway/${byway.id}`, window.location.origin).href
  const text = `${byway.name} — found on Rambleroo${note.trim() ? `\n\n${note.trim()}` : ''}`
  const links = buildShareLinks({ url, title: byway.name, text })
  const showMenu = () => {
    menu.current?.showPopover()
    menu.current?.querySelector<HTMLElement>('a, button')?.focus()
  }
  const download = async () => {
    setBusy(true)
    try {
      const file = await renderBywayPostcard(byway, story, note, photo)
      downloadBlob(file, file.name)
    } catch {
      toast('Could not download this postcard. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button
        ref={trigger}
        className={`btn btn-ghost ${small ? s.small : ''}`}
        disabled={busy}
        aria-expanded={open}
        aria-controls={id}
        onClick={async () => {
          if (open) {
            menu.current?.hidePopover()
            return
          }
          const probe = new File([], 'postcard.png', { type: 'image/png' })
          if (!navigator.share || !navigator.canShare?.({ files: [probe] })) {
            showMenu()
            return
          }
          setBusy(true)
          try {
            const file = await renderBywayPostcard(byway, story, note, photo)
            if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: byway.name, text, url })
            else showMenu()
          } catch (error) {
            if (!(error instanceof Error && error.name === 'AbortError')) {
              toast('Image sharing is unavailable. Choose another way to share.')
              showMenu()
            }
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Preparing postcard…' : 'Share'}
      </button>
      {note.trim() && <small>Your note is included</small>}
      {createPortal(
        <div
          ref={menu}
          id={id}
          popover="auto"
          className={s.menu}
          aria-label={`Share ${byway.name}`}
          onToggle={(event) => setOpen(event.newState === 'open')}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              menu.current?.hidePopover()
              trigger.current?.focus()
            }
          }}
        >
          <div className={s.head}>
            <span className="kicker">Send a postcard</span>
            <strong>{byway.name}</strong>
            {note.trim() && <small>Your note is included</small>}
          </div>
          <div className={s.grid}>
            <a className={s.dest} href={links.email}>
              Email
            </a>
            {(
              [
                ['X', links.x],
                ['Facebook', links.facebook],
                ['Bluesky', links.bluesky],
                ['Reddit', links.reddit],
              ] as const
            ).map(([label, href]) => (
              <a key={label} className={s.dest} href={href} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ))}
            <button
              className={s.dest}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url)
                  toast('Link copied')
                } catch {
                  toast('Could not copy the link. Copy the address from your browser.')
                }
              }}
            >
              Copy link
            </button>
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={() => void download()}>
            Download postcard
          </button>
          <small className={s.hint}>
            Email and social links share the page. To send the picture itself, download the postcard and attach it.
          </small>
          <button
            className={s.close}
            aria-label="Close share menu"
            onClick={() => {
              menu.current?.hidePopover()
              trigger.current?.focus()
            }}
          >
            ×
          </button>
        </div>,
        document.body,
      )}
    </>
  )
}
