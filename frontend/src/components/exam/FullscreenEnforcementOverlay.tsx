import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FullscreenEnforcementOverlayProps {
  isOpen: boolean;
  exitCount: number;
  maxExits?: number;
  countdownSeconds?: number;
  onReturnToFullscreen: () => void;
  onTimeoutSubmit: () => void;
}

export default function FullscreenEnforcementOverlay({
  isOpen,
  exitCount,
  maxExits = 3,
  countdownSeconds = 10,
  onReturnToFullscreen,
  onTimeoutSubmit,
}: FullscreenEnforcementOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);

  useEffect(() => {
    if (!isOpen) {
      setSecondsLeft(countdownSeconds);
      return;
    }

    setSecondsLeft(countdownSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeoutSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, countdownSeconds, onTimeoutSubmit]);

  if (!isOpen) return null;

  const isFinalWarning = exitCount >= maxExits;

  return (
    <AnimatePresence>
      <motion.div
        key="fullscreen-overlay-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: 'rgba(8, 14, 31, 0.95)',
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
            background: 'linear-gradient(180deg, #162752 0%, #101D3F 100%)',
            border: '2px solid #EF4444',
            borderRadius: 20,
            padding: '36px 32px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(239, 68, 68, 0.35)',
            color: '#F8FAFC',
          }}
        >
          {/* Animated Warning Icon */}
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              background: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              margin: '0 auto 20px',
            }}
          >
            ⚠️
          </motion.div>

          <h2
            style={{
              fontFamily: "var(--font-display, 'Montserrat', sans-serif)",
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#FFFFFF',
              marginBottom: 10,
              letterSpacing: '-0.02em',
            }}
          >
            Fullscreen Mode Required
          </h2>

          <p
            style={{
              fontSize: '0.98rem',
              color: '#CBD5E1',
              lineHeight: 1.55,
              marginBottom: 24,
            }}
          >
            You have exited fullscreen mode. LogicWhileLiRE assessment integrity requires uninterrupted fullscreen throughout your session.
          </p>

          {/* Exit counter & Strike Box */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 24,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', fontWeight: 600 }}>
                Violation Counter
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: isFinalWarning ? '#EF4444' : '#F59E0B' }}>
                Exit {exitCount} of {maxExits} {isFinalWarning && '(FINAL)'}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', fontWeight: 600 }}>
                Auto-Submit In
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: secondsLeft <= 3 ? '#EF4444' : '#60A5FA',
                }}
              >
                00:{String(secondsLeft).padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={onReturnToFullscreen}
            style={{
              width: '100%',
              padding: '14px 24px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #1B5FB5 0%, #0A3F8F 100%)',
              color: '#FFFFFF',
              fontFamily: "var(--font-display, 'Montserrat', sans-serif)",
              fontSize: '1.05rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(27, 95, 181, 0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            ⛶ Return to Fullscreen Immediately
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
