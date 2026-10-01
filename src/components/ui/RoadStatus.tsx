import { Link } from 'react-router'
import s from './RoadStatus.module.css'

export function LoadingRoad({ title }: { title: string }) {
  return (
    <main className={s.page} aria-busy="true">
      <p role="status">{title}</p>
      <div className={s.hero} aria-hidden="true" />
      <div className={s.lines} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </main>
  )
}
export function NotFound({ title = 'A little off the beaten path.' }: { title?: string }) {
  return (
    <main className={s.page}>
      <span className="kicker">404 · End of this road</span>
      <h1>{title}</h1>
      <p>We couldn’t find that page. Find another road on the map, or revisit your saved places.</p>
      <div className={s.actions}>
        <Link className="btn btn-primary" to="/">
          Return to the map
        </Link>
        <Link className="btn btn-ghost" to="/passport">
          Your passport
        </Link>
      </div>
    </main>
  )
}
