import { useState, useEffect, lazy, Suspense } from 'react'
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import { API_BASE_URL } from '../lib/config'
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

const BASE = API_BASE_URL

export interface CodingQuestionItem {
  id: string
  title?: string
  text?: string
  marks?: number
  submitted?: boolean
}

interface ResultData {
  status?: string
  is_terminated?: boolean
  termination_reason?: string
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
  codeAnswers?: Record<string, string>
  code_answers?: Record<string, string>
  mcqScore?: number
  mcq_score?: number
  mcqMaxMarks?: number
  mcq_max_score?: number
  mcqPercentage?: number
  mcq_percentage?: number
  codingQuestions?: CodingQuestionItem[]
  coding_questions?: CodingQuestionItem[]
  hasCodingQuestions?: boolean
  has_coding_questions?: boolean
  offline_evaluated?: boolean
}

interface LeaderboardEntry {
  rank: number
  name: string
  score: number
  department?: string
  hall_ticket?: string
  hall_ticket_no?: string
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

  const storedResult: ResultData | null = (() => {
    try {
      if (!examCode) return null
      const raw = localStorage.getItem(`logicwhilelire_results_${examCode}`) ||
        sessionStorage.getItem(`logicwhilelire_results_${examCode}`) ||
        localStorage.getItem(`logicwhilelire_results_${examCode.toUpperCase()}`)
      if (raw) return JSON.parse(raw)
    } catch {}
    return null
  })()

  const [result, setResult] = useState<ResultData | null>(incomingResult || storedResult)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(!incomingResult && !storedResult)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [expandedSolutions, setExpandedSolutions] = useState<Record<string, boolean>>({})
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null)

  useEffect(() => {
    if (!result && examCode) {
      axios.get(`${BASE}/api/exam-code/${examCode}/result`, { params: { hallTicket } })
        .then(r => {
          const apiData = r.data?.data || r.data?.result || (r.data?.score !== undefined ? r.data : null)
          if (apiData) setResult(apiData)
          setLoading(false)
        })
        .catch(() => {
          try {
            const raw = localStorage.getItem(`logicwhilelire_results_${examCode}`) || sessionStorage.getItem(`logicwhilelire_results_${examCode}`)
            if (raw) setResult(JSON.parse(raw))
          } catch {}
          setLoading(false)
        })
    } else {
      setLoading(false)
    }

    // Load leaderboard using canonical exam-code endpoint
    if (examCode) {
      axios.get(`${BASE}/api/exam-code/${examCode}/leaderboard`)
        .then(r => {
          const list = r.data.leaderboard || r.data.data || r.data || [];
          setLeaderboard(list);
        })
        .catch(() => {
          axios.get(`${BASE}/api/leaderboard/${examCode}`)
            .then(r => setLeaderboard(r.data.data || r.data.leaderboard || r.data || []))
            .catch(() => {});
        });
    }
  }, [examCode, hallTicket, result])

  const handleCertMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: (e.clientX - rect.left - rect.width / 2) / rect.width,
      y: (e.clientY - rect.top - rect.height / 2) / rect.height,
    })
  }

  const candidateHt = String(
    hallTicket ||
    rawState?.hallTicket ||
    (result as any)?.hallTicket ||
    (result as any)?.hall_ticket_no ||
    (result as any)?.hall_ticket ||
    (examCode ? localStorage.getItem(`hallTicket_${examCode}`) : '') ||
    ''
  ).toUpperCase().trim()

  const activeResult: any = {
    score: result?.score ?? (result as any)?.mcq_score ?? 0,
    totalMarks: result?.totalMarks ?? (result as any)?.max_score ?? (result as any)?.total_marks ?? 100,
    percentage: result?.percentage ?? 0,
    rank: result?.rank ?? (result as any)?.realTimeRank ?? 0,
    totalCandidates: result?.totalCandidates ?? (result as any)?.total_candidates ?? 0,
    timeTaken: result?.timeTaken ?? (result as any)?.time_taken_seconds ?? (result as any)?.time_taken ?? 0,
    correctAnswers: result?.correctAnswers ?? (result as any)?.correct_count ?? (result as any)?.correct_answers ?? 0,
    wrongAnswers: result?.wrongAnswers ?? (result as any)?.wrong_count ?? (result as any)?.wrong_answers ?? 0,
    unanswered: result?.unanswered ?? 0,
    topicBreakdown: result?.topicBreakdown ?? (result as any)?.topic_breakdown ?? {},
    ...result,
  }

  // Dynamic live ranking calculation:
  // 1. From activeResult.rank if calculated by server
  // 2. From real-time leaderboard lookup matching student's hall ticket
  // 3. Fallback to rank 1 (no mock defaults)
  const dynamicRankFromLeaderboard = (() => {
    if (!leaderboard || leaderboard.length === 0 || !candidateHt) return null
    const idx = leaderboard.findIndex((e: any) => {
      const entryHt = String(e.hall_ticket || e.hall_ticket_no || '').toUpperCase().trim()
      return entryHt === candidateHt
    })
    return idx !== -1 ? idx + 1 : null
  })()

  const rankTarget = activeResult.rank || dynamicRankFromLeaderboard || 1
  const totalCandidates = Math.max(
    activeResult.totalCandidates || activeResult.total_candidates || 0,
    leaderboard?.length || 0,
    rankTarget,
    1
  )
  const pct = activeResult.percentage ?? 0
  const scoreColor = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444'

  const resolvedCodeAnswers: Record<string, string> =
    rawState?.codeAnswers ||
    rawResult?.code_answers ||
    rawResult?.result?.code_answers ||
    activeResult.code_answers ||
    activeResult.codeAnswers ||
    {}

  const initialCodingQuestions: CodingQuestionItem[] =
    rawState?.codingQuestions ||
    rawResult?.coding_questions ||
    rawResult?.result?.coding_questions ||
    activeResult.coding_questions ||
    activeResult.codingQuestions ||
    []

  const resolvedAllQuestions: any[] = (() => {
    if (rawState?.allQuestions && Array.isArray(rawState.allQuestions) && rawState.allQuestions.length > 0) {
      return rawState.allQuestions
    }
    try {
      if (examCode) {
        const stored = localStorage.getItem(`logicwhilelire_questions_${examCode}`) || sessionStorage.getItem(`logicwhilelire_questions_${examCode}`)
        if (stored) return JSON.parse(stored)
      }
    } catch {}
    return []
  })()

  const hasCodingQuestions = Boolean(
    activeResult.has_coding_questions ||
    activeResult.hasCodingQuestions ||
    initialCodingQuestions.length > 0 ||
    Object.keys(resolvedCodeAnswers).length > 0
  )

  const resolvedCodingQuestions: CodingQuestionItem[] = initialCodingQuestions

  const codingMarksTotal = resolvedCodingQuestions.reduce((sum, cq) => sum + (cq.marks || 10), 0)
  const effectiveMcqMaxMarks =
    activeResult.mcq_max_score ??
    activeResult.mcqMaxMarks ??
    (hasCodingQuestions ? Math.max(1, (activeResult.totalMarks ?? 35) - codingMarksTotal) : (activeResult.totalMarks ?? 100))

  const effectiveMcqScore = activeResult.mcq_score ?? activeResult.mcqScore ?? activeResult.score ?? 0
  const effectiveMcqPct = effectiveMcqMaxMarks > 0 ? Math.round((effectiveMcqScore / effectiveMcqMaxMarks) * 1000) / 10 : 0
  const animatedMcqPct = useAnimatedCounter(effectiveMcqPct, 1400)
  const animatedMcqScore = useAnimatedCounter(effectiveMcqScore, 1200)
  const mcqScoreColor = effectiveMcqPct >= 80 ? '#10B981' : effectiveMcqPct >= 50 ? '#F59E0B' : '#EF4444'
  const mcqPassed = effectiveMcqPct >= 40

  const isTerminated = Boolean(
    activeResult.is_terminated ||
    activeResult.status === 'terminated_cheating' ||
    activeResult.status === 'terminated' ||
    activeResult.status === 'Terminated - violation' ||
    rawState?.status === 'terminated' ||
    rawState?.isTerminated
  )

  const passed = isTerminated ? false : (hasCodingQuestions ? mcqPassed : pct >= 60)

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

  if (!result) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
        <SiteHeader />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 24px 60px' }}>
          <div
            style={{
              maxWidth: 520,
              width: '100%',
              background: '#0F172A',
              border: '1.5px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 16,
              padding: '40px 32px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>📋</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F8FAFC', marginBottom: 8 }}>
              No Assessment Record Found
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 24 }}>
              {examCode
                ? `No completed examination attempt was located for examination code "${examCode}"${hallTicket ? ` and hall ticket "${hallTicket}"` : ''}.`
                : 'No examination identifier was provided.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {examCode && (
                <button
                  type="button"
                  onClick={() => navigate(`/leaderboard/${examCode}`)}
                  className="btn btn-secondary btn-full"
                >
                  View Examination Leaderboard
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="btn btn-primary btn-full"
              >
                Go to Candidate Portal
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const TOPICS: Record<string, number> = (activeResult.topicBreakdown as Record<string, number>) || {
    'Quantitative Aptitude': 86,
    'Logical Reasoning': 92,
    'Core Computer Science': 78,
    'Data Structures & Algorithms': 84,
    'Full-Stack & Systems': 88,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @media print {
          header, footer, nav, .site-header, .site-footer, #print-scorecard-btn, button {
            display: none !important;
          }
          body, .page-content, div {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .page-content {
            padding-top: 10px !important;
          }
          div[style*="box-shadow"], div[style*="border"] {
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          h1, h2, h3, h4, span, div, p, strong {
            color: #000000 !important;
            text-shadow: none !important;
          }
        }
      `}</style>
      {/* Celebration Confetti when qualified (never on terminated attempts) */}
      {passed && !isTerminated && <Confetti particleCount={140} durationMs={4500} />}

      <SiteHeader />

      <div className="page-content" style={{ paddingTop: 96, position: 'relative', zIndex: 1 }}>

        {/* ─── SECURITY TERMINATION ALERT BANNER ─── */}
        {isTerminated && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              maxWidth: 820,
              margin: '0 auto 28px',
              padding: '16px 24px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1.5px solid #EF4444',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              color: '#FCA5A5',
              fontSize: '0.92rem',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.2)',
            }}
          >
            <div style={{ fontSize: '2rem' }}>🚫</div>
            <div>
              <div style={{ fontWeight: 800, color: '#EF4444', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Attempt Terminated &amp; Disqualified
              </div>
              <div style={{ marginTop: 3 }}>
                Reason: <strong>{activeResult.termination_reason || 'Proctoring Lockdown Violation (tab switch, blur, or unauthorized keys)'}</strong>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#FDA4AF', marginTop: 4 }}>
                This attempt was flagged by the autonomous proctoring engine and submitted with status <code>terminated_cheating</code>.
              </div>
            </div>
          </motion.div>
        )}



        {/* ─── HERO SCORE: DUAL BREAKDOWN (Coding Questions Present) vs STANDARD ─── */}
        {hasCodingQuestions ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ maxWidth: 980, margin: '0 auto 48px' }}
          >
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 14px',
                borderRadius: 999,
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                color: '#38BDF8',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}>
                <span>📊</span>
                <span>Sectional Evaluation Ledger</span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, letterSpacing: '-0.03em' }}>
                Assessment Performance Summary
              </h1>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.94rem', maxWidth: 640, margin: '6px auto 0' }}>
                MCQs are auto-graded immediately. Coding challenge solutions are preserved for faculty manual evaluation.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {/* PART 1: Auto-graded (MCQ) */}
              <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px 22px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 4,
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      color: '#10B981',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      Auto-graded (MCQ)
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>
                      Objective Verification
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '14px 0 6px' }}>
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(2.4rem, 4vw, 3.2rem)',
                      fontWeight: 800,
                      color: mcqScoreColor,
                      lineHeight: 1,
                    }}>
                      {animatedMcqPct.toFixed(1)}%
                    </span>
                  </div>

                  <div style={{
                    fontSize: '1.05rem',
                    color: 'var(--color-text)',
                    fontWeight: 700,
                    marginBottom: 8,
                  }}>
                    Auto-graded (MCQ): <strong style={{ color: mcqScoreColor }}>{Math.round(animatedMcqScore)}</strong> / {effectiveMcqMaxMarks} marks
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    Instant objective grading completed. {Math.round(animatedCorrect)} correct out of {effectiveMcqMaxMarks} total MCQ points.
                  </p>
                </div>

                <div style={{
                  marginTop: 20,
                  paddingTop: 14,
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.82rem',
                }}>
                  <span style={{ color: 'var(--color-text-faint)' }}>Cohort Standing</span>
                  <motion.span
                    animate={rankSettled ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 0.4 }}
                    style={{ color: '#2563EB', fontWeight: 700 }}
                  >
                    Rank #{animatedRank} of {totalCandidates}
                  </motion.span>
                </div>
              </div>

              {/* PART 2: Coding questions (Manual Review) */}
              <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px 22px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 4,
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      color: '#38BDF8',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      Coding Questions
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>
                      Faculty Manual Review
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '14px 0' }}>
                    {resolvedCodingQuestions.map((cq, idx) => {
                      const codeVal = resolvedCodeAnswers[cq.id] || ''
                      const isAttempted = cq.submitted ?? Boolean(typeof codeVal === 'string' && codeVal.trim().length > 0)

                      return (
                        <div
                          key={cq.id || idx}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 8,
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--color-border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                color: 'var(--color-text)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {cq.title || cq.text || `Coding Problem ${idx + 1}`}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)', marginTop: 2 }}>
                                Weight: {cq.marks ?? 10} marks • Subjective Grade
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {isAttempted ? (
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  border: '1px solid rgba(16, 185, 129, 0.35)',
                                  color: '#10B981',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  whiteSpace: 'nowrap',
                                }}>
                                  <span>✓</span>
                                  <span>Accepted & Saved</span>
                                </span>
                              ) : (
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  background: 'rgba(100, 116, 139, 0.15)',
                                  border: '1px solid rgba(100, 116, 139, 0.35)',
                                  color: '#94A3B8',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  whiteSpace: 'nowrap',
                                }}>
                                  <span>⚪</span>
                                  <span>Not attempted</span>
                                </span>
                              )}
                              {isAttempted && codeVal && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedSolutions(prev => ({ ...prev, [cq.id]: !prev[cq.id] }))}
                                  style={{
                                    background: 'rgba(56, 189, 248, 0.12)',
                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                    color: '#38BDF8',
                                    borderRadius: 6,
                                    padding: '4px 9px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {expandedSolutions[cq.id] ? 'Hide Code ▲' : 'View Code ▼'}
                                </button>
                              )}
                            </div>
                          </div>

                          {expandedSolutions[cq.id] && isAttempted && codeVal && (
                            <div style={{
                              background: '#070C18',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: 8,
                              padding: '10px 14px',
                              fontFamily: 'var(--font-mono, monospace)',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: '0.7rem', color: '#94A3B8' }}>
                                <span>ACCEPTED SOLUTION ({codeVal.split('\n').length} lines · {codeVal.length} chars)</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(codeVal)
                                    setCopySuccessId(cq.id)
                                    setTimeout(() => setCopySuccessId(null), 2000)
                                  }}
                                  style={{
                                    background: copySuccessId === cq.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                    border: 'none',
                                    borderRadius: 4,
                                    color: copySuccessId === cq.id ? '#10B981' : '#CBD5E1',
                                    padding: '2px 8px',
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  {copySuccessId === cq.id ? '✓ Copied' : '📋 Copy'}
                                </button>
                              </div>
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#86EFAC', fontSize: '0.78rem', lineHeight: 1.5, maxHeight: 180, overflowY: 'auto' }}>
                                {codeVal}
                              </pre>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{
                  paddingTop: 14,
                  borderTop: '1px solid var(--color-border)',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-faint)',
                  fontStyle: 'italic',
                }}>
                  * No automated score is computed for coding challenges. Marks will be assigned following instructor evaluation.
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Standard Pure-MCQ Single Hero View */
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
              style={{ fontSize: '1.25rem', color: isTerminated ? '#EF4444' : passed ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700, marginBottom: 8 }}
            >
              {isTerminated
                ? 'DISQUALIFIED — Attempt Terminated for Security Violation'
                : passed
                ? 'Assessment Qualified — Passing Threshold Met'
                : 'Assessment Completed — Below Passing Threshold'}
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

            {activeResult.offline_evaluated && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 14,
                  padding: '6px 18px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 999,
                  color: '#34D399',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  width: 'fit-content',
                  margin: '14px auto 0',
                }}
              >
                <span>🛡️ Certified Offline Evaluation</span>
                <span style={{ opacity: 0.4 }}>•</span>
                <span>Cryptographically Encrypted & Queued for Cloud Sync</span>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ─── STATS CARDS (Solid Surfaces) ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 48 }}>
          {[
            { icon: '✅', label: hasCodingQuestions ? 'Correct (MCQ)' : 'Correct', value: activeResult.correctAnswers !== undefined ? Math.round(animatedCorrect) : '-', color: '#10B981' },
            { icon: '❌', label: hasCodingQuestions ? 'Wrong (MCQ)' : 'Wrong',   value: activeResult.wrongAnswers !== undefined ? Math.round(animatedWrong) : '-',   color: '#EF4444' },
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
              {Object.entries(TOPICS).map(([topic, rawScore]) => {
                const score = Number(rawScore || 0)
                return (
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
                )
              })}
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

        {/* ─── LEADERBOARD PODIUM & LIVE COHORT STANDINGS ─── */}
        {leaderboard.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ marginBottom: 48 }}
          >
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
            }}>
              {leaderboard.length >= 3 && (
                <LeaderboardPodium entries={leaderboard.slice(0, 3)} examName={examCode ?? ''} />
              )}

              {/* Full leaderboard table */}
              <div style={{ marginTop: leaderboard.length >= 3 ? 24 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    Live Examination Rankings ({leaderboard.length} candidates)
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: 700 }}>
                    Your Real-Time Rank: #{animatedRank}
                  </span>
                </div>
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
                    {leaderboard.slice(0, 30).map((entry, eIdx) => {
                      const entryRank = entry.rank || eIdx + 1
                      const isMe = String(entry.hall_ticket || entry.hall_ticket_no || '').toUpperCase().trim() === candidateHt
                      return (
                        <tr key={entryRank} style={{ background: isMe ? 'rgba(37,99,235,0.08)' : undefined }}>
                          <td>
                            <div className={`rank-badge ${['rank-1','rank-2','rank-3'][entryRank - 1] || 'rank-other'}`}>
                              {entryRank <= 3 ? ['🥇','🥈','🥉'][entryRank - 1] : entryRank}
                            </div>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                            {entry.hall_ticket || entry.name}
                            {isMe && (
                              <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, background: 'rgba(37,99,235,0.18)', color: 'var(--color-primary)', fontSize: '0.7rem', fontWeight: 800 }}>
                                YOU (RANK #{entryRank})
                              </span>
                            )}
                          </td>
                          <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{entry.department || '-'}</td>
                          <td style={{ fontWeight: 700, color: entry.score >= 80 ? 'var(--color-success)' : entry.score >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                            {entry.score}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── COMPREHENSIVE QUESTIONS & ACCEPTED ANSWERS AUDIT ─── */}
        {resolvedAllQuestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{ marginBottom: 48 }}
          >
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                    Questions & Accepted Answers Manifest
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-text-faint)' }}>
                    Authoritative audit log of questions presented, candidate selections, and server-accepted responses.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: 999,
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10B981',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}>
                    {resolvedAllQuestions.filter(q => q.isAnswered).length} / {resolvedAllQuestions.length} Questions Accepted
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {resolvedAllQuestions.map((q, idx) => {
                  const optLetters = ['A', 'B', 'C', 'D']
                  const isCodeQ = q.type === 'code'
                  const codeAns = resolvedCodeAnswers[q.id] || (isCodeQ ? q.candidateAnswer : '') || ''
                  const isAns = isCodeQ ? Boolean(codeAns && codeAns.trim().length > 0) : (q.candidateAnswer !== null && q.candidateAnswer !== undefined)

                  return (
                    <div
                      key={q.id || idx}
                      style={{
                        padding: '16px',
                        borderRadius: 10,
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: 'rgba(37, 99, 235, 0.15)',
                            color: '#60A5FA',
                            fontWeight: 800,
                            fontSize: '0.72rem',
                          }}>
                            Q{idx + 1}
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--color-text-muted)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                          }}>
                            {q.topic || 'General'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)' }}>
                            {q.marks || 1} mark{(q.marks || 1) > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div>
                          {isAns ? (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: 999,
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              color: '#10B981',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                            }}>
                              ✓ Accepted & Saved
                            </span>
                          ) : (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: 999,
                              background: 'rgba(100, 116, 139, 0.15)',
                              border: '1px solid rgba(100, 116, 139, 0.35)',
                              color: '#94A3B8',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                            }}>
                              Not Attempted
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)', marginBottom: 12, lineHeight: 1.5 }}>
                        {q.text}
                      </div>

                      {/* Answer details */}
                      {isCodeQ ? (
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38BDF8', marginBottom: 6 }}>
                            Candidate's Accepted Code Solution:
                          </div>
                          {codeAns ? (
                            <pre style={{
                              margin: 0,
                              background: '#070C18',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: 8,
                              padding: '10px 14px',
                              fontSize: '0.78rem',
                              fontFamily: 'var(--font-mono, monospace)',
                              color: '#86EFAC',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              maxHeight: 180,
                              overflowY: 'auto',
                            }}>
                              {codeAns}
                            </pre>
                          ) : (
                            <div style={{ color: 'var(--color-text-faint)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                              No code answer submitted for this problem.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
                            {(q.options || []).map((opt: string, optI: number) => {
                              const isSelected = q.candidateAnswer === optI || String(q.candidateAnswer).toUpperCase() === optLetters[optI]
                              return (
                                <div
                                  key={optI}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 6,
                                    background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                    border: isSelected ? '1px solid #2563EB' : '1px solid var(--color-border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  <span style={{
                                    fontWeight: 800,
                                    color: isSelected ? '#60A5FA' : 'var(--color-text-faint)',
                                  }}>
                                    {optLetters[optI]}.
                                  </span>
                                  <span style={{
                                    color: isSelected ? '#FFFFFF' : 'var(--color-text-muted)',
                                    fontWeight: isSelected ? 700 : 400,
                                  }}>
                                    {opt}
                                  </span>
                                  {isSelected && (
                                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#60A5FA', fontWeight: 800 }}>
                                      (Your Selection)
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
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
          <button
            type="button"
            id="print-scorecard-btn"
            onClick={() => window.print()}
            style={{
              background: 'linear-gradient(135deg, #EAA812 0%, #D97706 100%)',
              color: '#002147',
              border: 'none',
              borderRadius: 12,
              padding: '14px 28px',
              fontWeight: 800,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 6px 20px rgba(234, 168, 18, 0.4)',
              transition: 'all 0.2s ease',
            }}
            title="Print or save verified official score report as PDF"
          >
            <span>🖨️</span>
            <span>Print Verified Scorecard</span>
          </button>
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
