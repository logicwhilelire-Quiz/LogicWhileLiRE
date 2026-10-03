import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export default function LogicWhileLiREIntro({ onComplete }: { onComplete?: () => void }) {
  const shouldReduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (shouldReduceMotion) {
      setVisible(false);
      if (onComplete) onComplete();
      return;
    }

    try {
      const seen = sessionStorage.getItem('logicwhilelire_intro_seen');
      if (seen) {
        setVisible(false);
        if (onComplete) onComplete();
        return;
      }
      sessionStorage.setItem('logicwhilelire_intro_seen', 'true');
      setVisible(true);

      const timer = setTimeout(() => {
        setVisible(false);
        if (onComplete) onComplete();
      }, 1400);

      return () => clearTimeout(timer);
    } catch {
      setVisible(false);
      if (onComplete) onComplete();
    }
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="logicwhilelire-intro-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'var(--color-bg, #080E1F)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            {/* Animated SVG Brand Mark */}
            <svg
              viewBox="0 0 200 160"
              width="120"
              height="96"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Outer Frame: Draw in */}
              <motion.path
                d="M20 72 V128 H180 V72"
                stroke="#1B5FB5"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
              />

              {/* Left Page Outline */}
              <motion.path
                d="M34 65 C55 60 80 66 96 76 V134 C80 124 55 118 34 123 Z"
                stroke="#1B5FB5"
                strokeWidth="8"
                strokeLinejoin="round"
                initial={{ pathLength: 0, fillOpacity: 0 }}
                animate={{ pathLength: 1, fillOpacity: 1 }}
                transition={{ duration: 0.7, delay: 0.1, ease: 'easeInOut' }}
              />

              {/* Right Page Outline */}
              <motion.path
                d="M166 65 C145 60 120 66 104 76 V134 C120 124 145 118 166 123 Z"
                stroke="#1B5FB5"
                strokeWidth="8"
                strokeLinejoin="round"
                initial={{ pathLength: 0, fillOpacity: 0 }}
                animate={{ pathLength: 1, fillOpacity: 1 }}
                transition={{ duration: 0.7, delay: 0.1, ease: 'easeInOut' }}
              />

              {/* Central Spine */}
              <motion.line
                x1="100"
                y1="76"
                x2="100"
                y2="134"
                stroke="#1B5FB5"
                strokeWidth="7"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              />

              {/* Rising Growth Arrow Line: Draws upward */}
              <motion.path
                d="M38 108 L78 74 L106 95 L174 24"
                stroke="#1B5FB5"
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
              />

              {/* Arrowhead: Pops in */}
              <motion.polygon
                points="182,16 150,22 176,48"
                fill="#1B5FB5"
                stroke="#1B5FB5"
                strokeWidth="4"
                strokeLinejoin="round"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 450, damping: 20, delay: 0.85 }}
              />
            </svg>

            {/* Typography: Wordmark slides in, Tagline fades up */}
            <div style={{ textAlign: 'center', overflow: 'hidden' }}>
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.75, ease: 'easeOut' }}
                style={{
                  fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
                  fontSize: '2.4rem',
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                  lineHeight: 1.1,
                  display: 'inline-flex',
                  alignItems: 'baseline',
                }}
              >
                <span style={{ color: '#E2E8F0' }}>LogicWhile</span>
                <span
                  style={{
                    background: 'linear-gradient(135deg, #38BDF8 0%, #818CF8 50%, #C084FC 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 900,
                    marginLeft: 3,
                  }}
                >
                  LiRE
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.95, ease: 'easeOut' }}
                style={{
                  fontFamily: "var(--font-body, 'Inter', sans-serif)",
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  color: 'var(--color-accent, #60A5FA)',
                  textTransform: 'uppercase',
                  marginTop: 6,
                }}
              >
                Logic. While. LiRE.
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
