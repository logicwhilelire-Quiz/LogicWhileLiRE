import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PageTransitionProps {
  children?: React.ReactNode;
  isActive?: boolean;
  onTransitionComplete?: () => void;
  duration?: number; // default 0.8s
}

export default function PageTransition({
  children,
  isActive = false,
  onTransitionComplete,
  duration = 0.8,
}: PageTransitionProps) {
  const [wiping, setWiping] = useState(isActive);

  useEffect(() => {
    if (isActive) {
      setWiping(true);
      const timer = setTimeout(() => {
        setWiping(false);
        if (onTransitionComplete) onTransitionComplete();
      }, duration * 1000);
      return () => clearTimeout(timer);
    }
  }, [isActive, duration, onTransitionComplete]);

  return (
    <>
      {children}

      <AnimatePresence>
        {wiping && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
          >
            {/* Layer 1: Red Chromatic Aberration Fringe */}
            <motion.div
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: [0, 1, 1, 0], originX: [0, 0, 1, 1] }}
              transition={{ duration, times: [0, 0.45, 0.55, 1], ease: [0.65, 0, 0.35, 1] }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, #EF4444 0%, #dc2626 100%)',
                opacity: 0.85,
                mixBlendMode: 'screen',
              }}
            />

            {/* Layer 2: Cyan Chromatic Fringe */}
            <motion.div
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: [0, 1, 1, 0], originX: [0, 0, 1, 1] }}
              transition={{ duration, delay: 0.04, times: [0, 0.45, 0.55, 1], ease: [0.65, 0, 0.35, 1] }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, #06B6D4 0%, #0284c7 100%)',
                opacity: 0.85,
                mixBlendMode: 'screen',
              }}
            />

            {/* Layer 3: Main Purple Liquid Surface with Waves */}
            <motion.div
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: [0, 1, 1, 0], originX: [0, 0, 1, 1] }}
              transition={{ duration, delay: 0.08, times: [0, 0.45, 0.55, 1], ease: [0.65, 0, 0.35, 1] }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, #0A1931 0%, #6C5CE7 50%, #0A1931 100%)',
                boxShadow: '0 0 80px rgba(108, 92, 231, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  fontWeight: 800,
                  fontSize: '1.4rem',
                  letterSpacing: '0.15em',
                  color: '#ffffff',
                  textTransform: 'uppercase',
                  opacity: 0.7,
                  filter: 'drop-shadow(0 0 16px #06B6D4)',
                }}
              >
                LOGICWHILE · SYNCING
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
