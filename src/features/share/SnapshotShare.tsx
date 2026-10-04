import { useEffect, useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { useAccount, syncBeforeSharing } from '../../lib/account'
import type { ShareKind, ShareSummary } from '../../lib/shares'
import { SignInDialog } from '../account/SignInDialog'
import { buildShareLinks } from './links'
import s from './SnapshotShare.module.css'

async function shareRequest(userId: string, path = '', init?: RequestInit) {
  const response = await fetch(`/api/shares${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Rambleroo-User': userId },
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Could not update share links. Please try again.')
  if (useAccount.getState().user?.id !== userId) throw new Error('Account changed. Please reopen sharing.')
  return result
}
export function SnapshotShare({ kind }: { kind: ShareKind }) {
  const user = useAccount((state) => state.user)
  const [open, setOpen] = useState(false)
  const [signIn, setSignIn] = useState(false)
  return (
    <>
      <button className="btn" onClick={() => (user ? setOpen(true) : setSignIn(true))}>
        Share
      </button>
      {signIn && <SignInDialog reason="Sharing needs an account so you can turn your links off later." onClose={() => setSignIn(false)} />}
      {open && user && <ShareDialog key={user.id} kind={kind} userId={user.id} onClose={() => setOpen(false)} />}
    </>
  )
}
function ShareDialog({ kind, userId, onClose }: { kind: ShareKind; userId: string; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [includeNotes, setIncludeNotes] = useState(false)
  const [created, setCreated] = useState<ShareSummary>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const url = created ? `${window.location.origin}/s/${created.slug}` : ''
  const links = buildShareLinks({ url, title: created?.title || 'A Rambleroo trip', text: created?.title || 'A Rambleroo trip' })
  return (
    <Dialog title={`Share your ${kind}`} onClose={onClose}>
      <p>Anyone with this link can see this snapshot. Later edits won’t change it. Turn it off from “Your share links” on the Trip page.</p>
      <p>
        Includes road order{kind === 'passport' ? ', saved roads and visit dates' : ''}. Your account name, email and photos stay private.
      </p>
      {created ? (
        <div className={s.form}>
          <label>
            Share URL
            <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
          </label>
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url)
                setCopied(true)
              } catch {
                setError('Could not copy. Select and copy the URL above.')
              }
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <nav className={s.actions} aria-label="Share link">
            {Object.entries(links).map(([name, href]) => (
              <a key={name} href={href} target={name === 'email' ? undefined : '_blank'} rel="noopener noreferrer">
                {{ email: 'Email', x: 'X', facebook: 'Facebook', bluesky: 'Bluesky', reddit: 'Reddit' }[name as keyof typeof links]}
              </a>
            ))}
          </nav>
        </div>
      ) : (
        <form
          className={s.form}
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(true)
            setError('')
            try {
              await syncBeforeSharing(userId)
              setCreated(await shareRequest(userId, '', { method: 'POST', body: JSON.stringify({ kind, title, includeNotes }) }))
              window.dispatchEvent(new Event('rambleroo-shares-changed'))
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Could not create a link.')
            } finally {
              setBusy(false)
            }
          }}
        >
          <label>
            Title
            <input
              maxLength={200}
              value={title}
              disabled={busy}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={kind === 'trip' ? 'A Rambleroo trip' : 'My road passport'}
            />
          </label>
          {kind === 'passport' && (
            <label className={s.check}>
              <input type="checkbox" checked={includeNotes} disabled={busy} onChange={(event) => setIncludeNotes(event.target.checked)} />
              Include my notes
            </label>
          )}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create link'}
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </Dialog>
  )
}
export function ShareLinks() {
  const user = useAccount((state) => state.user)
  return user ? <OwnedLinks key={user.id} userId={user.id} /> : null
}
function OwnedLinks({ userId }: { userId: string }) {
  const [shares, setShares] = useState<ShareSummary[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string>()
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    const load = () => {
      void shareRequest(userId)
        .then((value: ShareSummary[]) => {
          if (active) {
            setShares(value)
            setError('')
          }
        })
        .catch((cause: Error) => {
          if (active) setError(cause.message)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }
    load()
    window.addEventListener('rambleroo-shares-changed', load)
    return () => {
      active = false
      window.removeEventListener('rambleroo-shares-changed', load)
    }
  }, [userId])
  return (
    <section className={s.owned}>
      <h2>Your share links</h2>
      <p>Turning off a link takes up to five minutes for cached copies. People may keep their own copies.</p>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Loading share links…</p> : !shares.length && <p>No share links yet.</p>}
      <ul>
        {shares.map((share) => (
          <li key={share.slug}>
            <div>
              {share.revoked ? (
                <span>{share.title || `Shared ${share.kind}`} · Turned off</span>
              ) : (
                <a href={`/s/${share.slug}`}>{share.title || `Shared ${share.kind}`}</a>
              )}
              <small> · {new Date(share.created).toLocaleDateString()}</small>
            </div>
            {!share.revoked && (
              <button
                className="btn"
                disabled={!!busy}
                onClick={async () => {
                  setBusy(share.slug)
                  setError('')
                  try {
                    await shareRequest(userId, `/${share.slug}`, { method: 'DELETE' })
                    setShares((items) => items.map((item) => (item.slug === share.slug ? { ...item, revoked: Date.now() } : item)))
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : 'Could not turn off link.')
                  } finally {
                    setBusy(undefined)
                  }
                }}
              >
                {busy === share.slug ? 'Turning off…' : 'Turn off'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
