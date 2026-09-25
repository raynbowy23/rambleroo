import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Icon, Logo, type IconName } from '../art'
import { Toast } from '../ui/Toast'
import { useCatalog } from '../../lib/data'
import { usePassport } from '../../lib/passport'
import styles from './Layout.module.css'
export default function Layout() {
  const { pathname } = useLocation()
  const { meta } = useCatalog()
  const count = usePassport((s) => Object.keys(s.saved).length + s.visits.length)
  const nav = (
    <>
      {(
        [
          ['/', 'Explore', 'map'],
          ['/collections', 'Collections', 'layers'],
          ['/passport', 'Passport', 'stamp'],
        ] as [string, string, IconName][]
      ).map(([to, label, icon]) => (
        <NavLink key={to} to={to} end={to === '/'}>
          <Icon name={icon} size={18} />
          {label}
          {label === 'Passport' && (
            <span className={styles.badge} aria-label={`${count} saves and visits`}>
              {count}
            </span>
          )}
        </NavLink>
      ))}
    </>
  )
  return (
    <>
      <a href="#main-content" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.header}>
        <Link to="/" className={styles.logo} aria-label="Rambleroo home">
          <Logo size={32} />
        </Link>
        <span className={`kicker ${styles.tagline}`}>Est. 2026 · Scenic roads of America</span>
        <nav className={styles.desktop} aria-label="Main navigation">
          {nav}
        </nav>
        <Link className={styles.about} to="/about">
          About the data
        </Link>
      </header>
      <div id="main-content" tabIndex={-1}>
        <Outlet />
      </div>
      {pathname !== '/' && (
        <footer className={styles.footer}>
          <span className="kicker">Explore / Collect / Remember</span>
          <p>
            Byway lines: <a href={meta?.source.url}>USDOT Scenic Byways layer</a>
            {meta ? `, retrieved ${meta.retrievedAt.slice(0, 10)}` : ''}. Basemap:{' '}
            <a href="https://www.naturalearthdata.com/">Natural Earth</a>. Illustrations are generated artwork, not photographs.
          </p>
          <Link to="/about">About the data</Link>
        </footer>
      )}
      <nav className={styles.mobile} aria-label="Mobile navigation">
        {nav}
      </nav>
      <Toast />
    </>
  )
}
