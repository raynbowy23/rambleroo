// Google Analytics, loaded only after the visitor accepts analytics cookies, and only on the live site so development and test
// traffic never reaches the reports. Until then nothing is requested from Google and no cookie is set.
import { create } from 'zustand'

export const GA_ID = 'G-ZG7RVR9WL3'
export const ANALYTICS_HOST = 'rambleroo.app'
const KEY = 'rambleroo.consent.v1'
/** Bump when the cookie notice changes in a way people should be asked about again. */
export const CONSENT_VERSION = 1

export type ConsentChoice = { analytics: boolean; version: number; decidedAt: string }

function read(): ConsentChoice | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as ConsentChoice | null
    return value && value.version === CONSENT_VERSION ? value : null
  } catch {
    return null
  }
}

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }

/** Analytics applies only on the live host; elsewhere there is nothing to consent to and no banner. */
export const analyticsAvailable = (host = typeof location === 'undefined' ? '' : location.hostname) => host === ANALYTICS_HOST

let loaded = false
function loadAnalytics() {
  const w = window as GtagWindow
  if (!loaded) {
    loaded = true
    w.dataLayer = w.dataLayer ?? []
    w.gtag = function gtag() {
      // gtag.js expects the arguments object itself, not an array.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments)
    }
    // Consent Mode v2: everything denied by default; only analytics storage is granted, never advertising.
    w.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    })
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
    document.head.appendChild(script)
    w.gtag('js', new Date())
    // 13-month cookies, no Google signals or ad personalisation.
    w.gtag('config', GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false, cookie_expires: 60 * 60 * 24 * 395 })
  }
  w.gtag!('consent', 'update', { analytics_storage: 'granted' })
}

function stopAnalytics() {
  const w = window as GtagWindow
  w.gtag?.('consent', 'update', { analytics_storage: 'denied' })
  // Remove the cookies GA set (on this host and the parent domain), so withdrawing consent really removes them.
  for (const name of document.cookie.split(';').map((c) => c.split('=')[0].trim()))
    if (name === '_ga' || name.startsWith('_ga_'))
      for (const domain of ['', `; domain=${location.hostname}`, `; domain=.${location.hostname}`])
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`
}

interface ConsentState {
  choice: ConsentChoice | null
  /** The banner is open: no decision yet, or the visitor asked to change it. */
  open: boolean
  decide: (analytics: boolean) => void
  reopen: () => void
}

export const useConsent = create<ConsentState>((set) => ({
  choice: read(),
  open: false,
  decide: (analytics) => {
    const choice = { analytics, version: CONSENT_VERSION, decidedAt: new Date().toISOString() }
    try {
      localStorage.setItem(KEY, JSON.stringify(choice))
    } catch {
      // Without storage the choice lasts for this visit only.
    }
    if (analyticsAvailable()) {
      if (analytics) loadAnalytics()
      else stopAnalytics()
    }
    set({ choice, open: false })
  },
  reopen: () => set({ open: true }),
}))

/** Call once at startup: resumes analytics for someone who already accepted. */
export function startAnalytics() {
  if (analyticsAvailable() && useConsent.getState().choice?.analytics) loadAnalytics()
}
