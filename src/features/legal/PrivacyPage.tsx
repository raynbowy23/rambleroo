import { Link } from 'react-router'
import styles from '../../components/layout/Page.module.css'
import { Contact } from './Contact'
import { PRIVACY_UPDATED } from './policy'

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
          Your saved roads, stretches, visits, notes and postcards are stored only in this browser, on this device. We do not receive them.
        </li>
        <li>We do not use cookies, analytics, advertising, or tracking of any kind, and we never sell or share personal information.</li>
        <li>We do not collect your location. Nothing runs in the background.</li>
        <li>
          If research participation opens in the future, it will be optional, asked for separately, and explained before anything is
          collected.
        </li>
      </ul>

      <h2>What is stored, and where</h2>
      <p>
        Your passport (saved roads and stretches, visits with their dates, scope and notes) is kept in your browser’s local storage. It
        never leaves your device unless you choose to export it. You can download it, import it on another browser, or clear it at any time
        from the <Link to="/passport">Passport</Link> page. Clearing your browser’s site data also deletes it. Because we never hold a copy,
        we cannot recover it for you if it is deleted.
      </p>
      <p>
        So that Rambleroo keeps working offline, your browser also caches the app and the pages, route data and photos you have opened. This
        cache contains public content only.
      </p>

      <h2>What reaches our server</h2>
      <p>
        Pages, route data and photos are loaded from the server that hosts Rambleroo. Like almost any website host, that server may record
        standard request logs (such as IP address, time, and the page requested) for security and reliability. We do not combine these logs
        with anything else or use them to profile anyone.
      </p>

      <h2>When you choose to leave Rambleroo</h2>
      <p>
        Some actions open another service, which then handles your information under its own policy: “Drive this stretch” and directions
        open Google Maps; share buttons open email, X, Facebook, Bluesky or Reddit with a link and short text you can edit; credits link to
        Wikipedia and Wikimedia Commons. A note you typed on a postcard is included in a share only when you choose to share it, and the
        page tells you when that will happen. Nothing is sent to these services unless you tap the link.
      </p>

      <h2>Accounts (not available yet)</h2>
      <p>
        Optional accounts may be added later so you can keep your journeys across devices. If they are, an account will only store what is
        needed to keep your journeys. Having an account will not, by itself, enroll you in any research.
      </p>

      <h2>Research participation (not active yet)</h2>
      <p>Rambleroo exists partly to understand when extra time on the road feels worthwhile. If a study opens, these commitments apply:</p>
      <ul>
        <li>
          <strong>Separate and optional.</strong> You will be asked in a dedicated consent step that explains exactly what is collected,
          why, who can see it, and how long it is kept. You can use Rambleroo fully without joining.
        </li>
        <li>
          <strong>Only what the study needs.</strong> For example, which road alternatives you were shown, the one you picked, why, and a
          short reflection after the trip. No continuous location tracking.
        </li>
        <li>
          <strong>Kept apart from who you are.</strong> Research records are stored under a random research ID, separately from any contact
          details. We describe this as de-identified rather than “anonymous”, because travel records can sometimes point to a person even
          without a name.
        </li>
        <li>
          <strong>Never shared in identifiable form.</strong> We will not publish, sell or share information that could identify you or be
          combined to single you out, such as individual trip records or exact places and dates. Findings are published only as aggregated
          results.
        </li>
        <li>
          <strong>You stay in control.</strong> You can withdraw at any time and ask for your contributions to be deleted. Results already
          published in aggregate cannot be un-published, but they will not contain anything that identifies you.
        </li>
      </ul>

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
