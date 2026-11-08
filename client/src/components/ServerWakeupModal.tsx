import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BrandLogo from './BrandLogo';
import { API_BASE_URL } from '../lib/config';

export interface ServerWakeupModalProps {
  isOpen: boolean;
  onRetry: () => Promise<any> | void;
  onClose?: () => void;
  customMessage?: string;
}

/* ── Inline Crisp SVG Icons ── */
function ServerIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function ActivityIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function RefreshIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  );
}

function CheckIcon({ size = 32, color = '#10B981' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function CloseIcon({ size = 16, color = '#94A3B8' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function ServerWakeupModal({
  isOpen,
  onRetry,
  onClose,
  customMessage,
}: ServerWakeupModalProps) {
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [countdown, setCountdown] = useState(3);
  const [isAwake, setIsAwake] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const backoffDelays = [3, 5, 8, 12, 16];
  const timerRef = useRef<any>(null);
  const probeActiveRef = useRef(false);

  // Reset counters when modal opens
  useEffect(() => {
    if (isOpen) {
      setElapsed(0);
      setAttempt(1);
      setCountdown(3);
      setIsAwake(false);
      setIsProbing(false);
    }
  }, [isOpen]);

  // Elapsed timer
  useEffect(() => {
    if (!isOpen || isAwake) return;
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, isAwake]);

  // Probe function to test if backend is responsive
  const probeHealth = async (): Promise<boolean> => {
    if (probeActiveRef.current) return false;
    probeActiveRef.current = true;
    setIsProbing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        setIsAwake(true);
        probeActiveRef.current = false;
        setIsProbing(false);
        // Automatically trigger retry on success
        setTimeout(async () => {
          try {
            await onRetry();
          } catch {
            // caller handles error
          }
        }, 600);
        return true;
      }
    } catch {
      // Still cold or starting up
    }
    probeActiveRef.current = false;
    setIsProbing(false);
    return false;
  };

  // Exponential backoff countdown and auto-probe
  useEffect(() => {
    if (!isOpen || isAwake) return;

    timerRef.current = setInterval(async () => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger probe
          probeHealth();
          setAttempt((currAttempt) => {
            const nextAttempt = currAttempt + 1;
            return nextAttempt;
          });
          const nextDelayIndex = Math.min(attempt, backoffDelays.length - 1);
          return backoffDelays[nextDelayIndex];
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isAwake, attempt]);

  const handleManualProbe = async () => {
    const success = await probeHealth();
    if (!success) {
      setCountdown(4);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          backgroundColor: 'rgba(5, 8, 18, 0.88)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 460,
            background: 'linear-gradient(165deg, #0D1527 0%, #080D1A 60%, #050811 100%)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(245, 158, 11, 0.12)',
            borderRadius: 20,
            padding: '32px 28px',
            color: '#F8FAFC',
            textAlign: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Subtle Ambient Glow */}
          <div
            style={{
              position: 'absolute',
              top: -60,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 220,
              height: 120,
              background: isAwake ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.22)',
              filter: 'blur(50px)',
              borderRadius: '50%',
              pointerEvents: 'none',
              transition: 'background 0.5s ease',
            }}
          />

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: 6,
                color: '#94A3B8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CloseIcon size={16} />
            </button>
          )}

          {/* Master Logo */}
          <div style={{ display: 'inline-flex', marginBottom: 18 }}>
            <BrandLogo size="sm" variant="standard" showTagline={false} />
          </div>

          {/* Status Animation Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <div
              style={{
                position: 'relative',
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: isAwake
                  ? 'rgba(16, 185, 129, 0.12)'
                  : 'rgba(245, 158, 11, 0.12)',
                border: `2px solid ${isAwake ? '#10B981' : '#F59E0B'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.4s ease',
              }}
            >
              {isAwake ? (
                <CheckIcon size={36} color="#10B981" />
              ) : (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <RefreshIcon size={32} color="#F59E0B" />
                </motion.div>
              )}
            </div>
          </div>

          {/* Heading */}
          <h2
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              margin: '0 0 8px',
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              fontFamily: "'Rajdhani', sans-serif",
            }}
          >
            {isAwake ? 'LogicWhile Server Is Online!' : 'Waking Up LogicWhile LiRE Cloud'}
          </h2>

          {/* Body Description */}
          <p
            style={{
              fontSize: '0.84rem',
              lineHeight: 1.5,
              color: '#94A3B8',
              margin: '0 0 20px',
            }}
          >
            {isAwake
              ? 'Backend engine connected successfully. Automatically completing your request...'
              : customMessage ||
                'Render cloud instances sleep during periods of inactivity. Initial startup takes ~25–35 seconds. Your session and inputs are retained.'}
          </p>

          {/* Live Progress Metrics Box */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 20,
              fontSize: '0.78rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ActivityIcon size={14} color="#38BDF8" />
                Elapsed Warm-up Time
              </span>
              <span style={{ fontWeight: 700, color: '#F1F5F9', fontFamily: 'monospace' }}>
                {elapsed}s
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ServerIcon size={14} color="#F59E0B" />
                Auto-probe (Attempt #{attempt})
              </span>
              <span style={{ fontWeight: 700, color: isAwake ? '#10B981' : '#FBBF24', fontFamily: 'monospace' }}>
                {isAwake ? 'Ready' : `Next in ${countdown}s`}
              </span>
            </div>

            {/* Smooth animated progress line */}
            <div
              style={{
                width: '100%',
                height: 4,
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 2,
                overflow: 'hidden',
                marginTop: 4,
              }}
            >
              <motion.div
                style={{
                  height: '100%',
                  background: isAwake
                    ? '#10B981'
                    : 'linear-gradient(90deg, #F59E0B 0%, #38BDF8 100%)',
                }}
                animate={{
                  width: isAwake ? '100%' : `${Math.min(95, (elapsed / 32) * 100)}%`,
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleManualProbe}
              disabled={isProbing || isAwake}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 10,
                border: 'none',
                background: isAwake
                  ? '#10B981'
                  : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                color: '#0A0E1A',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: isProbing || isAwake ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              {isProbing ? (
                <>
                  <RefreshIcon size={14} color="#0A0E1A" />
                  <span>Probing Cloud Engine...</span>
                </>
              ) : isAwake ? (
                <>
                  <CheckIcon size={16} color="#0A0E1A" />
                  <span>Server Connected!</span>
                </>
              ) : (
                <>
                  <RefreshIcon size={14} color="#0A0E1A" />
                  <span>Probe &amp; Connect Now</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
