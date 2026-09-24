import { useState, useEffect } from 'react';

interface LoadingLogoProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  showStatusMessages?: boolean;
}

const STATUS_MESSAGES = [
  'Powering assessment engine...',
  'Initializing server-authoritative timer...',
  'Securing anti-tamper proctoring watchdog...',
  'Preparing questions & live metrics...',
  'Elevating coding knowledge...',
];

export default function LoadingLogo({
  size = 'md',
  message,
  showStatusMessages = true,
}: LoadingLogoProps) {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    if (!showStatusMessages || message) return;
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [showStatusMessages, message]);

  const logoWidth = size === 'sm' ? 84 : size === 'lg' ? 170 : 124;
  const logoHeight = Math.round(logoWidth * (174 / 222));
  const orbSize = size === 'sm' ? 120 : size === 'lg' ? 220 : 170;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Outer ambient glow */}
      <div
        style={{
          position: 'relative',
          width: orbSize,
          height: orbSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        {/* Ambient radial blur glow */}
        <div
          style={{
            position: 'absolute',
            width: '80%',
            height: '80%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, rgba(234, 88, 12, 0.15) 50%, transparent 75%)',
            filter: 'blur(20px)',
            animation: 'pulseGlow 2.5s ease-in-out infinite alternate',
          }}
        />

        {/* Rotating SVG Tech Ring */}
        <svg
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            animation: 'spinTechRing 8s linear infinite',
            overflow: 'visible',
          }}
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#ea580c" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="46"
            stroke="url(#ringGrad)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="14 10 32 8"
            strokeLinecap="round"
          />
          <circle cx="50" cy="4" r="2.5" fill="#f59e0b" />
          <circle cx="96" cy="50" r="2" fill="#ea580c" />
          <circle cx="50" cy="96" r="2.5" fill="#f59e0b" />
          <circle cx="4" cy="50" r="2" fill="#ea580c" />
        </svg>

        {/* Counter-rotating subtle dash ring */}
        <svg
          style={{
            position: 'absolute',
            width: '88%',
            height: '88%',
            animation: 'spinTechRingReverse 12s linear infinite',
            opacity: 0.6,
          }}
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="#fbbf24"
            strokeWidth="1.2"
            fill="none"
            strokeDasharray="4 12"
          />
        </svg>

        {/* Main Logo Card Badge */}
        <div
          style={{
            position: 'relative',
            width: logoWidth,
            height: logoHeight,
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,251,235,0.94))',
            border: '2px solid rgba(245, 158, 11, 0.8)',
            boxShadow: '0 8px 32px rgba(245, 158, 11, 0.4), inset 0 0 14px rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            overflow: 'hidden',
            animation: 'breatheLogo 3s ease-in-out infinite',
            zIndex: 2,
          }}
        >
          {/* Shimmer line across badge */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '60%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)',
              transform: 'skewX(-25deg)',
              animation: 'logoShimmer 2.4s ease-in-out infinite',
            }}
          />

          <img
            src="/logo.png"
            alt="LogicWhile QUIZ"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      </div>

      {/* Brand Heading */}
      <div style={{ textAlign: 'center', marginTop: 4 }}>
        <div
          style={{
            fontSize: size === 'sm' ? '1rem' : size === 'lg' ? '1.5rem' : '1.25rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span style={{ color: '#ffffff', fontWeight: 800, letterSpacing: '-0.03em' }}>LogicWhile</span>
          <span
            className="elevated-quiz-badge"
            style={{
              fontSize: size === 'sm' ? '0.64rem' : size === 'lg' ? '0.88rem' : '0.74rem',
              padding: size === 'sm' ? '2px 7px' : size === 'lg' ? '4px 12px' : '3px 9px',
            }}
          >
            QUIZ
          </span>
        </div>

        <div
          style={{
            fontSize: size === 'sm' ? '0.72rem' : '0.82rem',
            color: '#f59e0b',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginTop: 4,
            opacity: 0.95,
          }}
        >
          Elevating Coding Knowledge
        </div>
      </div>

      {/* Status line & circuit progress shimmer */}
      <div
        style={{
          marginTop: 18,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          maxWidth: 260,
        }}
      >
        {/* Shimmering Progress Bar */}
        <div
          style={{
            width: '100%',
            height: 4,
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 999,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              height: '100%',
              width: '45%',
              background: 'linear-gradient(90deg, #f59e0b, #ea580c, #f59e0b)',
              borderRadius: 999,
              animation: 'indeterminateTrack 1.8s ease-in-out infinite',
            }}
          />
        </div>

        {/* Dynamic status message */}
        <span
          style={{
            fontSize: '0.78rem',
            color: 'rgba(255, 255, 255, 0.65)',
            fontFamily: 'monospace',
            textAlign: 'center',
            minHeight: '1.2em',
            transition: 'opacity 0.25s ease',
          }}
        >
          {message || STATUS_MESSAGES[statusIndex]}
        </span>
      </div>

      {/* Inline styles for keyframe animations */}
      <style>{`
        @keyframes spinTechRing {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes spinTechRingReverse {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes pulseGlow {
          0% { transform: scale(0.92); opacity: 0.55; }
          100% { transform: scale(1.08); opacity: 0.95; }
        }
        @keyframes breatheLogo {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes logoShimmer {
          0% { left: -100%; opacity: 0; }
          40% { left: 140%; opacity: 0.8; }
          100% { left: 140%; opacity: 0; }
        }
        @keyframes indeterminateTrack {
          0% { left: -45%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
