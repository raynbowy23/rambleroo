import { Vehicle } from '../../components/art'
import { accents, models, roofs, swatches, useGarage } from '../../lib/garage'
import './studio.css'
export function GarageControls() {
  const car = useGarage()
  return (
    <section className="studio-controls" aria-label="Your car">
      <h2>Your car</h2>
      <div className="garage-preview">
        <Vehicle view="side" size={240} {...car} />
        <Vehicle view="top" size={70} {...car} />
      </div>
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
