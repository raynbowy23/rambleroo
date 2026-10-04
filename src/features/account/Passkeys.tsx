import { useEffect, useState } from 'react'
import { accountClient, useAccount } from '../../lib/account'
import { Dialog } from '../../components/ui/Dialog'
import styles from './AccountControl.module.css'

/** Passkeys need WebAuthn; older browsers simply don't see the passkey options. */
export const passkeysSupported = () => typeof window !== 'undefined' && 'PublicKeyCredential' in window

type Passkey = { id: string; name?: string | null; createdAt?: string | Date | null; deviceType?: string }
const deviceLabel = (key: Passkey) => key.name || (key.deviceType === 'multiDevice' ? 'Synced passkey' : 'Passkey on this device')

async function addPasskey() {
  const result = await accountClient.passkey.addPasskey({ name: `Rambleroo on ${navigator.platform || 'this device'}` })
  if (result?.error) throw new Error(result.error.message ?? 'The passkey was not saved.')
}

/** Account menu section: list, add and remove passkeys. */
export function PasskeySection() {
  const { data, refetch } = accountClient.useListPasskeys()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!passkeysSupported()) return null
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await action()
      refetch()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const keys = (data ?? []) as Passkey[]
  return (
    <section className={styles.passkeys} aria-label="Passkeys">
      <h3>Passkeys</h3>
      {keys.length ? (
        <ul>
          {keys.map((key) => (
            <li key={key.id}>
              <span>{deviceLabel(key)}</span>
              <button
                className="btn btn-ghost"
                disabled={busy}
                aria-label={`Remove ${deviceLabel(key)}`}
                onClick={() =>
                  void run(async () => {
                    const result = await accountClient.passkey.deletePasskey({ id: key.id })
                    if (result?.error) throw new Error(result.error.message ?? 'Could not remove the passkey.')
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>Sign in with one tap using Face ID, a fingerprint or your device PIN.</p>
      )}
      <button className="btn" disabled={busy} onClick={() => void run(addPasskey)}>
        Add a passkey
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}

/** Offered once per account and browser after signing in, when there is no passkey yet. Signed-out visitors make no request. */
export function PasskeyNudge() {
  const user = useAccount((state) => state.user)
  return user && passkeysSupported() ? <PasskeyOffer key={user.id} /> : null
}

function PasskeyOffer() {
  const user = useAccount((state) => state.user)
  const { data, isPending } = accountClient.useListPasskeys()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const key = user ? `rambleroo.passkey-offered.${user.id}` : ''
  useEffect(() => {
    if (!user || isPending || !passkeysSupported() || (data && data.length)) return
    try {
      if (localStorage.getItem(key)) return
    } catch {
      return
    }
    setOpen(true)
  }, [user, isPending, data, key])
  if (!open) return null
  const close = () => {
    try {
      localStorage.setItem(key, '1')
    } catch {
      /* The offer may come back next time; harmless. */
    }
    setOpen(false)
  }
  return (
    <Dialog title="Sign in faster next time?" onClose={close}>
      <p>
        Add a passkey and next time you can sign in with one tap: Face ID, a fingerprint or your device PIN. No password, no email. Your
        fingerprint or face never leaves your device.
      </p>
      <div className={styles.actions}>
        <button
          className="btn btn-primary"
          onClick={() =>
            void addPasskey()
              .then(close)
              .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'The passkey was not saved.'))
          }
        >
          Add a passkey
        </button>
        <button className="btn" onClick={close}>
          Not now
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </Dialog>
  )
}
