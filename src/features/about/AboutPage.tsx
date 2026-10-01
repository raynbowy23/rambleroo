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
      <h2>3D terrain</h2>
      <p>
        3D terrain uses{' '}
        <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">
          Mapzen Terrain Tiles on AWS Open Data (USGS, NOAA and others)
        </a>
        . Elevation is exaggerated to give the paper map a raised-relief appearance.
      </p>
      <h2>Roads beyond the national dataset</h2>
      <p>
        Two Wisconsin byways missing from the 2022 national layer, the Wisconsin Lake Superior Scenic Byway and the Nicolet-Wolf River
        Scenic Byway, use the route lines from WisDOT's own scenic byways layer. A small set of classic drives that were never designated
        scenic byways, such as Going-to-the-Sun Road and the Road to Hana, are included and always labelled "Classic drive · not a
        designated byway". Their route lines are routed or taken from OpenStreetMap data (© OpenStreetMap contributors) and checked to
        follow the named road.
      </p>
      <h2>How we choose photos</h2>
      <p>
        We curate photographs for stories. For other listings, we use the lead image of the road’s Wikipedia article or the U.S. DOT
        America’s Byways collection. Each photo is reviewed by eye, credited, and freely licensed. Roads without a suitable photo show an
        illustration.
      </p>
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
        Basemap: <a href="https://www.naturalearthdata.com/">Natural Earth</a>, public-domain geographic data. Detailed basemap:{' '}
        <a href="https://openfreemap.org/">© OpenFreeMap</a>{' '}
        <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>.
      </p>
    </main>
  )
}
