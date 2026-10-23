import React from 'react';
import { motion } from 'framer-motion';

export interface SectorScore {
  sector: string;
  short: string;
  score: number; // 0 to 100
  benchmark: number; // 0 to 100
  color: string;
}

interface SectorRadar3DProps {
  scores?: SectorScore[];
  width?: number;
  height?: number;
  className?: string;
  showBenchmark?: boolean;
}

const DEFAULT_SCORES: SectorScore[] = [
  { sector: 'Quantitative Aptitude', short: 'Quant', score: 85, benchmark: 72, color: '#F59E0B' },
  { sector: 'Logical Reasoning', short: 'Logic', score: 92, benchmark: 76, color: '#8B5CF6' },
  { sector: 'Core Computer Science', short: 'Core CS', score: 78, benchmark: 68, color: '#10B981' },
  { sector: 'Data Structures & Algorithms', short: 'DSA', score: 74, benchmark: 64, color: '#38BDF8' },
  { sector: 'Full-Stack & System Design', short: 'Full-Stack', score: 88, benchmark: 71, color: '#F43F5E' },
];

export default function SectorRadar3D({
  scores = DEFAULT_SCORES,
  width = 380,
  height = 340,
  className = '',
  showBenchmark = true,
}: SectorRadar3DProps) {
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(cx, cy) - 52;
  const totalAxes = scores.length;

  // Grid level rings: 25%, 50%, 75%, 100%
  const levels = [0.25, 0.5, 0.75, 1.0];

  // Helper to convert polar to cartesian
  const getCoordinates = (index: number, ratio: number) => {
    const angle = (index / totalAxes) * (Math.PI * 2) - Math.PI / 2;
    const r = maxRadius * ratio;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  // Generate polygon points string
  const userPolygonPoints = scores
    .map((s, idx) => {
      const { x, y } = getCoordinates(idx, Math.max(0.1, s.score / 100));
      return `${x},${y}`;
    })
    .join(' ');

  const benchmarkPolygonPoints = scores
    .map((s, idx) => {
      const { x, y } = getCoordinates(idx, Math.max(0.1, s.benchmark / 100));
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div
      className={`sector-radar-container ${className}`}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'rgba(10, 16, 32, 0.85)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '20px',
        padding: '20px 24px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: '#FFC200', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            LogicWhileLiRE · Elevating Coding Knowledge
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
            5-Sector Technical Competency Radar
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38BDF8', fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38BDF8' }} /> Candidate
          </span>
          {showBenchmark && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(148,163,184,0.5)' }} /> Cohort Avg
            </span>
          )}
        </div>
      </div>

      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <radialGradient id="radarUserGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#818CF8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#C084FC" stopOpacity="0.1" />
          </radialGradient>
        </defs>

        {/* Circular / Polygonal Concentric Grid Rings */}
        {levels.map((lvl, lIdx) => {
          const ringPoints = Array.from({ length: totalAxes })
            .map((_, idx) => {
              const { x, y } = getCoordinates(idx, lvl);
              return `${x},${y}`;
            })
            .join(' ');

          return (
            <g key={lIdx}>
              <polygon
                points={ringPoints}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth={lIdx === levels.length - 1 ? '1.5' : '1'}
                strokeDasharray={lIdx < levels.length - 1 ? '3,3' : undefined}
              />
              <text
                x={cx + 6}
                y={cy - maxRadius * lvl + 12}
                fill="rgba(148, 163, 184, 0.6)"
                fontSize="9"
                fontFamily="monospace"
              >
                {Math.round(lvl * 100)}%
              </text>
            </g>
          );
        })}

        {/* Radial Axis Spokes */}
        {scores.map((_, idx) => {
          const outer = getCoordinates(idx, 1.0);
          return (
            <line
              key={idx}
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="1"
            />
          );
        })}

        {/* Benchmark Polygon */}
        {showBenchmark && (
          <polygon
            points={benchmarkPolygonPoints}
            fill="rgba(148, 163, 184, 0.08)"
            stroke="rgba(148, 163, 184, 0.5)"
            strokeWidth="1.5"
            strokeDasharray="4,4"
          />
        )}

        {/* Candidate Performance Polygon */}
        <motion.polygon
          points={userPolygonPoints}
          fill="url(#radarUserGrad)"
          stroke="#38BDF8"
          strokeWidth="2.5"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Vertex Markers & Sector Labels */}
        {scores.map((s, idx) => {
          const userCoord = getCoordinates(idx, Math.max(0.1, s.score / 100));
          const labelCoord = getCoordinates(idx, 1.18);

          return (
            <g key={idx}>
              {/* Vertex glow marker */}
              <circle
                cx={userCoord.x}
                cy={userCoord.y}
                r="4.5"
                fill={s.color}
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />

              {/* Label */}
              <text
                x={labelCoord.x}
                y={labelCoord.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#F8FAFC"
                fontSize="11"
                fontWeight="700"
                fontFamily="var(--font-display, 'Space Grotesk', sans-serif)"
              >
                {s.short}
              </text>
              <text
                x={labelCoord.x}
                y={labelCoord.y + 13}
                textAnchor="middle"
                dominantBaseline="central"
                fill={s.color}
                fontSize="10"
                fontWeight="800"
                fontFamily="monospace"
              >
                {s.score}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
