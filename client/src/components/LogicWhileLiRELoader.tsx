import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface LogicWhileLiRELoaderProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  showProgress?: boolean;
}

const INSTITUTIONAL_PHASES = [
  'LogicWhile LiRE Assessment Platform',
  'Synchronizing High-Concurrency Assessment Engine...',
  'Verifying Institutional Security & Proctoring Mesh...',
  'Authorizing Real-Time Synchronous Telemetry...',
  'Elevating Coding Knowledge · Ready',
];

export function LogicWhileLiRELoader(props: LogicWhileLiRELoaderProps) {
  return <LogicWhileLiRELoaderDefault {...props} />;
}

export default function LogicWhileLiRELoaderDefault({
  size = 'md',
  message,
  showProgress = true,
}: LogicWhileLiRELoaderProps) {
  const shouldReduceMotion = useReducedMotion();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(25);

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % INSTITUTIONAL_PHASES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [message]);

  useEffect(() => {
    if (!showProgress) return;
    const timer = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 98) return 98;
        return Math.min(prev + 6, 98);
      });
    }, 280);
    return () => clearInterval(timer);
  }, [showProgress]);

  const dims = {
    sm: { img: 48, ring: 76, stroke: 3, font: '0.8rem', progressW: 160 },
    md: { img: 72, ring: 112, stroke: 3.5, font: '0.9rem', progressW: 240 },
    lg: { img: 96, ring: 148, stroke: 4, font: '1rem', progressW: 300 },
  }[size];

  const currentStatusText = message || INSTITUTIONAL_PHASES[phaseIndex];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: size === 'sm' ? '12px' : '24px',
        gap: size === 'sm' ? 12 : 16,
        userSelect: 'none',
      }}
      role="status"
      aria-live="polite"
    >
      {/* ── HUMAN-CRAFTED INSTITUTIONAL EMBLEM & SMOOTH SEAL ── */}
      <div
        style={{
          position: 'relative',
          width: dims.ring,
          height: dims.ring,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Subtle, soft ambient glow */}
        <div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(234, 168, 18, 0.15) 0%, rgba(2, 132, 199, 0.1) 60%, transparent 80%)',
            pointerEvents: 'none',
          }}
        />

        {/* Circular Academic Track */}
        <svg
          viewBox="0 0 100 100"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={dims.stroke}
          />
        </svg>

        {/* Smooth, continuous elegant gold/sapphire indicator arc */}
        {!shouldReduceMotion && (
          <motion.svg
            viewBox="0 0 100 100"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          >
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="url(#lire-arc-gradient)"
              strokeWidth={dims.stroke}
              strokeDasharray="65 210"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="lire-arc-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#EAA812" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>
          </motion.svg>
        )}

        {/* Central Official Logo Badge */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: dims.img,
            height: dims.img,
            borderRadius: '50%',
            padding: 3,
            background: 'linear-gradient(135deg, #EAA812 0%, #002147 60%, #EAA812 100%)',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.45), 0 0 12px rgba(234, 168, 18, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="/logo.png"
            alt="LogicWhile LiRE"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              borderRadius: '50%',
              background: '#FFFFFF',
              display: 'block',
            }}
          />
        </div>
      </div>

      {/* Brand Wordmark Title */}
      <div style={{ textAlign: 'center', lineHeight: 1.25 }}>
        <div style={{ fontSize: size === 'sm' ? '0.95rem' : '1.15rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
          LogicWhile <span style={{ color: '#EAA812' }}>LiRE</span>
        </div>
        <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600, letterSpacing: '0.04em', marginTop: 3 }}>
          Official Assessment Engine
        </div>
      </div>

      {/* Institutional Progress Bar */}
      {showProgress && (
        <div style={{ width: dims.progressW, maxWidth: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Platform Verification
            </span>
            <span style={{ fontSize: '0.72rem', color: '#EAA812', fontWeight: 800, fontFamily: 'monospace' }}>
              {progressPercent}%
            </span>
          </div>

          <div
            style={{
              position: 'relative',
              height: 4,
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <motion.div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: 'linear-gradient(90deg, #EAA812 0%, #0284c7 100%)',
                borderRadius: 999,
              }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
            />
          </div>
        </div>
      )}

      {/* Dynamic Telemetry Status Message */}
      <div style={{ textAlign: 'center', minHeight: 22, maxWidth: 360 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: dims.font,
            fontWeight: 600,
            color: '#38BDF8',
            letterSpacing: '0.01em',
          }}
        >
          {currentStatusText}
        </span>
      </div>
    </div>
  );
}
