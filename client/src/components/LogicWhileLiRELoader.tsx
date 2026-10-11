import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface LogicWhileLiRELoaderProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  showProgress?: boolean;
}

const TELEMETRY_PHASES = [
  'LogicWhile LiRE',
  'Booting LogicWhile Assessment Engine...',
  'Synchronizing Server-Authoritative Clock...',
  'Verifying Real-Time Examination Security...',
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
  const [progressPercent, setProgressPercent] = useState(15);

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % TELEMETRY_PHASES.length);
    }, 1600);
    return () => clearInterval(interval);
  }, [message]);

  useEffect(() => {
    if (!showProgress) return;
    const timer = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 98) return 98;
        const jump = Math.floor(Math.random() * 8) + 4;
        return Math.min(prev + jump, 98);
      });
    }, 240);
    return () => clearInterval(timer);
  }, [showProgress]);

  const dims = {
    sm: { img: 56, ring: 90, font: '0.8rem', progressW: 160 },
    md: { img: 88, ring: 136, font: '0.92rem', progressW: 240 },
    lg: { img: 120, ring: 180, font: '1.05rem', progressW: 320 },
  }[size];

  const currentStatusText = message || TELEMETRY_PHASES[phaseIndex];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: size === 'sm' ? '12px' : '24px',
        gap: size === 'sm' ? 12 : 18,
        userSelect: 'none',
      }}
      role="status"
      aria-live="polite"
    >
      {/* ── HIGH-TECH CYBER EMBLEM & SCANNER RING ── */}
      <div style={{ position: 'relative', width: dims.ring, height: dims.ring, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Pulsing ambient aura */}
        <motion.div
          animate={shouldReduceMotion ? {} : { scale: [1, 1.18, 1], opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: -12,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(234, 168, 18, 0.28) 0%, rgba(43, 127, 255, 0.16) 50%, transparent 75%)',
            filter: 'blur(16px)',
            pointerEvents: 'none',
          }}
        />

        {/* Outer Tech Ring (Rotating Cyber Dashes) */}
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
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="#EAA812"
              strokeWidth="2.5"
              strokeDasharray="14 18"
              opacity="0.75"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#2B7FFF"
              strokeWidth="1.5"
              strokeDasharray="8 24"
              opacity="0.6"
            />
          </motion.svg>
        )}

        {/* Counter-rotating Inner Precision Arc */}
        {!shouldReduceMotion && (
          <motion.svg
            viewBox="0 0 100 100"
            style={{
              position: 'absolute',
              inset: 4,
              width: 'calc(100% - 8px)',
              height: 'calc(100% - 8px)',
              pointerEvents: 'none',
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          >
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#38BDF8"
              strokeWidth="1.5"
              strokeDasharray="60 120"
              strokeLinecap="round"
              opacity="0.8"
            />
          </motion.svg>
        )}

        {/* Central Official Logo Badge */}
        <motion.div
          animate={shouldReduceMotion ? {} : { scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'relative',
            zIndex: 2,
            width: dims.img,
            height: dims.img,
            borderRadius: '50%',
            padding: 4,
            background: 'linear-gradient(135deg, #EAA812 0%, #2B7FFF 50%, #FF7A00 100%)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(234, 168, 18, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
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
        </motion.div>
      </div>

      {/* Brand Wordmark Title */}
      <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
        <div style={{ fontSize: size === 'sm' ? '0.96rem' : '1.2rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
          LogicWhile <span style={{ color: '#EAA812' }}>LiRE</span>
        </div>
        <div style={{ fontSize: '0.74rem', color: '#CBD5E1', fontWeight: 600, letterSpacing: '0.04em', marginTop: 4 }}>
          Live Rank Engine
        </div>
      </div>

      {/* High-Tech Progress Bar */}
      {showProgress && (
        <div style={{ width: dims.progressW, maxWidth: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
              INITIALIZING ENGINE
            </span>
            <span style={{ fontSize: '0.74rem', color: '#EAA812', fontWeight: 800, fontFamily: 'monospace' }}>
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
              border: '1px solid rgba(234, 168, 18, 0.25)',
            }}
          >
            <motion.div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: 'linear-gradient(90deg, #EAA812 0%, #2B7FFF 60%, #38BDF8 100%)',
                boxShadow: '0 0 10px rgba(234, 168, 18, 0.6)',
                borderRadius: 999,
              }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
            />
          </div>
        </div>
      )}

      {/* Dynamic Telemetry Status Message */}
      <div style={{ textAlign: 'center', minHeight: 24, maxWidth: 360 }}>
        <motion.span
          key={currentStatusText}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.2 }}
          style={{
            display: 'inline-block',
            fontFamily: 'monospace',
            fontSize: dims.font,
            fontWeight: 700,
            color: '#38BDF8',
            letterSpacing: '0.03em',
            textShadow: '0 0 10px rgba(56, 189, 248, 0.35)',
          }}
        >
          {currentStatusText}
        </motion.span>
      </div>
    </div>
  );
}
