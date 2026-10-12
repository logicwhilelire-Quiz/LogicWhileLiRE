import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PlasmaBall from './PlasmaBall'
import CodeCube from './CodeCube'

export interface LeaderboardEntry {
  rank: number
  name: string
  score: number
  department?: string
  hall_ticket?: string
  avatar?: string
}

interface LeaderboardPodiumProps {
  entries: LeaderboardEntry[]
  examName?: string
}

const MEDALS = ['🥇', '🥈', '🥉']
const PODIUM_HEIGHTS = [180, 140, 110] // px heights for 1st, 2nd, 3rd

export default function LeaderboardPodium({ entries = [], examName = 'Exam' }: LeaderboardPodiumProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  // Reorder: 2nd | 1st | 3rd
  const ordered = [entries[1], entries[0], entries[2]].filter(Boolean)
  const orderMap = [1, 0, 2] // display positions to data indices

  return (
    <div style={{ padding: '32px 0', textAlign: 'center' }}>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.1rem', fontWeight: 700,
        color: 'var(--color-text-muted)',
        marginBottom: 40, letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        🏆 Top Performers — {examName}
      </h3>

      {/* Podium display */}
      <div style={{
        display: 'flex', alignItems: 'flex-end',
        justifyContent: 'center', gap: 16,
        perspective: '800px',
      }}>
        {ordered.map((entry, displayIdx) => {
          if (!entry) return null
          const dataIdx = orderMap[displayIdx]
          const rank = entry.rank
          const podiumH = PODIUM_HEIGHTS[dataIdx]
          const isFirst = rank === 1
          const isHovered = hovered === entry.rank

          return (
            <motion.div
              key={entry.rank}
              onMouseEnter={() => setHovered(entry.rank)}
              onMouseLeave={() => setHovered(null)}
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: displayIdx * 0.15 + 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                width: 150,
              }}
            >
              {/* Avatar area with 3D component */}
              <motion.div
                style={{ marginBottom: 12, position: 'relative' }}
                animate={isHovered ? { y: -8 } : { y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {rank === 1 && (
                  <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', zIndex: 2, pointerEvents: 'none' }}>
                    <PlasmaBall height={80} />
                  </div>
                )}
                {rank === 2 && (
                  <div style={{ position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)', zIndex: 2, pointerEvents: 'none', opacity: 0.8 }}>
                    <CodeCube height={60} />
                  </div>
                )}
                {rank === 3 && (
                  <div style={{ position: 'absolute', top: -36, left: '50%', transform: 'translateX(-50%)', zIndex: 2, pointerEvents: 'none', opacity: 0.7 }}>
                    {/* NeonGrid mini — just a glowing circle for 3rd */}
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      border: '2px solid rgba(106,90,205,0.6)',
                      background: 'radial-gradient(circle, rgba(106,90,205,0.3), transparent)',
                      boxShadow: '0 0 16px rgba(106,90,205,0.4)',
                    }} />
                  </div>
                )}

                {/* Avatar */}
                <motion.div
                  style={{
                    width: 60, height: 60, borderRadius: '50%',
                    background: isFirst
                      ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                      : rank === 2
                        ? 'linear-gradient(135deg, #e2e8f0, #94a3b8)'
                        : 'linear-gradient(135deg, #cd7f32, #a0522d)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem',
                    border: `3px solid ${isFirst ? '#fbbf24' : rank === 2 ? '#94a3b8' : '#cd7f32'}`,
                    boxShadow: isFirst
                      ? '0 0 24px rgba(251,191,36,0.4)'
                      : rank === 2 ? '0 0 16px rgba(148,163,184,0.3)' : '0 0 12px rgba(205,127,50,0.3)',
                    transition: 'box-shadow 0.3s ease',
                    zIndex: 3, position: 'relative',
                    marginTop: rank === 1 ? 60 : rank === 2 ? 50 : 36,
                  }}
                >
                  {MEDALS[dataIdx]}
                </motion.div>
              </motion.div>

              {/* Info */}
              <motion.div
                style={{
                  marginBottom: 8, textAlign: 'center',
                }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700 }}>
                  {entry.name || entry.hall_ticket || `Rank ${rank}`}
                </div>
                {entry.department && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)', marginTop: 2 }}>
                    {entry.department}
                  </div>
                )}
                <motion.div
                  style={{
                    fontSize: '1.1rem', fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    background: isFirst
                      ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                      : rank === 2
                        ? 'linear-gradient(135deg, #e2e8f0, #94a3b8)'
                        : 'linear-gradient(135deg, #cd7f32, #a0522d)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    marginTop: 4,
                  }}
                >
                  {entry.score}%
                </motion.div>
              </motion.div>

              {/* Podium base */}
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: displayIdx * 0.15 + 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  transformOrigin: 'bottom',
                  width: '100%',
                  height: podiumH,
                  background: isFirst
                    ? 'linear-gradient(180deg, rgba(251,191,36,0.2), rgba(251,191,36,0.08))'
                    : rank === 2
                      ? 'linear-gradient(180deg, rgba(148,163,184,0.15), rgba(148,163,184,0.06))'
                      : 'linear-gradient(180deg, rgba(205,127,50,0.15), rgba(205,127,50,0.06))',
                  border: '1px solid',
                  borderColor: isFirst
                    ? 'rgba(251,191,36,0.3)' : rank === 2 ? 'rgba(148,163,184,0.25)' : 'rgba(205,127,50,0.25)',
                  borderRadius: '8px 8px 0 0',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                  paddingTop: 16,
                  boxShadow: isFirst
                    ? '0 -4px 24px rgba(251,191,36,0.15)'
                    : rank === 2 ? '0 -4px 16px rgba(148,163,184,0.1)' : '0 -4px 12px rgba(205,127,50,0.1)',
                  transition: 'box-shadow 0.3s ease',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2rem', fontWeight: 800,
                  color: isFirst ? 'rgba(251,191,36,0.5)' : rank === 2 ? 'rgba(148,163,184,0.4)' : 'rgba(205,127,50,0.4)',
                }}>
                  {rank}
                </span>
              </motion.div>
            </motion.div>
          )
        })}
      </div>

      {/* Ground line */}
      <div style={{
        height: 2,
        background: 'linear-gradient(90deg, transparent, rgba(43,127,255,0.3), rgba(255,255,255,0.1), rgba(43,127,255,0.3), transparent)',
        margin: '0 auto',
        maxWidth: 600,
      }} />
    </div>
  )
}
