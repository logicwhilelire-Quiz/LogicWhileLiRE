import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { supabase } from '../lib/supabaseClient'
import ExamQuestionCard from '../components/exam/ExamQuestionCard'
import ExamCodeEditor from '../components/exam/ExamCodeEditor'
import ExamFaceMonitor from '../components/exam/ExamFaceMonitor'
import ExamTimerProgress from '../components/exam/ExamTimerProgress'
import ProctoringConsentModal from '../components/ProctoringConsentModal'
import BrandLogo from '../components/BrandLogo'
import LogicWhileLiRELoader from '../components/LogicWhileLiRELoader'
import FullscreenEnforcementOverlay from '../components/exam/FullscreenEnforcementOverlay'
import ScreenShareWarningOverlay from '../components/exam/ScreenShareWarningOverlay'
import { useAudioProctor } from '../hooks/useAudioProctor'
import {
  bufferAnswer,
  getPendingAnswers,
  getAllCachedAnswers,
  markAnswersSynced,
  clearAnswerBuffer,
} from '../lib/offlineAnswerStore'
import AntiLeakWatermark from '../components/AntiLeakWatermark'
import HoloScratchpadModal from '../components/HoloScratchpadModal'
import HoloProctorDeskModal, { type ProctorCommsMessage } from '../components/HoloProctorDeskModal'
import { soundFx } from '../lib/synthAudio'

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
  endTimeMs?: number
}

type FaceStatus = 'ok' | 'no_face' | 'multiple' | 'looking_away' | 'loading'

const BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function QuizPage() {
  const { examCode } = useParams<{ examCode: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const stateHt = (location.state as { hallTicket?: string } | null)?.hallTicket
  const storedHt = (() => {
    try {
      const raw = localStorage.getItem('logicwhilelire_attempt') || localStorage.getItem('growthran_attempt') || localStorage.getItem('lw_attempt') || '{}'
      return JSON.parse(raw)?.hallTicket
    } catch { return '' }
  })()
  const hallTicket: string = stateHt || storedHt || ''

  // Sprint 2 item 3: read server_start_time from router state (set by WaitingLobbyPage on EXAM_STARTED)
  // This is the single source of truth for computing correct remaining time for late joiners.
  const routerServerStartTime: number | undefined = (location.state as any)?.serverStartTime
  const routerDurationSeconds: number | undefined = (location.state as any)?.durationSeconds

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

  /* ── Inspector Remote Actions & Integrity State ── */
  const [broadcastBanner, setBroadcastBanner] = useState('')
  const [whisperNotice, setWhisperNotice] = useState<{ message: string; inspectorName?: string } | null>(null)
  const [isExamPaused, setIsExamPaused] = useState(false)
  const isExamPausedRef = useRef(false)
  const [timeExtensionNotice, setTimeExtensionNotice] = useState('')
  const [securityBlockNotice, setSecurityBlockNotice] = useState('')
  const [showScratchpad, setShowScratchpad] = useState(false)
  const [showProctorDesk, setShowProctorDesk] = useState(false)
  const [proctorCommsLog, setProctorCommsLog] = useState<ProctorCommsMessage[]>([])
  const [unreadCommsCount, setUnreadCommsCount] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)

  /* ── 1.4 Offline Resilience & Sync Queue ── */
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [showReconnectedAlert, setShowReconnectedAlert] = useState(false)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)

  const syncPendingAnswers = useCallback(async () => {
    if (!examCode || !hallTicket || !navigator.onLine) return
    try {
      const pending = await getPendingAnswers(examCode, hallTicket)
      if (pending.length === 0) {
        setPendingSyncCount(0)
        return
      }
      setPendingSyncCount(pending.length)
      const items = pending.map(p => ({
        question_id: p.questionId,
        answer: p.answer,
        type: p.type,
      }))
      const { data } = await axios.post(`${BASE}/api/exam-code/${examCode}/save-answer`, {
        examCode,
        candidateId: hallTicket,
        items,
      })
      if (data?.success) {
        await markAnswersSynced(pending.map(p => p.id))
        setPendingSyncCount(0)
      }
    } catch (err: any) {
      if (err?.response?.data?.code === 'SESSION_EVICTED' || (err?.response?.status === 409 && err?.response?.data?.error?.includes('device'))) {
        alert('Your exam session was opened on another device/tab. This session has been terminated.')
        navigate('/enter-exam')
        return
      }
      console.warn('[SyncQueue] Sync deferred:', err)
    }
  }, [examCode, hallTicket, navigate])

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
        const proctoringMode: 'webcam' | 'screen' | 'dual' = exam?.proctoring_mode || 'webcam'
        setSession({
          candidateId: data.candidateId || hallTicket,
          examName: exam?.exam_name || exam?.name || 'Exam',
          totalMarks: exam?.total_marks || 100,
          duration: (exam?.duration_minutes || 60) * 60,
          questions,
          proctoringMode,
          endTimeMs: exam?.end_time ? new Date(exam.end_time).getTime() : undefined,
        })

        // Sprint 2 item 3: compute correct remaining time from server_start_time.
        // Priority order:
        //   1. router state serverStartTime (set by WaitingLobbyPage from EXAM_STARTED)
        //   2. server-returned end_time (written by POST /start endpoint)
        //   3. full duration_minutes (fallback for exams not yet started via push-to-start)
        let initialTimeLeft: number
        const fullDuration = (exam?.duration_minutes || 60) * 60

        if (routerServerStartTime && routerDurationSeconds) {
          // Most accurate: router state populated by WaitingLobbyPage's EXAM_STARTED handler
          const elapsed = Math.floor((Date.now() - routerServerStartTime) / 1000)
          initialTimeLeft = Math.max(0, routerDurationSeconds - elapsed)
        } else if (exam?.end_time) {
          // Second source: server wrote end_time when POST /start was called
          const serverEndMs = new Date(exam.end_time).getTime()
          initialTimeLeft = Math.max(0, Math.floor((serverEndMs - Date.now()) / 1000))
        } else {
          // Fallback: exam hasn't been started via push-to-start yet, use full duration
          initialTimeLeft = fullDuration
        }
        setTimeLeft(initialTimeLeft)

        // ── 1.4 Offline answer restoration ──
        try {
          const cached = await getAllCachedAnswers(examCode, hallTicket)
          const restoredAnswers: Record<string, number | string> = {}
          const restoredCode: Record<string, string> = {}

          try {
            const { data: resumeData } = await axios.get(`${BASE}/api/exam-code/${examCode}/resume-state`, {
              params: { candidateId: hallTicket }
            })
            if (resumeData?.partial_answers) {
              for (const [qid, val] of Object.entries(resumeData.partial_answers)) {
                restoredAnswers[qid] = val as string
              }
            }
          } catch {}

          for (const [qid, entry] of Object.entries(cached)) {
            if (entry.type === 'code') {
              restoredCode[qid] = String(entry.answer)
            } else {
              restoredAnswers[qid] = entry.answer
            }
          }

          if (Object.keys(restoredAnswers).length > 0) setAnswers(prev => ({ ...prev, ...restoredAnswers }))
          if (Object.keys(restoredCode).length > 0) setCodeAnswers(prev => ({ ...prev, ...restoredCode }))
        } catch (restoreErr) {
          console.warn('[OfflineDB] Could not restore cached answers:', restoreErr)
        }
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
      try {
        await syncPendingAnswers()
      } catch {}
      const payload = {
        sessionId: sessionIdRef.current,
        examCode,
        hallTicket,
        answers: { ...answers },
        codeAnswers: { ...codeAnswers },
      }
      const { data } = await axios.post(`${BASE}/api/exam-code/${examCode}/submit`, payload)
      if (examCode && hallTicket) {
        await clearAnswerBuffer(examCode, hallTicket)
      }

      // Dispatch official confirmation receipt email to candidate
      const candidateEmail = sessionStorage.getItem('lw_candidate_email') ||
        sessionStorage.getItem('email') ||
        `${hallTicket.toLowerCase()}@logicwhilelire.internal`
      const candidateName = sessionStorage.getItem('lw_candidate_name') ||
        sessionStorage.getItem('name') ||
        hallTicket

      axios.post(`${BASE}/api/v1/inspector/send-receipt`, {
        examCode,
        candidateName,
        candidateEmail,
        hallTicket,
        score: data?.score || 0,
        totalMarks: data?.totalMarks || 100,
        questionsAttempted: Object.keys(answers).length + Object.keys(codeAnswers).length,
      }).catch(() => {})

      soundFx.playExamSubmittedFanfare()
      navigate(`/result-ec/${examCode}`, { state: { result: data, hallTicket } })
    } catch {
      navigate(`/result-ec/${examCode}`, { state: { hallTicket, error: true } })
    }
  }, [submitting, examCode, hallTicket, answers, codeAnswers, navigate, syncPendingAnswers])

  /* ── 1.4 Background Sync & Network Listeners ── */
  useEffect(() => {
    if (!session || submitting) return
    const syncInterval = setInterval(() => {
      syncPendingAnswers()
    }, 5000)
    return () => clearInterval(syncInterval)
  }, [session, submitting, syncPendingAnswers])

  useEffect(() => {
    const onOnline = () => {
      setIsOffline(false)
      syncPendingAnswers().then(() => {
        setShowReconnectedAlert(true)
        setTimeout(() => setShowReconnectedAlert(false), 3500)
      })
    }
    const onOffline = () => {
      setIsOffline(true)
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [syncPendingAnswers])

  /* ── Forensic Violation Logger & Anomaly Telemetry ── */
  const logViolation = useCallback(async (type: string, msg: string, metadata?: { duration_seconds?: number; exitCount?: number; peak_db?: number }) => {
    violationRef.current++
    setViolationCount(violationRef.current)
    setViolationMsg(msg)
    setShowViolationModal(true)
    soundFx.playSecurityAlertTone()
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
        peak_db: metadata?.peak_db,
      })
    } catch { /* non-blocking */ }

    if (violationRef.current >= 5) {
      handleSubmit()
    }
  }, [session, examCode, hallTicket, handleSubmit])

  /* ── Supabase Realtime Telemetry Broadcast & Inspector Remote Controls ── */
  useEffect(() => {
    if (!examCode || !hallTicket) return

    const channel = supabase.channel(`realtime:monitor-${examCode}`)

    channel
      .on('broadcast', { event: 'admin_warning' }, payload => {
        const data = payload.payload as { hallTicket?: string; message?: string }
        if (!data?.hallTicket || data.hallTicket === hallTicket) {
          setAdminWarningMsg(data?.message || 'Proctor Warning: Unusual activity detected on your terminal.')
          setShowAdminWarning(true)
          soundFx.playSecurityAlertTone()
          setTimeout(() => setShowAdminWarning(false), 6000)
        }
      })
      .on('broadcast', { event: 'admin_terminate' }, payload => {
        const data = payload.payload as { hallTicket?: string }
        if (!data?.hallTicket || data.hallTicket === hallTicket) {
          handleSubmit()
        }
      })
      .on('broadcast', { event: 'admin_broadcast' }, payload => {
        const data = payload.payload as { message?: string }
        if (data?.message) {
          setBroadcastBanner(data.message)
          soundFx.playProctorBroadcastChime()
          setProctorCommsLog(prev => [{
            id: `bc-${Date.now()}`,
            type: 'broadcast',
            title: 'Room Announcement',
            message: data.message || '',
            timestamp: new Date().toISOString(),
          }, ...prev])
          setUnreadCommsCount(prev => prev + 1)
          setTimeout(() => setBroadcastBanner(''), 12000)
        }
      })
      .on('broadcast', { event: 'admin_message' }, payload => {
        const data = payload.payload as { hallTicket?: string; message?: string; inspectorName?: string }
        if (!data?.hallTicket || data.hallTicket === hallTicket) {
          if (data?.message) {
            setWhisperNotice({ message: data.message, inspectorName: data.inspectorName || 'Exam Invigilator' })
            soundFx.playProctorBroadcastChime()
            setProctorCommsLog(prev => [{
              id: `wh-${Date.now()}`,
              type: 'whisper',
              title: `Direct Notice from ${data.inspectorName || 'Exam Invigilator'}`,
              message: data.message || '',
              timestamp: new Date().toISOString(),
            }, ...prev])
            setUnreadCommsCount(prev => prev + 1)
          }
        }
      })
      .on('broadcast', { event: 'admin_pause' }, payload => {
        const data = payload.payload as { hallTicket?: string }
        if (!data?.hallTicket || data.hallTicket === hallTicket) {
          setIsExamPaused(true)
          isExamPausedRef.current = true
        }
      })
      .on('broadcast', { event: 'admin_resume' }, payload => {
        const data = payload.payload as { hallTicket?: string }
        if (!data?.hallTicket || data.hallTicket === hallTicket) {
          setIsExamPaused(false)
          isExamPausedRef.current = false
        }
      })
      .on('broadcast', { event: 'admin_extend_time' }, payload => {
        const data = payload.payload as { hallTicket?: string; seconds?: number }
        if (!data?.hallTicket || data.hallTicket === hallTicket) {
          const addSecs = data?.seconds || 300
          setTimeLeft(prev => prev + addSecs)
          setTimeExtensionNotice(`⏱️ +${Math.round(addSecs / 60)} minutes extended by Exam Invigilator!`)
          soundFx.playTimeExtensionChime()
          setProctorCommsLog(prev => [{
            id: `ex-${Date.now()}`,
            type: 'extension',
            title: `Time Extension Granted (+${Math.round(addSecs / 60)} mins)`,
            message: `The invigilator granted an extra ${Math.round(addSecs / 60)} minutes to your session.`,
            timestamp: new Date().toISOString(),
          }, ...prev])
          setUnreadCommsCount(prev => prev + 1)
          setTimeout(() => setTimeExtensionNotice(''), 6000)
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
  }, [examCode, hallTicket, currentQ, answers, codeAnswers, handleSubmit])

  /* ── Timer (Sprint 2, Item 2 & 3: Server-authoritative countdown) ── */
  useEffect(() => {
    if (!session) return
    timerRef.current = setInterval(() => {
      if (isExamPausedRef.current) return // Timer freezes while exam is paused by inspector!
      setTimeLeft(prev => {
        let rem: number
        if (routerServerStartTime && routerDurationSeconds) {
          // Continuous sync against server start time: immune to background tab throttling
          const elapsed = Math.floor((Date.now() - routerServerStartTime) / 1000)
          rem = Math.max(0, routerDurationSeconds - elapsed)
        } else if (session.endTimeMs) {
          // Continuous sync against server end_time from DB
          rem = Math.max(0, Math.floor((session.endTimeMs - Date.now()) / 1000))
        } else {
          rem = Math.max(0, prev - 1)
        }

        if (rem <= 0) {
          handleSubmit()
          return 0
        }
        return rem
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [session, routerServerStartTime, routerDurationSeconds, handleSubmit])

  /* ── Tab/visibility proctoring & Inspector Anomaly Reporting ── */
  useEffect(() => {
    if (!session || submitting) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('tab_switch', 'Candidate switched browser tab or minimized window')
        axios.post(`${BASE}/api/v1/inspector/report-issue`, {
          examCode,
          hallTicket,
          candidateName: session?.candidateId || hallTicket,
          issueType: 'tab_switch',
          severity: 'high',
          description: `Candidate tab switch detected at ${new Date().toLocaleTimeString()}`,
        }).catch(() => {})
      }
    }

    const handleWindowBlur = () => {
      if (!document.fullscreenElement && !submitting) {
        logViolation('window_blur', 'Exam terminal lost active focus')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [session, submitting, logViolation, examCode, hallTicket])

  /* ── Keyboard, Context Menu & Clipboard Integrity Lockdown ── */
  useEffect(() => {
    if (!session || submitting) return

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      setSecurityBlockNotice('🛡️ Right-click context menu is restricted during examination')
      setTimeout(() => setSecurityBlockNotice(''), 3000)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // DevTools F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault()
        logViolation('devtools_attempt', 'Candidate pressed F12 DevTools key')
        setSecurityBlockNotice('🛡️ Developer inspection tools are strictly restricted')
        setTimeout(() => setSecurityBlockNotice(''), 3000)
        return
      }

      // DevTools Ctrl+Shift+I / J / C
      if (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
        e.preventDefault()
        logViolation('devtools_attempt', 'Candidate pressed Ctrl+Shift+I/J/C DevTools shortcut')
        setSecurityBlockNotice('🛡️ Developer inspection tools are strictly restricted')
        setTimeout(() => setSecurityBlockNotice(''), 3000)
        return
      }

      // Ctrl+U (View Source)
      if (e.ctrlKey && ['u', 'U'].includes(e.key)) {
        e.preventDefault()
        setSecurityBlockNotice('🛡️ Page source inspection is restricted')
        setTimeout(() => setSecurityBlockNotice(''), 3000)
        return
      }

      // Ctrl+P (Print)
      if (e.ctrlKey && ['p', 'P'].includes(e.key)) {
        e.preventDefault()
        setSecurityBlockNotice('🛡️ Printing is disabled during exam')
        setTimeout(() => setSecurityBlockNotice(''), 3000)
        return
      }
    }

    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInsideCodeEditor = target?.closest('.monaco-editor') || target?.closest('textarea.code-input')
      if (!isInsideCodeEditor) {
        e.preventDefault()
        setSecurityBlockNotice('🛡️ Copying question text is restricted by Exam Proctor')
        setTimeout(() => setSecurityBlockNotice(''), 3000)
        logViolation('unauthorized_copy', 'Candidate attempted to copy question content')
      }
    }

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('copy', handleCopy)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('copy', handleCopy)
    }
  }, [session, submitting, logViolation])

  /* ── Face proctoring ── */
  const handleFaceStatus = useCallback((status: FaceStatus) => {
    setTimeout(() => {
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
    }, 0)
  }, [logViolation])

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

  /* ── 1.3 Audio Proctoring ── */
  const [showAudioWarning, setShowAudioWarning] = useState(false)
  const [lastAudioSpikeDb, setLastAudioSpikeDb] = useState(0)

  const handleAudioSpike = useCallback((peakDb: number) => {
    setLastAudioSpikeDb(peakDb)
    logViolation('audio_spike', `Audio spike detected: ${peakDb} dB`, {
      peak_db: peakDb,
    })
    setShowAudioWarning(true)
    setTimeout(() => setShowAudioWarning(false), 3500)
  }, [logViolation])

  const { isListening: isAudioListening } = useAudioProctor({
    enabled: consentGiven && !submitting,
    thresholdDb: -24,
    cooldownMs: 8000,
    onAudioSpike: handleAudioSpike,
  })

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
    if (examCode && hallTicket) {
      bufferAnswer(examCode, hallTicket, currentQuestion.id, optionIdx, 'mcq')
    }
  }

  const handleCodeAnswer = (code: string) => {
    if (!currentQuestion) return
    setCodeAnswers(prev => ({ ...prev, [currentQuestion.id]: code }))
    if (examCode && hallTicket) {
      bufferAnswer(examCode, hallTicket, currentQuestion.id, code, 'code')
    }
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

  const getSectorForQuestion = (q: ExamQuestion | undefined, idx: number) => {
    if (!q) return { name: 'Sector 1 · Quant Velocity', color: '#38BDF8' }
    if (q.topic) {
      const t = q.topic.toLowerCase()
      if (t.includes('quant') || t.includes('math') || t.includes('number') || t.includes('arithmetic')) return { name: 'Sector 1 · Quant Velocity', color: '#38BDF8' }
      if (t.includes('logic') || t.includes('reason') || t.includes('deduct') || t.includes('syllogism')) return { name: 'Sector 2 · Deductive Logic', color: '#818CF8' }
      if (t.includes('os') || t.includes('system') || t.includes('dbms') || t.includes('network') || t.includes('core')) return { name: 'Sector 3 · Core CS & Systems', color: '#34D399' }
      if (t.includes('dsa') || t.includes('tree') || t.includes('graph') || t.includes('algo') || t.includes('array')) return { name: 'Sector 4 · Algorithms & DSA', color: '#F472B6' }
      if (t.includes('web') || t.includes('react') || t.includes('node') || t.includes('distribut') || t.includes('stack')) return { name: 'Sector 5 · Full-Stack Arch', color: '#FBBF24' }
    }
    const defaultSectors = [
      { name: 'Sector 1 · Quantitative Aptitude', color: '#38BDF8' },
      { name: 'Sector 2 · Deductive Logic', color: '#818CF8' },
      { name: 'Sector 3 · Core CS & Systems', color: '#34D399' },
      { name: 'Sector 4 · Data Structures & DSA', color: '#F472B6' },
      { name: 'Sector 5 · Full-Stack Arch', color: '#FBBF24' },
    ]
    return defaultSectors[idx % 5]
  }

  /* ── Render states ── */
  if (loading) return (
    <div className="page-center" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LogicWhileLiRELoader size="lg" message="Loading secure LogicWhileLiRE exam session & question manifest..." />
    </div>
  )

  if (error) return (
    <div className="page-center">
      <div className="card" style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Exam Load Error</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/enter-exam')}>
          Try Again
        </button>
      </div>
    </div>
  )

  if (!session || !currentQuestion) return null

  const isCode = currentQuestion.type === 'code'
  const answered = isCode ? !!codeAnswers[currentQuestion.id] : answers[currentQuestion.id] !== undefined
  const isFlagged = flagged.has(currentQuestion.id)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Subtle Focus Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.03, backgroundImage: 'radial-gradient(circle, #2B7FFF 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

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
          <ExamTimerProgress
            timeLeft={timeLeft}
            totalTime={session?.duration || 3600}
          />
          <div>
            <div
              id="quiz-timer-display"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.5rem', fontWeight: 800,
                color: timerColor, letterSpacing: '0.04em',
                lineHeight: 1,
              }}
            >
              {formatTime(timeLeft)}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Remaining
            </div>
          </div>
        </motion.div>

        {/* Right: Proctor Monitor + Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Scratchpad & Sound Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowScratchpad(true)}
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38BDF8',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Open In-Exam Secure Scratchpad & Calculation Canvas"
            >
              <span>📝</span>
              <span>Scratchpad</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowProctorDesk(true)
                setUnreadCommsCount(0)
              }}
              style={{
                background: unreadCommsCount > 0 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                border: unreadCommsCount > 0 ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.15)',
                color: unreadCommsCount > 0 ? '#38BDF8' : 'var(--color-text-muted)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                position: 'relative',
              }}
              title="Open Proctor Communication Desk & AI Sentinel Enclave"
            >
              <span>💬</span>
              <span>Invigilator Desk</span>
              {unreadCommsCount > 0 && (
                <span
                  style={{
                    background: '#EF4444',
                    color: '#FFF',
                    borderRadius: 10,
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    padding: '1px 5px',
                  }}
                >
                  {unreadCommsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled
                setSoundEnabled(next)
                soundFx.setEnabled(next)
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: soundEnabled ? '#34D399' : 'var(--color-text-faint)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
              title={soundEnabled ? 'Mute Proctor Chimes' : 'Unmute Proctor Chimes'}
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
          </div>

          <button
            id="open-submit-modal-btn"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSubmitModal(true)}
          >
            Submit Exam
          </button>

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
            {isAudioListening && (
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
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  color: '#60A5FA',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>🎙️ Mic Guard</span>
              </div>
            )}
            {isOffline ? (
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
                  background: 'rgba(234, 88, 12, 0.15)',
                  border: '1px solid rgba(234, 88, 12, 0.4)',
                  color: '#FB923C',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>📡 Offline (Buffered)</span>
              </div>
            ) : pendingSyncCount > 0 ? (
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
                  background: 'rgba(168, 85, 247, 0.15)',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  color: '#C084FC',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>🔄 Syncing ({pendingSyncCount})</span>
              </div>
            ) : null}
            <ExamFaceMonitor onStatusChange={handleFaceStatus} size={52} />
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

      {/* ─── AUDIO SPIKE ALERT ─── */}
      <AnimatePresence>
        {showAudioWarning && (
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            style={{
              position: 'fixed', top: 168, right: 24, zIndex: 200,
              background: 'rgba(234, 88, 12, 0.95)',
              backdropFilter: 'blur(8px)',
              borderRadius: 'var(--radius-md)', padding: '10px 16px',
              fontSize: '0.85rem', fontWeight: 600, color: '#fff',
              boxShadow: '0 0 20px rgba(234, 88, 12, 0.4)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span>🎙️ Audio spike detected ({lastAudioSpikeDb} dB)! Please maintain silence.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── OFFLINE RESILIENCE BANNER ─── */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)',
              zIndex: 350, maxWidth: 540, width: '92%',
              background: 'rgba(234, 88, 12, 0.98)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(254, 215, 170, 0.6)', borderRadius: 'var(--radius-md)',
              padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 8px 32px rgba(234, 88, 12, 0.4)',
              color: '#fff', fontSize: '0.88rem', fontWeight: 600,
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 800 }}>Network Disconnected</div>
              <div style={{ fontSize: '0.78rem', opacity: 0.95 }}>
                Your answers are safely buffered locally. Do not close or refresh this tab.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── RECONNECTED BANNER ─── */}
      <AnimatePresence>
        {showReconnectedAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)',
              zIndex: 350,
              background: 'rgba(16, 185, 129, 0.96)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(167, 243, 208, 0.6)', borderRadius: 'var(--radius-md)',
              padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 8px 32px rgba(16, 185, 129, 0.35)',
              color: '#fff', fontSize: '0.86rem', fontWeight: 700,
            }}
          >
            <span>✅ Reconnected. All local answers synchronized with server.</span>
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
            <button
              className="btn btn-sm"
              style={{ background: '#fff', color: '#EF4444', fontWeight: 800 }}
              onClick={() => setShowAdminWarning(false)}
            >
              ✓ I Understand & Acknowledge
            </button>
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
          <ExamQuestionCard
            question={currentQuestion}
            questionIndex={currentQ}
            selectedOption={typeof answers[currentQuestion.id] === 'number' ? answers[currentQuestion.id] as number : null}
            onOptionSelect={handleAnswer}
            sector={getSectorForQuestion(currentQuestion, currentQ)}
          />

          {/* When in MCQ mode, navigation sits in Left Column */}
          {!isCode && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
              <button
                className="btn btn-secondary"
                disabled={currentQ === 0}
                onClick={() => setCurrentQ(q => q - 1)}
              >
                ← Previous
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn ${isFlagged ? 'btn-warning' : 'btn-ghost'}`}
                  style={{ color: isFlagged ? '#F59E0B' : undefined }}
                  onClick={toggleFlag}
                >
                  {isFlagged ? '🚩 Flagged' : '⚑ Flag'}
                </button>
                {currentQ < session.questions.length - 1 ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => setCurrentQ(q => q + 1)}
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    className="btn btn-success"
                    onClick={() => setShowSubmitModal(true)}
                  >
                    Submit Exam 🏁
                  </button>
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
            <ExamCodeEditor
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
              <button
                className="btn btn-secondary"
                disabled={currentQ === 0}
                onClick={() => setCurrentQ(q => q - 1)}
              >
                ← Previous
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn ${isFlagged ? 'btn-warning' : 'btn-ghost'}`}
                  style={{ color: isFlagged ? '#F59E0B' : undefined }}
                  onClick={toggleFlag}
                >
                  {isFlagged ? '🚩 Flagged' : '⚑ Flag'}
                </button>
                {currentQ < session.questions.length - 1 ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => setCurrentQ(q => q + 1)}
                  >
                    Next Question →
                  </button>
                ) : (
                  <button
                    className="btn btn-success"
                    onClick={() => setShowSubmitModal(true)}
                  >
                    Submit Exam 🏁
                  </button>
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
                <button
                  className="btn btn-ghost w-full"
                  onClick={() => setShowSubmitModal(false)}
                >
                  Continue Exam
                </button>
                <button
                  id="confirm-submit-exam-btn"
                  className="btn btn-success w-full"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? <><span className="btn-spinner" /> Submitting</> : '✓ Confirm Submit'}
                </button>
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
          const mode = session?.proctoringMode || 'webcam';
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

      {/* ─── INSPECTOR BROADCAST BANNER ─── */}
      <AnimatePresence>
        {broadcastBanner && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
              background: 'linear-gradient(90deg, #1E3A8A, #2563EB, #1D4ED8)',
              color: '#FFFFFF', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 4px 20px rgba(37,99,235,0.4)', borderBottom: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '1.4rem' }}>📢</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.9 }}>
                  Exam Invigilator Official Announcement
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>{broadcastBanner}</div>
              </div>
            </div>
            <button
              onClick={() => setBroadcastBanner('')}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFF', borderRadius: 4, padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── EXAM PAUSED OVERLAY ─── */}
      <AnimatePresence>
        {isExamPaused && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 10001,
            background: 'rgba(7, 13, 24, 0.94)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                maxWidth: 480, textAlign: 'center', background: '#0B1120',
                border: '1px solid rgba(245, 158, 11, 0.5)', borderRadius: 16, padding: 32,
                boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(245,158,11,0.2)',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>⏸️</div>
              <h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 8px', color: '#FBBF24', fontSize: '1.4rem' }}>
                Examination Paused by Proctor
              </h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: 1.5, margin: '0 0 20px' }}>
                The exam inspector has paused your session. Your questions and timer are frozen. Please remain seated and keep your webcam streaming until the proctor resumes your examination.
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '0.78rem', color: '#FCD34D' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                Awaiting Invigilator Action...
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── WHISPER DIRECT NOTICE MODAL ─── */}
      <AnimatePresence>
        {whisperNotice && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 10002,
            background: 'rgba(5, 7, 15, 0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              style={{
                maxWidth: 480, width: '100%', background: '#0F172A',
                border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: 16, padding: 24,
                boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: '1.6rem' }}>💬</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#60A5FA' }}>
                    Official Notice from {whisperNotice.inspectorName || 'Exam Proctor'}
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)' }}>Direct Candidate Communication</span>
                </div>
              </div>
              <div style={{
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: 16, fontSize: '0.88rem', color: 'var(--color-text)',
                marginBottom: 20, lineHeight: 1.5,
              }}>
                "{whisperNotice.message}"
              </div>
              <button
                className="btn btn-primary w-full"
                onClick={() => setWhisperNotice(null)}
              >
                ✓ I Acknowledge & Understand
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── TIME EXTENSION TOAST ─── */}
      <AnimatePresence>
        {timeExtensionNotice && (
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            style={{
              position: 'fixed', top: 72, right: 24, zIndex: 9999,
              background: '#064E3B', border: '1px solid #10B981', color: '#A7F3D0',
              padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: '0.84rem',
              boxShadow: '0 10px 30px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span>⏱️</span>
            <span>{timeExtensionNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SECURITY BLOCK TOAST ─── */}
      <AnimatePresence>
        {securityBlockNotice && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
              background: '#7F1D1D', border: '1px solid #EF4444', color: '#FECACA',
              padding: '10px 20px', borderRadius: 30, fontWeight: 700, fontSize: '0.82rem',
              boxShadow: '0 10px 30px rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span>🛡️</span>
            <span>{securityBlockNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── DYNAMIC ANTI-LEAK SECURITY WATERMARK ─── */}
      <AntiLeakWatermark
        hallTicket={hallTicket}
        candidateName={session?.candidateId}
        examCode={examCode}
      />

      {/* ─── IN-EXAM SECURE SCRATCHPAD MODAL ─── */}
      <HoloScratchpadModal
        isOpen={showScratchpad}
        onClose={() => setShowScratchpad(false)}
        examCode={examCode || 'EXAM'}
      />

      {/* ─── INVIGILATOR DESK & AI SENTINEL MODAL ─── */}
      <HoloProctorDeskModal
        isOpen={showProctorDesk}
        onClose={() => setShowProctorDesk(false)}
        examCode={examCode || 'EXAM'}
        hallTicket={hallTicket}
        candidateName={session?.candidateId}
        commsLog={proctorCommsLog}
      />
    </div>
  )
}
