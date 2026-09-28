import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { supabase } from '../lib/supabaseClient'
import QuestionMorph from '../components/3d/QuestionMorph'
import CodeEditorHolo from '../components/3d/CodeEditorHolo'
import MagneticButton from '../components/3d/MagneticButton'
import TypingDots from '../components/3d/TypingDots'
import HoloScan from '../components/3d/HoloScan'
import FlightPathLines from '../components/3d/FlightPathLines'
import ProctoringConsentModal from '../components/ProctoringConsentModal'
import BrandLogo from '../components/BrandLogo'
import FullscreenEnforcementOverlay from '../components/exam/FullscreenEnforcementOverlay'
import ScreenShareWarningOverlay from '../components/exam/ScreenShareWarningOverlay'

const FaceMeshOrb = lazy(() => import('../components/3d/FaceMeshOrb'))
const CircularProgress3D = lazy(() => import('../components/3d/CircularProgress3D'))

/* ── Types ── */
interface ExamQuestion {
  id: string
  text: string
  options?: string[]
  type: 'mcq' | 'code' | 'aptitude'
  marks?: number
  time_limit?: number
  difficulty?: string
  topic?: string
  test_cases?: Array<{ id: string; input_text: string; expected_output?: string; is_hidden: boolean; marks?: number }>
}

interface ExamSession {
  candidateId: string
  examName: string
  totalMarks: number
  duration: number   // seconds
  questions: ExamQuestion[]
  proctoringMode?: 'webcam' | 'screen' | 'dual'
}

type FaceStatus = 'ok' | 'no_face' | 'multiple' | 'looking_away' | 'loading'

const BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function QuizPage() {
  const { examCode } = useParams<{ examCode: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const stateHt = (location.state as { hallTicket?: string } | null)?.hallTicket
  const storedHt = (() => {
    try { return JSON.parse(localStorage.getItem('lw_attempt') || '{}')?.hallTicket } catch { return '' }
  })()
  const hallTicket: string = stateHt || storedHt || ''

  /* ── State ── */
  const [session, setSession] = useState<ExamSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [codeAnswers, setCodeAnswers] = useState<Record<string, string>>({})
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [timeLeft, setTimeLeft] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [violationCount, setViolationCount] = useState(0)
  const [showViolationModal, setShowViolationModal] = useState(false)
  const [violationMsg, setViolationMsg] = useState('')
  const [faceStatus, setFaceStatus] = useState<FaceStatus>('loading')
  const [showProctoringAlert, setShowProctoringAlert] = useState(false)
  const [consentGiven, setConsentGiven] = useState(() => Boolean(sessionStorage.getItem(`lw_camera_consented_${examCode}`)))
  const [adminWarningMsg, setAdminWarningMsg] = useState('')
  const [showAdminWarning, setShowAdminWarning] = useState(false)
  const [runResult, setRunResult] = useState<{ output: string; error?: string } | null>(null)
  const [running, setRunning] = useState(false)
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false)
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0)
  const fullscreenExitCountRef = useRef(0)
  const exitTimestampRef = useRef<number | null>(null)
  const violationRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const sessionIdRef = useRef<string | undefined>(undefined)
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  /* ── Load session ── */
  useEffect(() => {
    const init = async () => {
      if (!examCode || !hallTicket) {
        navigate('/enter-exam')
        return
      }
      try {
        const { data } = await axios.get(`${BASE}/api/exam-code/${examCode}/start`, {
          params: { hallTicket }
        })
        if (!data.success) throw new Error(data.message)
        const exam = data.exam || data.data
        const questions: ExamQuestion[] = (data.questions || []).map((q: Record<string, unknown>) => ({
          id: String(q.id),
          text: (q.question_text || q.text || q.question) as string,
          options: (q.options as string[]) || [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean) as string[],
          type: (q.question_type || q.type || 'mcq') as ExamQuestion['type'],
          marks: (q.marks as number) || 1,
          difficulty: (q.difficulty as string) || 'Medium',
          topic: (q.topic as string) || 'General',
          test_cases: (q.test_cases as ExamQuestion['test_cases']) || [],
        }))
        sessionIdRef.current = data.sessionId || data.session_id
        const proctoringMode: 'webcam' | 'screen' | 'dual' = exam?.proctoring_mode || 'dual'
        setSession({
          candidateId: data.candidateId || hallTicket,
          examName: exam?.exam_name || exam?.name || 'Exam',
          totalMarks: exam?.total_marks || 100,
          duration: (exam?.duration_minutes || 60) * 60,
          questions,
          proctoringMode,
        })
        setTimeLeft((exam?.duration_minutes || 60) * 60)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load exam')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [examCode, hallTicket, navigate])

  /* ── Submit Handler ── */
  const handleSubmit = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    if (timerRef.current) clearInterval(timerRef.current)
    try {
      const payload = {
        sessionId: sessionIdRef.current,
        examCode,
        hallTicket,
        answers: { ...answers },
        codeAnswers: { ...codeAnswers },
      }
      const { data } = await axios.post(`${BASE}/api/exam-code/${examCode}/submit`, payload)
      navigate(`/result-ec/${examCode}`, { state: { result: data, hallTicket } })
    } catch {
      navigate(`/result-ec/${examCode}`, { state: { hallTicket, error: true } })
    }
  }, [submitting, examCode, hallTicket, answers, codeAnswers, navigate])

  /* ── Supabase Realtime Telemetry Broadcast ── */
  useEffect(() => {
    if (!examCode || !hallTicket) return

    const channel = supabase.channel(`realtime:monitor-${examCode}`)

    channel
      .on('broadcast', { event: 'admin_warning' }, payload => {
        const data = payload.payload as { hallTicket?: string; message?: string }
        if (!data?.hallTicket || data.hallTicket === hallTicket) {
          setAdminWarningMsg(data?.message || 'Proctor Warning: Unusual activity detected on your terminal.')
          setShowAdminWarning(true)
          setTimeout(() => setShowAdminWarning(false), 6000)
        }
      })
      .on('broadcast', { event: 'admin_terminate' }, payload => {
        const data = payload.payload as { hallTicket?: string }
        if (!data?.hallTicket || data.hallTicket === hallTicket) {
          handleSubmit()
        }
      })
      .subscribe()

    realtimeChannelRef.current = channel

    // Periodic Heartbeat every 10 seconds
    const heartbeatInterval = setInterval(() => {
      channel.send({
        type: 'broadcast',
        event: 'student_heartbeat',
        payload: {
          hallTicket,
          currentQuestion: currentQ + 1,
          answeredCount: Object.keys(answers).length + Object.keys(codeAnswers).length,
          timestamp: Date.now(),
        },
      })
    }, 10000)

    return () => {
      clearInterval(heartbeatInterval)
      supabase.removeChannel(channel)
    }
  }, [examCode, hallTicket, currentQ, answers, codeAnswers])

  /* ── Timer ── */
  useEffect(() => {
    if (!session || timeLeft <= 0) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleSubmit(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [session])

  /* ── Tab/visibility proctoring ── */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('tab_switch', 'Student switched tab or minimized window')
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  /* ── Face proctoring ── */
  const handleFaceStatus = useCallback((status: FaceStatus) => {
    setFaceStatus(status)
    if (status === 'multiple') {
      logViolation('multiple_faces', 'Multiple faces detected in camera')
      setShowProctoringAlert(true)
      setTimeout(() => setShowProctoringAlert(false), 4000)
    } else if (status === 'no_face') {
      logViolation('no_face', 'No face detected — student may have left camera')
      setShowProctoringAlert(true)
      setTimeout(() => setShowProctoringAlert(false), 3000)
    } else if (status === 'looking_away') {
      logViolation('looking_away', 'Candidate looking away from screen')
      setShowProctoringAlert(true)
      setTimeout(() => setShowProctoringAlert(false), 3000)
    }
  }, [])

  const logViolation = useCallback(async (type: string, msg: string, metadata?: { duration_seconds?: number; exitCount?: number }) => {
    violationRef.current++
    setViolationCount(violationRef.current)
    setViolationMsg(msg)
    setShowViolationModal(true)
    setTimeout(() => setShowViolationModal(false), 3000)

    // Capture low-res snapshot thumbnail for audit evidence
    let snapshotThumb: string | null = null
    try {
      const videoEl = document.querySelector('video')
      if (videoEl && videoEl.videoWidth > 0) {
        const snapCanvas = document.createElement('canvas')
        snapCanvas.width = 160
        snapCanvas.height = 120
        const ctx = snapCanvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(videoEl, 0, 0, 160, 120)
          snapshotThumb = snapCanvas.toDataURL('image/jpeg', 0.5)
        }
      }
    } catch { /* ignore capture error */ }

    // Broadcast over Realtime WebSocket for instant sub-100ms invigilator alert
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: 'broadcast',
        event: 'student_violation',
        payload: {
          hallTicket,
          eventType: type,
          message: msg,
          violationCount: violationRef.current,
          snapshotThumb,
          metadata,
          timestamp: Date.now(),
        },
      })
    }

    try {
      await axios.post(`${BASE}/api/exam-code/${examCode}/violation`, {
        candidateId: session?.candidateId || hallTicket,
        examCode,
        violationType: type,
        notes: msg,
        snapshot_thumb: snapshotThumb,
        duration_seconds: metadata?.duration_seconds,
        exitCount: metadata?.exitCount,
      })
    } catch { /* non-blocking */ }

    if (violationRef.current >= 5) {
      handleSubmit()
    }
  }, [session, examCode, hallTicket, handleSubmit])

  /* ── 1.1 Fullscreen Enforcement Listener ── */
  const handleReturnToFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      }
      setShowFullscreenOverlay(false)
    } catch {
      /* Handled */
    }
  }, [])

  useEffect(() => {
    if (!session || submitting) return

    // Auto-request fullscreen if consent already given
    if (!document.fullscreenElement && consentGiven) {
      document.documentElement.requestFullscreen().catch(() => {})
    }

    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement
      if (!isFs && !submitting) {
        exitTimestampRef.current = Date.now()
        fullscreenExitCountRef.current += 1
        const count = fullscreenExitCountRef.current
        setFullscreenExitCount(count)
        setShowFullscreenOverlay(true)

        logViolation('fullscreen_exit', `Candidate exited fullscreen mode (Strike ${count}/3)`, {
          exitCount: count,
        })

        if (count >= 3) {
          setTimeout(() => {
            setShowFullscreenOverlay(false)
            handleSubmit()
          }, 800)
        }
      } else if (isFs) {
        if (exitTimestampRef.current) {
          const durationSec = Math.max(1, Math.round((Date.now() - exitTimestampRef.current) / 1000))
          exitTimestampRef.current = null
          logViolation('fullscreen_restored', `Fullscreen restored after ${durationSec}s outside test window`, {
            duration_seconds: durationSec,
          })
        }
        setShowFullscreenOverlay(false)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [session, submitting, consentGiven, logViolation, handleSubmit])

  /* ── 1.2 Screen Share Proctoring ── */
  const [screenShareActive, setScreenShareActive] = useState(false)
  const [showScreenWarning, setShowScreenWarning] = useState(false)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const screenCaptureIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      })
      screenStreamRef.current = stream
      setScreenShareActive(true)
      setShowScreenWarning(false)

      const track = stream.getVideoTracks()[0]
      if (track) {
        track.onended = () => {
          setScreenShareActive(false)
          setShowScreenWarning(true)
          logViolation('screen_share_stopped', 'Candidate stopped sharing screen')
        }
      }
    } catch {
      setScreenShareActive(false)
      setShowScreenWarning(true)
      logViolation('screen_share_denied', 'Candidate refused or closed screen share dialog')
    }
  }, [logViolation])

  // Periodic 30-second screen capture to server & realtime channel
  useEffect(() => {
    if (!screenShareActive || !examCode || !hallTicket) return

    screenCaptureIntervalRef.current = setInterval(() => {
      try {
        const stream = screenStreamRef.current
        if (!stream || !stream.active) return
        const videoTrack = stream.getVideoTracks()[0]
        if (!videoTrack) return

        const offscreenVideo = document.createElement('video')
        offscreenVideo.srcObject = stream
        offscreenVideo.muted = true
        offscreenVideo.play().then(() => {
          const canvas = document.createElement('canvas')
          canvas.width = 240
          canvas.height = 135
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(offscreenVideo, 0, 0, 240, 135)
            const thumb = canvas.toDataURL('image/jpeg', 0.45)
            axios.post(`${BASE}/api/exam-code/${examCode}/screen-thumbnail`, {
              examCode,
              candidateId: hallTicket,
              thumbnail: thumb,
              timestamp: new Date().toISOString(),
            }).catch(() => {})

            if (realtimeChannelRef.current) {
              realtimeChannelRef.current.send({
                type: 'broadcast',
                event: 'screen_thumbnail',
                payload: { hallTicket, thumbnail: thumb, timestamp: Date.now() },
              })
            }
          }
          offscreenVideo.pause()
          offscreenVideo.srcObject = null
        }).catch(() => {})
      } catch {
        /* Non-blocking capture */
      }
    }, 30000)

    return () => {
      if (screenCaptureIntervalRef.current) clearInterval(screenCaptureIntervalRef.current)
    }
  }, [screenShareActive, examCode, hallTicket])

  /* ── Helpers ── */
  const currentQuestion = session?.questions[currentQ]
  const answeredCount = Object.keys(answers).length + Object.keys(codeAnswers).length

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  const timerPct = session ? timeLeft / session.duration : 1
  const timerStatus = timerPct > 0.6 ? 'ok' : timerPct > 0.3 ? 'warning' : 'critical'
  const timerColor = timerStatus === 'ok' ? '#10B981' : timerStatus === 'warning' ? '#F59E0B' : '#EF4444'

  const handleAnswer = (optionIdx: number) => {
    if (!currentQuestion) return
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: optionIdx }))
  }

  const handleCodeAnswer = (code: string) => {
    if (!currentQuestion) return
    setCodeAnswers(prev => ({ ...prev, [currentQuestion.id]: code }))
  }

  const handleRunCode = async () => {
    if (!currentQuestion) return
    const code = codeAnswers[currentQuestion.id] || ''
    if (!code.trim()) return
    setRunning(true)
    setRunResult(null)
    try {
      const { data } = await axios.post(`${BASE}/api/execute`, {
        language: 'python',
        code,
        testCases: [],
      })
      setRunResult({ output: data.output || data.stdout || 'No output', error: data.stderr })
    } catch (e) {
      setRunResult({ output: '', error: e instanceof Error ? e.message : 'Execution failed' })
    } finally {
      setRunning(false)
    }
  }

  const toggleFlag = () => {
    if (!currentQuestion) return
    setFlagged(prev => {
      const next = new Set(prev)
      next.has(currentQuestion.id) ? next.delete(currentQuestion.id) : next.add(currentQuestion.id)
      return next
    })
  }

  /* ── Render states ── */
  if (loading) return (
    <div className="page-center">
      <HoloScan color="#2B7FFF">
        <div style={{ padding: '48px 64px', textAlign: 'center' }}>
          <div className="btn-spinner" style={{ width: 32, height: 32, margin: '0 auto 16px', borderTopColor: '#2B7FFF' }} />
          <div style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)' }}>
            Loading Exam<TypingDots />
          </div>
        </div>
      </HoloScan>
    </div>
  )

  if (error) return (
    <div className="page-center">
      <div className="card" style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Exam Load Error</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>{error}</p>
        <MagneticButton className="btn btn-primary" onClick={() => navigate('/enter-exam')}>
          Try Again
        </MagneticButton>
      </div>
    </div>
  )

  if (!session || !currentQuestion) return null

  const isCode = currentQuestion.type === 'code'
  const answered = isCode ? !!codeAnswers[currentQuestion.id] : answers[currentQuestion.id] !== undefined
  const isFlagged = flagged.has(currentQuestion.id)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.06 }}>
        <FlightPathLines color="#2B7FFF" opacity={1} count={8} className="" />
      </div>

      {/* ─── EXAM HEADER ─── */}
      <div className="exam-header" style={{ zIndex: 100 }}>
        {/* Left: Exam info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <BrandLogo size="xs" variant="mark" />
          <div>
            <div className="exam-title">{session.examName}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', marginTop: 2 }}>
              {hallTicket} • {answeredCount}/{session.questions.length} answered
            </div>
          </div>
        </div>

        {/* Center: Timer */}
        <motion.div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 20px',
            background: 'rgba(20,28,47,0.8)',
            border: `1px solid ${timerColor}40`,
            borderRadius: 'var(--radius-lg)',
            boxShadow: `0 0 16px ${timerColor}20`,
            transition: 'all 0.5s ease',
          }}
          animate={timerStatus === 'critical' ? {
            boxShadow: [`0 0 16px ${timerColor}20`, `0 0 32px ${timerColor}40`, `0 0 16px ${timerColor}20`],
          } : {}}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          <Suspense fallback={<div className="btn-spinner" style={{ width: 44, height: 44, borderTopColor: timerColor }} />}>
            <CircularProgress3D
              timeLeft={timeLeft}
              totalTime={session?.duration || 3600}
            />
          </Suspense>
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.5rem', fontWeight: 800,
              color: timerColor, letterSpacing: '0.04em',
              lineHeight: 1,
            }}>
              {formatTime(timeLeft)}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Remaining
            </div>
          </div>
        </motion.div>

        {/* Right: FaceMeshOrb + Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <MagneticButton
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSubmitModal(true)}
          >
            Submit Exam
          </MagneticButton>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 28 }}>
            {session?.proctoringMode !== 'webcam' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 999,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  background: screenShareActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${screenShareActive ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                  color: screenShareActive ? '#10B981' : '#EF4444',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{screenShareActive ? '🖥️ Screen Live' : '⚠️ Screen Off'}</span>
              </div>
            )}
            <Suspense fallback={
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(43,127,255,0.1)', border: '2px solid rgba(43,127,255,0.2)' }} />
            }>
              <FaceMeshOrb onStatusChange={handleFaceStatus} size={52} />
            </Suspense>
          </div>
        </div>
      </div>

      {/* ─── VIOLATION BANNER ─── */}
      <AnimatePresence>
        {showViolationModal && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            style={{
              position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
              zIndex: 200, background: 'rgba(239,68,68,0.95)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(239,68,68,0.5)', borderRadius: 'var(--radius-md)',
              padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: '0 0 32px rgba(239,68,68,0.3)',
              maxWidth: 480, fontSize: '0.9rem', fontWeight: 600, color: '#fff',
            }}
          >
            ⚠️ VIOLATION #{violationCount}: {violationMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── PROCTORING ALERT ─── */}
      <AnimatePresence>
        {showProctoringAlert && (
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            style={{
              position: 'fixed', top: 120, right: 24, zIndex: 200,
              background: faceStatus === 'multiple' ? 'rgba(239,68,68,0.9)' : 'rgba(245,158,11,0.9)',
              borderRadius: 'var(--radius-md)', padding: '10px 16px',
              fontSize: '0.85rem', fontWeight: 600, color: '#fff',
              boxShadow: '0 0 20px rgba(239,68,68,0.3)',
            }}
          >
            {faceStatus === 'multiple' ? '🚨 Multiple faces detected!' : '⚠️ Face not visible!'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── LIVE INVIGILATOR WARNING OVERLAY ─── */}
      <AnimatePresence>
        {showAdminWarning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            style={{
              position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
              zIndex: 300, maxWidth: 540, width: '90%',
              background: 'rgba(239,68,68,0.98)', backdropFilter: 'blur(16px)',
              border: '2px solid #fff', borderRadius: 'var(--radius-lg)',
              padding: '16px 24px', boxShadow: '0 0 40px rgba(239,68,68,0.7)',
              color: '#fff', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>🚨 PROCTOR NOTICE</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 8 }}>
              {adminWarningMsg}
            </div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9, marginBottom: 12 }}>
              Your session is being monitored in real time. Continued infractions will result in immediate disqualification.
            </div>
            <MagneticButton
              className="btn btn-sm"
              style={{ background: '#fff', color: '#EF4444', fontWeight: 800 }}
              onClick={() => setShowAdminWarning(false)}
            >
              ✓ I Understand & Acknowledge
            </MagneticButton>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ─── MAIN CONTENT ─── */}
      <div style={{
        flex: 1, position: 'relative', zIndex: 1,
        display: 'grid',
        gridTemplateColumns: isCode ? '1fr 1fr' : '1fr 320px',
        gap: 16, padding: '16px 20px', maxWidth: 1400, margin: '0 auto', width: '100%',
      }}>

        {/* ── Left Column: Question Content ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <QuestionMorph
            question={currentQuestion}
            questionIndex={currentQ}
            selectedOption={typeof answers[currentQuestion.id] === 'number' ? answers[currentQuestion.id] as number : null}
            onOptionSelect={handleAnswer}
          />

          {/* When in MCQ mode, navigation sits in Left Column */}
          {!isCode && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
              <MagneticButton
                className="btn btn-secondary"
                disabled={currentQ === 0}
                onClick={() => setCurrentQ(q => q - 1)}
              >
                ← Previous
              </MagneticButton>
              <div style={{ display: 'flex', gap: 8 }}>
                <MagneticButton
                  className={`btn ${isFlagged ? 'btn-warning' : 'btn-ghost'}`}
                  style={{ color: isFlagged ? '#F59E0B' : undefined }}
                  onClick={toggleFlag}
                >
                  {isFlagged ? '🚩 Flagged' : '⚑ Flag'}
                </MagneticButton>
                {currentQ < session.questions.length - 1 ? (
                  <MagneticButton
                    className="btn btn-primary"
                    onClick={() => setCurrentQ(q => q + 1)}
                  >
                    Next →
                  </MagneticButton>
                ) : (
                  <MagneticButton
                    className="btn btn-success"
                    onClick={() => setShowSubmitModal(true)}
                  >
                    Submit Exam 🏁
                  </MagneticButton>
                )}
              </div>
            </div>
          )}

          {/* In Coding mode: Palette is under question on left */}
          {isCode && (
            <div className="glow-card" style={{ padding: 14, marginTop: 'auto' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Question Palette
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {session.questions.map((q, i) => {
                  const isAns  = q.type === 'code' ? !!codeAnswers[q.id] : answers[q.id] !== undefined
                  const isFlag = flagged.has(q.id)
                  const isCurr = i === currentQ
                  return (
                    <button
                      key={q.id}
                      className={`q-nav-btn ${isCurr ? 'current' : isAns ? 'answered' : isFlag ? 'flagged' : ''}`}
                      onClick={() => setCurrentQ(i)}
                      style={{ width: 28, height: 28, fontSize: '0.72rem' }}
                    >
                      {isFlag ? '⚑' : i + 1}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column: Code Editor (in Code Mode) OR Question Palette (in MCQ Mode) ── */}
        {isCode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CodeEditorHolo
              value={codeAnswers[currentQuestion.id] || ''}
              onChange={handleCodeAnswer}
              height={440}
              questionId={String(currentQuestion.id)}
              testCases={currentQuestion.test_cases || []}
              onRunComplete={result => {
                setRunResult({ output: result.output, error: result.stderr })
                if (result.passed && result.passed > 0) {
                  // Mark as answered
                  handleCodeAnswer(codeAnswers[currentQuestion.id] || '')
                }
              }}
            />

            {/* Navigation for coding mode */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <MagneticButton
                className="btn btn-secondary"
                disabled={currentQ === 0}
                onClick={() => setCurrentQ(q => q - 1)}
              >
                ← Previous
              </MagneticButton>
              <div style={{ display: 'flex', gap: 8 }}>
                <MagneticButton
                  className={`btn ${isFlagged ? 'btn-warning' : 'btn-ghost'}`}
                  style={{ color: isFlagged ? '#F59E0B' : undefined }}
                  onClick={toggleFlag}
                >
                  {isFlagged ? '🚩 Flagged' : '⚑ Flag'}
                </MagneticButton>
                {currentQ < session.questions.length - 1 ? (
                  <MagneticButton
                    className="btn btn-primary"
                    onClick={() => setCurrentQ(q => q + 1)}
                  >
                    Next Question →
                  </MagneticButton>
                ) : (
                  <MagneticButton
                    className="btn btn-success"
                    onClick={() => setShowSubmitModal(true)}
                  >
                    Submit Exam 🏁
                  </MagneticButton>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Right Column in MCQ Mode: Palette & Stats */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="glow-card" style={{ padding: 16 }}>
            <h4 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.82rem', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--color-text-muted)', marginBottom: 12,
            }}>
              Question Palette
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {session.questions.map((q, i) => {
                const isAns  = q.type === 'code' ? !!codeAnswers[q.id] : answers[q.id] !== undefined
                const isFlag = flagged.has(q.id)
                const isCurr = i === currentQ

                return (
                  <motion.button
                    key={q.id}
                    className={`q-nav-btn ${isCurr ? 'current' : isAns ? 'answered' : isFlag ? 'flagged' : ''}`}
                    onClick={() => setCurrentQ(i)}
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.95 }}
                    title={`Q${i+1}${isFlag?' (Flagged)':''}`}
                  >
                    {isFlag ? '⚑' : i + 1}
                  </motion.button>
                )
              })}
            </div>

            {/* Legend */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { color: 'var(--color-primary)', label: 'Current' },
                { color: 'var(--color-success)', label: 'Answered' },
                { color: 'var(--color-warning)', label: 'Flagged' },
                { color: 'var(--color-border)', label: 'Not visited' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Exam stats */}
          <div className="glow-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Total Qs', value: session.questions.length },
                { label: 'Answered',  value: answeredCount, color: 'var(--color-success)' },
                { label: 'Flagged',   value: flagged.size,  color: 'var(--color-warning)' },
                { label: 'Remaining', value: session.questions.length - answeredCount, color: 'var(--color-text-muted)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--color-text-faint)' }}>{label}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: color || 'var(--color-text)' }}>
                    {value}
                  </span>
                </div>
              ))}
              <div className="progress-bar-wrap" style={{ marginTop: 4 }}>
                <div
                  className="progress-bar-fill"
                  style={{ width: `${(answeredCount / session.questions.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Violation counter */}
          {violationCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glow-card"
              style={{ padding: 16, borderColor: 'rgba(239,68,68,0.3)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{violationCount} Violation{violationCount > 1 ? 's' : ''}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)' }}>5 will auto-submit</div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
      </div>

      {/* ─── SUBMIT MODAL ─── */}
      <AnimatePresence>
        {showSubmitModal && (
          <div className="modal-overlay" onClick={() => setShowSubmitModal(false)}>
            <motion.div
              className="modal modal-warning"
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{ opacity: 0,  scale: 0.92, y: 24 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-icon">🏁</div>
              <div className="modal-title">Submit Exam?</div>
              <div className="modal-message">
                You've answered {answeredCount} of {session.questions.length} questions.
                {flagged.size > 0 && ` ${flagged.size} question${flagged.size > 1 ? 's are' : ' is'} flagged for review.`}
                <br /><br />
                <strong>This action cannot be undone.</strong>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <MagneticButton
                  className="btn btn-ghost w-full"
                  onClick={() => setShowSubmitModal(false)}
                >
                  Continue Exam
                </MagneticButton>
                <MagneticButton
                  className="btn btn-success w-full"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? <><span className="btn-spinner" /> Submitting</> : '✓ Confirm Submit'}
                </MagneticButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── PROCTORING PRIVACY & CAMERA CONSENT MODAL ─── */}
      <ProctoringConsentModal
        isOpen={!consentGiven}
        onConsent={() => {
          setConsentGiven(true);
          sessionStorage.setItem(`lw_camera_consented_${examCode}`, 'true');
          document.documentElement.requestFullscreen().catch(() => {});
          const mode = session?.proctoringMode || 'dual';
          if (mode === 'screen' || mode === 'dual') {
            startScreenShare();
          }
        }}
        examName={session?.examName || examCode}
      />

      {/* ─── FULLSCREEN ENFORCEMENT OVERLAY (1.1) ─── */}
      <FullscreenEnforcementOverlay
        isOpen={showFullscreenOverlay}
        exitCount={fullscreenExitCount}
        maxExits={3}
        countdownSeconds={10}
        onReturnToFullscreen={handleReturnToFullscreen}
        onTimeoutSubmit={() => {
          setShowFullscreenOverlay(false);
          logViolation('excessive_fullscreen_exits', 'Exam auto-submitted: 10s fullscreen return countdown expired');
          handleSubmit();
        }}
      />

      {/* ─── SCREEN SHARE WARNING OVERLAY (1.2) ─── */}
      <ScreenShareWarningOverlay
        isOpen={showScreenWarning}
        onReconnect={startScreenShare}
      />
    </div>
  )
}
