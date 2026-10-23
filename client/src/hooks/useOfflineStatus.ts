/**
 * useOfflineStatus.ts
 * Phase 1c: Tracks navigator.onLine + fires SW sync on reconnect.
 */
import { useState, useEffect } from 'react';

export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      setJustReconnected(true);
      // Trigger background sync for queued answers
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then((reg) => {
            if ('sync' in reg) {
              (reg as any).sync.register('lw-answer-sync').catch(() => {});
            }
          })
          .catch(() => {});
      }
      setTimeout(() => setJustReconnected(false), 3000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return { isOffline, justReconnected };
}
