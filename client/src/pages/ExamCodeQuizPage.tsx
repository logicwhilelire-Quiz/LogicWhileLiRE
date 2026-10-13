import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { io as connectSocket, Socket } from 'socket.io-client'
import { API_BASE_URL, SOCKET_URL } from '../lib/config'
import { supabase } from '../lib/supabaseClient'
import ExamQuestionCard from '../components/exam/ExamQuestionCard'
import ExamCodeEditor from '../components/exam/ExamCodeEditor'
import ExamFaceMonitor from '../components/exam/ExamFaceMonitor'
import ExamTimerProgress from '../components/exam/ExamTimerProgress'
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
  starter_code?: string
  code?: string
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
  violationThreshold?: number
}

type FaceStatus = 'ok' | 'no_face' | 'multiple' | 'looking_away' | 'loading'

const BASE = API_BASE_URL

const ALLOWED_MCQ_KEYS = new Set([
  'Tab', 'Space', 'Enter', ' ',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  '1', '2', '3', '4',
  'Backspace',
])

function shuffleForStudent<T>(array: T[], seed: string): T[] {
  let s = 0
  for (let i = 0; i < seed.length; i++) {
    s = (s * 31 + seed.charCodeAt(i)) >>> 0
  }
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

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
  const [isInWaitingList, setIsInWaitingList] = useState(false)
  const [waitingExamData, setWaitingExamData] = useState<{
    exam_name?: string
    duration_minutes?: number
    total_questions?: number
  }>({})
  const [waitingLaunchStarting, setWaitingLaunchStarting] = useState(false)
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
  const [consentGiven, setConsentGiven] = useState(true)
  const [adminWarningMsg, setAdminWarningMsg] = useState('')
  const [showAdminWarning, setShowAdminWarning] = useState(false)
  const [runResult, setRunResult] = useState<{ output: string; error?: string } | null>(null)
  const [running, setRunning] = useState(false)
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false)
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0)
  const fullscreenExitCountRef = useRef(0)
  const exitTimestampRef = useRef<number | null>(null)
  const violationRef = useRef(0)

  /* ── Strict Integrity Auto-Termination State ── */
  const [isTerminated, setIsTerminated] = useState(false)
  const [terminationReason, setTerminationReason] = useState('')
  const isTerminatedRef = useRef(false)
  const hasTerminatedRef = useRef(false)
  const altMetaWarningCountRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const sessionIdRef = useRef<string | undefined>(undefined)
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  /* ── Inspector Remote Actions & Integrity State ── */
  const [broadcastBanner, setBroadcastBanner] = useState('')
  const [whisperNotice, setWhisperNotice] = useState<{ message: string; inspectorName?: string } | null>(null)
  const [isExamPaused, setIsExamPaused] = useState(false)
  const isExamPausedRef = useRef(false)
  const [proctorDeskDefaultTab, setProctorDeskDefaultTab] = useState<'comms' | 'raise_hand' | 'telemetry'>('comms')
  const [isRetryingSubmit, setIsRetryingSubmit] = useState(false)
  const [submitRetryCount, setSubmitRetryCount] = useState(0)
  const [submitNetworkErrorNotice, setSubmitNetworkErrorNotice] = useState('')
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
  const init = useCallback(async () => {
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
          starter_code: (q.starter_code || q.code) as string | undefined,
          code: (q.code || q.starter_code) as string | undefined,
          test_cases: (q.test_cases as ExamQuestion['test_cases']) || [],
        }))

        // If the server has already deterministically shuffled questions and options for this candidate,
        // use them directly to guarantee 100% accurate option key evaluation mapping!
        const isServerShuffled = Boolean(data.server_shuffled || data.questions_shuffled)
        const randomizedQuestions: ExamQuestion[] = isServerShuffled
          ? questions
          : questions.map(q => {
              if (q.options && q.options.length > 1 && q.type !== 'code') {
                return {
                  ...q,
                  options: shuffleForStudent(q.options, `${hallTicket}_${q.id}_opts`),
                }
              }
              return q
            })

        sessionIdRef.current = data.sessionId || data.session_id
        const proctoringMode: 'webcam' | 'screen' | 'dual' = exam?.proctoring_mode || 'webcam'
        const fullDuration = (exam?.duration_minutes || 60) * 60
        let initialTimeLeft: number

        if (routerServerStartTime && routerDurationSeconds) {
          // Accurate: router state populated by WaitingLobbyPage from EXAM_STARTED
          const elapsed = Math.floor((Date.now() - routerServerStartTime) / 1000)
          initialTimeLeft = Math.max(0, routerDurationSeconds - elapsed)
        } else if (exam?.started_at) {
          // Started by inspector via POST /start
          const startedAtMs = new Date(exam.started_at).getTime()
          const elapsed = Math.floor((Date.now() - startedAtMs) / 1000)
          initialTimeLeft = Math.max(0, fullDuration - elapsed)
        } else {
          // Standard full duration for this exam attempt (e.g. 30 or 60 min)
          initialTimeLeft = fullDuration
        }

        const computedEndTimeMs = Date.now() + (initialTimeLeft * 1000)

        setSession({
          candidateId: data.candidateId || hallTicket,
          examName: exam?.exam_name || exam?.name || 'Exam',
          totalMarks: exam?.total_marks || 100,
          duration: fullDuration,
          questions: randomizedQuestions,
          proctoringMode,
          endTimeMs: computedEndTimeMs,
          violationThreshold: Number(exam?.max_violations) || Number(exam?.violation_threshold) || 2,
        })

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
        if (examCode?.toUpperCase().includes('DEMO')) {
          const demoQuestions: ExamQuestion[] = [
            {
              id: 'demo-q1',
              text: 'In an autonomous flight calculation, a thruster consumes 1,200 kg of fuel at 40 kg/s. What is the total burn duration?',
              options: ['20 seconds', '30 seconds', '40 seconds', '48 seconds'],
              type: 'mcq',
              marks: 5,
              difficulty: 'Easy',
              topic: 'Sector 1: Quantitative Velocity',
            },
            {
              id: 'demo-q2',
              text: 'A train 150m long passes a signal pole in 15 seconds. What is the speed of the train in km/h?',
              options: ['36 km/h', '40 km/h', '45 km/h', '54 km/h'],
              type: 'mcq',
              marks: 5,
              difficulty: 'Medium',
              topic: 'Sector 1: Quantitative Velocity',
            },
            {
              id: 'demo-q3',
              text: 'In the LogicWhile cipher matrix, if "LOGIC" is encoded as "MQHKE", how is "WHILE" encoded under alternating +1 and +2 letter shifts?',
              options: ['XIKMG', 'XJKMH', 'WJIMG', 'YKLOI'],
              type: 'mcq',
              marks: 5,
              difficulty: 'Easy',
              topic: 'Sector 2: Deductive Logic',
            },
            {
              id: 'demo-q4',
              text: 'Statements: (1) All compilers are parsers. (2) All parsers are state machines. Conclusion: Are all compilers state machines?',
              options: ['Definitely True', 'Definitely False', 'Probably True', 'Cannot be determined'],
              type: 'mcq',
              marks: 5,
              difficulty: 'Easy',
              topic: 'Sector 2: Deductive Logic',
            },
            {
              id: 'demo-q5',
              text: 'Which memory management replacement policy suffers from Belady\'s Anomaly (increasing frame count can increase page faults)?',
              options: ['Optimal (OPT)', 'Least Recently Used (LRU)', 'First In First Out (FIFO)', 'Least Frequently Used (LFU)'],
              type: 'mcq',
              marks: 5,
              difficulty: 'Medium',
              topic: 'Sector 3: Core Computer Science',
            },
            {
              id: 'demo-q6',
              text: 'Which of the following is NOT an essential condition for Deadlock to occur in an operating system?',
              options: ['Mutual Exclusion', 'Hold and Wait', 'Preemption Allowed', 'Circular Wait'],
              type: 'mcq',
              marks: 5,
              difficulty: 'Medium',
              topic: 'Sector 3: Core Computer Science',
            },
            {
              id: 'demo-q7',
              text: 'In the TCP 3-way handshake, what is the exact sequence of flags transmitted between client and server?',
              options: ['SYN -> ACK -> SYN-ACK', 'SYN -> SYN-ACK -> ACK', 'ACK -> SYN -> ACK', 'FIN -> ACK -> FIN-ACK'],
              type: 'mcq',
              marks: 5,
              difficulty: 'Easy',
              topic: 'Sector 3: Core Computer Science',
            },
            {
              id: 'demo-q8',
              text: 'What is the tightest worst-case asymptotic time complexity of searching in a Balanced Binary Search Tree (AVL / Red-Black) with N nodes?',
              options: ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)'],
              type: 'mcq',
              marks: 5,
              difficulty: 'Easy',
              topic: 'Sector 4: Data Structures & Algorithms',
            },
            {
              id: 'demo-q9',
              text: 'Which data structure is fundamentally utilized in Breadth-First Search (BFS) graph traversal?',
              options: ['Stack', 'Queue', 'Priority Heap', 'Segment Tree'],
              type: 'mcq',
              marks: 5,
              difficulty: 'Easy',
              topic: 'Sector 4: Data Structures & Algorithms',
            },
            {
              id: 'demo-q10',
              text: 'In Node.js asynchronous architecture, which phase of the Libuv event loop executes callbacks scheduled by process.nextTick()?',
              options: ['Timers phase', 'Poll phase', 'Immediately after current operation before event loop continues', 'Check phase'],
              type: 'mcq',
              marks: 5,
              difficulty: 'Medium',
              topic: 'Sector 5: Full-Stack Architecture',
            },
            {
              id: 'demo-q11',
              text: 'In distributed system architecture, what does the CAP Theorem state a system can guarantee simultaneously in the presence of network partitions?',
              options: ['Both Consistency and Availability', 'Either Consistency or Availability, but not both', 'Latency and Partition Tolerance', 'All three: Consistency, Availability, Partition Tolerance'],
              type: 'mcq',
              marks: 5,
              difficulty: 'Medium',
              topic: 'Sector 5: Full-Stack Architecture',
            },
            {
              id: 'demo-q12',
              text: 'Which HTTP header is utilized by WebSocket protocol to upgrade an HTTP connection to a full-duplex TCP socket?',
              options: ['Connection: Upgrade & Upgrade: websocket', 'Transfer-Encoding: chunked', 'Content-Type: application/websocket', 'X-Socket-Protocol: 1.0'],
              type: 'mcq',
              marks: 5,
              difficulty: 'Easy',
              topic: 'Sector 5: Full-Stack Architecture',
            },
            {
              id: 'demo-q13',
              text: 'In modern relational database indexing, why are B+ Trees favored over standard Binary Search Trees for disk storage?',
              options: ['High fanout reduces disk I/O depth and leaf nodes form contiguous linked list for range scans', 'B+ Trees use less RAM', 'Binary trees cannot store strings', 'B+ Trees do not require locking'],
              type: 'mcq',
              marks: 5,
              difficulty: 'Medium',
              topic: 'Sector 3: Core Computer Science',
            },
            {
              id: 'demo-code-01',
              text: '⚡ LIVE CODING SANDBOX 1: Two Sum Vector Verification\n\nGiven integer N, followed by N space-separated integers, and target integer T, write a program that prints "True" if any two distinct elements sum to T, otherwise "False".\n\nInput:\n5\n2 7 11 15 20\n9\n\nExpected Output:\nTrue',
              type: 'code',
              marks: 15,
              difficulty: 'Medium',
              topic: 'Sector 4: Data Structures & Algorithms',
              test_cases: [
                { id: 'tc-1', input_text: "5\n2 7 11 15 20\n9", expected_output: "True", is_hidden: false, marks: 5 },
                { id: 'tc-2', input_text: "4\n1 2 3 9\n8", expected_output: "False", is_hidden: false, marks: 5 },
                { id: 'tc-3', input_text: "6\n-3 4 3 90 2 1\n0", expected_output: "True", is_hidden: true, marks: 5 },
              ],
            },
            {
              id: 'demo-code-02',
              text: '⚡ LIVE CODING SANDBOX 2: Operating Systems FIFO Page Faults\n\nGiven capacity K on line 1 and page requests on line 2, compute and output total FIFO page faults.\n\nInput:\n3\n7 0 1 2 0 3 0 4 2 3 0 3 2\n\nExpected Output:\n12',
              type: 'code',
              marks: 20,
              difficulty: 'Hard',
              topic: 'Sector 3: Core Computer Science',
              test_cases: [
                { id: 'tc-1', input_text: "3\n7 0 1 2 0 3 0 4 2 3 0 3 2", expected_output: "12", is_hidden: false, marks: 10 },
                { id: 'tc-2', input_text: "4\n1 2 3 4 1 2 5 1 2 3 4 5", expected_output: "10", is_hidden: false, marks: 10 },
              ],
            },
          ]
          const randomizedDemo = shuffleForStudent(demoQuestions, `${hallTicket}_q_demo`).map(q => {
            if (q.options && q.options.length > 1 && q.type !== 'code') {
              return {
                ...q,
                options: shuffleForStudent(q.options, `${hallTicket}_${q.id}_opts`),
              }
            }
            return q
          })
          setSession({
            candidateId: hallTicket || '2201A0501',
            examName: 'LogicWhileLiRE 4.0 - National Engineering Qualifier (Demo)',
            totalMarks: 100,
            duration: 3600,
            questions: randomizedDemo,
            proctoringMode: 'webcam',
          })
          setTimeLeft(3600)
          setIsInWaitingList(false)
          setError('')
          return
        }

        const isNotStarted =
          (e as any)?.response?.data?.code === 'EXAM_NOT_STARTED_BY_INSPECTOR' ||
          (e as any)?.response?.data?.waiting_list === true ||
          (e as any)?.response?.data?.error?.toLowerCase().includes('not started') ||
          (e as any)?.response?.data?.error?.toLowerCase().includes('waiting lobby')

        if (isNotStarted) {
          setIsInWaitingList(true)
          setWaitingExamData({
            exam_name: (e as any)?.response?.data?.exam_name || examCode,
            duration_minutes: (e as any)?.response?.data?.duration_minutes || 60,
            total_questions: (e as any)?.response?.data?.total_questions || 15,
          })
          setError('')
          return
        }

        setError(e instanceof Error ? e.message : 'Failed to load exam')
      } finally {
        setLoading(false)
      }
  }, [examCode, hallTicket, navigate, routerServerStartTime, routerDurationSeconds])

  useEffect(() => {
    init()
  }, [init])

  /* ── Waiting List Real-time Listener (Single Page Flow) ── */
  useEffect(() => {
    if (!isInWaitingList || !examCode) return

    let socket: Socket | null = null
    let pollInterval: ReturnType<typeof setInterval> | null = null
    let bc: BroadcastChannel | null = null
    let hasLaunched = false

    const triggerLaunch = () => {
      if (hasLaunched) return
      hasLaunched = true
      setWaitingLaunchStarting(true)
      try { soundFx.playProctorBroadcastChime() } catch {}
      setTimeout(() => {
        setIsInWaitingList(false)
        setWaitingLaunchStarting(false)
        init()
      }, 1000)
    }

    try {
      socket = connectSocket(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
      })

      socket.on('connect', () => {
        socket?.emit('join_lobby', { examCode: examCode.toUpperCase(), hallTicket })
        socket?.emit('join_room', `lobby:${examCode.toUpperCase()}`)
      })

      socket.on('EXAM_STARTED', () => {
        triggerLaunch()
      })

      socket.on('lobby:stats', (data: any) => {
        if (data?.exam_started) triggerLaunch()
      })
    } catch {}

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('logicwhilelire_admin_exam_commands')
        bc.onmessage = (ev) => {
          if (
            (ev.data?.examCode?.toUpperCase() === examCode.toUpperCase() || ev.data?.examCode === 'DEMO123') &&
            ev.data?.state === 'started'
          ) {
            triggerLaunch()
          }
        }
      } catch {}
    }

    const checkStorage = () => {
      const state =
        localStorage.getItem(`admin_exam_state_${examCode}`) ||
        localStorage.getItem(`admin_exam_state_${examCode.toUpperCase()}`)
      if (state === 'started') triggerLaunch()
    }
    window.addEventListener('storage', checkStorage)
    checkStorage()

    pollInterval = setInterval(async () => {
      try {
        const { data } = await axios.get(`${BASE}/api/exam-code/${examCode}/start`, {
          params: { hallTicket }
        })
        if (data && data.success) {
          triggerLaunch()
        }
      } catch {}
    }, 2500)

    return () => {
      if (socket) socket.disconnect()
      if (bc) bc.close()
      if (pollInterval) clearInterval(pollInterval)
      window.removeEventListener('storage', checkStorage)
    }
  }, [isInWaitingList, examCode, hallTicket, init])

  /* ── Submit Handler with Network Drop Retry Queue ── */
  const handleSubmit = useCallback(async () => {
    if (submitting && !isRetryingSubmit) return
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

      // Retry queue with backoff if network drops
      let attempt = 0
      const maxRetries = 5
      let submitSuccess = false
      let responseData: any = null

      while (attempt < maxRetries && !submitSuccess) {
        try {
          if (attempt > 0) {
            setIsRetryingSubmit(true)
            setSubmitRetryCount(attempt)
            setSubmitNetworkErrorNotice(`Network interruption detected. Answers safely buffered locally. Retrying submission (Attempt ${attempt}/${maxRetries})...`)
          }
          const { data } = await axios.post(`${BASE}/api/exam-code/${examCode}/submit`, payload, {
            timeout: 10000,
          })
          responseData = data
          submitSuccess = true
          setIsRetryingSubmit(false)
          setSubmitNetworkErrorNotice('')
        } catch (postErr: any) {
          attempt++
          if (attempt >= maxRetries) {
            if (examCode?.toUpperCase().includes('DEMO')) {
              const mcqCount = Object.keys(answers).length
              const codeCount = Object.keys(codeAnswers).length
              const calcScore = Math.min(100, Math.max(76, mcqCount * 6 + codeCount * 12))
              responseData = {
                score: calcScore,
                totalMarks: 100,
                percentage: calcScore,
                rank: 2,
                totalCandidates: 120,
                timeTaken: 1420,
                correctAnswers: Math.max(1, Math.round(mcqCount * 0.85)),
                wrongAnswers: Math.round(mcqCount * 0.15),
                unanswered: Math.max(0, 13 - mcqCount),
                topicBreakdown: {
                  'Quantitative Aptitude': 90,
                  'Logical Reasoning': 88,
                  'Core Computer Science': 82,
                  'Data Structures & Algorithms': 86,
                  'Full-Stack Architecture': 84,
                },
              }
              submitSuccess = true
              setIsRetryingSubmit(false)
              setSubmitNetworkErrorNotice('')
              break
            }
            setIsRetryingSubmit(false)
            setSubmitNetworkErrorNotice(`Connection lost after ${maxRetries} automatic retry attempts. All your answers are 100% safely protected in local offline storage. Please verify your network and click 'Retry Submission Now'.`)
            return
          }
          // Exponential backoff wait (1.5s, 3s, 5s, 8s)
          await new Promise(res => setTimeout(res, Math.min(8000, 1500 * attempt)))
        }
      }

      if (examCode && hallTicket) {
        await clearAnswerBuffer(examCode, hallTicket).catch(() => {})
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
        score: responseData?.score || 0,
        totalMarks: responseData?.totalMarks || 100,
        questionsAttempted: Object.keys(answers).length + Object.keys(codeAnswers).length,
      }).catch(() => {})

      soundFx.playExamSubmittedFanfare()
      const codingQState = (session?.questions || [])
        .filter(q => q.type === 'code')
        .map(q => ({
          id: q.id,
          title: q.text,
          marks: q.marks,
          submitted: Boolean(codeAnswers[q.id] && codeAnswers[q.id].trim().length > 0),
        }))

      navigate(`/result-ec/${examCode}`, {
        state: {
          result: responseData,
          hallTicket,
          codeAnswers,
          codingQuestions: codingQState,
        },
      })
    } catch {
      navigate(`/result-ec/${examCode}`, { state: { hallTicket, error: true } })
    }
  }, [submitting, isRetryingSubmit, examCode, hallTicket, answers, codeAnswers, session, navigate, syncPendingAnswers])

  /* ── Strict Integrity Auto-Termination Handler ── */
  const handleForceTermination = useCallback(async (reason: string) => {
    if (hasTerminatedRef.current || submitting) return
    hasTerminatedRef.current = true
    setIsTerminated(true)
    setTerminationReason(reason)

    if (timerRef.current) clearInterval(timerRef.current)
    soundFx.playSecurityAlertTone()

    // 1. Send immediate Realtime broadcast for invigilator alert
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: 'broadcast',
        event: 'student_violation',
        payload: {
          hallTicket,
          eventType: 'EXAM_FORCE_TERMINATED_BREACH',
          message: reason,
          violationCount: (violationRef.current || 0) + 1,
          timestamp: Date.now(),
        },
      })
    }

    // 2. Beacon/Post violation
    const violationPayload = JSON.stringify({
      candidateId: hallTicket,
      examCode,
      violationType: 'EXAM_FORCE_TERMINATED_BREACH',
      notes: reason,
      is_terminated: true,
      auto_submitted: true,
    })
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${BASE}/api/exam-code/${examCode}/violation`, new Blob([violationPayload], { type: 'application/json' }))
    } else {
      axios.post(`${BASE}/api/exam-code/${examCode}/violation`, JSON.parse(violationPayload)).catch(() => {})
    }

    // 3. Log critical security incident to inspector console
    try {
      await axios.post(`${BASE}/api/v1/inspector/report-issue`, {
        examCode,
        hallTicket,
        candidateName: session?.candidateId || hallTicket,
        issueType: 'lockdown_auto_termination',
        severity: 'critical',
        description: `EXAM AUTO-TERMINATED: ${reason} at ${new Date().toLocaleTimeString()}`,
      })
    } catch {}

    // 4. Submit attempt with Terminated - violation status
    try {
      await axios.post(`${BASE}/api/exam-code/${examCode}/submit`, {
        sessionId: sessionIdRef.current,
        examCode,
        hallTicket,
        answers: { ...answers },
        codeAnswers: { ...codeAnswers },
        status: 'terminated',
        termination_reason: reason,
      })
      if (examCode && hallTicket) {
        await clearAnswerBuffer(examCode, hallTicket).catch(() => {})
      }
    } catch {}

    // 5. Purge storage (Auto Logout)
    try {
      localStorage.removeItem('logicwhilelire_attempt')
      localStorage.removeItem('growthran_attempt')
      localStorage.removeItem('lw_attempt')
      localStorage.removeItem('student_token')
      localStorage.removeItem('student_user')
      sessionStorage.clear()
    } catch {}
  }, [examCode, hallTicket, session, answers, codeAnswers, submitting])

  /* ── Forensic Violation Logger & Anomaly Telemetry (Two-Strike Strict Lockdown) ── */
  const logViolation = useCallback(async (
    type: string,
    msg: string,
    metadata?: { duration_seconds?: number; exitCount?: number; peak_db?: number; isSevere?: boolean }
  ) => {
    if (hasTerminatedRef.current || isTerminated || submitting) return

    violationRef.current++
    const count = violationRef.current
    setViolationCount(count)

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
          violationCount: count,
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

    const isSevere = metadata?.isSevere === true
    const maxStrikes = session?.violationThreshold || 2

    if (count < maxStrikes && !isSevere) {
      // VIOLATION WARNING: Show reminder to the student
      setSecurityBlockNotice(`⚠️ INTEGRITY REMINDER (Warning ${count} of ${maxStrikes}): ${msg}`)
      setViolationMsg(`Warning ${count} of ${maxStrikes}: ${msg}. Attention: Exceeding ${maxStrikes} violations will immediately auto-terminate your exam and log you out.`)
      setShowViolationModal(true)
      soundFx.playSecurityAlertTone()
      setTimeout(() => setShowViolationModal(false), 5000)
      setTimeout(() => setSecurityBlockNotice(''), 5000)
    } else {
      // REPEAT OR SEVERE VIOLATION: Auto-terminate the exam and log student out
      handleForceTermination(
        isSevere
          ? `Severe security lockdown breach: ${msg}`
          : `Integrity threshold reached (${count}/${maxStrikes} strikes): ${msg}. Exam auto-terminated.`
      )
    }
  }, [session, examCode, hallTicket, isTerminated, submitting, handleForceTermination])

  /* ── Strict Exam Security Listeners (Phase 1 Comprehensive Lockdown) ── */
  useEffect(() => {
    if (!session || isTerminated || submitting) return

    // 1. Detect tab switch / sliding to another tab (Zero tolerance)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation(
          'tab_switch',
          'Tab switch or window sliding detected during examination — zero-tolerance security lockdown triggered',
          { isSevere: true }
        )
      }
    }

    // 2. Detect window blur / sliding away to another app
    const handleWindowBlur = () => {
      logViolation(
        'window_blur',
        'Exam window lost focus (switched applications or desktop window) — zero-tolerance focus policy',
        { isSevere: true }
      )
    }

    // 3. Detect window resize / minimize
    const handleResize = () => {
      if (window.outerWidth < 650 || window.outerHeight < 450) {
        logViolation('window_minimize', 'Exam window was minimized or resized below minimum bounds')
      }
    }

    // 4. Block right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      logViolation('right_click', 'Right-click context menu was attempted')
      return false
    }

    // 5. Block copy / cut / paste
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      logViolation('copy_attempt', 'Copying question content was blocked')
      return false
    }
    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault()
      logViolation('cut_attempt', 'Cutting exam content was blocked')
      return false
    }
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault()
      logViolation('paste_attempt', 'Pasting content into the examination was blocked')
      return false
    }

    // 6. Block text selection outside code editor
    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement | null
      const isInsideCode = target?.closest('textarea, .monaco-editor')
      if (!isInsideCode) {
        e.preventDefault()
      }
    }

    // 7. Block drag & drop
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault()
    }

    // 8. Strict keyboard detector
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable || target.closest('.monaco-editor'))

      // Detect Escape key — immediately terminate exam (zero-tolerance policy)
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        logViolation('escape_key', 'Escape key was pressed during examination — immediate security lockdown triggered', { isSevere: true })
        return
      }

      // Detect F12 and DevTools shortcuts
      const isFKey = e.key.startsWith('F') && e.key.length <= 3 && !isNaN(Number(e.key.slice(1)))
      const isDevToolsCombo = (e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C', 'K', 'i', 'j', 'c', 'k'].includes(e.key)
      const isViewSource = (e.ctrlKey || e.metaKey) && ['u', 'U', 's', 'S'].includes(e.key)
      if (isFKey || isDevToolsCombo || isViewSource) {
        e.preventDefault()
        e.stopPropagation()
        logViolation('devtools_shortcut', `Restricted developer tool shortcut (${e.key}) was pressed`, { isSevere: true })
        return
      }

      // Detect Print shortcut
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        e.stopPropagation()
        logViolation('print_shortcut', 'Print shortcut (Ctrl+P / Cmd+P) was pressed')
        return
      }

      // Detect Screenshot shortcuts
      const isPrintScreen = e.key === 'PrintScreen'
      const isScreenShotCombo = (e.metaKey || e.ctrlKey) && e.shiftKey && ['3', '4', '5', 's', 'S'].includes(e.key)
      if (isPrintScreen || isScreenShotCombo) {
        e.preventDefault()
        e.stopPropagation()
        try { navigator.clipboard?.writeText('') } catch {}
        logViolation('screenshot_shortcut', 'Screenshot capture shortcut was pressed')
        return
      }

      // Browser close / navigation shortcuts
      if ((e.ctrlKey || e.metaKey) && ['w', 'W', 't', 'T', 'n', 'N', 'q', 'Q', 'r', 'R'].includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        logViolation('browser_shortcut', `Restricted browser shortcut (${e.key}) was pressed`)
        return
      }

      // System modifier keys (Alt, Windows/Meta)
      if (e.key === 'Alt' || e.key === 'Meta' || e.code === 'MetaLeft' || e.code === 'MetaRight') {
        e.preventDefault()
        e.stopPropagation()
        logViolation('system_key', `Restricted system key (${e.key}) was pressed`)
        return
      }

      // If user is focused on a valid code/text input: standard typing allowed
      if (isInput) return

      // In MCQ mode: only allowed navigation keys permitted. Any other non-mouse key is a violation.
      if (!ALLOWED_MCQ_KEYS.has(e.key)) {
        e.preventDefault()
        logViolation('unauthorized_key', `Non-mouse key (${e.key}) pressed outside answer input. Only mouse navigation is permitted.`)
        return
      }
    }

    // 9. Fullscreen change detection (ESC exit from fullscreen)
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !hasTerminatedRef.current && !submitting) {
        const newCount = fullscreenExitCountRef.current + 1
        fullscreenExitCountRef.current = newCount
        setFullscreenExitCount(newCount)
        exitTimestampRef.current = Date.now()
        setShowFullscreenOverlay(true)
        logViolation(
          'fullscreen_exit',
          `Candidate exited fullscreen mode (exit #${newCount}) — zero-tolerance fullscreen policy triggered exam shutdown`,
          { exitCount: newCount, isSevere: true }
        )
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('resize', handleResize)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('cut', handleCut)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('selectstart', handleSelectStart)
    document.addEventListener('dragstart', handleDragStart)
    window.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('msfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('cut', handleCut)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('selectstart', handleSelectStart)
      document.removeEventListener('dragstart', handleDragStart)
      window.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('msfullscreenchange', handleFullscreenChange)
    }
  }, [session, isTerminated, submitting, logViolation, fullscreenExitCountRef])


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

  // ── Administrator Command Real-Time Synchronizer (Pause, Resume, Conclude) ──
  useEffect(() => {
    if (!examCode || isTerminated || submitting) return

    const checkAdminState = () => {
      try {
        const state =
          localStorage.getItem(`admin_exam_state_${examCode}`) ||
          localStorage.getItem(`admin_exam_state_${examCode.toUpperCase()}`) ||
          (examCode.toUpperCase().includes('DEMO') ? localStorage.getItem('admin_exam_state_DEMO123') : null)

        if (state === 'paused') {
          if (!isExamPausedRef.current) {
            setIsExamPaused(true)
            isExamPausedRef.current = true
            soundFx.playSecurityAlertTone()
          }
        } else if (state === 'started') {
          if (isExamPausedRef.current) {
            setIsExamPaused(false)
            isExamPausedRef.current = false
          }
        } else if (state === 'stopped') {
          if (!hasTerminatedRef.current && !submitting) {
            hasTerminatedRef.current = true
            setBroadcastBanner('🛑 EXAM CONCLUDED BY CENTRAL COMMAND: Administrator has concluded this assessment session. All answers submitted.')
            handleSubmit()
          }
        }
      } catch {}
    }

    checkAdminState()
    const interval = setInterval(checkAdminState, 1000)

    let bc: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('logicwhilelire_admin_exam_commands')
        bc.onmessage = (e) => {
          if (
            e.data?.examCode?.toUpperCase() === examCode.toUpperCase() ||
            (examCode.toUpperCase().includes('DEMO') && e.data?.examCode === 'DEMO123')
          ) {
            checkAdminState()
          }
        }
      } catch {}
    }

    window.addEventListener('storage', checkAdminState)

    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', checkAdminState)
      bc?.close()
    }
  }, [examCode, isTerminated, submitting, handleSubmit])

  // ── Dual-Layer Continuous Answer Auto-Save Vault ──
  useEffect(() => {
    if (!examCode || !hallTicket) return
    try {
      const backupData = {
        examCode,
        hallTicket,
        answers,
        codeAnswers,
        timestamp: Date.now(),
      }
      localStorage.setItem(`logicwhilelire_exam_backup_${examCode}_${hallTicket}`, JSON.stringify(backupData))
    } catch {}
  }, [examCode, hallTicket, answers, codeAnswers])

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

  const handleReturnToFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      }
      setShowFullscreenOverlay(false)
    } catch {}
  }, [])

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
      if (next.has(currentQuestion.id)) {
        next.delete(currentQuestion.id)
      } else {
        next.add(currentQuestion.id)
      }
      return next
    })
  }

  const getSectorForQuestion = (q: ExamQuestion | undefined, idx: number) => {
    if (!q) return { name: 'Sector 1 · Quant Velocity', color: '#F59E0B' }
    if (q.topic) {
      const t = q.topic.toLowerCase()
      if (t.includes('quant') || t.includes('math') || t.includes('number') || t.includes('arithmetic')) return { name: 'Sector 1 · Quant Velocity', color: '#F59E0B' }
      if (t.includes('logic') || t.includes('reason') || t.includes('deduct') || t.includes('syllogism')) return { name: 'Sector 2 · Deductive Logic', color: '#8B5CF6' }
      if (t.includes('os') || t.includes('system') || t.includes('dbms') || t.includes('network') || t.includes('core')) return { name: 'Sector 3 · Core CS & Systems', color: '#10B981' }
      if (t.includes('dsa') || t.includes('tree') || t.includes('graph') || t.includes('algo') || t.includes('array')) return { name: 'Sector 4 · Algorithms & DSA', color: '#38BDF8' }
      if (t.includes('web') || t.includes('react') || t.includes('node') || t.includes('distribut') || t.includes('stack')) return { name: 'Sector 5 · Full-Stack Arch', color: '#F43F5E' }
    }
    const defaultSectors = [
      { name: 'Sector 1 · Quantitative Aptitude & Velocity', color: '#F59E0B' },
      { name: 'Sector 2 · Deductive Logic & Invariants', color: '#8B5CF6' },
      { name: 'Sector 3 · Core CS & Systems', color: '#10B981' },
      { name: 'Sector 4 · Data Structures & DSA', color: '#38BDF8' },
      { name: 'Sector 5 · Full-Stack & Distributed Arch', color: '#F43F5E' },
    ]
    return defaultSectors[idx % 5]
  }

  /* ── Render states ── */
  if (loading && !isInWaitingList) return (
    <div className="page-center" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LogicWhileLiRELoader size="lg" message="Loading secure LogicWhileLiRE exam session & question manifest..." />
    </div>
  )

  /* ── Examination Waiting List Screen (Single Page Execution) ── */
  if (isInWaitingList) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'radial-gradient(ellipse at top, #0A1128 0%, #030712 100%)',
          color: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans, "Inter", sans-serif)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.04,
            backgroundImage: 'linear-gradient(#38BDF8 1px, transparent 1px), linear-gradient(90deg, #38BDF8 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            pointerEvents: 'none',
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{
            maxWidth: 640,
            width: '100%',
            background: 'rgba(15, 23, 42, 0.88)',
            border: '1px solid rgba(56, 189, 248, 0.28)',
            borderRadius: 20,
            padding: '36px 32px',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 35px rgba(56, 189, 248, 0.12)',
            position: 'relative',
            zIndex: 10,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <BrandLogo size="md" variant="standard" showTagline={false} />
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#34D399',
                fontSize: '0.78rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981' }} />
              <span>TERMINAL READY • IN WAITING LIST</span>
            </div>
          </div>

          {/* Status Alert Banner */}
          <div
            style={{
              background: waitingLaunchStarting ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.08)',
              border: waitingLaunchStarting ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 14,
              padding: '22px 20px',
              textAlign: 'center',
              marginBottom: 24,
              transition: 'all 0.3s ease',
            }}
          >
            <div style={{ fontSize: '2.6rem', marginBottom: 8 }}>
              {waitingLaunchStarting ? '🚀' : '⏳'}
            </div>
            <h2 style={{ fontSize: '1.38rem', fontWeight: 800, color: '#F1F5F9', marginBottom: 6 }}>
              {waitingLaunchStarting
                ? 'Examination Started by Administrator!'
                : 'Waiting for Administrator to Start Exam'}
            </h2>
            <p style={{ fontSize: '0.86rem', color: '#94A3B8', margin: 0, lineHeight: 1.55 }}>
              {waitingLaunchStarting
                ? 'Authorization confirmed. Initializing question manifest and synchronized timer...'
                : 'Your examination terminal is locked and verified in the waiting list. The admin has the option to start the exam from the admin portal. Once launched, this screen will immediately begin your test.'}
            </p>
          </div>

          {/* Details Grid */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.38)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              padding: '18px 20px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginBottom: 24,
              fontSize: '0.84rem',
            }}
          >
            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                Candidate Hall Ticket
              </span>
              <strong style={{ color: '#38BDF8', fontFamily: 'monospace', fontSize: '1.05rem' }}>
                {hallTicket}
              </strong>
            </div>

            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                Exam Code
              </span>
              <strong style={{ color: '#F8FAFC', fontFamily: 'monospace', fontSize: '1.05rem' }}>
                {examCode?.toUpperCase()}
              </strong>
            </div>

            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                Assessment Name
              </span>
              <strong style={{ color: '#E2E8F0' }}>
                {waitingExamData.exam_name || examCode}
              </strong>
            </div>

            <div>
              <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                Duration
              </span>
              <strong style={{ color: '#E2E8F0' }}>
                {waitingExamData.duration_minutes || 60} Minutes
              </strong>
            </div>
          </div>

          {/* Live Sync Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: 10,
              fontSize: '0.78rem',
              color: '#94A3B8',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="btn-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              <span>Real-time channel active • Waiting for admin dispatch...</span>
            </div>
            <span style={{ color: '#38BDF8', fontWeight: 700 }}>
              Live In Waiting List
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

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

  /* ── Strict Integrity Auto-Termination Screen ── */
  if (isTerminated) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: 'radial-gradient(ellipse at center, #1e0b0e 0%, #0a0405 100%)',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'var(--font-sans)',
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            maxWidth: 620,
            width: '100%',
            background: 'rgba(239, 68, 68, 0.06)',
            border: '2px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 0 50px rgba(239, 68, 68, 0.25)',
            borderRadius: 20,
            padding: '40px 32px',
            textAlign: 'center',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🛑</div>
          <span
            style={{
              display: 'inline-block',
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#F87171',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              padding: '4px 14px',
              borderRadius: 9999,
              fontSize: '0.8rem',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            INTEGRITY VIOLATION LOCKDOWN
          </span>
          <h1
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              color: '#ffffff',
              marginBottom: 12,
            }}
          >
            Exam Terminated &amp; Session Shut Down
          </h1>
          <p
            style={{
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: '0.98rem',
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            Your examination terminal has been immediately disqualified and terminated due to an unauthorized action:
          </p>

          <div
            style={{
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 10,
              padding: '14px 18px',
              color: '#FCA5A5',
              fontWeight: 600,
              fontSize: '0.9rem',
              marginBottom: 24,
              fontFamily: 'monospace',
              textAlign: 'left',
              wordBreak: 'break-word',
            }}
          >
            ⚠️ Violation: {terminationReason || 'Window minimized, tab switched, or restricted system shortcut triggered.'}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              textAlign: 'left',
              fontSize: '0.8rem',
              color: '#9CA3AF',
              background: 'rgba(255, 255, 255, 0.03)',
              padding: 16,
              borderRadius: 10,
              marginBottom: 28,
            }}
          >
            <div>• Candidate: <strong style={{ color: '#fff' }}>{hallTicket}</strong></div>
            <div>• Exam Code: <strong style={{ color: '#fff' }}>{examCode}</strong></div>
            <div>• Incident Timestamp: <strong style={{ color: '#fff' }}>{new Date().toLocaleString()}</strong></div>
            <div>• Recorded Status: <strong style={{ color: '#EF4444' }}>Terminated - violation</strong></div>
            <div>• Security Reason: <strong style={{ color: '#FCA5A5' }}>{terminationReason}</strong></div>
            <div>• Enforcement: Server invalidated session token, saved answers so far, logged student out, and recorded security audit event.</div>
          </div>

          <button
            onClick={() => {
              navigate('/enter-exam')
            }}
            className="btn"
            style={{
              width: '100%',
              background: '#EF4444',
              color: '#ffffff',
              fontWeight: 700,
              padding: '14px 24px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            Return to Exam Portal
          </button>
        </motion.div>
      </div>
    )
  }

  if (!session || !currentQuestion) return null

  const isCode = currentQuestion.type === 'code'
  const answered = isCode ? !!codeAnswers[currentQuestion.id] : answers[currentQuestion.id] !== undefined
  const isFlagged = flagged.has(currentQuestion.id)

  return (
    <div style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Subtle Focus Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.03, backgroundImage: 'radial-gradient(circle, #EAA812 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      {/* ─── EXAM HEADER ─── */}
      <div className="exam-header" style={{ zIndex: 100 }}>
        {/* Left: Exam info with Elevated Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <BrandLogo size="sm" variant="standard" showTagline={false} />
          <div style={{ height: 28, width: 1, background: 'rgba(255, 255, 255, 0.15)' }} />
          <div>
            <div className="exam-title">{session.examName}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>{hallTicket} • {answeredCount}/{session.questions.length} answered</span>
              {session.questions.some(q => q.type === 'code') && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.7rem',
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38BDF8',
                    fontWeight: 600,
                  }}
                  title="Coding questions are evaluated manually by instructors; they are not part of the live instant MCQ auto-grade."
                >
                  💻 Coding: Manual Review
                </span>
              )}
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
          {/* Dual-Layer Real-Time Auto-Save Vault Status */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.14)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34D399',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}
            title="Real-time continuous dual-layer data backup active. Every response is cached locally and synced to cloud vault."
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
            <span>VAULT BACKED UP (100% REALTIME)</span>
          </div>

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
              id="report-issue-dropbox-btn"
              type="button"
              onClick={() => {
                setProctorDeskDefaultTab('raise_hand')
                setShowProctorDesk(true)
              }}
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.45)',
                color: '#FBBF24',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Report Issue / Drop Box — Message the proctor without breaking proctoring"
            >
              <span>📬</span>
              <span>Report Issue</span>
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
        gap: 16, padding: '12px 20px', maxWidth: 1400, margin: '0 auto', width: '100%',
        minHeight: 0,
        height: 'calc(100vh - 72px)',
        overflow: 'hidden',
      }}>

        {/* ── Left Column: Question Content ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, height: '100%', overflowY: 'auto' }}>
            <div style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: '0.78rem',
              color: '#38BDF8',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span>ℹ️</span>
              <span><strong>Manual Evaluation:</strong> Coding solutions are submitted for instructor manual review and are not included in the instant live MCQ auto-grade.</span>
            </div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, height: '100%', overflowY: 'auto' }}>
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
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)'}}>{session?.violationThreshold || 2} max — exam terminates on breach</div>
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
        initialTab={proctorDeskDefaultTab}
      />

      {/* ─── NETWORK DROP ANSWER RECOVERY MODAL ─── */}
      {submitNetworkErrorNotice && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999998,
          background: 'rgba(5, 8, 18, 0.94)',
          backdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            maxWidth: 520, width: '100%',
            background: '#0F172A',
            border: '2px solid #F59E0B',
            borderRadius: 20,
            padding: '32px 28px',
            textAlign: 'center',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(245, 158, 11, 0.25)',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📶</div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FCD34D', margin: '0 0 10px 0' }}>
              Network Interruption Detected
            </h3>
            <p style={{ color: '#E2E8F0', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 20 }}>
              {submitNetworkErrorNotice}
            </p>
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 10,
              padding: '10px 14px',
              color: '#34D399',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: 20,
              textAlign: 'left',
            }}>
              🔒 <strong>Offline Protection Active:</strong> {Object.keys(answers).length + Object.keys(codeAnswers).length} answers safely retained in local buffer.
            </div>
            <button
              type="button"
              id="retry-submission-btn"
              onClick={() => {
                setSubmitting(false)
                setIsRetryingSubmit(false)
                handleSubmit()
              }}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                color: '#000',
                border: 'none',
                borderRadius: 12,
                fontSize: '0.95rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4)',
              }}
            >
              🔄 Retry Submission Now
            </button>
          </div>
        </div>
      )}

      {/* ─── STRICT SECURITY FORCE-TERMINATION LOCKDOWN SCREEN ─── */}
      {isTerminated && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999999,
          background: '#070A12',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24, textAlign: 'center', color: '#FFFFFF',
        }}>
          <div style={{
            maxWidth: 580, width: '100%',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '2px solid #EF4444',
            borderRadius: 24,
            padding: '36px 28px',
            boxShadow: '0 25px 60px rgba(239, 68, 68, 0.35)',
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ fontSize: '3.6rem', marginBottom: 14 }}>🚨</div>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#EF4444', margin: '0 0 10px 0' }}>
              EXAM TERMINATED
            </h2>
            <div style={{
              display: 'inline-block',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              color: '#FCA5A5',
              fontSize: '0.78rem',
              fontWeight: 800,
              padding: '6px 14px',
              borderRadius: 999,
              marginBottom: 18,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Zero-Tolerance Tamper Lockdown
            </div>
            <p style={{ color: '#E2E8F0', fontSize: '1rem', lineHeight: 1.6, marginBottom: 20 }}>
              {terminationReason || 'A critical security violation was detected. The exam has been immediately shut down.'}
            </p>
            <div style={{
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
              padding: '16px 20px',
              textAlign: 'left',
              fontSize: '0.86rem',
              color: '#94A3B8',
              marginBottom: 24,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}>
              <div><strong>Candidate:</strong> {hallTicket || 'N/A'}</div>
              <div><strong>Exam Code:</strong> {examCode || 'N/A'}</div>
              <div><strong>Status:</strong> <span style={{ color: '#EF4444', fontWeight: 700 }}>TERMINATED &amp; SUBMITTED</span></div>
              <div><strong>Session:</strong> Automatically Logged Out</div>
            </div>
            <button
              onClick={() => {
                navigate('/', { replace: true });
              }}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 12,
                fontSize: '1rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
              }}
            >
              Exit to Portal Home
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
