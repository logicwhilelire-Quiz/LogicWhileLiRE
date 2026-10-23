import { useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../lib/config';

interface ProctoringConfig {
  sessionId: string;
  onViolation: (type: string, notes?: string) => void;
  enabled: boolean;
}

/**
 * useProctor — client-side exam lockdown hook.
 * Detects: tab switches, window blur, fullscreen exit, devtools, copy/paste.
 * Sends violations via navigator.sendBeacon (fires even if tab is closing).
 */
export function useProctor({ sessionId, onViolation, enabled }: ProctoringConfig) {
  const beaconUrl = `${API_BASE_URL}/api/session/${sessionId}/violation`;
  const disabledRef = useRef(!enabled);

  useEffect(() => {
    disabledRef.current = !enabled;
  }, [enabled]);

  const sendViolationBeacon = useCallback(
    (type: string, notes?: string) => {
      if (disabledRef.current) return;

      const payload = JSON.stringify({ type, notes });

      // sendBeacon fires even if the tab is closing (beforeunload)
      if (navigator.sendBeacon) {
        navigator.sendBeacon(beaconUrl, new Blob([payload], { type: 'application/json' }));
      }

      onViolation(type, notes);
    },
    [beaconUrl, onViolation]
  );

  // ——— Tab switch (visibility change) ———
  useEffect(() => {
    if (!enabled) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        sendViolationBeacon('tab_switch', 'Document became hidden');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, sendViolationBeacon]);

  // ——— Window blur (alt-tab, other app focus) ———
  useEffect(() => {
    if (!enabled) return;
    const handleBlur = () => sendViolationBeacon('window_blur', 'Window lost focus');
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [enabled, sendViolationBeacon]);

  // ——— Fullscreen exit ———
  useEffect(() => {
    if (!enabled) return;
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        sendViolationBeacon('fullscreen_exit', 'Exited fullscreen mode');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [enabled, sendViolationBeacon]);

  // ——— DevTools keyboard shortcuts (deterrent only) ———
  useEffect(() => {
    if (!enabled) return;
    const handleKeydown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        sendViolationBeacon('devtools', 'F12 pressed');
        return;
      }
      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(e.key)) {
        e.preventDefault();
        sendViolationBeacon('devtools', `Ctrl+Shift+${e.key.toUpperCase()} pressed`);
        return;
      }
      // Ctrl+U (view source)
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [enabled, sendViolationBeacon]);

  // ——— Disable right-click ———
  useEffect(() => {
    if (!enabled) return;
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, [enabled]);

  // ——— Disable copy/paste ———
  useEffect(() => {
    if (!enabled) return;
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      sendViolationBeacon('copy_paste', 'Copy attempt');
    };
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      sendViolationBeacon('copy_paste', 'Paste attempt');
    };
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, [enabled, sendViolationBeacon]);

  // ——— Request fullscreen when enabled ———
  const requestFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      console.warn('[Proctor] Fullscreen request denied');
    }
  }, []);

  return { requestFullscreen };
}
