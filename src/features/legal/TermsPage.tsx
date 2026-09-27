import { Link } from 'react-router'
import styles from '../../components/layout/Page.module.css'
import { Contact } from './Contact'
import { TERMS_UPDATED } from './policy'

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <span className="kicker">Terms of use</span>
      <h1>A few ground rules for the road.</h1>
      <p>
        <strong>Last updated {TERMS_UPDATED}.</strong> By using Rambleroo you agree to these terms. They are written to be read.
      </p>

      <h2>What Rambleroo is</h2>
      <p>
        A free, noncommercial guide for discovering scenic roads and keeping a personal record of the ones you drive. It is not a navigation
        system, a travel agency, or a source of live road information.
      </p>

      <h2>Drive safely and check before you go</h2>
      <ul>
        <li>Do not use Rambleroo while driving. Plan before you set off or when you are safely parked.</li>
        <li>
          Roads close, change and flood; seasons and weather change them. Always check current conditions with the responsible agency, and
          follow road signs and the law over anything shown here.
        </li>
        <li>
          Distances are measured from mapped source data, and drive times are estimates routed with OpenStreetMap data that exclude stops,
          traffic and conditions. Neither is a guarantee.
        </li>
        <li>
          “Drive this stretch” hands your route to Google Maps. Check that the directions it gives actually follow the road you chose.
        </li>
        <li>Stories are drafts unless marked reviewed, and places marked “off the road” require a detour.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        Notes, visits and postcards you create belong to you and are stored in your browser (see the{' '}
        <Link to="/privacy">privacy policy</Link>
        ). If you share them, you are responsible for what you share and where.
      </p>

      <h2>Our content and credits</h2>
      <p>
        Byway lines come from the U.S. Department of Transportation’s Scenic Byways layer, and the basemap from Natural Earth; both are
        public domain. Drive times use data © OpenStreetMap contributors (ODbL). Photographs belong to their credited authors and are used
        under the licence shown with each one; reuse must follow that licence. Illustrations are generated artwork, not photographs.
        Rambleroo’s own text, design and illustrations may not be reused commercially without permission.
      </p>

      <p>
        3D terrain uses{' '}
        <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">
          Mapzen Terrain Tiles on AWS Open Data (USGS, NOAA and others)
        </a>
        . Elevation is exaggerated to give the paper map a raised-relief appearance.
      </p>
      <h2>Fair use of the service</h2>
      <p>Please don’t attempt to disrupt the site, overload it with automated requests, or use it to harm others.</p>

      <h2>No warranty</h2>
      <p>
        Rambleroo is provided “as is”, without warranties of any kind. To the extent the law allows, we are not liable for losses arising
        from its use, including decisions made on the road. You are responsible for your own travel.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms; the date above will change and earlier versions remain on record. Questions: <Contact />.
      </p>
    </main>
  )
}
