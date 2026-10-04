import { AccountBridge, AccountControl } from '../../features/account/AccountControl'
import { ConsentBanner, CookieSettingsButton } from '../../features/consent/ConsentBanner'
import { useTrip } from '../../lib/store'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { Icon, Logo, type IconName } from '../art'
import { AppStatus } from '../ui/AppStatus'
import { Toast } from '../ui/Toast'
import { useCatalog } from '../../lib/data'
import { usePassport } from '../../lib/passport'
import styles from './Layout.module.css'
const supportsViewTransitions = typeof document !== 'undefined' && 'startViewTransition' in document

export default function Layout() {
  const { pathname } = useLocation()
  const { meta } = useCatalog()
  const tripCount = useTrip((s) => s.roads.length)
  const count = usePassport((s) => Object.keys(s.saved).length + s.savedStretches.length + s.visits.length)
  const nav = (
    <>
      {(
        [
          ['/', 'Explore', 'map'],
          ['/collections', 'Collections', 'layers'],
          ['/passport', 'Passport', 'stamp'],
          ['/trip', 'Trip', 'map'],
        ] as [string, string, IconName][]
      ).map(([to, label, icon]) => (
        <NavLink viewTransition key={to} to={to} end={to === '/'}>
          <Icon name={icon} size={18} />
          {label}
          {label === 'Trip' && (
            <span className={styles.badge} aria-label={`${tripCount} roads`}>
              {tripCount}
            </span>
          )}
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
      <AccountBridge />
      <a href="#main-content" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.header}>
        <Link viewTransition to="/" className={styles.logo} aria-label="Rambleroo home">
          <Logo size={32} />
        </Link>
        <span className={`kicker ${styles.tagline}`}>Est. 2026 · Scenic roads of America</span>
        <nav className={styles.desktop} aria-label="Main navigation">
          {nav}
        </nav>
        <Link viewTransition className={styles.about} to="/about">
          About the data
        </Link>
        <AccountControl placement="header" />
      </header>
      {/* Keyed by path so browsers without the View Transitions API still get a soft fade-in (see .pageEnter). */}
      <div id="main-content" tabIndex={-1} key={pathname} className={supportsViewTransitions ? undefined : styles.pageEnter}>
        <Outlet />
      </div>
      <ScrollRestoration />
      <ConsentBanner />
      {pathname !== '/' && (
        <footer className={styles.footer}>
          <span className="kicker">Explore / Collect / Remember</span>
          <p>
            Byway lines: <a href={meta?.source.url}>USDOT Scenic Byways layer</a>
            {meta ? `, retrieved ${meta.retrievedAt.slice(0, 10)}` : ''}. Basemap:{' '}
            <a href="https://www.naturalearthdata.com/">Natural Earth</a> and <a href="https://openfreemap.org/">OpenFreeMap</a> (©{' '}
            <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors). Illustrations are generated artwork, not
            photographs.
          </p>
          <nav className={styles.footerLinks} aria-label="Site information">
            <Link viewTransition to="/about">
              About the data
            </Link>
            <Link viewTransition to="/privacy">
              Privacy
            </Link>
            <Link viewTransition to="/terms">
              Terms
            </Link>
            <CookieSettingsButton className={styles.footerButton} />
          </nav>
        </footer>
      )}
      <nav className={styles.mobile} aria-label="Mobile navigation">
        {nav}
      </nav>
      <Toast />
      <AppStatus />
    </>
  )
}
