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
        <li>You can use everything without an account.</li>
        <li>
          Your trip, saved roads, stretches, visits, notes and postcards are stored only in this browser, on this device. We do not receive
          them.
        </li>
        <li>
          On rambleroo.app we ask before using Google Analytics cookies to count visits. If you decline, no analytics cookie is set. We use
          no advertising, and we never sell or share personal information.
        </li>
        <li>{LOCATION_POLICY}</li>
      </ul>

      <h2>What is stored, and where</h2>
      <p>
        Your trip and passport (saved roads and stretches, visits with their dates, scope and notes) are kept in your browser’s local
        storage. It never leaves your device unless you choose to export it. You can download it, import it on another browser, or clear it
        at any time from the <Link to="/passport">Passport</Link> page. Clearing your browser’s site data also deletes it. Because we never
        hold a copy, we cannot recover it for you if it is deleted.
      </p>
      <p>
        So that Rambleroo keeps working offline, your browser also caches the app and the pages, route data and photos you have opened. This
        cache contains public content only.
      </p>

      <p>
        Your car choices and postcard customizations are stored locally, like your passport. Your car picture and photos you add to
        postcards stay in this browser’s storage (IndexedDB) and are never uploaded by Rambleroo. They are not included in the passport
        export file; card customizations are also excluded. Clearing the passport can also remove your added photos. Clearing site data
        removes them too. If you choose to share or download a postcard image, that image includes the photo you selected.
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
        page tells you when that will happen. Nothing is sent to these services unless you tap the link.
      </p>

      <h2 id="cookies">Cookies and analytics</h2>
      <p>
        On rambleroo.app, a banner asks whether we may count visits with Google Analytics. Nothing from Google loads, and no analytics
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

      <h2>Accounts (not available yet)</h2>
      <p>
        Optional accounts may be added later so you can keep your journeys across devices. If they are, this page will be updated before
        they launch, and an account will only store what is needed to keep your journeys.
      </p>

      <h2>Children</h2>
      <p>Rambleroo is not directed at children under 13, and we do not knowingly collect information from them.</p>

      <h2>Changes and contact</h2>
      <p>
        If this policy changes, the date above will change and the previous versions remain on record. Questions or requests: <Contact />.
      </p>
      <p>
        See also the <Link to="/terms">terms of use</Link>.
      </p>
    </main>
  )
}
