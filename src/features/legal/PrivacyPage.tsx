import { Link } from 'react-router'
import styles from '../../components/layout/Page.module.css'
import { Contact } from './Contact'
import { PRIVACY_UPDATED, LOCATION_POLICY } from './policy'

// Every statement here must match what the code actually does. If a feature changes what leaves the browser, update this page in the same commit.
export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <span className="kicker">Privacy policy</span>
      <h1>Your journeys stay yours.</h1>
      <p>
        <strong>Last updated {PRIVACY_UPDATED}.</strong> Rambleroo is a noncommercial project. This page describes what happens to
        information when you use it, in plain language.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>You can explore roads and keep a local passport without an account.</li>
        <li>
          Without an account, your trip, saved roads, stretches, visits, notes, car and postcards stay in this browser. When you sign in,
          your account data syncs across devices. Your own photos stay on this device.
        </li>
        <li>
          On rambleroo.app we ask before using Google Analytics cookies to count visits. If you decline, no analytics cookie is set. We use
          no advertising and do not sell your personal information. Hosting and sign-in providers handle information as described below.
        </li>
        <li>{LOCATION_POLICY}</li>
      </ul>

      <h2>What is stored, and where</h2>
      <p>
        Your trip and passport (saved roads and stretches, visits with their dates, scope and notes) are kept in your browser’s local
        storage. Without signing in, it only leaves this device when you choose to export or share it. You can download it, import it on
        another browser, or clear it from the <Link to="/passport">Passport</Link> page. Clearing site data deletes the browser copy. We
        cannot recover browser-only data. When signed in, changes sync to your account; unsent changes need this browser to stay available
        until they sync.
      </p>
      <p>
        So that Rambleroo keeps working offline, your browser also caches the app and the pages, route data and photos you have opened. This
        cache contains public content only.
      </p>

      <p>
        Your car choices and postcard customizations are stored locally, and sync when you sign in. Your car picture and photos you add to
        postcards stay in this browser’s storage (IndexedDB) and are never uploaded by Rambleroo. They are not included in the passport
        export file. Card customizations are included in the account export, but not the browser passport export. Clearing the passport can
        also remove your added photos. Clearing site data removes them too. If you choose to share or download a postcard image, that image
        includes the photo you selected.
      </p>

      <h2>What reaches our server</h2>
      <p>
        Pages, route data and photos are loaded from the server that hosts Rambleroo. Like almost any website host, that server may record
        standard request logs (such as IP address, time, and the page requested) for security and reliability. We do not combine these logs
        with anything else or use them to profile anyone.
      </p>

      <p>
        The road maps draw streets, towns, parks and water from OpenFreeMap, a free map service built on OpenStreetMap data. Your browser
        requests those map tiles directly from OpenFreeMap, so the requests reveal roughly which map area you are viewing, along with
        standard network information such as your IP address. Nothing else is sent with them.
      </p>

      <p>
        When you turn on 3D, your browser loads elevation tiles directly from Amazon Web Services’ public open-data storage. These requests
        reveal roughly which map area you are viewing, along with standard network request information such as your IP address. Rambleroo
        sends no saved journeys, notes or pictures with them. The 3D preference is saved in this browser; turning it off stops elevation
        requests.
      </p>
      <h2>When you choose to leave Rambleroo</h2>
      <p>
        Some actions open another service, which then handles your information under its own policy: “Drive this stretch” and directions
        open Google Maps; share buttons open email, X, Facebook, Bluesky or Reddit with a link and short text you can edit; credits link to
        Wikipedia and Wikimedia Commons. A note you typed on a postcard is included in a share only when you choose to share it, and the
        page tells you when that will happen. These actions send information only when you choose them. Google sign-in and profile pictures
        are described below.
      </p>

      <h2 id="cookies">Cookies and analytics</h2>
      <p>
        The account session cookie <code>__Secure-rambleroo.session_token</code> and temporary sign-in cookie{' '}
        <code>__Secure-rambleroo.oauth_state</code> are strictly necessary when you sign in. They do not depend on your analytics choice.
      </p>
      <p>
        On rambleroo.app, a banner asks whether we may count visits with Google Analytics. Google Analytics does not load, and no analytics
        cookie is set, until you choose Accept. If you accept, Google Analytics sets these cookies:
      </p>
      <ul>
        <li>
          <code>_ga</code> and <code>_ga_ZG7RVR9WL3</code>: tell visits apart so we can count them. They last up to 13 months.
        </li>
      </ul>
      <p>
        Google then receives which pages you open, roughly where you are (country and city, from your IP address), and your device and
        browser type. We turned off Google signals and advertising features, so this is not used for ads. Google’s handling is described in
        its{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
          privacy policy
        </a>
        . You can change your choice at any time with “Cookie settings” in the site footer; declining removes the analytics cookies.
      </p>
      <p>
        Everything else Rambleroo keeps in your browser is there because you asked for it, so it needs no consent: your choice in the cookie
        banner, your trip, passport, car, postcards, and preferences such as the 3D view (local storage keys beginning with{' '}
        <code>rambleroo.</code>), and the offline cache of pages you have opened.
      </p>

      <h2>Optional accounts</h2>
      <p>
        You can sign in with Google to sync across devices. We store your Google name, email address, profile picture URL and Google account
        identifier, along with the authentication records needed to sign you in. Google handles its sign-in page under its own privacy
        policy. Showing your profile picture also sends a request to its image host.
      </p>
      <p>
        If you add a passkey, we store its public key, a credential ID, the type of authenticator and when you added it. The private key,
        and any fingerprint or face used to unlock it, never leave your device or your password manager. You can remove a passkey from the
        account menu.
      </p>
      <p>
        You can instead sign in with an email link. We then store your email address, and a one-time link valid for 15 minutes is sent to it
        through Resend, our email delivery service. To stop automated abuse of that form, it loads Cloudflare Turnstile, which checks your
        browser when you open the email sign-in form and sends Cloudflare technical signals for that check. It is not loaded anywhere else
        and is not used for advertising.
      </p>
      <p>
        Account data is stored on Cloudflare in its D1 database: your passport (saved roads and stretches, visits, notes and kept
        postcards), trip road order, car choices, and postcard customizations. Your own photo files and their browser references are not
        uploaded. On your first sign-in here, we ask before bringing existing browser data into your account. After that, changes made while
        signed in sync automatically. Conflicting saves can be combined; a removal may need repeating if another device changed the same
        document.
      </p>
      <p>
        A strictly necessary session cookie, <code>__Secure-rambleroo.session_token</code>, keeps you signed in for up to 60 days and may be
        renewed while you use the app. It is secure, HTTP-only and SameSite Lax. It needs no analytics consent. A short-lived{' '}
        <code>__Secure-rambleroo.oauth_state</code> cookie protects the sign-in handoff. Session records may also include your browser’s
        user-agent information; account sign-in does not record your IP address in the session table. Our hosting request logs are separate.
      </p>
      <p>
        In the account menu, “Export my data” downloads your stored profile, the four data kinds and sign-in metadata as JSON; it excludes
        credentials, session tokens and photo files. “Delete my account” removes your user record, sessions, linked Google account record
        and synced data from the live database. It does not delete your Google account or browser-only data and photos. Copies in hosting
        backups or security logs may remain under Cloudflare’s retention practices. Signing out restores the browser-only data that was here
        before sign-in.
      </p>

      <h2>Children</h2>
      <p>Rambleroo is not directed at children under 13, and we do not knowingly collect information from them.</p>

      <h2>Changes and contact</h2>
      <p>
        If this policy changes, the date above will change and the previous versions remain on record. You can export or delete your account
        yourself from the account menu. For questions or other requests, open <Contact />. Issues are public, so please leave out your email
        address and other personal details; if a request needs them (for example, you lost access to your account), say so in the issue and
        we will reply with a private way to reach us.
      </p>
      <p>
        See also the <Link to="/terms">terms of use</Link>.
      </p>
    </main>
  )
}
