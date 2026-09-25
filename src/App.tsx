import { lazy, Suspense } from 'react'
import { createBrowserRouter, Link, RouterProvider } from 'react-router'
import Layout from './components/layout/Layout'
import styles from './components/layout/Page.module.css'
const ExplorePage = lazy(() => import('./features/explore/ExplorePage'))
const BywayPage = lazy(() => import('./features/byway/BywayPage'))
const StatePage = lazy(() => import('./features/state/StatePage'))
const CollectionsPage = lazy(() => import('./features/collections/CollectionsPage'))
const PassportPage = lazy(() => import('./features/passport/PassportPage'))
const AboutPage = lazy(() => import('./features/about/AboutPage'))
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
    children: [
      { path: '/', element: <ExplorePage /> },
      { path: '/byway/:id', element: <BywayPage /> },
      { path: '/state/:code', element: <StatePage /> },
      { path: '/collections', element: <CollectionsPage /> },
      { path: '/collections/:slug', element: <CollectionsPage /> },
      { path: '/passport', element: <PassportPage /> },
      { path: '/about', element: <AboutPage /> },
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
        element: (
          <main className={styles.page}>
            <h1>A little off the beaten path.</h1>
            <p>We couldn’t find that page.</p>
            <Link to="/">Return to the map</Link>
          </main>
        ),
      },
    ],
  },
])
export default function App() {
  return (
    <Suspense fallback={<p role="status">Opening the map…</p>}>
      <RouterProvider router={router} />
    </Suspense>
  )
}
