/**
 * OfflineIndicator.tsx
 * Phase 1c: Visible "Reconnecting / Synced" status banner for exam page.
 */
import { useOfflineStatus } from '../hooks/useOfflineStatus';

export default function OfflineIndicator() {
  const { isOffline, justReconnected } = useOfflineStatus();

  if (!isOffline && !justReconnected) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        padding: '0.6rem 1.4rem',
        borderRadius: '2rem',
        fontFamily: 'inherit',
        fontSize: '0.875rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        transition: 'all 0.3s ease',
        ...(isOffline
          ? {
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff',
              border: '1px solid #fca5a5',
            }
          : {
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              border: '1px solid #6ee7b7',
            }),
      }}
    >
      {isOffline ? (
        <>
          <span style={{ fontSize: '1.1em' }}>⚠️</span>
          Reconnecting… Your answers are saved locally
        </>
      ) : (
        <>
          <span style={{ fontSize: '1.1em' }}>✅</span>
          Back online — answers synced
        </>
      )}
    </div>
  );
}
