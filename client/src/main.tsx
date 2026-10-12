import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { runStartupMigration } from './lib/storageMigration'

// Auto-recover from stale Vite dynamic imports after new deployments
window.addEventListener('vite:preloadError', async (event) => {
  console.warn('[Vite Preload Error] Module chunk missing after deployment, purging cache and reloading...', event);
  event.preventDefault();
  const lastReload = sessionStorage.getItem('vite_preload_reload');
  const now = Date.now();
  if (!lastReload || now - Number(lastReload) > 8000) {
    sessionStorage.setItem('vite_preload_reload', String(now));
    if ('caches' in window) {
      try {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      } catch (_) {}
    }
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.update();
        }
      } catch (_) {}
    }
    window.location.href = window.location.pathname + '?_t=' + now;
  }
});

// Run backward-compatible storage migration (Phase R)
runStartupMigration()

// PWA Service Worker (Phase 1c: offline resilience)
// Only register in production; in development, aggressively unregister and purge caches to prevent Vite ESM module corruption
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[SW Registration Error]', err)
      })
    })
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister()
      }
    })
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) caches.delete(name)
      })
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
