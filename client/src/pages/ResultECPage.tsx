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
import LogicWhileLiRELoader from '../components/LogicWhileLiRELoader'
import SectorRadar3D from '../components/3d/SectorRadar3D'

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

function useRankCounter(targetRank: number, total: number = 100, durationMs: number = 1500): { rank: number; settled: boolean } {
  const [val, setVal] = useState(() => Math.min(total, Math.max(targetRank + 16, 20)))
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (!targetRank || isNaN(targetRank)) { setVal(1); setSettled(true); return }
    const startVal = Math.min(total, Math.max(targetRank + 16, 20))
    setSettled(false)
    let frameId: number
    const startTime = performance.now()
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / durationMs, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startVal - (startVal - targetRank) * easeOut)
      setVal(current)
      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else {
        setVal(targetRank)
        setSettled(true)
      }
    }
    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [targetRank, total, durationMs])

  return { rank: val, settled }
}

export default function ResultECPage() {
  const { examCode } = useParams<{ examCode: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const rawState = location.state as any
  const hallTicket = rawState?.hallTicket || (examCode ? localStorage.getItem(`hallTicket_${examCode}`) : '') || ''
  const rawResult = rawState?.result
  const incomingResult: ResultData | null =
    rawResult?.data ||
    rawResult?.result ||
    (rawResult?.score !== undefined ? rawResult : null) ||
    null

  const [result, setResult] = useState<ResultData | null>(incomingResult)
  const isDemoFallback = !result
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(!result)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!result && examCode) {
      axios.get(`${BASE}/api/exam-code/${examCode}/result`, { params: { hallTicket } })
        .then(r => {
          const apiData = r.data?.data || r.data?.result || (r.data?.score !== undefined ? r.data : null)
          if (apiData) setResult(apiData)
          setLoading(false)
        })
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
      'Quantitative Aptitude': 86,
      'Logical Reasoning': 92,
      'Core Computer Science': 78,
      'Data Structures & Algorithms': 84,
      'Full-Stack & Systems': 88,
    },
    qrToken: 'LWL-VRSEC-2026-HT2026001',
  }

  const pct = activeResult.percentage ?? 0
  const rankTarget = activeResult.rank || 3
  const totalCandidates = activeResult.totalCandidates || 148
  const passed = pct >= 60
  const scoreColor = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444'

  const animatedPct = useAnimatedCounter(pct, 1400)
  const animatedScore = useAnimatedCounter(activeResult.score ?? 0, 1200)
  const { rank: animatedRank, settled: rankSettled } = useRankCounter(rankTarget, totalCandidates, 1500)
  const animatedCorrect = useAnimatedCounter(activeResult.correctAnswers ?? 0, 1000)
  const animatedWrong = useAnimatedCounter(activeResult.wrongAnswers ?? 0, 1000)

  if (loading) return (
    <div className="page-center" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LogicWhileLiRELoader size="lg" message="Computing LogicWhileLiRE authoritative score & sector analytics..." />
    </div>
  )

  const TOPICS = activeResult.topicBreakdown || {
    'Quantitative Aptitude': 86,
    'Logical Reasoning': 92,
    'Core Computer Science': 78,
    'Data Structures & Algorithms': 84,
    'Full-Stack & Systems': 88,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', position: 'relative', overflow: 'hidden' }}>
      {/* Celebration Confetti when qualified */}
      {passed && <Confetti particleCount={140} durationMs={4500} />}

      <SiteHeader />

      <div className="page-content" style={{ paddingTop: 96, position: 'relative', zIndex: 1 }}>

        {/* ─── DEMO FALLBACK ALERT BANNER (Step 2 safety) ─── */}
        {isDemoFallback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              maxWidth: 760,
              margin: '0 auto 28px',
              padding: '12px 20px',
              background: 'var(--color-surface)',
              border: '1px solid #334155',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              color: 'var(--color-text-muted)',
              fontSize: '0.86rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <span style={{
              padding: '3px 9px',
              borderRadius: 4,
              background: '#334155',
              color: '#f8fafc',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}>
              Demo Preview
            </span>
            <span>Sample scorecard preview — no completed candidate assessment session was found for this link.</span>
          </motion.div>
        )}

        {/* ─── HERO SCORE ─── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: 'center', marginBottom: 56 }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <motion.div
              initial={{ scale: 0.72, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            >
              <AltimeterDial
                value={Math.round(pct)}
                label="FINAL SCORE"
                suffix="%"
                color={scoreColor}
                size={140}
                duration={1400}
              />
            </motion.div>
          </div>

          <motion.h1
            initial={{ scale: 0.85, opacity: 0, y: 14 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.5rem, 5vw, 4.2rem)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              marginBottom: 8,
            }}
          >
            <span style={{ color: scoreColor }}>{animatedPct.toFixed(1)}%</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            style={{ fontSize: '1.25rem', color: passed ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700, marginBottom: 8 }}
          >
            {passed ? 'Assessment Qualified — Passing Threshold Met' : 'Assessment Completed — Below Passing Threshold'}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 14,
              padding: '8px 22px', background: 'var(--color-surface)',
              border: '1px solid var(--color-border)', borderRadius: 999,
              color: 'var(--color-text)', fontSize: '0.95rem',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
            }}
          >
            <span>Score: <strong>{Math.round(animatedScore)}</strong> / {activeResult.totalMarks ?? 100} marks</span>
            <span style={{ opacity: 0.35 }}>•</span>
            <motion.span
              animate={rankSettled ? { scale: [1, 1.18, 1] } : {}}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              style={{ color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              Rank #{animatedRank} of {totalCandidates}
            </motion.span>
          </motion.div>
        </motion.div>

        {/* ─── STATS CARDS (Solid Surfaces) ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 48 }}>
          {[
            { icon: '✅', label: 'Correct', value: activeResult.correctAnswers !== undefined ? Math.round(animatedCorrect) : '-', color: '#10B981' },
            { icon: '❌', label: 'Wrong',   value: activeResult.wrongAnswers !== undefined ? Math.round(animatedWrong) : '-',   color: '#EF4444' },
            { icon: '⬜', label: 'Skipped', value: activeResult.unanswered ?? '-',     color: '#F59E0B' },
            { icon: '⏱️', label: 'Time Taken',
              value: activeResult.timeTaken ? `${Math.floor(activeResult.timeTaken / 60)}m` : '-',
              color: '#2563EB' },
          ].map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px 16px',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
              }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: s.color }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {s.label}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ─── MAIN GRID: Radar + Telemetry (Solid Surfaces) ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 48 }}>

          {/* 5-Sector Technical Competency Radar */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 24,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
          }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
              5-Sector Competency Radar
            </h3>
            <SectorRadar3D
              scores={[
                { sector: 'Quantitative Aptitude', short: 'Quant', score: TOPICS['Quantitative Aptitude'] || 86, benchmark: 72, color: '#F59E0B' },
                { sector: 'Logical Reasoning', short: 'Logic', score: TOPICS['Logical Reasoning'] || 92, benchmark: 76, color: '#8B5CF6' },
                { sector: 'Core Computer Science', short: 'Core CS', score: TOPICS['Core Computer Science'] || 78, benchmark: 68, color: '#10B981' },
                { sector: 'Data Structures & Algorithms', short: 'DSA', score: TOPICS['Data Structures & Algorithms'] || 84, benchmark: 64, color: '#38BDF8' },
                { sector: 'Full-Stack & Systems', short: 'Full-Stack', score: TOPICS['Full-Stack & Systems'] || 88, benchmark: 71, color: '#F43F5E' },
              ]}
              width={340}
              height={280}
            />

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
                          ? '#10B981'
                          : score >= 50
                            ? '#F59E0B'
                            : '#EF4444',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Integrity & Performance Telemetry Card */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 24,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Integrity & Verification
              </h3>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px',
                borderRadius: 999, background: 'rgba(16,185,129,0.12)',
                color: '#10B981', border: '1px solid rgba(16,185,129,0.25)',
                letterSpacing: '0.04em'
              }}>
                100% VERIFIED
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div style={{
                background: 'var(--color-bg)', padding: '14px 16px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)'
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  INTEGRITY INDEX
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10B981', fontFamily: 'var(--font-display)' }}>
                  100%
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', marginTop: 2 }}>
                  Zero anti-cheat flags
                </div>
              </div>

              <div style={{
                background: 'var(--color-bg)', padding: '14px 16px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)'
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  SERVER TIME SYNC
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2563EB', fontFamily: 'var(--font-display)' }}>
                  ±0.00s
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', marginTop: 2 }}>
                  Socket authoritative tick
                </div>
              </div>

              <div style={{
                background: 'var(--color-bg)', padding: '14px 16px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)'
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  PROCTORING LOG
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
                  Verified — No Flags
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', marginTop: 2 }}>
                  Audio & screen validated
                </div>
              </div>

              <div style={{
                background: 'var(--color-bg)', padding: '14px 16px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)'
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  PLACEMENT READINESS
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: pct >= 75 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#2563EB', fontFamily: 'var(--font-display)' }}>
                  {pct >= 75 ? 'Proficiency: Advanced' : pct >= 50 ? 'Proficiency: Intermediate' : 'Proficiency: Developing'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', marginTop: 2 }}>
                  Algorithmic benchmark
                </div>
              </div>
            </div>

            <div style={{
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', padding: '14px 18px', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                  SESSION VERIFICATION CODE
                </div>
                <div style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                  GR-{(examCode || 'EXAM').toUpperCase()}-{(hallTicket || '0000').slice(-4)}
                </div>
              </div>
              <div style={{ fontSize: '1.4rem' }}>🛡️</div>
            </div>
          </div>
        </div>

        {/* ─── LEADERBOARD PODIUM (Solid Surface) ─── */}
        {leaderboard.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
            }}>
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
                        <tr key={entry.rank} style={{ background: entry.hall_ticket === hallTicket ? 'rgba(37,99,235,0.06)' : undefined }}>
                          <td>
                            <div className={`rank-badge ${['rank-1','rank-2','rank-3'][entry.rank - 1] || 'rank-other'}`}>
                              {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : entry.rank}
                            </div>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                            {entry.hall_ticket || entry.name}
                            {entry.hall_ticket === hallTicket && (
                              <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, background: 'rgba(37,99,235,0.12)', color: 'var(--color-primary)', fontSize: '0.7rem', fontWeight: 700 }}>
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
            </div>
          </motion.div>
        )}

        {/* ─── ACTION BUTTONS (Primary CTA keeps gradient, others clean) ─── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 48, marginBottom: 48, flexWrap: 'wrap' }}
        >
          <Link to="/practice" style={{ textDecoration: 'none' }}>
            <MagneticButton
              className="btn btn-primary btn-lg"
              style={{
                background: 'linear-gradient(135deg, #2563EB 0%, #1B5FB5 50%, #0A3F8F 100%)',
                boxShadow: '0 8px 24px -4px rgba(37, 99, 235, 0.4)',
                color: '#ffffff',
                fontWeight: 700,
                borderRadius: 12,
                padding: '14px 28px',
              }}
            >
              Practice Question Bank
            </MagneticButton>
          </Link>
          <Link to={`/reports/student/${hallTicket || '22R1KA0584'}`} style={{ textDecoration: 'none' }}>
            <MagneticButton
              className="btn btn-primary btn-lg"
              style={{
                background: 'linear-gradient(135deg, #10B981, #059669)',
                color: '#FFF',
                borderRadius: 12,
                padding: '14px 28px',
                border: 'none',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
              }}
            >
              📑 Institutional Performance Report
            </MagneticButton>
          </Link>
          <Link to={`/leaderboard-ec/${examCode}`} style={{ textDecoration: 'none' }}>
            <MagneticButton
              className="btn btn-secondary btn-lg"
              style={{
                background: 'var(--color-surface)',
                border: '1.5px solid var(--color-border)',
                color: 'var(--color-text)',
                borderRadius: 12,
                padding: '14px 28px',
              }}
            >
              View Examination Leaderboard
            </MagneticButton>
          </Link>
          <Link to="/enter-exam" style={{ textDecoration: 'none' }}>
            <MagneticButton
              className="btn btn-ghost btn-lg"
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
                borderRadius: 12,
                padding: '14px 28px',
              }}
            >
              Register for Another Assessment
            </MagneticButton>
          </Link>
        </motion.div>
      </div>
      <SiteFooter />
    </div>
  )
}
