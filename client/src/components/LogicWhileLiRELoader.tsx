import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface LogicWhileLiRELoaderProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  showProgress?: boolean;
}

const INSTITUTIONAL_PHASES = [
  'Verifying Server-Authoritative Clock...',
  'Synchronizing Assessment Encryption Mesh...',
  'Securing Single-Session Integrity Bounds...',
  'Connecting High-Concurrency Event Telemetry...',
  'LogicWhile LiRE Engine · Ready',
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
    }, 1700);
    return () => clearInterval(interval);
  }, [message]);

  useEffect(() => {
    if (!showProgress) return;
    const timer = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 98) return 98;
        return Math.min(prev + 5, 98);
      });
    }, 240);
    return () => clearInterval(timer);
  }, [showProgress]);

  const scale = size === 'sm' ? 0.75 : size === 'lg' ? 1.25 : 1;
  const currentStatusText = message || INSTITUTIONAL_PHASES[phaseIndex];

  // Letter outline paths for "LOGICWHILE" centered in viewBox 0 0 540 80
  // Each path corresponds to one uppercase letter's structural contour
  const letters = [
    { char: 'L', path: 'M 20 15 L 20 65 L 50 65', id: 'l1', delay: 0 },
    { char: 'O', path: 'M 90 15 A 25 25 0 1 0 90 65 A 25 25 0 1 0 90 15 Z', id: 'o1', delay: 0.18 },
    { char: 'G', path: 'M 165 24 A 25 25 0 1 0 165 56 L 165 40 L 148 40', id: 'g1', delay: 0.36 },
    { char: 'I', path: 'M 195 15 L 215 15 M 205 15 L 205 65 M 195 65 L 215 65', id: 'i1', delay: 0.54 },
    { char: 'C', path: 'M 268 22 A 25 25 0 1 0 268 58', id: 'c1', delay: 0.72 },
    { char: 'W', path: 'M 290 15 L 302 65 L 314 28 L 326 65 L 338 15', id: 'w1', delay: 0.90 },
    { char: 'H', path: 'M 358 15 L 358 65 M 358 40 L 388 40 M 388 15 L 388 65', id: 'h1', delay: 1.08 },
    { char: 'I', path: 'M 408 15 L 428 15 M 418 15 L 418 65 M 408 65 L 428 65', id: 'i2', delay: 1.26 },
    { char: 'L', path: 'M 448 15 L 448 65 L 476 65', id: 'l2', delay: 1.44 },
    { char: 'E', path: 'M 522 15 L 494 15 L 494 65 L 524 65 M 494 40 L 518 40', id: 'e1', delay: 1.62 },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: size === 'sm' ? '14px' : '28px',
        gap: size === 'sm' ? 12 : 18,
        userSelect: 'none',
      }}
      role="status"
      aria-live="polite"
    >
      {/* ── ELEVATED OFFICIAL BRAND EMBLEM IMAGE WITH HOLOGRAPHIC HALO ── */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}
      >
        {/* Orbital holographic circuit ring */}
        {!shouldReduceMotion && (
          <motion.div
            style={{
              position: 'absolute',
              width: (size === 'sm' ? 68 : size === 'lg' ? 104 : 86) * scale,
              height: (size === 'sm' ? 68 : size === 'lg' ? 104 : 86) * scale,
              borderRadius: '50%',
              border: '1.5px dashed rgba(234, 168, 18, 0.55)',
              pointerEvents: 'none',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* Counter-rotating subtle cyan ring */}
        {!shouldReduceMotion && (
          <motion.div
            style={{
              position: 'absolute',
              width: (size === 'sm' ? 78 : size === 'lg' ? 116 : 98) * scale,
              height: (size === 'sm' ? 78 : size === 'lg' ? 116 : 98) * scale,
              borderRadius: '50%',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              pointerEvents: 'none',
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* Official Brand Emblem Image with Golden Circuit Glow */}
        <motion.div
          animate={shouldReduceMotion ? undefined : {
            boxShadow: [
              '0 0 20px rgba(234, 168, 18, 0.35), 0 8px 24px rgba(0, 0, 0, 0.6)',
              '0 0 32px rgba(234, 168, 18, 0.6), 0 8px 24px rgba(0, 0, 0, 0.6)',
              '0 0 20px rgba(234, 168, 18, 0.35), 0 8px 24px rgba(0, 0, 0, 0.6)',
            ],
          }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'relative',
            borderRadius: 16,
            padding: 3,
            background: 'linear-gradient(135deg, rgba(234, 168, 18, 0.75) 0%, rgba(56, 189, 248, 0.5) 50%, rgba(234, 168, 18, 0.85) 100%)',
            boxShadow: '0 0 24px rgba(234, 168, 18, 0.4), 0 8px 24px rgba(0, 0, 0, 0.6)',
            zIndex: 2,
          }}
        >
          <img
            src="/brand/logicwhilelire-official.png"
            alt="LogicWhile LiRE"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              if (!target.src.endsWith('logicwhilelire-mark.svg')) {
                target.src = '/brand/logicwhilelire-mark.svg';
              }
            }}
            style={{
              height: (size === 'sm' ? 44 : size === 'lg' ? 72 : 56) * scale,
              width: (size === 'sm' ? 44 : size === 'lg' ? 72 : 56) * scale,
              objectFit: 'contain',
              borderRadius: 13,
              background: '#FFFFFF',
              padding: 3,
              display: 'block',
            }}
          />
        </motion.div>
      </div>

      {/* ── INNOVATIVE LIGHT-TRACING BRAND LOGO ANIMATION ── */}
      <div
        style={{
          position: 'relative',
          width: 520 * scale,
          maxWidth: '92vw',
          height: 100 * scale,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, rgba(14, 26, 46, 0.7) 0%, rgba(8, 19, 38, 0.95) 100%)',
          borderRadius: 14,
          border: '1px solid rgba(234, 168, 18, 0.22)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5), inset 0 0 24px rgba(56, 189, 248, 0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Architectural Grid Watermark in Background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.12,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            pointerEvents: 'none',
          }}
        />

        {/* Dynamic Sweeping Ambient Glow Flare */}
        {!shouldReduceMotion && (
          <motion.div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 140,
              background: 'linear-gradient(90deg, transparent, rgba(234, 168, 18, 0.15), rgba(56, 189, 248, 0.2), transparent)',
              pointerEvents: 'none',
              filter: 'blur(8px)',
            }}
            animate={{ left: ['-20%', '120%'] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <svg
          viewBox="0 0 540 80"
          style={{
            width: '92%',
            height: '80%',
            overflow: 'visible',
          }}
        >
          <defs>
            {/* Electric Golden Core Gradient */}
            <linearGradient id="neon-glow-gold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF7A00" />
              <stop offset="50%" stopColor="#FFBE00" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>

            {/* Glowing Drop Filter */}
            <filter id="neon-bloom" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur1" />
              <feGaussianBlur stdDeviation="7" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 1. Underlying Architectural Blueprint Outline */}
          {letters.map((l) => (
            <path
              key={`base-${l.id}`}
              d={l.path}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* 2. Neon Boundary Tracing (Starts at L, sequentially tracing to E) */}
          {!shouldReduceMotion ? (
            letters.map((l) => (
              <motion.path
                key={`trace-${l.id}`}
                d={l.path}
                fill="none"
                stroke="url(#neon-glow-gold)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#neon-bloom)"
                initial={{ pathLength: 0, opacity: 0.15 }}
                animate={{
                  pathLength: [0, 1, 1, 0],
                  opacity: [0.2, 1, 0.85, 0.2],
                }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: l.delay,
                }}
              />
            ))
          ) : (
            letters.map((l) => (
              <path
                key={`static-${l.id}`}
                d={l.path}
                fill="none"
                stroke="#FFBE00"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))
          )}

          {/* 3. Hot Electric Spark Pinpoint running through contours */}
          {!shouldReduceMotion && (
            <motion.path
              d="M 20 15 L 20 65 L 50 65 M 90 15 A 25 25 0 1 0 90 65 M 165 24 A 25 25 0 1 0 165 56 L 165 40 L 148 40 M 195 15 L 215 15 M 205 15 L 205 65 M 268 22 A 25 25 0 1 0 268 58 M 290 15 L 302 65 L 314 28 L 326 65 L 338 15 M 358 15 L 358 65 M 358 40 L 388 40 M 388 15 L 388 65 M 408 15 L 428 15 M 418 15 L 418 65 M 448 15 L 448 65 L 476 65 M 522 15 L 494 15 L 494 65 L 524 65"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="18 280"
              initial={{ strokeDashoffset: 1200 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </svg>

        {/* LiRE Institutional Gold Badge in bottom right */}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            right: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 8px',
            borderRadius: 4,
            background: 'rgba(234, 168, 18, 0.12)',
            border: '1px solid rgba(234, 168, 18, 0.35)',
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
          <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#EAA812', letterSpacing: '0.1em' }}>
            LiRE ENGINE
          </span>
        </div>
      </div>

      {/* Human-Made Clean Sub-Caption */}
      <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
        <div style={{ fontSize: size === 'sm' ? '0.82rem' : '0.94rem', fontWeight: 700, color: '#F1F5F9', letterSpacing: '0.04em' }}>
          Standardized Institutional Assessment Platform
        </div>
        <div style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 500, letterSpacing: '0.02em', marginTop: 2 }}>
          Server-Authoritative Clock • Anti-Tamper Proctoring Enclave
        </div>
      </div>

      {/* Institutional Progress Bar */}
      {showProgress && (
        <div style={{ width: 280 * scale, maxWidth: '90%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Synchronizing Clock & Assets
            </span>
            <span style={{ fontSize: '0.72rem', color: '#FFBE00', fontWeight: 800, fontFamily: 'monospace' }}>
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
                background: 'linear-gradient(90deg, #FF7A00 0%, #FFBE00 50%, #38BDF8 100%)',
                borderRadius: 999,
                boxShadow: '0 0 8px rgba(255, 190, 0, 0.6)',
              }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
            />
          </div>
        </div>
      )}

      {/* Dynamic Telemetry Status Message */}
      <div style={{ textAlign: 'center', minHeight: 20, maxWidth: 420 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: size === 'sm' ? '0.78rem' : '0.86rem',
            fontWeight: 600,
            color: '#38BDF8',
            letterSpacing: '0.01em',
            fontFamily: 'monospace',
          }}
        >
          {currentStatusText}
        </span>
      </div>
    </div>
  );
}
