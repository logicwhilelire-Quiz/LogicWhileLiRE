import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface LogicWhileLiRELoaderProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  showProgress?: boolean;
}

const INSTITUTIONAL_PHASES = [
  'Synchronizing Server-Authoritative Clock...',
  'Verifying LogicWhile Auth & Single-Session Bounds...',
  'Initializing LiRE Encrypted Proctoring Enclave...',
  'Connecting Live Rank Engine Telemetry Stream...',
  'LogicWhile · LiRE Assessment Engine Ready',
];

const TELEMETRY_NODES = [
  { id: 'clock', label: 'Clock Sync' },
  { id: 'auth', label: 'Session Guard' },
  { id: 'proctor', label: 'AI Proctor' },
  { id: 'lire', label: 'LiRE Engine' },
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
  const [progressPercent, setProgressPercent] = useState(22);

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % INSTITUTIONAL_PHASES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [message]);

  useEffect(() => {
    if (!showProgress) return;
    const timer = setInterval(() => {
      setProgressPercent((prev) => (prev >= 98 ? 98 : Math.min(prev + 6, 98)));
    }, 220);
    return () => clearInterval(timer);
  }, [showProgress]);

  const scale = size === 'sm' ? 0.78 : size === 'lg' ? 1.18 : 1;
  const currentStatusText = message || INSTITUTIONAL_PHASES[phaseIndex];
  const activeNodeCount = Math.min(4, Math.max(1, Math.ceil((progressPercent / 100) * 4)));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: size === 'sm' ? '10px' : '18px 16px',
        gap: size === 'sm' ? 12 : 16,
        userSelect: 'none',
        width: '100%',
      }}
      role="status"
      aria-live="polite"
    >
      {/* ── CORPORATE HIERARCHY RIBBON (Main Company > Sub-Branch) ── */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 12px',
          borderRadius: 999,
          background: 'rgba(10, 28, 104, 0.55)',
          border: '1px solid rgba(255, 180, 0, 0.42)',
          boxShadow: '0 0 18px rgba(255, 180, 0, 0.14)',
          fontSize: size === 'sm' ? '0.62rem' : '0.68rem',
          fontWeight: 800,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF7A00', boxShadow: '0 0 8px #FF7A00' }} />
        <span style={{ color: '#FF7A00' }}>LogicWhile</span>
        <span style={{ color: '#64748B' }}>›</span>
        <span style={{ color: '#FFD000' }}>LiRE Assessment Portal</span>
      </div>

      {/* ── OFFICIAL LOGO EMBLEM WITH DUAL CIRCUIT ORBITS ── */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '2px 0',
        }}
      >
        {!shouldReduceMotion && (
          <motion.div
            style={{
              position: 'absolute',
              width: (size === 'sm' ? 70 : size === 'lg' ? 106 : 88) * scale,
              height: (size === 'sm' ? 70 : size === 'lg' ? 106 : 88) * scale,
              borderRadius: '50%',
              border: '1.5px dashed rgba(255, 180, 0, 0.65)',
              pointerEvents: 'none',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {!shouldReduceMotion && (
          <motion.div
            style={{
              position: 'absolute',
              width: (size === 'sm' ? 82 : size === 'lg' ? 120 : 100) * scale,
              height: (size === 'sm' ? 82 : size === 'lg' ? 120 : 100) * scale,
              borderRadius: '50%',
              border: '1px solid rgba(255, 122, 0, 0.35)',
              pointerEvents: 'none',
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
          />
        )}

        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  boxShadow: [
                    '0 0 18px rgba(255, 180, 0, 0.35), 0 8px 24px rgba(0, 0, 0, 0.6)',
                    '0 0 34px rgba(255, 122, 0, 0.55), 0 8px 24px rgba(0, 0, 0, 0.6)',
                    '0 0 18px rgba(255, 180, 0, 0.35), 0 8px 24px rgba(0, 0, 0, 0.6)',
                  ],
                }
          }
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'relative',
            borderRadius: 16,
            padding: 3,
            background: 'linear-gradient(135deg, #FFD000 0%, #FF7A00 55%, #1D4ED8 100%)',
            zIndex: 2,
          }}
        >
          <img
            src="/brand/logicwhilelire-official.png"
            alt="LogicWhile — LiRE Official Emblem"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              if (!target.src.endsWith('logicwhilelire-mark.svg')) {
                target.src = '/brand/logicwhilelire-mark.svg';
              }
            }}
            style={{
              height: (size === 'sm' ? 46 : size === 'lg' ? 72 : 58) * scale,
              width: (size === 'sm' ? 46 : size === 'lg' ? 72 : 58) * scale,
              objectFit: 'contain',
              borderRadius: 13,
              background: '#FFFFFF',
              padding: 3,
              display: 'block',
            }}
          />
        </motion.div>
      </div>

      {/* ── ANIMATED CIRCUIT WORDMARK STAGE (Matches Official Logo Frame + Rays) ── */}
      <div
        style={{
          position: 'relative',
          width: 480 * scale,
          maxWidth: '92vw',
          padding: size === 'sm' ? '12px 16px' : '16px 22px',
          background: 'linear-gradient(160deg, rgba(10, 28, 104, 0.65) 0%, rgba(5, 11, 34, 0.96) 100%)',
          borderRadius: 16,
          border: '1.5px solid rgba(255, 180, 0, 0.35)',
          boxShadow: '0 14px 38px rgba(0, 0, 0, 0.55), inset 0 0 28px rgba(255, 180, 0, 0.06)',
          overflow: 'hidden',
        }}
      >
        {/* Architectural Circuit Grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.14,
            backgroundImage:
              'linear-gradient(rgba(255, 180, 0, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 180, 0, 0.16) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            pointerEvents: 'none',
          }}
        />

        {/* Sweeping Gold-Orange Flare */}
        {!shouldReduceMotion && (
          <motion.div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 130,
              background: 'linear-gradient(90deg, transparent, rgba(255, 180, 0, 0.16), rgba(255, 122, 0, 0.18), transparent)',
              pointerEvents: 'none',
              filter: 'blur(8px)',
            }}
            animate={{ left: ['-25%', '125%'] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Animated Circuit Frame SVG + Crisp Single-Word LogicWhile + Sub-Branch LiRE Box */}
        <svg viewBox="0 0 520 112" style={{ width: '100%', height: 'auto', display: 'block', position: 'relative', zIndex: 1 }}>
          <defs>
            <linearGradient id="lwLoaderGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF7A00" />
              <stop offset="50%" stopColor="#FFD000" />
              <stop offset="100%" stopColor="#FFB400" />
            </linearGradient>
          </defs>

          {/* Outer Circuit Traces */}
          <path
            d="M 16 74 L 16 14 L 504 14 L 504 40 L 486 40"
            fill="none"
            stroke="rgba(255, 180, 0, 0.25)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 16 98 L 504 98 L 504 68"
            fill="none"
            stroke="rgba(255, 180, 0, 0.25)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {!shouldReduceMotion && (
            <>
              <motion.path
                d="M 16 74 L 16 14 L 504 14 L 504 40 L 486 40"
                fill="none"
                stroke="url(#lwLoaderGoldGrad)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: [0, 1, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.path
                d="M 16 98 L 504 98 L 504 68"
                fill="none"
                stroke="url(#lwLoaderGoldGrad)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: [0, 1, 1] }}
                transition={{ duration: 2.2, delay: 0.25, repeat: Infinity, ease: 'easeInOut' }}
              />
            </>
          )}

          {/* Left Terminal & Right Circuit Bulb with Light Rays */}
          <circle cx="16" cy="74" r="6" fill="#FFB400" />
          <circle cx="504" cy="68" r="6" fill="#FFB400" />
          <circle cx="486" cy="40" r="8" fill="#FFD000" />
          <g stroke="#FFD000" strokeWidth="2.5" strokeLinecap="round">
            <line x1="472" y1="34" x2="454" y2="27" />
            <line x1="470" y1="40" x2="450" y2="40" />
            <line x1="472" y1="46" x2="454" y2="53" />
          </g>

          {/* Single Wordmark: LogicWhile (Logo Orange + High-Contrast White/Blue) */}
          <text
            x="248"
            y="60"
            textAnchor="middle"
            fontFamily="'Rajdhani', 'Plus Jakarta Sans', sans-serif"
            fontSize="42"
            fontWeight="800"
            letterSpacing="0.02em"
          >
            <tspan fill="#FF7A00">Logic</tspan>
            <tspan fill="#FFFFFF">While</tspan>
          </text>

          {/* Boxed Sub-Branch Line */}
          <rect
            x="110"
            y="72"
            width="292"
            height="22"
            rx="5"
            fill="rgba(7, 19, 75, 0.9)"
            stroke="#FFB400"
            strokeWidth="1.6"
          />
          <text
            x="256"
            y="87"
            textAnchor="middle"
            fontFamily="'JetBrains Mono', monospace"
            fontSize="11.5"
            fontWeight="700"
            letterSpacing="0.06em"
            fill="#F8FAFC"
          >
            <tspan fill="#FFB400">LiRE</tspan>
            <tspan fill="#94A3B8"> • </tspan>
            <tspan fill="#FDBA74">Li: Live</tspan>
            <tspan fill="#64748B"> · </tspan>
            <tspan fill="#FFD000">R: Real</tspan>
            <tspan fill="#64748B"> · </tspan>
            <tspan fill="#FDBA74">E: Engine</tspan>
          </text>
        </svg>
      </div>

      {/* ── SUBSYSTEM DIAGNOSTIC NODES ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 6,
          width: 480 * scale,
          maxWidth: '92vw',
        }}
      >
        {TELEMETRY_NODES.map((node, idx) => {
          const isOnline = idx < activeNodeCount;
          return (
            <div
              key={node.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '5px 6px',
                borderRadius: 8,
                background: isOnline ? 'rgba(255, 180, 0, 0.10)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${isOnline ? 'rgba(255, 180, 0, 0.40)' : 'rgba(255, 255, 255, 0.08)'}`,
                fontSize: '0.65rem',
                fontWeight: 700,
                color: isOnline ? '#FFD000' : '#64748B',
                transition: 'all 0.25s ease',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isOnline ? '#FF7A00' : '#475569',
                  boxShadow: isOnline ? '0 0 6px #FF7A00' : 'none',
                  flexShrink: 0,
                }}
              />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.label}</span>
            </div>
          );
        })}
      </div>

      {/* ── INSTITUTIONAL PROGRESS BAR (Logo Navy -> Orange -> Gold Gradient) ── */}
      {showProgress && (
        <div style={{ width: 320 * scale, maxWidth: '92%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: '0.66rem', color: '#94A3B8', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Booting Assessment Sub-Branch
            </span>
            <span style={{ fontSize: '0.72rem', color: '#FFD000', fontWeight: 800, fontFamily: 'monospace' }}>
              {progressPercent}%
            </span>
          </div>

          <div
            style={{
              position: 'relative',
              height: 5,
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
              border: '1px solid rgba(255, 180, 0, 0.2)',
            }}
          >
            <motion.div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: 'linear-gradient(90deg, #1D4ED8 0%, #FF7A00 55%, #FFD000 100%)',
                borderRadius: 999,
                boxShadow: '0 0 10px rgba(255, 180, 0, 0.65)',
              }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
            />
          </div>
        </div>
      )}

      {/* ── LIVE TELEMETRY STATUS LINE ── */}
      <div style={{ textAlign: 'center', minHeight: 20, maxWidth: 460 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: size === 'sm' ? '0.76rem' : '0.84rem',
            fontWeight: 600,
            color: '#FDBA74',
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
