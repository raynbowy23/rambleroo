import { NotFound } from './components/ui/RoadStatus'
import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import Layout from './components/layout/Layout'
import styles from './components/layout/Page.module.css'
// Route modules load through the router (not <Suspense>), so the current page stays on screen until the next one is ready,
// and the swap then runs inside a view transition instead of flashing a loading message.
const pages = {
  trip: () => import('./features/trip/TripPage'),
  print: () => import('./features/strip/print'),
  explore: () => import('./features/explore/ExplorePage'),
  strip: () => import('./features/strip/StripPage'),
  byway: () => import('./features/byway/BywayPage'),
  state: () => import('./features/state/StatePage'),
  collections: () => import('./features/collections/CollectionsPage'),
  passport: () => import('./features/passport/PassportPage'),
  about: () => import('./features/about/AboutPage'),
  privacy: () => import('./features/legal/PrivacyPage'),
  terms: () => import('./features/legal/TermsPage'),
}
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default })

/** Fetch every page's code once the first screen is idle, so later navigations never wait on the network. */
export function preloadPages() {
  const run = () => Object.values(pages).forEach((load) => void load())
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 2500)
}

const galleryModules = import.meta.glob<{ default: React.ComponentType }>('./components/art/ArtGallery.tsx')
const ArtGallery = lazy(async () => {
  const loader = galleryModules['./components/art/ArtGallery.tsx']
  return loader
    ? loader()
    : {
        default: () => (
          <main className={styles.page}>
            <h1>Art gallery</h1>
            <p>The illustration gallery is still being prepared.</p>
          </main>
        ),
      }
})
const router = createBrowserRouter([
  {
    element: <Layout />,
    HydrateFallback: () => (
      <p role="status" className={styles.page}>
        Opening the map…
      </p>
    ),
    children: [
      { path: '/', lazy: page(pages.explore) },
      { path: '/byway/:id/strip', lazy: page(pages.strip) },
      { path: '/byway/:id', lazy: page(pages.byway) },
      { path: '/state/:code', lazy: page(pages.state) },
      { path: '/collections', lazy: page(pages.collections) },
      { path: '/collections/:slug', lazy: page(pages.collections) },
      { path: '/trip', lazy: page(pages.trip) },
      { path: '/byway/:id/strip/print', lazy: page(pages.print) },
      { path: '/passport', lazy: page(pages.passport) },
      { path: '/about', lazy: page(pages.about) },
      { path: '/privacy', lazy: page(pages.privacy) },
      { path: '/terms', lazy: page(pages.terms) },
      {
        path: '/dev/art',
        element: (
          <Suspense fallback={<p>Opening the gallery…</p>}>
            <ArtGallery />
          </Suspense>
        ),
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
])
export default function App() {
  return <RouterProvider router={router} />
}
