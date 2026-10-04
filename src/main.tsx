import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { startAnalytics } from './lib/analytics'
import './index.css'
import App, { preloadPages } from './App.tsx'

// Resumes analytics only for a visitor who already accepted on rambleroo.app; otherwise this does nothing.
startAnalytics()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

preloadPages()
