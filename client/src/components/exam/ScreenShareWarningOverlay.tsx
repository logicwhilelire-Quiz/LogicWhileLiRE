import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScreenShareWarningOverlayProps {
  isOpen: boolean;
  onReconnect: () => void;
}

export default function ScreenShareWarningOverlay({
  isOpen,
  onReconnect,
}: ScreenShareWarningOverlayProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="screen-share-warning-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999998,
          background: 'rgba(8, 14, 31, 0.96)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          userSelect: 'none',
        }}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          style={{
            maxWidth: 520,
            width: '100%',
            background: 'linear-gradient(180deg, #1A1D36 0%, #101426 100%)',
            border: '2px solid #F59E0B',
            borderRadius: 20,
            padding: '36px 32px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(245, 158, 11, 0.3)',
            color: '#F8FAFC',
          }}
        >
          {/* Animated Display Icon */}
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              background: 'rgba(245, 158, 11, 0.15)',
              border: '2px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.2rem',
              margin: '0 auto 20px',
            }}
          >
            🖥️
          </motion.div>

          <h2
            style={{
              fontFamily: "var(--font-display, 'Montserrat', sans-serif)",
              fontSize: '1.6rem',
              fontWeight: 800,
              color: '#FFFFFF',
              marginBottom: 10,
              letterSpacing: '-0.02em',
            }}
          >
            Screen Sharing Disconnected
          </h2>

          <p
            style={{
              fontSize: '0.98rem',
              color: '#CBD5E1',
              lineHeight: 1.55,
              marginBottom: 24,
            }}
          >
            The examination requires an active screen share stream. The assessment has been paused and a proctoring alert has been dispatched to the invigilator.
          </p>

          <div
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 12,
              padding: '14px 18px',
              fontSize: '0.85rem',
              color: '#FDE68A',
              marginBottom: 24,
              textAlign: 'left',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <span>ℹ️</span>
            <span>Please select <strong>"Entire Screen"</strong> in the browser prompt to resume your examination without additional strikes.</span>
          </div>

          <button
            onClick={onReconnect}
            style={{
              width: '100%',
              padding: '14px 24px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
              color: '#FFFFFF',
              fontFamily: "var(--font-display, 'Montserrat', sans-serif)",
              fontSize: '1.05rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(217, 119, 6, 0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            🔄 Reconnect Screen Share Now
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
