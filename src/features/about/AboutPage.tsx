import { useCatalog } from '../../lib/data'
import styles from '../../components/layout/Page.module.css'
export default function AboutPage() {
  const { meta } = useCatalog()
  return (
    <main className={styles.page}>
      <span className="kicker">About the data</span>
      <h1>Scenic roads of America, honestly mapped.</h1>
      <p>
        Rambleroo brings together {meta?.bywayCount.toLocaleString() ?? '…'} scenic byways from the USDOT source layer, with{' '}
        {meta?.storyCount ?? '…'} stories. These stories are drafts pending review. This catalog is a snapshot of that source, not a
        complete inventory of every scenic road or current designation.
      </p>
      <h2>What the map tells you</h2>
      <p>
        Theme tags are mostly inferred from road names. Distances are sums of mapped source segments, rounded for display; divided
        carriageways can be counted twice. They are not verified driving distances or suggested itineraries. Multi-state roads include all
        mapped segments.
      </p>
      <p>
        All scenic illustrations are generated artwork, not photographs or documentary views of a specific place. Decorative terrain symbols
        are atmospheric, not navigation landmarks.
      </p>
      <h2>Photographs</h2>
      <p>Real photographs come from Wikimedia Commons under their stated licences, credited on each image. Illustrations are artwork.</p>
      <h2>Sharing postcards</h2>
      <p>
        Link previews on social sites show the generic Rambleroo card for now. Per-road preview images need prerendering, which is planned.
      </p>
      <h2>Your passport stays here</h2>
      <p>
        Saves and visits live in this browser only. There is no account or synchronization. Clearing browser storage removes them; if
        storage is blocked, changes last only for this session.
      </p>
      <h2>Sources and credits</h2>
      <p>
        <a href={meta?.source.url ?? 'https://data-usdot.opendata.arcgis.com/'}>USDOT Scenic Byways layer</a>
        {meta && ` · retrieved ${meta.retrievedAt.slice(0, 10)} · ${meta.source.featureCount.toLocaleString()} source features`}.
      </p>
      <p>
        Basemap: <a href="https://www.naturalearthdata.com/">Natural Earth</a>, public-domain geographic data.
      </p>
    </main>
  )
}
