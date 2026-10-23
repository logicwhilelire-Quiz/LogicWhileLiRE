import { motion } from 'framer-motion'

interface ExamTimerProgressProps {
  timeLeft: number
  totalTime: number
}

/**
 * ExamTimerProgress — Lightweight 2D SVG circular progress ring for exam timer
 * Strictly 0% WebGL / Three.js overhead for maximum exam focus & performance.
 */
export default function ExamTimerProgress({ timeLeft, totalTime }: ExamTimerProgressProps) {
  const pct = Math.max(0, Math.min(100, (timeLeft / (totalTime || 1)) * 100))
  const circumference = 2 * Math.PI * 52
  const offset = circumference - (pct / 100) * circumference
  const color = pct > 50 ? '#10B981' : pct > 15 ? '#F59E0B' : '#EF4444'

  return (
    <div style={{ width: 80, height: 80, position: 'relative' }}>
      <svg
        style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}
        viewBox="-20 -20 120 120"
      >
        <circle
          cx="40"
          cy="40"
          r="52"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="6"
        />
        <motion.circle
          cx="40"
          cy="40"
          r="52"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: '9px',
            color: 'rgba(255,255,255,0.5)',
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.05em',
          }}
        >
          TIME
        </span>
        <span
          style={{
            color,
            fontSize: '0.85rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </span>
      </div>
    </div>
  )
}
