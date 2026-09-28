import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { runStartupMigration } from './lib/storageMigration'

// Run backward-compatible storage migration (Phase R)
runStartupMigration()

// Register PWA Service Worker (Phase 1c: offline resilience)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[SW Registration Error]', err)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


