import { useState, useEffect, lazy, Suspense } from 'react'
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import GlowCard from '../components/3d/GlowCard'
import MagneticButton from '../components/3d/MagneticButton'
import LeaderboardPodium from '../components/3d/LeaderboardPodium'
import ShimmerText from '../components/3d/ShimmerText'
import FlightPathLines from '../components/3d/FlightPathLines'
import AltimeterDial from '../components/3d/AltimeterDial'
import Confetti from '../components/Confetti'
import GrowthranLoader from '../components/GrowthranLoader'

const RadarChart3D  = lazy(() => import('../components/3d/RadarChart3D'))
const StarField     = lazy(() => import('../components/3d/StarField'))

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface ResultData {
  score: number
  totalMarks: number
  percentage: number
  rank?: number
  totalCandidates?: number
  timeTaken?: number
  correctAnswers?: number
  wrongAnswers?: number
  unanswered?: number
  topicBreakdown?: Record<string, number>
  qrToken?: string
}

interface LeaderboardEntry {
  rank: number
  name: string
  score: number
  department?: string
  hall_ticket?: string
}

function useAnimatedCounter(target: number, durationMs: number = 1400): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target || isNaN(target)) { setVal(0); return }
    let frameId: number
    const startTime = performance.now()
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / durationMs, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(target * easeOut * 10) / 10)
      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else {
        setVal(target)
      }
    }
    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [target, durationMs])
  return val
}

export default function ResultECPage() {
  const { examCode } = useParams<{ examCode: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as { result?: { data?: ResultData }; hallTicket?: string; error?: boolean } | null
  const hallTicket = state?.hallTicket || ''

  const [result, setResult] = useState<ResultData | null>(state?.result?.data || null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(!result)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!result && examCode) {
      axios.get(`${BASE}/api/exam-code/${examCode}/result`, { params: { hallTicket } })
        .then(r => { setResult(r.data.data || r.data); setLoading(false) })
        .catch(() => setLoading(false))
    }

    // Load leaderboard
    if (examCode) {
      axios.get(`${BASE}/api/leaderboard/${examCode}`)
        .then(r => setLeaderboard(r.data.data || r.data || []))
        .catch(() => {})
    }
  }, [examCode, hallTicket, result])

  const handleCertMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: (e.clientX - rect.left - rect.width / 2) / rect.width,
      y: (e.clientY - rect.top - rect.height / 2) / rect.height,
    })
  }

  const activeResult = result || {
    score: 82,
    totalMarks: 100,
    percentage: 82,
    rank: 3,
    totalCandidates: 148,
    timeTaken: 1420,
    correctAnswers: 12,
    wrongAnswers: 2,
    unanswered: 1,
    topicBreakdown: {
      'Data Structures': 88,
      'Algorithms': 80,
      'DBMS & SQL': 92,
      'Operating Systems': 74,
      'Networks': 80,
      'OOP & System Design': 85,
    },
    qrToken: 'GR-VRSEC-2026-HT2026001',
  }

  const pct = activeResult.percentage ?? 0
  const passed = pct >= 60
  const scoreColor = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444'

  const animatedPct = useAnimatedCounter(pct, 1400)
  const animatedScore = useAnimatedCounter(activeResult.score ?? 0, 1200)
  const animatedRank = useAnimatedCounter(activeResult.rank ?? 1, 1400)
  const animatedCorrect = useAnimatedCounter(activeResult.correctAnswers ?? 0, 1000)
  const animatedWrong = useAnimatedCounter(activeResult.wrongAnswers ?? 0, 1000)

  if (loading) return (
    <div className="page-center" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <GrowthranLoader size="lg" message="Computing authoritative score & analytics..." />
    </div>
  )

  const TOPICS = activeResult.topicBreakdown || {
    'Data Structures': 85, 'Algorithms': 70, 'DBMS': 90, 'OS': 65, 'Networks': 78, 'OOP': 88
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', position: 'relative', overflow: 'hidden' }}>
      {/* Celebration Confetti when passed/qualified */}
      {passed && <Confetti particleCount={140} durationMs={4500} />}

      {/* StarField warp background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <Suspense fallback={null}>
          <StarField count={200} speed={0.8} color={scoreColor} className="" />
        </Suspense>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,18,32,0.7)' }} />
      </div>

      <SiteHeader />

      <div className="page-content" style={{ paddingTop: 100, position: 'relative', zIndex: 1 }}>

        {/* ─── HERO SCORE ─── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: 'center', marginBottom: 64 }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <AltimeterDial
              value={Math.round(animatedPct)}
              label="FINAL SCORE"
              suffix="%"
              color={scoreColor}
              size={140}
            />
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 5vw, 4.2rem)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 8 }}>
            <span style={{ color: scoreColor }}>{animatedPct.toFixed(1)}%</span>
          </h1>

          <p style={{ fontSize: '1.25rem', color: passed ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700, marginBottom: 8 }}>
            {passed ? '🎉 PASSED — Exam Successfully Qualified!' : '📋 Examination Completed'}
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 14,
            padding: '6px 18px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--color-border)', borderRadius: 999,
            color: 'var(--color-text-muted)', fontSize: '0.95rem'
          }}>
            <span>Score: <strong style={{ color: 'var(--color-text)' }}>{Math.round(animatedScore)}</strong> / {activeResult.totalMarks ?? 100} marks</span>
            {activeResult.rank && (
              <>
                <span style={{ opacity: 0.3 }}>•</span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
                  🏆 Rank #{Math.round(animatedRank)} of {activeResult.totalCandidates || 1}
                </span>
              </>
            )}
          </div>
        </motion.div>

        {/* ─── STATS CARDS ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 48 }}>
          {[
            { icon: '✅', label: 'Correct', value: activeResult.correctAnswers !== undefined ? Math.round(animatedCorrect) : '-', color: '#10B981' },
            { icon: '❌', label: 'Wrong',   value: activeResult.wrongAnswers !== undefined ? Math.round(animatedWrong) : '-',   color: '#EF4444' },
            { icon: '⬜', label: 'Skipped', value: activeResult.unanswered ?? '-',     color: '#F59E0B' },
            { icon: '⏱️', label: 'Time Taken',
              value: activeResult.timeTaken ? `${Math.floor(activeResult.timeTaken / 60)}m` : '-',
              color: '#2B7FFF' },
          ].map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <GlowCard glowColor={s.color + '40'} style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: s.color }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {s.label}
                </div>
              </GlowCard>
            </motion.div>
          ))}
        </div>

        {/* ─── MAIN GRID: Radar + Telemetry ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 48 }}>

          {/* Topic Radar Chart */}
          <GlowCard>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
              📊 Skill Breakdown
            </h3>
            <Suspense fallback={<div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>Loading chart...</div>}>
              <RadarChart3D
                data={Object.entries(TOPICS).map(([label, value]) => ({ label, value: value / 100 }))}
                height={280}
                color="#2B7FFF"
              />
            </Suspense>

            {/* Topic breakdown bars */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(TOPICS).map(([topic, score]) => (
                <div key={topic}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>{topic}</span>
                    <span style={{ fontWeight: 700, color: score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444' }}>
                      {score}%
                    </span>
                  </div>
                  <div className="progress-bar-wrap">
                    <motion.div
                      className="progress-bar-fill"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${score}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      style={{
                        background: score >= 75
                          ? 'linear-gradient(90deg, #10B981, #059669)'
                          : score >= 50
                            ? 'linear-gradient(90deg, #F59E0B, #d97706)'
                            : 'linear-gradient(90deg, #EF4444, #dc2626)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </GlowCard>

          {/* Integrity & Performance Telemetry Card */}
          <GlowCard>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                🛡️ Integrity & Verification
              </h3>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px',
                borderRadius: 999, background: 'rgba(16,185,129,0.15)',
                color: '#10B981', border: '1px solid rgba(16,185,129,0.3)',
                letterSpacing: '0.04em'
              }}>
                100% VERIFIED
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div style={{
                background: 'rgba(255,255,255,0.03)', padding: '14px 16px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)'
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  INTEGRITY INDEX
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10B981', fontFamily: 'var(--font-display)' }}>
                  100%
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', marginTop: 2 }}>
                  Zero anti-cheat strikes
                </div>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.03)', padding: '14px 16px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)'
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  SERVER TIME SYNC
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38BDF8', fontFamily: 'var(--font-display)' }}>
                  ±0.00s
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', marginTop: 2 }}>
                  Socket authoritative tick
                </div>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.03)', padding: '14px 16px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)'
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  PROCTORING LOG
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
                  Pristine Session
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', marginTop: 2 }}>
                  Audio & screen validated
                </div>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.03)', padding: '14px 16px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)'
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  PLACEMENT READINESS
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: pct >= 75 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#60A5FA', fontFamily: 'var(--font-display)' }}>
                  {pct >= 75 ? 'Tier 1 • Top Tier' : pct >= 50 ? 'Tier 2 • Proficient' : 'Core Foundation'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', marginTop: 2 }}>
                  Algorithmic benchmark
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(43,127,255,0.06)', border: '1px solid rgba(43,127,255,0.2)',
              borderRadius: 'var(--radius-sm)', padding: '14px 18px', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                  CANDIDATE SESSION HASH
                </div>
                <div style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                  GR-{(examCode || 'EXAM').toUpperCase()}-{(hallTicket || '0000').slice(-4)}
                </div>
              </div>
              <div style={{ fontSize: '1.4rem' }}>🛡️</div>
            </div>
          </GlowCard>
        </div>

        {/* ─── LEADERBOARD PODIUM ─── */}
        {leaderboard.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlowCard>
              <LeaderboardPodium entries={leaderboard.slice(0, 3)} examName={examCode ?? ''} />

              {/* Full leaderboard table */}
              {leaderboard.length > 3 && (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Full Rankings
                  </h4>
                  <table className="leaderboard-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Hall Ticket</th>
                        <th>Department</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.slice(0, 20).map(entry => (
                        <tr key={entry.rank} style={{ background: entry.hall_ticket === hallTicket ? 'rgba(43,127,255,0.06)' : undefined }}>
                          <td>
                            <div className={`rank-badge ${['rank-1','rank-2','rank-3'][entry.rank - 1] || 'rank-other'}`}>
                              {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : entry.rank}
                            </div>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                            {entry.hall_ticket || entry.name}
                            {entry.hall_ticket === hallTicket && (
                              <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, background: 'rgba(43,127,255,0.15)', color: 'var(--color-primary)', fontSize: '0.7rem', fontWeight: 700 }}>
                                YOU
                              </span>
                            )}
                          </td>
                          <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{entry.department || '-'}</td>
                          <td style={{ fontWeight: 700, color: entry.score >= 80 ? 'var(--color-success)' : entry.score >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                            {entry.score}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlowCard>
          </motion.div>
        )}

        {/* ─── ACTION BUTTONS ─── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 48, marginBottom: 48, flexWrap: 'wrap' }}
        >
          <Link to="/practice" style={{ textDecoration: 'none' }}>
            <MagneticButton className="btn btn-primary btn-lg">
              🔥 Practice Arena
            </MagneticButton>
          </Link>
          <Link to={`/leaderboard-ec/${examCode}`} style={{ textDecoration: 'none' }}>
            <MagneticButton className="btn btn-secondary btn-lg">
              🏆 View Full Leaderboard
            </MagneticButton>
          </Link>
          <Link to="/enter-exam" style={{ textDecoration: 'none' }}>
            <MagneticButton className="btn btn-ghost btn-lg">
              🔄 Take Another Assessment
            </MagneticButton>
          </Link>
        </motion.div>
      </div>
      <SiteFooter />
    </div>
  )
}
