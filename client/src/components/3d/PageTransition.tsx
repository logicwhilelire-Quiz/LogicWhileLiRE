import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface PageTransitionProps {
  children?: React.ReactNode;
  isActive?: boolean;
  onTransitionComplete?: () => void;
  duration?: number;
}

export default function PageTransition({
  children,
  isActive = false,
  onTransitionComplete,
  duration = 0.5,
}: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();
  const [sweeping, setSweeping] = useState(isActive);

  useEffect(() => {
    if (isActive) {
      setSweeping(true);
      const timer = setTimeout(() => {
        setSweeping(false);
        if (onTransitionComplete) onTransitionComplete();
      }, duration * 1000);
      return () => clearTimeout(timer);
    }
  }, [isActive, duration, onTransitionComplete]);

  return (
    <>
      {children}

      <AnimatePresence>
        {sweeping && !shouldReduceMotion && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: 3.5,
              zIndex: 999999,
              pointerEvents: 'none',
              overflow: 'hidden',
              background: 'transparent',
            }}
          >
            {/* Thin Brand-Blue Progress Track */}
            <motion.div
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: [0, 0.7, 1] }}
              exit={{ opacity: 0 }}
              transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #0A3F8F 0%, #1B5FB5 60%, #4A7DBE 100%)',
                position: 'relative',
              }}
            >
              {/* Arrow Sweep Head */}
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: -3,
                  width: 10,
                  height: 10,
                  borderTop: '2px solid #60A5FA',
                  borderRight: '2px solid #60A5FA',
                  transform: 'rotate(45deg)',
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
