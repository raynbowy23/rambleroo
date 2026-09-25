import { useState } from 'react'
import type { SceneFamily } from '../../lib/types'
import { Scene, Stamp, Seal, Compass, Logo, Icon } from './index'
import type { SceneVariant, IconName } from './index'
import './art.css'
const families: SceneFamily[] = ['river', 'coast', 'mountain', 'forest', 'desert', 'town', 'prairie']
const variants: SceneVariant[] = ['postcard', 'hero', 'stamp', 'cover', 'thumb']
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
    <main className="art-gallery">
      <Logo size={40} />
      <h1>The illustrated atlas</h1>
      <p>Seven landscapes, four seeds, five formats. Paper, terrain, and the road ahead.</p>
      <h2>Ink & insignia</h2>
      <div className="art-gallery-badges">
        <Seal />
        <Seal text="Good roads · brighter days" size={140} />
        <Compass size={100} />
        <Logo size={56} />
        <Logo size={28} withWordmark={false} />
      </div>
      <h2>A passport to the back roads</h2>
      <div className="art-gallery-badges">
        <Stamp title="Great River Road" subtitle="Wisconsin" seed={1} />
        <Stamp family="mountain" title="Going-to-the-Sun Road" subtitle="Montana" seed={7} visited date="Aug 2026" />
        <Stamp empty />
        <Stamp key={press} family="coast" title="Pacific Coast Highway" subtitle="California" visited date="Sep 2026" press size={220} />
        <Stamp family="desert" title="Scenic Byway 12" subtitle="Utah" size={96} />
        <button type="button" onClick={() => setPress((p) => p + 1)}>
          Replay stamp press
        </button>
      </div>
      <h2>Field symbols</h2>
      <div className="art-gallery-icons">
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
              <div className="art-gallery-grid">
                {[false, true].flatMap((animate) =>
                  seeds.map((seed) => (
                    <figure key={`${seed}-${animate}`}>
                      <div className="art-gallery-sample" style={{ aspectRatio: ratios[variant] }}>
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
