import { useEffect, useState } from 'react'
import {
  accountClient,
  answerImport,
  connectAccount,
  deleteAccount,
  exportAccount,
  retrySync,
  signOutAccount,
  useAccount,
} from '../../lib/account'
import { Dialog } from '../../components/ui/Dialog'
import styles from './AccountControl.module.css'
import { SignInDialog } from './SignInDialog'
import { PasskeyNudge, PasskeySection } from './Passkeys'

export function AccountBridge() {
  const { data, isPending, error } = accountClient.useSession()
  const importing = useAccount((state) => state.importing)
  useEffect(() => {
    if (!isPending && !error)
      void connectAccount(data?.user?.id ? data.user : null).catch((cause: unknown) =>
        useAccount.setState({ status: cause instanceof Error ? cause.message : 'Could not load your account.' }),
      )
  }, [data?.user?.id, isPending, error])
  useEffect(() => {
    const retry = () => {
      void retrySync()
    }
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])
  return importing ? (
    <Dialog title="Bring this browser's passport and trip into your account?" onClose={() => answerImport(false)}>
      <p>
        We’ll combine your saved roads, stretches, visits and trip. Your newer car and postcard choices come too. Your photos sync privately
        too, resized with location metadata removed.
      </p>
      <p>If you skip this, your browser-only data will be here again when you sign out.</p>
      <div className={styles.actions}>
        <button className="btn btn-primary" onClick={() => answerImport(true)}>
          Bring my data
        </button>
        <button className="btn" onClick={() => answerImport(false)}>
          Use account data
        </button>
      </div>
    </Dialog>
  ) : (
    <PasskeyNudge />
  )
}
export function AccountControl({ placement }: { placement: 'header' | 'passport' }) {
  const { user, status } = useAccount()
  const [open, setOpen] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={placement === 'header' ? styles.header : styles.passport}>
      {user ? (
        <>
          <button className={`btn ${styles.identity}`} aria-expanded={open} onClick={() => setOpen(!open)}>
            {user.image && <img src={user.image} alt="" referrerPolicy="no-referrer" width={24} height={24} />}
            <span>{user.name || 'Your account'}</span>
          </button>
          {open && (
            <div className={styles.menu}>
              <p role="status">{status}</p>
              <button className="btn" disabled={busy} onClick={() => void run(retrySync)}>
                Retry sync
              </button>
              <PasskeySection />
              <button className="btn" disabled={busy} onClick={() => void run(exportAccount)}>
                Export my data
              </button>
              <button className="btn" disabled={busy} onClick={() => void run(signOutAccount)}>
                Sign out
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  setConfirmation('')
                  setDeleting(true)
                }}
              >
                Delete my account
              </button>
            </div>
          )}
        </>
      ) : (
        <button className="btn" disabled={busy} onClick={() => setSigningIn(true)}>
          Sign in
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      {signingIn && <SignInDialog onClose={() => setSigningIn(false)} />}
      {deleting && (
        <Dialog
          title="Delete your account?"
          onClose={() => {
            if (!busy) setDeleting(false)
          }}
        >
          <p>
            This deletes your account, synced photos, passport, trip, car and postcard choices. Your browser-only data and photos stay on
            this device. This cannot be undone.
          </p>
          <label>
            Type DELETE to confirm
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
          </label>
          {error && <p role="alert">{error}</p>}
          <div className={styles.actions}>
            <button
              className="btn btn-primary"
              disabled={busy || confirmation !== 'DELETE'}
              onClick={() =>
                void run(async () => {
                  await deleteAccount()
                  setDeleting(false)
                  setOpen(false)
                })
              }
            >
              Delete my account
            </button>
            <button className="btn" disabled={busy} onClick={() => setDeleting(false)}>
              Keep my account
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
