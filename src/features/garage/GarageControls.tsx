import { useState } from 'react'
import { prepareCarPicture } from '../../lib/carPicture'
import { userPhotos } from '../../lib/userPhotos'
import { Vehicle } from '../../components/art'
import { accents, models, roofs, swatches, useGarage } from '../../lib/garage'
import './studio.css'
export function GarageControls() {
  const car = useGarage()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <section className="studio-controls" aria-label="Your car">
      <h2>Your car</h2>
      <div className="garage-preview">
        <Vehicle view="side" size={240} {...car} />
        <Vehicle view="top" size={70} {...car} />
      </div>
      <fieldset>
        <legend>Use your own picture</legend>
        <label>
          Choose a picture (up to 8 MB)
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setBusy(true)
              setError('')
              try {
                const picture = await userPhotos.add(await prepareCarPicture(file))
                const previous = useGarage.getState().picture
                car.update({ picture, usePicture: true })
                if (previous) await userPhotos.remove(previous)
              } catch (error) {
                setError(error instanceof Error ? error.message : 'Could not save your picture.')
              } finally {
                setBusy(false)
              }
            }}
          />
        </label>
        <p>Transparent PNGs look best. Pictures are cropped to a square and stay in this browser.</p>
        {busy && <p role="status">Preparing your sticker…</p>}
        {error && <p role="alert">{error}</p>}
        {car.picture && (
          <div className="studio-options">
            <button disabled={busy} aria-pressed={car.usePicture} onClick={() => car.update({ usePicture: !car.usePicture })}>
              {car.usePicture ? 'Back to the drawn car' : 'Use your picture'}
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await userPhotos.remove(car.picture!)
                  car.update({ picture: undefined, usePicture: false })
                } catch {
                  setError('Could not remove your picture. Please try again.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Remove picture
            </button>
          </div>
        )}
      </fieldset>
      <fieldset>
        <legend>Model</legend>
        <div className="studio-options">
          {models.map((model) => (
            <label key={model}>
              <input type="radio" name="car-model" checked={car.model === model} onChange={() => car.update({ model })} />
              {model}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Body colour</legend>
        <div className="studio-options">
          {swatches.map(([name, body]) => (
            <button type="button" key={body} aria-label={name} aria-pressed={car.body === body} onClick={() => car.update({ body })}>
              <span className="swatch" style={{ background: body }} />
              {name}
            </button>
          ))}
        </div>
        <label>
          Custom colour
          <input type="color" value={car.body} onChange={(e) => car.update({ body: e.target.value })} />
        </label>
      </fieldset>
      <fieldset>
        <legend>Accent</legend>
        <div className="studio-options">
          {accents.map((accent) => (
            <label key={accent}>
              <input type="radio" name="car-accent" checked={car.accent === accent} onChange={() => car.update({ accent })} />
              {accent}
            </label>
          ))}
        </div>
        <label>
          Accent colour
          <select value={car.accentColor} onChange={(e) => car.update({ accentColor: e.target.value })}>
            {swatches.map(([name, color]) => (
              <option key={color} value={color}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <legend>On the roof</legend>
        <div className="studio-options">
          {roofs.map((roof) => (
            <label key={roof}>
              <input type="radio" name="car-roof" checked={car.roof === roof} onChange={() => car.update({ roof })} />
              {roof}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Plate
        <input
          className="plate-input"
          value={car.plate}
          maxLength={7}
          onChange={(e) => car.update({ plate: e.target.value })}
          aria-describedby="plate-help"
        />
      </label>
      <p id="plate-help">Up to 7 letters, numbers or spaces.</p>
    </section>
  )
}
