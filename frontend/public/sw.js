/**
 * sw.js — LogicWhileLiRE Service Worker
 * Phase 1c: Offline resilience
 *
 * Strategy:
 * - App shell (HTML/JS/CSS): Cache-first with network fallback in production
 * - Dev mode (localhost): Bypass and unregister to prevent Vite ESM module corruption
 * - API calls: Network-first; on failure return last cached response
 * - Answer saves during offline: queued in IndexedDB (by useExamAutosave hook)
 *   and flushed when the 'sync' event fires (Background Sync API)
 */

const CACHE_VERSION = 'logicwhilelire-v6';
const APP_SHELL = [
  '/',
  '/index.html',
];

const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

if (isDev) {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim())
    );
  });
  self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
  });
} else {

  // ── Install: pre-cache app shell ──────────────────────────────────────────
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
  });

  // ── Activate: purge all outdated caches immediately ────────────────────────
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => {
            console.log('[SW] Purging outdated cache:', k);
            return caches.delete(k);
          })
        )
      )
    );
    self.clients.claim();
  });

  // ── Fetch: network-first for navigation & API, cache-fallback for offline ─
  self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Navigation (HTML pages): ALWAYS network-first so new releases are immediately seen
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html') || url.pathname === '/' || url.pathname === '/index.html') {
      event.respondWith(
        fetch(request)
          .then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
            }
            return res;
          })
          .catch(() => caches.match('/index.html'))
      );
      return;
    }

    // API calls: network-first (never cache failed or stale API responses)
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(
        fetch(request)
          .then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
            }
            return res;
          })
          .catch(() => caches.match(request))
      );
      return;
    }

    // Static assets (hashed JS, CSS, images): Network-first with cache fallback
    // CRITICAL: NEVER return index.html for .js or .css assets! Serving HTML for JS causes syntax crash
    const isCodeAsset = url.pathname.includes('/assets/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css');

    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          if (isCodeAsset) {
            return new Response('Asset not found or updated in recent deployment', {
              status: 404,
              statusText: 'Not Found',
              headers: { 'Content-Type': 'text/plain' },
            });
          }
          return caches.match('/index.html');
        })
    );
  });

  // ── Background Sync: flush pending answer saves ───────────────────────────
  self.addEventListener('sync', (event) => {
    if (event.tag === 'lw-answer-sync') {
      event.waitUntil(flushAnswerQueue());
    }
  });

  async function flushAnswerQueue() {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: 'SW_SYNC_TRIGGER' });
    }
  }
}
