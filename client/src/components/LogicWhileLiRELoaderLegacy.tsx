import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface LOGICWHILELIRELoaderProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

export type LogicWhileLiRELoaderProps = LOGICWHILELIRELoaderProps;

export function LogicWhileLiRELoader(props: LOGICWHILELIRELoaderProps) {
  return <LOGICWHILELIRELoader {...props} />;
}

export default function LOGICWHILELIRELoader({
  size = 'md',
  message = 'Loading LogicWhileLiRE...',
}: LOGICWHILELIRELoaderProps) {
  const shouldReduceMotion = useReducedMotion();

  const dims = {
    sm: { w: 48, h: 38, stroke: 8, font: '0.85rem' },
    md: { w: 80, h: 64, stroke: 10, font: '0.95rem' },
    lg: { w: 120, h: 96, stroke: 12, font: '1.1rem' },
  }[size];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 16,
      }}
      role="status"
      aria-live="polite"
    >
      <svg
        viewBox="0 0 200 160"
        width={dims.w}
        height={dims.h}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Book base in subtle outline */}
        <path
          d="M20 72 V128 H180 V72"
          stroke="var(--color-primary-light, #E0EDFF)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M34 65 C55 60 80 66 96 76 V134 C80 124 55 118 34 123 Z"
          fill="none"
          stroke="var(--color-primary-light, #E0EDFF)"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <path
          d="M166 65 C145 60 120 66 104 76 V134 C120 124 145 118 166 123 Z"
          fill="none"
          stroke="var(--color-primary-light, #E0EDFF)"
          strokeWidth="7"
          strokeLinejoin="round"
        />

        {/* Looping Growth Arrow Line Drawing */}
        {shouldReduceMotion ? (
          <>
            <path
              d="M38 108 L78 74 L106 95 L174 24"
              stroke="var(--color-primary, #1B5FB5)"
              strokeWidth={dims.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polygon
              points="182,16 150,22 176,48"
              fill="var(--color-primary, #1B5FB5)"
              stroke="var(--color-primary, #1B5FB5)"
              strokeWidth="3"
            />
          </>
        ) : (
          <>
            <motion.path
              d="M38 108 L78 74 L106 95 L174 24"
              stroke="var(--color-primary, #1B5FB5)"
              strokeWidth={dims.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0.2 }}
              animate={{ pathLength: [0, 1, 1, 0], opacity: [0.2, 1, 1, 0.2] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.polygon
              points="182,16 150,22 176,48"
              fill="var(--color-primary, #1B5FB5)"
              stroke="var(--color-primary, #1B5FB5)"
              strokeWidth="3"
              animate={{ scale: [0.6, 1.15, 1, 0.6] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </>
        )}
      </svg>

      {message && (
        <span
          style={{
            fontFamily: "var(--font-body, 'Inter', sans-serif)",
            fontSize: dims.font,
            fontWeight: 500,
            color: 'var(--color-text-muted, #475569)',
            letterSpacing: '0.02em',
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
}
