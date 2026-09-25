import { useState } from 'react'
import type { Motif, Region, SceneFamily } from '../../lib/types'
import { Scene, Stamp, Seal, Compass, Logo, Icon } from './index'
import type { SceneVariant, IconName } from './index'
import { regions } from './regions'
import { landmarks } from './motifs'
import './art.css'
const families: SceneFamily[] = ['river', 'coast', 'mountain', 'forest', 'desert', 'town', 'prairie']
const variants: SceneVariant[] = ['postcard', 'hero', 'stamp', 'cover', 'thumb']
const combinations: { label: string; family: SceneFamily; region: Region; motifs: Motif[] }[] = [
  { label: 'Great River Road', family: 'river', region: 'upper-midwest', motifs: ['river-bluffs', 'lake-wide'] },
  { label: 'Oregon offshore light', family: 'coast', region: 'pacific-northwest', motifs: ['lighthouse', 'sea-rock'] },
  { label: 'Big Sur', family: 'coast', region: 'california', motifs: ['arch-bridge'] },
  { label: 'Bryce country', family: 'desert', region: 'southwest', motifs: ['hoodoos'] },
  { label: 'Utah Highway 12', family: 'desert', region: 'southwest', motifs: ['slickrock-ridge'] },
  { label: 'Blue Ridge Parkway', family: 'mountain', region: 'appalachia', motifs: ['viaduct', 'rolling-ridges'] },
  { label: 'Blue Ridge mill pond', family: 'forest', region: 'appalachia', motifs: ['gristmill'] },
  { label: 'San Juan Skyway', family: 'mountain', region: 'rockies', motifs: ['mining-town', 'snow-peaks'] },
  { label: 'Door County harbor', family: 'coast', region: 'great-lakes', motifs: ['harbor-village', 'lighthouse'] },
  { label: 'Door County shoreline', family: 'coast', region: 'great-lakes', motifs: ['limestone-ledges'] },
]
const seeds = [1, 7, 42, 2026]
const ratios: Record<SceneVariant, string> = {
  postcard: '400 / 260',
  hero: '1200 / 680',
  stamp: '200 / 220',
  cover: '400 / 520',
  thumb: '1',
}
const icons: IconName[] = [
  'search',
  'bookmark',
  'bookmark-filled',
  'arrow-right',
  'arrow-left',
  'close',
  'map',
  'grid',
  'list',
  'pin',
  'clock',
  'leaf',
  'share',
  'plus',
  'minus',
  'locate',
  'layers',
  'dice',
  'check',
  'pause',
  'play',
  'chevron-left',
  'chevron-right',
  'chevron-up',
  'chevron-down',
  'user',
  'stamp',
  'route',
  'external',
  'trash',
  'edit',
  'calendar',
  'info',
  'theme-water',
  'theme-coast',
  'theme-mountain',
  'theme-forest',
  'theme-desert',
  'theme-historic',
  'theme-countryside',
]
export default function ArtGallery() {
  const [press, setPress] = useState(0)
  return (
    <main className="rr-gallery">
      <Logo size={40} />
      <h1>Illustration kit</h1>
      <p>Fifteen regions, twenty-three landmarks, seven landscape families. Six inks and warm paper.</p>
      <h2>Ink & insignia</h2>
      <div className="rr-gallery-badges">
        <Seal />
        <Seal text="Good roads · brighter days" size={140} />
        <Compass size={100} />
        <Logo size={56} />
        <Logo size={28} withWordmark={false} />
      </div>
      <h2>A passport to the back roads</h2>
      <div className="rr-gallery-badges">
        <Stamp region="upper-midwest" motifs={['river-bluffs', 'lake-wide']} title="Great River Road" subtitle="Wisconsin" seed={1} />
        <Stamp
          region="rockies"
          motifs={['snow-peaks', 'switchbacks']}
          family="mountain"
          title="Going-to-the-Sun Road"
          subtitle="Montana"
          seed={7}
          visited
          date="Aug 2026"
        />
        <Stamp empty />
        <Stamp
          key={press}
          region="california"
          motifs={['arch-bridge']}
          family="coast"
          title="Pacific Coast Highway"
          subtitle="California"
          visited
          date="Sep 2026"
          press
          size={220}
        />
        <Stamp region="southwest" motifs={['slickrock-ridge']} family="desert" title="Scenic Byway 12" subtitle="Utah" size={96} />
        <button type="button" onClick={() => setPress((p) => p + 1)}>
          Replay stamp press
        </button>
      </div>
      <section>
        <h2>Regions</h2>
        <div className="rr-gallery-grid rr-gallery-regions">
          {(Object.keys(regions) as Region[]).flatMap((region) =>
            [1, 7, 42].map((seed) => (
              <figure key={`${region}-${seed}`}>
                <div className="rr-gallery-sample" style={{ aspectRatio: ratios.postcard }}>
                  <Scene family={regions[region].family} region={region} seed={seed} framed title={`${region}, seed ${seed}`} />
                </div>
                <figcaption>
                  {region.replaceAll('-', ' ')} / {seed}
                </figcaption>
              </figure>
            )),
          )}
        </div>
      </section>
      <section>
        <h2>Landmarks</h2>
        {(['postcard', 'hero'] as const).map((variant) => (
          <section key={variant}>
            <h3>{variant}</h3>
            <div className="rr-gallery-grid">
              {(Object.keys(landmarks) as Motif[]).map((motif) => (
                <figure key={motif}>
                  <div className="rr-gallery-sample" style={{ aspectRatio: ratios[variant] }}>
                    <Scene
                      family={landmarks[motif].family}
                      motifs={[motif]}
                      seed={7}
                      variant={variant}
                      framed
                      title={motif.replaceAll('-', ' ')}
                    />
                  </div>
                  <figcaption>{motif.replaceAll('-', ' ')}</figcaption>
                </figure>
              ))}
              {combinations.map(({ label, ...scene }) => (
                <figure key={label}>
                  <div className="rr-gallery-sample" style={{ aspectRatio: ratios[variant] }}>
                    <Scene {...scene} seed={42} variant={variant} framed title={label} />
                  </div>
                  <figcaption>
                    {label} / {scene.motifs.join(' + ')}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </section>
      <h2>Field symbols</h2>
      <div className="rr-gallery-icons">
        {icons.map((name) => (
          <figure key={name}>
            <Icon name={name} size={28} />
            <figcaption>{name}</figcaption>
          </figure>
        ))}
      </div>
      {variants.map((variant) => (
        <section key={variant}>
          <h2>{variant.charAt(0).toUpperCase() + variant.slice(1)} studies</h2>
          {families.map((family) => (
            <section key={family}>
              <h3>{family}</h3>
              <div className="rr-gallery-grid">
                {[false, true].flatMap((animate) =>
                  seeds.map((seed) => (
                    <figure key={`${seed}-${animate}`}>
                      <div className="rr-gallery-sample" style={{ aspectRatio: ratios[variant] }}>
                        <Scene
                          family={family}
                          seed={seed}
                          variant={variant}
                          animate={animate}
                          title={`${family}, seed ${seed}, ${variant}, ${animate ? 'ambient motion' : 'still'}`}
                        />
                      </div>
                      <figcaption>
                        {seed} / {animate ? 'Ambient' : 'Static'}
                      </figcaption>
                    </figure>
                  )),
                )}
              </div>
            </section>
          ))}
        </section>
      ))}
    </main>
  )
}
