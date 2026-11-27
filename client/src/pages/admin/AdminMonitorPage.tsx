import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { io as connectSocket, type Socket } from 'socket.io-client'
import { API_BASE_URL, SOCKET_URL } from '../../lib/config'
import { supabase } from '../../lib/supabaseClient'
import { getHierarchyOverview, startExam } from '../../lib/api'
import {
  COURSE_OPTIONS,
  getBranchesForCourse,
  inferCourseFromBranch,
  buildSectionChoices,
} from '../../constants/academicCatalog'
import LiveGridWall, { type StudentTile } from '../../components/3d/LiveGridWall'
import GlowCard from '../../components/3d/GlowCard'
import MagneticButton from '../../components/3d/MagneticButton'
import FlightPathLines from '../../components/3d/FlightPathLines'
import ShimmerText from '../../components/3d/ShimmerText'
import CandidateViolationTimelineModal from '../../components/CandidateViolationTimelineModal'
import InspectorRadarMatrix3D from '../../components/3d/InspectorRadarMatrix3D'
import AdminSidebar from '../../components/layout/AdminSidebar'
import {
  IconAlert,
  IconStop,
  IconChat,
  IconDownload,
  IconMail,
  IconCross,
  IconCamera,
  IconVolume,
  IconVolumeMute,
  IconGlobe,
  IconBuilding,
  IconKey,
  IconFlash,
  IconRefresh,
  IconUsers,
  IconRadio,
  IconShield,
  IconCheck,
  IconClipboard,
  IconLaunch,
  IconEye,
  IconProhibit,
  IconClock,
} from '../../components/icons/HumanIcons'

const BASE_URL = API_BASE_URL

interface ProctoringEvent {
  id: string
  candidate_id: string
  event_type: string
  metadata?: Record<string, unknown>
  created_at: string
}

/* ── Web Audio API Warning Tone ────────────────────────── */
function playWarningChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15) // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch {}
}


interface ExamCodeOption {
  exam_code: string
  exam_name?: string
  subject?: string
  college_id?: number | string | null
  college_name?: string
  branch?: string | null
  passout_year?: number | null
  sections?: string[]
  is_active?: boolean
  is_launched?: boolean
  duration_minutes?: number
}

interface WaitingLobbyItem {
  hall_ticket_no: string
  student_name: string
  section?: string
  branch?: string
  college_name?: string
  joined_at?: string
  attempt_id?: string | null
  source?: string
  status: string
}

interface EligibleRosterItem {
  id: string
  hall_ticket: string
  name: string
  email?: string
  college_name?: string
  branch?: string
  section?: string
  batch?: string
  passout_year?: number | null
  presence: string
  score?: number
  flag_count?: number
}

function adminHeaders() {
  const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token') || localStorage.getItem('inspector_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/* ── Main Monitor Component ───────────────────────────── */
export default function AdminMonitorPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()

  const defaultExamCode = (examId || '').toUpperCase().trim()
  const [examCode, setExamCode] = useState(defaultExamCode)
  const [inputCode, setInputCode] = useState(defaultExamCode)
  const [students, setStudents] = useState<StudentTile[]>([])
  const [waitingQueue, setWaitingQueue] = useState<WaitingLobbyItem[]>([])
  const [eligibleRoster, setEligibleRoster] = useState<EligibleRosterItem[]>([])
  const [activeExamMeta, setActiveExamMeta] = useState<ExamCodeOption | null>(null)
  const [examStarted, setExamStarted] = useState(false)
  const [events, setEvents] = useState<ProctoringEvent[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentTile | null>(null)
  const [monitorTab, setMonitorTab] = useState<'wall' | 'lobby' | 'roster'>('wall')
  const [connected, setConnected] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [releasingLobby, setReleasingLobby] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [actionNotice, setActionNotice] = useState('')
  const [timelineCandidate, setTimelineCandidate] = useState<StudentTile | null>(null)
  const [show3DMatrix, setShow3DMatrix] = useState(false)
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [whisperModalStudent, setWhisperModalStudent] = useState<StudentTile | null>(null)
  const [whisperMessage, setWhisperMessage] = useState('')
  const [isRoomFrozen, setIsRoomFrozen] = useState(false)

  /* ── College, Course, Branch, Section & Exam Scoping State ── */
  const [colleges, setColleges] = useState<Array<{ id: number; college_name: string; college_code: string }>>([])
  const [hierarchySections, setHierarchySections] = useState<any[]>([])
  const [selectedCollege, setSelectedCollege] = useState<string>('ALL')
  const [selectedCourse, setSelectedCourse] = useState<string>('ALL')
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL')
  const [selectedSection, setSelectedSection] = useState<string>('ALL')
  const [availableExams, setAvailableExams] = useState<ExamCodeOption[]>([])

  /* ── Outbound Email Hub State ── */
  const [emailHubOpen, setEmailHubOpen] = useState(false)
  const [emailLogs, setEmailLogs] = useState<Array<{ id: string; type: string; recipient: string; recipientName?: string; examCode: string; subject: string; status: string; timestamp: string }>>([])
  const [testEmailType, setTestEmailType] = useState('invitation')
  const [testEmailRecipient, setTestEmailRecipient] = useState('')
  const [testEmailSending, setTestEmailSending] = useState(false)

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const idleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── Initial Mount: Load Colleges, Sections & Active Exam Codes ── */
  useEffect(() => {
    const headers = adminHeaders()
    axios.get(`${BASE_URL}/api/colleges`, { withCredentials: true, headers })
      .then(res => {
        if (res.data?.colleges) setColleges(res.data.colleges)
      })
      .catch(() => {
        axios.get(`${BASE_URL}/api/exam-code/colleges`, { withCredentials: true, headers })
          .then(res => { if (res.data?.colleges) setColleges(res.data.colleges) })
          .catch(() => {})
      })

    getHierarchyOverview()
      .then(res => {
        if (res.data?.success && Array.isArray(res.data.sections)) {
          setHierarchySections(res.data.sections)
        }
      })
      .catch(() => {})

    axios.get(`${BASE_URL}/api/admin/exam-codes`, { withCredentials: true, headers })
      .then(res => {
        const raw = res.data?.exam_codes || []
        const formatted: ExamCodeOption[] = raw.map((ec: any) => ({
          exam_code: String(ec.exam_code || '').toUpperCase(),
          exam_name: ec.exam_name || ec.subject || ec.exam_code,
          subject: ec.subject,
          college_id: ec.college_id ?? ec.college?.id ?? null,
          college_name: ec.college?.college_name || '',
          branch: ec.branch || null,
          passout_year: ec.passout_year || null,
          sections: Array.isArray(ec.section_ids) && ec.section_ids.length > 0
            ? ec.section_ids
            : ec.section_id ? [ec.section_id] : [],
          is_active: ec.is_active,
          is_launched: ec.is_launched,
          duration_minutes: ec.duration_minutes,
        })).filter((e: ExamCodeOption) => Boolean(e.exam_code))

        setAvailableExams(formatted)
        if (!defaultExamCode && formatted.length > 0) {
          const preferred = formatted.find(e => e.is_active) || formatted[0]
          setExamCode(preferred.exam_code)
          setInputCode(preferred.exam_code)
        }
      })
      .catch(() => {
        axios.get(`${BASE_URL}/api/admin/exams`, { withCredentials: true, headers })
          .then(r => {
            const raw = r.data?.exams || []
            const formatted: ExamCodeOption[] = raw
              .filter((e: any) => Boolean(e.exam_code))
              .map((e: any) => ({
                exam_code: String(e.exam_code).toUpperCase(),
                exam_name: e.title,
                college_id: e.college_id,
                branch: e.branch,
                passout_year: e.passout_year,
                sections: Array.isArray(e.section_ids) ? e.section_ids : e.section_id ? [e.section_id] : [],
                is_active: e.is_active,
                duration_minutes: e.duration_minutes,
              }))
            setAvailableExams(formatted)
            if (!defaultExamCode && formatted.length > 0) {
              setExamCode(formatted[0].exam_code)
              setInputCode(formatted[0].exam_code)
            }
          })
          .catch(() => {})
      })
  }, [defaultExamCode])

  /* ── Mark student idle after 30s of no activity ── */
  const resetIdleTimer = useCallback((candidateId: string) => {
    if (idleTimers.current.has(candidateId)) {
      clearTimeout(idleTimers.current.get(candidateId)!)
    }
    const timer = setTimeout(() => {
      setStudents(prev =>
        prev.map(s => s.id === candidateId && s.status === 'active'
          ? { ...s, status: 'idle' }
          : s
        )
      )
    }, 30_000)
    idleTimers.current.set(candidateId, timer)
  }, [])

  /* ── Push new proctor event ── */
  const recordEvent = useCallback((ev: ProctoringEvent) => {
    setEvents(prev => [ev, ...prev.slice(0, 49)])
    if (soundEnabled && (ev.event_type.includes('face') || ev.event_type === 'tab_switch')) {
      playWarningChime()
    }
  }, [soundEnabled])

  /* ── Load authoritative snapshot from backend Admin Monitor API ── */
  const loadSnapshot = useCallback(async (code: string, quiet: boolean = false) => {
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) return
    if (!quiet) setLoading(true)
    try {
      const res = await axios.get(`${BASE_URL}/api/admin/monitor/${encodeURIComponent(cleanCode)}/snapshot`, {
        withCredentials: true,
        headers: adminHeaders(),
      })

      if (res.data?.success) {
        if (res.data.exam) {
          setActiveExamMeta(res.data.exam)
          setExamStarted(Boolean(res.data.exam.is_launched))
        }
        const rawWaiting: WaitingLobbyItem[] = Array.isArray(res.data.waiting_students) ? res.data.waiting_students : []
        setWaitingQueue(rawWaiting)

        const rawRoster: EligibleRosterItem[] = Array.isArray(res.data.eligible_roster) ? res.data.eligible_roster : []
        setEligibleRoster(rawRoster)

        const rawAttempts: any[] = Array.isArray(res.data.attempts) ? res.data.attempts : []
        const tileMap = new Map<string, StudentTile>()

        for (const a of rawAttempts) {
          const flags = Number(a.flag_count || 0)
          const st = String(a.status || '').toLowerCase()
          const isTerminated = st === 'terminated_cheating' || st === 'terminated' || st === 'terminated - violation'
          const isWaiting = st === 'waiting' || st === 'waiting_verification' || st === 'in_lobby'
          const isCheating = !isTerminated && flags >= 3
          const isDone = Boolean(a.submitted_at) || st === 'completed' || st === 'submitted' || st === 'auto_submitted_expired'

          const tile: StudentTile = {
            id: String(a.hall_ticket || a.id),
            attemptId: a.id ? String(a.id) : undefined,
            name: a.name || a.hall_ticket,
            hallTicket: a.hall_ticket,
            status: isTerminated ? 'terminated' : isWaiting ? 'waiting' : isCheating ? 'cheating' : isDone ? 'offline' : 'active',
            score: a.score !== undefined && a.score !== null ? Math.round(Number(a.score)) : undefined,
            flagCount: flags,
            joinedAt: a.started_at,
            branch: a.branch,
            section: a.section,
            course: inferCourseFromBranch(a.branch),
            collegeName: a.college_name,
            batch: a.batch,
          }
          if (tile.hallTicket) tileMap.set(tile.hallTicket, tile)
        }

        // Merge any live socket waiting students not yet present in attempts map
        for (const w of rawWaiting) {
          const ht = String(w.hall_ticket_no || '').toUpperCase().trim()
          if (ht && !tileMap.has(ht)) {
            tileMap.set(ht, {
              id: ht,
              attemptId: w.attempt_id || undefined,
              name: w.student_name || ht,
              hallTicket: ht,
              status: 'waiting',
              flagCount: 0,
              joinedAt: w.joined_at,
              branch: w.branch || res.data.exam?.branch || 'CSE',
              section: w.section || 'A',
              course: inferCourseFromBranch(w.branch || res.data.exam?.branch),
              collegeName: w.college_name || res.data.exam?.college_name || 'Unassigned',
            })
          }
        }

        setStudents(Array.from(tileMap.values()))

        if (Array.isArray(res.data.violations)) {
          setEvents(res.data.violations.slice(0, 60))
        }
      }
      setConnected(true)
    } catch (err) {
      console.error('[Monitor] Snapshot load error', err)
      setConnected(true)
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  /* ── Connect to Supabase Realtime Channels + Socket.IO Rooms ── */
  const subscribe = useCallback((code: string) => {
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) return
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (broadcastChannelRef.current) {
      supabase.removeChannel(broadcastChannelRef.current)
      broadcastChannelRef.current = null
    }
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    setExamCode(cleanCode)
    setInputCode(cleanCode)
    if ((examId || '').toUpperCase() !== cleanCode) {
      navigate(`/admin/monitor/${encodeURIComponent(cleanCode)}`, { replace: true })
    }
    loadSnapshot(cleanCode)

    // 0. Connect Socket.IO to join monitor + lobby rooms for instant waiting lobby visibility
    const token = localStorage.getItem('admin_token') || localStorage.getItem('inspector_token') || ''
    const sock = connectSocket(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1200,
      auth: { token: token || undefined },
    })
    socketRef.current = sock

    sock.on('connect', () => {
      setSocketConnected(true)
      sock.emit('monitor:join', { examCode: cleanCode })
      sock.emit('lobby:join', { examCode: cleanCode })
    })
    sock.on('disconnect', () => setSocketConnected(false))

    sock.on('telemetry:update', (data: any) => {
      if (String(data?.exam_code || '').toUpperCase() !== cleanCode) return
      if (Array.isArray(data.waiting_students)) {
        setWaitingQueue(prev => {
          const byHt = new Map(prev.map(w => [String(w.hall_ticket_no || '').toUpperCase(), w]))
          for (const sw of data.waiting_students) {
            const ht = String(sw.hall_ticket_no || '').toUpperCase()
            if (!ht) continue
            const prevItem = byHt.get(ht)
            byHt.set(ht, {
              hall_ticket_no: ht,
              student_name: sw.student_name || prevItem?.student_name || ht,
              section: sw.section || prevItem?.section || 'A',
              branch: prevItem?.branch || activeExamMeta?.branch || 'CSE',
              college_name: prevItem?.college_name || activeExamMeta?.college_name || 'Unassigned',
              joined_at: sw.joined_at || prevItem?.joined_at || new Date().toISOString(),
              status: sw.status || 'waiting',
            })
          }
          return Array.from(byHt.values())
        })
        setStudents(prev => {
          const next = [...prev]
          for (const sw of data.waiting_students) {
            const ht = String(sw.hall_ticket_no || '').toUpperCase()
            if (ht && !next.some(s => s.id === ht)) {
              next.unshift({
                id: ht,
                name: sw.student_name || ht,
                hallTicket: ht,
                status: 'waiting',
                flagCount: 0,
                joinedAt: sw.joined_at,
                section: sw.section || 'A',
              })
            }
          }
          return next
        })
      }
    })

    sock.on('lobby:update', (data: any) => {
      if (Array.isArray(data?.participants)) {
        loadSnapshot(cleanCode, true)
      }
    })

    sock.on('EXAM_STARTED', () => {
      setExamStarted(true)
      loadSnapshot(cleanCode, true)
    })

    sock.on('proctor:violation', (v: any) => {
      const cid = String(v?.hall_ticket || v?.candidate_id || '').toUpperCase()
      if (!cid) return
      recordEvent({
        id: v.id || `sock-${Date.now()}`,
        candidate_id: cid,
        event_type: v.violation_type || v.eventType || 'proctor_alert',
        metadata: { message: v.details || v.message },
        created_at: new Date().toISOString(),
      })
    })

    // Channel 1: Database Postgres changes (exam_code_attempts & proctor_logs)
    const attemptsChannel = supabase
      .channel(`monitor-db-${cleanCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_code_attempts', filter: `exam_code=eq.${cleanCode}` },
        payload => {
          const row = (payload.new || payload.old) as Record<string, unknown>
          const hallTicket = String(row.hall_ticket_no || row.hall_ticket || '').toUpperCase()
          if (!hallTicket) return
          loadSnapshot(cleanCode, true)
          if (payload.eventType === 'INSERT') {
            resetIdleTimer(hallTicket)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'proctor_logs', filter: `exam_id=eq.${cleanCode}` },
        payload => {
          const row = payload.new as ProctoringEvent
          if (!row) return

          recordEvent(row)

          setStudents(prev =>
            prev.map(s => {
              if (s.id !== row.candidate_id) return s
              const flags = (s.flagCount || 0) + 1
              const newStatus = flags >= 3 ? 'cheating' : s.status
              return { ...s, flagCount: flags, status: newStatus }
            })
          )
          resetIdleTimer(row.candidate_id)
        }
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setConnected(true)
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setConnected(false)
      })

    // Channel 2: Realtime Broadcast Channel (instant sub-100ms peer events)
    const broadcastChannel = supabase
      .channel(`realtime:monitor-${cleanCode}`)
      .on('broadcast', { event: 'student_heartbeat' }, payload => {
        const data = payload.payload as { hallTicket: string; currentQuestion?: number; answeredCount?: number }
        if (!data?.hallTicket) return
        const ht = data.hallTicket.toUpperCase()

        setStudents(prev => {
          const exists = prev.find(s => s.id === ht)
          if (!exists) {
            return [{
              id: ht,
              name: ht,
              hallTicket: ht,
              status: 'active',
              flagCount: 0,
              currentQuestion: data.currentQuestion,
              joinedAt: new Date().toISOString(),
            }, ...prev]
          }
          return prev.map(s => s.id === ht
            ? { ...s, status: s.status === 'cheating' ? 'cheating' : 'active', currentQuestion: data.currentQuestion, lastSeen: new Date().toISOString() }
            : s
          )
        })
        resetIdleTimer(ht)
      })
      .on('broadcast', { event: 'student_violation' }, payload => {
        const data = payload.payload as { hallTicket: string; eventType: string; message: string; violationCount: number }
        if (!data?.hallTicket) return
        const ht = data.hallTicket.toUpperCase()

        recordEvent({
          id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          candidate_id: ht,
          event_type: data.eventType,
          metadata: { message: data.message },
          created_at: new Date().toISOString(),
        })

        setStudents(prev =>
          prev.map(s => {
            if (s.id !== ht) return s
            const flags = (s.flagCount || 0) + 1
            return {
              ...s,
              flagCount: flags,
              status: flags >= 3 ? 'cheating' : 'active',
            }
          })
        )
      })
      .subscribe()

    channelRef.current = attemptsChannel
    broadcastChannelRef.current = broadcastChannel
  }, [examId, loadSnapshot, navigate, recordEvent, resetIdleTimer, activeExamMeta?.branch, activeExamMeta?.college_name])

  useEffect(() => {
    if (!examCode) return
    subscribe(examCode)
    const poll = setInterval(() => loadSnapshot(examCode, true), 6000)
    return () => {
      clearInterval(poll)
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (broadcastChannelRef.current) supabase.removeChannel(broadcastChannelRef.current)
      if (socketRef.current) socketRef.current.disconnect()
      if (simTimerRef.current) clearInterval(simTimerRef.current)
      idleTimers.current.forEach(t => clearTimeout(t))
    }
  }, [examCode])



  /* ── Send Warning to Candidate ── */
  const handleSendWarning = (student: StudentTile) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'admin_warning',
        payload: {
          hallTicket: student.hallTicket,
          message: `Official Proctor Warning: Suspicious activity logged. You have ${student.flagCount || 0} violations.`,
        },
      })
    }
    setActionNotice(`Warning broadcasted to ${student.hallTicket}`)
    setTimeout(() => setActionNotice(''), 3000)
  }

  /* ── Force Terminate Candidate ── */
  const handleTerminateStudent = (student: StudentTile) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'admin_terminate',
        payload: {
          hallTicket: student.hallTicket,
        },
      })
    }
    setStudents(prev =>
      prev.map(s => s.id === student.id ? { ...s, status: 'offline', flagCount: (s.flagCount || 0) + 5 } : s)
    )
    setActionNotice(`Terminated session for ${student.hallTicket}`)
    setTimeout(() => setActionNotice(''), 3000)
  }

  /* ── Broadcast to All Candidates ── */
  const handleBroadcastToAll = () => {
    if (!broadcastMessage.trim()) return
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'admin_broadcast',
        payload: {
          examCode,
          message: broadcastMessage,
          inspectorName: 'Chief Exam Invigilator',
          timestamp: new Date().toISOString(),
        },
      })
    }
    axios.post(`${BASE_URL}/api/v1/inspector/broadcast`, {
      examCode,
      message: broadcastMessage,
      inspectorName: 'Chief Exam Invigilator',
    }).catch(() => {})

    setActionNotice(`Announcement broadcasted to all ${students.length} candidates in ${examCode}!`)
    setBroadcastMessage('')
    setBroadcastModalOpen(false)
    setTimeout(() => setActionNotice(''), 3500)
  }

  /* ── Send Direct Whisper Message ── */
  const handleSendWhisper = () => {
    if (!whisperModalStudent || !whisperMessage.trim()) return
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'admin_message',
        payload: {
          hallTicket: whisperModalStudent.hallTicket,
          message: whisperMessage,
          inspectorName: 'Exam Inspector',
        },
      })
    }
    axios.post(`${BASE_URL}/api/v1/inspector/candidate-action`, {
      examCode,
      hallTicket: whisperModalStudent.hallTicket,
      action: 'whisper',
      message: whisperMessage,
    }).catch(() => {})

    setActionNotice(`Direct notice sent to ${whisperModalStudent.hallTicket}`)
    setWhisperModalStudent(null)
    setWhisperMessage('')
    setTimeout(() => setActionNotice(''), 3000)
  }

  /* ── Grant Time Extension ── */
  const handleExtendTime = (student: StudentTile, mins: number = 5) => {
    const secs = mins * 60
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'admin_extend_time',
        payload: {
          hallTicket: student.hallTicket,
          seconds: secs,
          message: `Inspector granted you a +${mins} minute time extension.`,
        },
      })
    }
    axios.post(`${BASE_URL}/api/v1/inspector/candidate-action`, {
      examCode,
      hallTicket: student.hallTicket,
      action: 'extend_time',
      seconds: secs,
    }).catch(() => {})

    setActionNotice(`⏱️ +${mins}m extension granted to ${student.hallTicket}`)
    setTimeout(() => setActionNotice(''), 3000)
  }

  /* ── Pause / Resume Candidate ── */
  const handlePauseResume = (student: StudentTile) => {
    const isPaused = student.status === 'idle'
    const newAction = isPaused ? 'resume' : 'pause'
    const eventName = isPaused ? 'admin_resume' : 'admin_pause'

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: eventName,
        payload: {
          hallTicket: student.hallTicket,
        },
      })
    }
    axios.post(`${BASE_URL}/api/v1/inspector/candidate-action`, {
      examCode,
      hallTicket: student.hallTicket,
      action: newAction,
    }).catch(() => {})

    setStudents(prev =>
      prev.map(s => s.id === student.id ? { ...s, status: isPaused ? 'active' : 'idle' } : s)
    )
    setActionNotice(`${isPaused ? '▶️ Resumed' : '⏸️ Paused'} session for ${student.hallTicket}`)
    setTimeout(() => setActionNotice(''), 3000)
  }

  /* ── Master Room Freeze / Resume All Candidates ── */
  const handleToggleRoomFreeze = () => {
    const next = !isRoomFrozen
    setIsRoomFrozen(next)
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: next ? 'admin_pause' : 'admin_resume',
        payload: {
          hallTicket: undefined,
          message: next ? 'Master room freeze commanded by Chief Invigilator.' : 'Room resumed by Chief Invigilator.',
        },
      })
    }
    axios.post(`${BASE_URL}/api/v1/inspector/candidate-action`, {
      examCode,
      hallTicket: 'ALL',
      action: next ? 'pause' : 'resume',
    }).catch(() => {})

    setStudents(prev =>
      prev.map(s => (s.status === 'active' || s.status === 'idle') ? { ...s, status: next ? 'idle' : 'active' } : s)
    )
    setActionNotice(next ? '⏸️ MASTER LOCKDOWN: All candidates in room paused!' : '▶️ ROOM RESUMED: All candidates active!')
    setTimeout(() => setActionNotice(''), 4000)
  }

  /* ── Export Forensic Audit Log (JSON) ── */
  const handleExportAudit = () => {
    const report = {
      examCode,
      exportTimestamp: new Date().toISOString(),
      inspector: 'Chief Exam Invigilator',
      stats,
      candidates: students.map(s => ({
        id: s.id,
        name: s.name,
        hallTicket: s.hallTicket,
        status: s.status,
        score: s.score,
        flagCount: s.flagCount,
        currentQuestion: s.currentQuestion,
        joinedAt: s.joinedAt,
      })),
      events,
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `LogicWhileLiRE_Audit_${examCode}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setActionNotice(`Downloaded forensic audit report for ${examCode}!`)
    setTimeout(() => setActionNotice(''), 3000)
  }

  /* ── Outbound Email Dispatch Log Fetcher ── */
  const fetchEmailLogs = useCallback(() => {
    axios.get(`${BASE_URL}/api/v1/inspector/email-logs/${examCode}`)
      .then(res => {
        if (res.data?.emails) setEmailLogs(res.data.emails)
      })
      .catch(() => {})
  }, [examCode])

  useEffect(() => {
    if (emailHubOpen) {
      fetchEmailLogs()
    }
  }, [emailHubOpen, fetchEmailLogs])

  const handleTestEmailDispatch = async () => {
    if (!testEmailRecipient.trim()) return
    setTestEmailSending(true)
    try {
      await axios.post(`${BASE_URL}/api/v1/inspector/test-email`, {
        type: testEmailType,
        recipient: testEmailRecipient.trim(),
        examCode,
        examTitle: `Exam ${examCode}`,
      })
      setActionNotice(`Test ${testEmailType} dispatched to ${testEmailRecipient}!`)
      fetchEmailLogs()
      setTimeout(() => setActionNotice(''), 3500)
    } catch {
      setActionNotice('Failed to dispatch test email')
      setTimeout(() => setActionNotice(''), 3000)
    } finally {
      setTestEmailSending(false)
    }
  }

  /* ── Waiting Lobby Actions (Release / Start / Block / Reject) ── */
  const handleReleaseStudent = async (hallTicket?: string, releaseAll: boolean = false) => {
    if (!examCode) return
    setReleasingLobby(true)
    try {
      await axios.post(
        `${BASE_URL}/api/admin/exam-codes/${encodeURIComponent(examCode)}/release-student`,
        releaseAll ? { all: true } : { hallTicket },
        { withCredentials: true, headers: adminHeaders() }
      )
      setActionNotice(releaseAll ? `Released all waiting lobby candidates for ${examCode}!` : `Released ${hallTicket} from Waiting Lobby!`)
      await loadSnapshot(examCode, true)
    } catch (err: any) {
      setActionNotice(`Release notice: ${err?.response?.data?.error || err.message}`)
    } finally {
      setReleasingLobby(false)
      setTimeout(() => setActionNotice(''), 3500)
    }
  }

  const handleRejectLobbyStudent = async (hallTicket: string) => {
    if (!examCode || !window.confirm(`Reject ${hallTicket} from Waiting Lobby?`)) return
    try {
      await axios.post(
        `${BASE_URL}/api/admin/exam-codes/${encodeURIComponent(examCode)}/reject-student`,
        { hallTicket, reason: 'Entry rejected from Live Monitor Lobby' },
        { withCredentials: true, headers: adminHeaders() }
      )
      setActionNotice(`Rejected ${hallTicket} from Waiting Lobby`)
      await loadSnapshot(examCode, true)
    } catch {}
    setTimeout(() => setActionNotice(''), 3500)
  }

  const handleBlockLobbyStudent = async (hallTicket: string) => {
    if (!examCode || !window.confirm(`Block ${hallTicket} from taking ${examCode}?`)) return
    try {
      await axios.post(
        `${BASE_URL}/api/admin/exam-codes/${encodeURIComponent(examCode)}/block-student`,
        { hallTicket, reason: 'Blocked by administrator' },
        { withCredentials: true, headers: adminHeaders() }
      )
      setActionNotice(`Blocked ${hallTicket}`)
      await loadSnapshot(examCode, true)
    } catch {}
    setTimeout(() => setActionNotice(''), 3500)
  }

  const handleStartExamFromMonitor = async () => {
    if (!examCode) return
    setReleasingLobby(true)
    try {
      await startExam(examCode, { allow_late_join: true })
      setExamStarted(true)
      setActionNotice(`LIVE LAUNCH DISPATCHED: ${examCode} started and all Waiting Lobby candidates unlocked!`)
      await loadSnapshot(examCode, true)
    } catch (err: any) {
      setActionNotice(`Start failed: ${err?.response?.data?.error || err.message}`)
    } finally {
      setReleasingLobby(false)
      setTimeout(() => setActionNotice(''), 4500)
    }
  }

  /* ── Filtered Monitor Collections (College / Course / Branch / Section) ── */
  const matchesScopeFilters = useCallback((item: { college_name?: string; branch?: string; section?: string }) => {
    if (selectedCollege !== 'ALL' && item.college_name && !item.college_name.toLowerCase().includes(selectedCollege.toLowerCase())) {
      return false
    }
    if (selectedCourse !== 'ALL' && inferCourseFromBranch(item.branch) !== selectedCourse) {
      return false
    }
    if (selectedBranch !== 'ALL' && (item.branch || '').toUpperCase() !== selectedBranch.toUpperCase()) {
      return false
    }
    if (selectedSection !== 'ALL') {
      const secA = (item.section || '').toUpperCase().replace(/^SECTION\s*/i, '').trim()
      const secB = selectedSection.toUpperCase().replace(/^SECTION\s*/i, '').trim()
      if (secA !== secB && !secA.endsWith(`-${secB}`) && !secB.endsWith(`-${secA}`)) {
        return false
      }
    }
    return true
  }, [selectedCollege, selectedCourse, selectedBranch, selectedSection])

  const filteredStudents = useMemo(
    () => students.filter(s => matchesScopeFilters({ college_name: s.collegeName, branch: s.branch, section: s.section })),
    [students, matchesScopeFilters]
  )
  const filteredWaiting = useMemo(
    () => waitingQueue.filter(w => matchesScopeFilters({ college_name: w.college_name, branch: w.branch, section: w.section })),
    [waitingQueue, matchesScopeFilters]
  )
  const filteredRoster = useMemo(
    () => eligibleRoster.filter(r => matchesScopeFilters({ college_name: r.college_name, branch: r.branch, section: r.section })),
    [eligibleRoster, matchesScopeFilters]
  )

  const filteredExamOptions = useMemo(() => {
    const selectedColObj = colleges.find(c => c.college_name === selectedCollege)
    const list = availableExams.filter(ec => {
      if (selectedCollege === 'ALL' || !selectedColObj) return true
      return Number(ec.college_id) === Number(selectedColObj.id) || ec.exam_code === examCode
    })
    if (examCode && !list.some(e => e.exam_code === examCode)) {
      return [{ exam_code: examCode, exam_name: activeExamMeta?.exam_name || examCode }, ...list]
    }
    return list
  }, [availableExams, colleges, selectedCollege, examCode, activeExamMeta])

  const sectionFilterChoices = useMemo(() => {
    const selectedColObj = colleges.find(c => c.college_name === selectedCollege)
    const scopedSecs = selectedColObj
      ? hierarchySections.filter(sec => Number(sec.college_id) === Number(selectedColObj.id))
      : hierarchySections
    const metaSecs = (activeExamMeta?.sections || []).map(s => ({ section_name: s }))
    return buildSectionChoices([...scopedSecs, ...metaSecs], selectedBranch !== 'ALL' ? selectedBranch : activeExamMeta?.branch)
  }, [colleges, selectedCollege, hierarchySections, activeExamMeta, selectedBranch])

  /* ── Stats ── */
  const stats = {
    total:    Math.max(filteredRoster.length, filteredStudents.length, filteredWaiting.length),
    waiting:  filteredWaiting.length,
    active:   filteredStudents.filter(s => s.status === 'active').length,
    idle:     filteredStudents.filter(s => s.status === 'idle').length,
    cheat:    filteredStudents.filter(s => s.status === 'cheating').length,
    done:     filteredStudents.filter(s => s.status === 'offline').length,
    avgScore: filteredStudents.filter(s => s.score !== undefined).length > 0
      ? Math.round(filteredStudents.reduce((sum, s) => sum + (s.score || 0), 0) / filteredStudents.filter(s => s.score !== undefined).length)
      : 0,
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'tab_switch':
        return <IconProhibit size={13} color="#EF4444" />;
      case 'multiple_faces':
        return <IconUsers size={13} color="#F59E0B" />;
      case 'no_face':
        return <IconEye size={13} color="#F59E0B" />;
      case 'copy_paste':
        return <IconClipboard size={13} color="#EF4444" />;
      default:
        return <IconAlert size={13} color="#F59E0B" />;
    }
  }

  return (
    <div className="admin-layout" style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.04 }}>
        <FlightPathLines color="#2B7FFF" opacity={1} count={8} className="" />
      </div>

      <AdminSidebar activeTab="monitor" />

      <main className="admin-content" style={{ position: 'relative', zIndex: 1, overflow: 'auto' }}>

        {/* ─── Top Bar / Header ─── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                <ShimmerText text="Live Proctor Monitor" shimmer={false} />
              </h1>
              <span style={{
                background: 'rgba(43,127,255,0.15)', border: '1px solid rgba(43,127,255,0.4)',
                color: 'var(--color-primary)', fontSize: '0.72rem', fontWeight: 700,
                padding: '2px 8px', borderRadius: 999, letterSpacing: '0.06em',
              }}>
                100-STUDENT WALL
              </span>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
              Real-time candidate telemetry via Supabase Realtime & WebSockets
            </p>
          </div>

          <div
            style={{
              width: '100%',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconCamera size={18} color="#34D399" />
              <span style={{ fontSize: '0.8rem', color: '#34D399', fontWeight: 600 }}>
                <strong>3rd-Party Camera Telemetry Active:</strong> Live optical presence indicator. Telemetry is monitored on client devices only; video/audio streams are never stored on institutional servers.
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#10B981', background: 'rgba(16,185,129,0.2)', padding: '2px 8px', borderRadius: 999, fontWeight: 800 }}>
              ● TELEMETRY ONLY (COMPLIANT)
            </span>
          </div>

          {/* Quick exam picker + Action Buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {filteredExamOptions.slice(0, 4).map(item => (
                <button
                  key={item.exam_code}
                  type="button"
                  onClick={() => subscribe(item.exam_code)}
                  style={{
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                    fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
                    border: '1px solid',
                    borderColor: examCode === item.exam_code ? 'var(--color-primary)' : 'var(--color-border)',
                    background: examCode === item.exam_code ? 'rgba(43,127,255,0.2)' : 'rgba(0,0,0,0.2)',
                    color: examCode === item.exam_code ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {item.exam_code}
                </button>
              ))}
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input
                className="form-input"
                style={{ width: 195, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', fontSize: '0.84rem', padding: '7px 12px' }}
                placeholder="Exam Code..."
                value={inputCode}
                onChange={e => setInputCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && inputCode && subscribe(inputCode)}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => inputCode && subscribe(inputCode)}
                disabled={loading || !inputCode}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', whiteSpace: 'nowrap' }}
              >
                {loading ? <span className="btn-spinner" /> : <><IconRadio size={14} /> <span>Connect</span></>}
              </button>
            </div>

            {examCode && (
              <>
                <button
                  type="button"
                  onClick={handleStartExamFromMonitor}
                  disabled={releasingLobby}
                  style={{
                    padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(16,185,129,0.6)',
                    background: examStarted ? 'rgba(16,185,129,0.22)' : 'linear-gradient(135deg, #059669, #10B981)',
                    color: '#FFFFFF', fontSize: '0.76rem', fontWeight: 800,
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <IconLaunch size={14} color="#FFFFFF" />
                  <span>{examStarted ? 'Exam Live (Re-Sync Start)' : 'Start Exam & Unlock Lobby'}</span>
                </button>

                {filteredWaiting.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleReleaseStudent(undefined, true)}
                    disabled={releasingLobby}
                    style={{
                      padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(56,189,248,0.5)',
                      background: 'rgba(56,189,248,0.16)',
                      color: '#38BDF8', fontSize: '0.76rem', fontWeight: 800,
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <IconCheck size={14} color="#38BDF8" />
                    <span>Release Lobby ({filteredWaiting.length})</span>
                  </button>
                )}

                <a
                  href={`/waiting-lobby/${encodeURIComponent(examCode)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '7px 12px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(234,168,18,0.45)',
                    background: 'rgba(234,168,18,0.12)',
                    color: '#FDE68A', fontSize: '0.76rem', fontWeight: 700,
                    textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <IconUsers size={14} color="#FDE68A" />
                  <span>View Student Lobby ↗</span>
                </a>
              </>
            )}

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute alert sounds' : 'Enable alert sounds'}
              style={{
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: soundEnabled ? 'rgba(43,127,255,0.1)' : 'rgba(0,0,0,0.2)',
                color: soundEnabled ? 'var(--color-primary)' : 'var(--color-text-faint)',
                cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              {soundEnabled ? <IconVolume size={16} /> : <IconVolumeMute size={16} />}
            </button>

            {/* Broadcast to All Button */}
            <button
              onClick={() => setBroadcastModalOpen(true)}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(245,158,11,0.5)',
                background: 'rgba(245,158,11,0.15)',
                color: '#FBBF24', fontSize: '0.76rem', fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <IconChat size={14} color="#FBBF24" />
              <span>Broadcast Alert</span>
            </button>

            {/* Emergency Room Lockdown / Resume All */}
            <button
              onClick={handleToggleRoomFreeze}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                border: isRoomFrozen ? '1px solid #10B981' : '1px solid rgba(239,68,68,0.5)',
                background: isRoomFrozen ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)',
                color: isRoomFrozen ? '#34D399' : '#F87171',
                fontSize: '0.76rem', fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
              title={isRoomFrozen ? 'Reactivate all candidate terminals' : 'Freeze all candidate terminals immediately'}
            >
              {isRoomFrozen ? (
                <>
                  <IconFlash size={14} color="#34D399" />
                  <span>Resume All</span>
                </>
              ) : (
                <>
                  <IconStop size={14} color="#F87171" />
                  <span>Master Room Freeze</span>
                </>
              )}
            </button>

            {/* 3D Matrix Toggle Button */}
            <button
              onClick={() => setShow3DMatrix(m => !m)}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${show3DMatrix ? '#00F2FE' : 'rgba(43,127,255,0.4)'}`,
                background: show3DMatrix ? 'rgba(0,242,254,0.15)' : 'rgba(43,127,255,0.1)',
                color: show3DMatrix ? '#00F2FE' : 'var(--color-primary)',
                fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <IconGlobe size={14} />
              <span>{show3DMatrix ? 'Hide 3D Matrix' : '3D Orbital Matrix'}</span>
            </button>

            {/* Export Forensic Audit Report Button */}
            <button
              onClick={handleExportAudit}
              title="Download Forensic Audit Ledger"
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.06)',
                color: '#E2E8F0', fontSize: '0.76rem', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <IconDownload size={14} />
              <span>Export Audit</span>
            </button>

            {/* Outbound Email Hub Button */}
            <button
              onClick={() => setEmailHubOpen(true)}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(16,185,129,0.5)',
                background: 'rgba(16,185,129,0.15)',
                color: '#34D399', fontSize: '0.76rem', fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <IconMail size={14} />
              <span>Mail Dispatch Hub</span>
            </button>
          </div>
        </div>

        {/* ─── College, Course, Branch, Section & Exam Scoping Control Bar ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
          background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 14, padding: '14px 18px', marginBottom: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-primary, #38BDF8)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <IconBuilding size={13} color="var(--color-primary, #38BDF8)" />
                <span>College:</span>
              </span>
              <select
                value={selectedCollege}
                onChange={(e) => { setSelectedCollege(e.target.value); setSelectedSection('ALL') }}
                style={{
                  background: '#0B1120', border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#FFF', padding: '6px 10px', borderRadius: 8, fontSize: '0.84rem', fontWeight: 600,
                  cursor: 'pointer', maxWidth: 220,
                }}
              >
                <option value="ALL">All Colleges</option>
                {colleges.map(c => (
                  <option key={c.id} value={c.college_name}>{c.college_name} ({c.college_code})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <IconKey size={13} color="#F59E0B" />
                <span>Exam:</span>
              </span>
              <select
                value={examCode}
                onChange={(e) => subscribe(e.target.value)}
                style={{
                  background: '#0B1120', border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#38BDF8', padding: '6px 10px', borderRadius: 8, fontSize: '0.84rem', fontWeight: 700, fontFamily: 'var(--font-mono)'
                }}
              >
                {filteredExamOptions.length === 0 ? (
                  <option value="">No Exam Codes</option>
                ) : (
                  filteredExamOptions.map(ec => (
                    <option key={ec.exam_code} value={ec.exam_code}>
                      {ec.exam_code}{ec.exam_name && ec.exam_name !== ec.exam_code ? ` — ${ec.exam_name}` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#FDE68A', textTransform: 'uppercase' }}>Course:</span>
              <select
                aria-label="Filter monitor by course"
                value={selectedCourse}
                onChange={(e) => { setSelectedCourse(e.target.value); setSelectedBranch('ALL') }}
                style={{ background: '#0B1120', border: '1px solid rgba(255, 255, 255, 0.18)', color: '#FFF', padding: '6px 10px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600 }}
              >
                <option value="ALL">All Courses</option>
                {COURSE_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Branch:</span>
              <select
                aria-label="Filter monitor by branch"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                style={{ background: '#0B1120', border: '1px solid rgba(255, 255, 255, 0.18)', color: '#FFF', padding: '6px 10px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600 }}
              >
                <option value="ALL">All Branches</option>
                {getBranchesForCourse(selectedCourse).map(b => <option key={b.code} value={b.code}>{b.code}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#C084FC', textTransform: 'uppercase' }}>Section:</span>
              <select
                aria-label="Filter monitor by section"
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                style={{ background: '#0B1120', border: '1px solid rgba(255, 255, 255, 0.18)', color: '#FFF', padding: '6px 10px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600 }}
              >
                <option value="ALL">All Sections</option>
                {sectionFilterChoices.map(sec => (
                  <option key={sec} value={sec}>{sec.length === 1 ? `Section ${sec}` : sec}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              Scope: <strong style={{ color: '#10B981' }}>{selectedCollege === 'ALL' ? (activeExamMeta?.college_name || 'All Verified Colleges') : selectedCollege}</strong> &bull; Exam: <strong style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>{examCode || '—'}</strong>
              {activeExamMeta?.branch && <> &bull; <strong style={{ color: '#FDE68A' }}>{inferCourseFromBranch(activeExamMeta.branch)} {activeExamMeta.branch}</strong></>}
            </span>
          </div>
        </div>

        {/* ─── Action Notice Banner ─── */}
        <AnimatePresence>
          {actionNotice && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius-md)',
                background: 'rgba(43,127,255,0.15)', border: '1px solid rgba(43,127,255,0.4)',
                color: '#93c5fd', fontSize: '0.82rem', fontWeight: 600,
                marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <IconFlash size={14} color="#EAA812" /> {actionNotice}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Status & Simulation Bar ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          {/* Connection status */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 14px',
            background: connected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${connected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
            color: connected ? '#10B981' : '#EF4444',
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: connected ? '#10B981' : '#EF4444',
              animation: connected ? 'blink 1.5s infinite' : 'none',
            }} />
            {connected
              ? `REALTIME LIVE (${socketConnected ? 'SOCKET + DB SYNC' : 'DB SYNC'}) — Monitoring "${examCode}" • ${stats.waiting} in Lobby • ${stats.active} Active`
              : 'Connecting to Realtime stream...'}
          </div>

          {/* Telemetry Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button
              onClick={() => examCode && loadSnapshot(examCode)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: '6px 14px', borderRadius: 999,
                fontSize: '0.76rem', fontWeight: 700,
                border: '1px solid rgba(56,189,248,0.5)',
                background: 'rgba(56,189,248,0.12)',
                color: '#38BDF8',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <IconRefresh size={14} />
              <span style={{ fontSize: '0.75rem' }}>Refresh Telemetry</span>
            </motion.button>
          </div>
        </div>

        {/* ─── 6-Stats Cards (Including Waiting Lobby) ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Eligible Enrolled', value: stats.total,   color: 'var(--color-primary)',  icon: <IconUsers size={20} color="var(--color-primary)" /> },
            { label: 'In Waiting Lobby',  value: stats.waiting, color: '#38BDF8',               icon: <IconRadio size={20} color="#38BDF8" /> },
            { label: 'Active Answering',  value: stats.active,  color: '#10B981',               icon: <IconFlash size={20} color="#10B981" /> },
            { label: 'Idle / Paused',     value: stats.idle,    color: '#F59E0B',               icon: <IconClock size={20} color="#F59E0B" /> },
            { label: 'Flagged Cheating',  value: stats.cheat,   color: '#EF4444',               icon: <IconAlert size={20} color="#EF4444" /> },
            { label: 'Completed',         value: stats.done,    color: '#64748B',               icon: <IconCheck size={20} color="#64748B" /> },
          ].map(({ label, value, color, icon }) => (
            <GlowCard key={label} glowColor={color + '25'} style={{ padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', marginBottom: 2, display: 'flex', justifyContent: 'center' }}>{icon}</div>
              <motion.div
                key={value}
                initial={{ scale: 1.15, color }}
                animate={{ scale: 1, color }}
                style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, color, lineHeight: 1 }}
              >
                {value}
              </motion.div>
              <div style={{ fontSize: '0.68rem', color: 'var(--color-text-faint)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {label}
              </div>
            </GlowCard>
          ))}
        </div>

        {/* ─── Monitor & Waiting Lobby View Switcher ─── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { id: 'wall', label: `Live Proctor Wall (${filteredStudents.length})`, color: '#38BDF8' },
            { id: 'lobby', label: `Waiting Lobby Queue (${filteredWaiting.length})`, color: '#FBBF24' },
            { id: 'roster', label: `Eligible College Roster (${filteredRoster.length})`, color: '#10B981' },
          ].map(t => {
            const active = monitorTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setMonitorTab(t.id as any)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: active ? `1.5px solid ${t.color}` : '1px solid rgba(255,255,255,0.1)',
                  background: active ? `${t.color}20` : 'rgba(15, 23, 42, 0.7)',
                  color: active ? t.color : '#94A3B8',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* ─── Inline Waiting Lobby Strip (Visible whenever candidates wait on Proctor Wall tab) ─── */}
        {monitorTab === 'wall' && filteredWaiting.length > 0 && (
          <GlowCard glowColor="rgba(56,189,248,0.25)" style={{ padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconRadio size={16} color="#38BDF8" />
                <strong style={{ color: '#38BDF8', fontSize: '0.9rem' }}>
                  Pre-Exam Waiting Lobby ({filteredWaiting.length} awaiting release)
                </strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setMonitorTab('lobby')}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.76rem', color: '#FDE68A', border: '1px solid rgba(234,168,18,0.35)' }}
                >
                  Inspect Full Lobby Queue →
                </button>
                <button
                  type="button"
                  onClick={() => handleReleaseStudent(undefined, true)}
                  disabled={releasingLobby}
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: '0.76rem' }}
                >
                  Release All Waiting
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {filteredWaiting.slice(0, 10).map(w => (
                <div
                  key={w.hall_ticket_no}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 8,
                    background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)',
                    fontSize: '0.76rem',
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38BDF8' }}>{w.hall_ticket_no}</span>
                  <span style={{ color: '#E2E8F0' }}>{w.student_name}</span>
                  <span style={{ color: '#C084FC', fontSize: '0.7rem', fontWeight: 700 }}>Sec {w.section || 'A'}</span>
                  <button
                    type="button"
                    onClick={() => handleReleaseStudent(w.hall_ticket_no)}
                    style={{
                      padding: '2px 8px', borderRadius: 4, border: 'none',
                      background: '#10B981', color: '#052E16', fontWeight: 800, fontSize: '0.68rem', cursor: 'pointer',
                    }}
                  >
                    Release
                  </button>
                </div>
              ))}
            </div>
          </GlowCard>
        )}

        {/* ─── 3D Orbital Candidate Radar Matrix (When toggled) ─── */}
        <AnimatePresence>
          {show3DMatrix && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginBottom: 18 }}
            >
              <InspectorRadarMatrix3D
                students={filteredStudents}
                onSelectStudent={s => setSelectedStudent(s)}
                selectedId={selectedStudent?.id}
                height={380}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Main 2-Column: Active Tab Content + Event/Inspector Stream ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 16, alignItems: 'start' }}>

          {/* Left Column: Wall OR Waiting Lobby Queue OR Eligible Roster */}
          {monitorTab === 'wall' ? (
            <GlowCard noPadding style={{ padding: 18 }}>
              <LiveGridWall
                students={filteredStudents}
                selectedId={selectedStudent?.id}
                onSelectStudent={s => setSelectedStudent(s)}
                onWarnStudent={handleSendWarning}
                onTerminateStudent={handleTerminateStudent}
                onExtendTime={s => handleExtendTime(s, 5)}
                onPauseResume={handlePauseResume}
                onOpenDossier={s => setTimelineCandidate(s)}
                onReleaseStudent={s => handleReleaseStudent(s.hallTicket || s.id)}
              />
            </GlowCard>
          ) : monitorTab === 'lobby' ? (
            <GlowCard style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#F8FAFC' }}>
                    Waiting Lobby Queue — {examCode}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94A3B8' }}>
                    Candidates connected to the waiting room awaiting supervisor release or simultaneous exam launch.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleReleaseStudent(undefined, true)}
                    disabled={releasingLobby || filteredWaiting.length === 0}
                    className="btn btn-primary btn-sm"
                  >
                    Release All ({filteredWaiting.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleStartExamFromMonitor}
                    disabled={releasingLobby}
                    className="btn btn-secondary btn-sm"
                    style={{ borderColor: 'rgba(16,185,129,0.5)', color: '#34D399' }}
                  >
                    Start Exam Now
                  </button>
                </div>
              </div>

              {filteredWaiting.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', background: 'rgba(0,0,0,0.2)', borderRadius: 10 }}>
                  <div style={{ fontWeight: 700, color: '#E2E8F0', marginBottom: 6 }}>No candidates currently waiting in lobby</div>
                  <div style={{ fontSize: '0.8rem', marginBottom: 14 }}>
                    When students enter via Enter Exam or Student Dashboard before exam start, they appear here in real time.
                  </div>
                  {examCode && (
                    <a
                      href={`/waiting-lobby/${encodeURIComponent(examCode)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      Open Waiting Lobby Page ↗
                    </a>
                  )}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Hall Ticket</th>
                        <th>Candidate</th>
                        <th>Course / Branch</th>
                        <th>Section</th>
                        <th>Joined</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWaiting.map(w => (
                        <tr key={w.hall_ticket_no}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38BDF8' }}>{w.hall_ticket_no}</td>
                          <td>
                            <div style={{ fontWeight: 700, color: '#F8FAFC' }}>{w.student_name}</div>
                            <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{w.college_name || activeExamMeta?.college_name || 'Unassigned'}</div>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.76rem', color: '#FDE68A', fontWeight: 700 }}>
                              {inferCourseFromBranch(w.branch)}
                            </span>{' '}
                            <span style={{ fontSize: '0.76rem', color: '#CBD5E1' }}>• {w.branch || 'CSE'}</span>
                          </td>
                          <td>
                            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(168,85,247,0.16)', color: '#E9D5FF', fontSize: '0.74rem', fontWeight: 700 }}>
                              Sec {w.section || 'A'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.76rem', color: '#94A3B8' }}>
                            {w.joined_at ? new Date(w.joined_at).toLocaleTimeString() : 'Just now'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => handleReleaseStudent(w.hall_ticket_no)}
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                              >
                                Release
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBlockLobbyStudent(w.hall_ticket_no)}
                                className="btn btn-danger btn-sm"
                                style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                              >
                                Block
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectLobbyStudent(w.hall_ticket_no)}
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlowCard>
          ) : (
            <GlowCard style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#F8FAFC' }}>
                    Eligible College Roster ({filteredRoster.length})
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94A3B8' }}>
                    Full roster matching this exam&apos;s College, Course, Branch &amp; Target Sections.
                  </p>
                </div>
              </div>
              {filteredRoster.length === 0 ? (
                <div style={{ padding: 36, textAlign: 'center', color: '#94A3B8' }}>
                  No enrolled students match the current College / Course / Branch / Section filter.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
                  <table className="data-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Hall Ticket</th>
                        <th>Name</th>
                        <th>Course / Branch</th>
                        <th>Section</th>
                        <th>Presence</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRoster.map(r => {
                        const pColor = r.presence === 'in_progress' || r.presence === 'active'
                          ? '#10B981'
                          : r.presence === 'in_lobby'
                            ? '#38BDF8'
                            : r.presence === 'completed' || r.presence === 'submitted'
                              ? '#A78BFA'
                              : '#64748B'
                        return (
                          <tr key={r.id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38BDF8' }}>{r.hall_ticket}</td>
                            <td>
                              <div style={{ fontWeight: 700, color: '#F8FAFC' }}>{r.name}</div>
                              <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{r.college_name}</div>
                            </td>
                            <td style={{ fontSize: '0.78rem' }}>
                              <strong style={{ color: '#FDE68A' }}>{inferCourseFromBranch(r.branch)}</strong> • {r.branch}
                            </td>
                            <td>
                              <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(168,85,247,0.14)', color: '#E9D5FF', fontSize: '0.74rem', fontWeight: 700 }}>
                                Sec {r.section || 'A'}
                              </span>
                            </td>
                            <td>
                              <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 800, background: `${pColor}20`, color: pColor }}>
                                {r.presence === 'in_lobby' ? 'IN WAITING LOBBY' : r.presence.replace(/_/g, ' ').toUpperCase()}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, color: '#F8FAFC' }}>
                              {r.score !== undefined ? `${r.score}%` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </GlowCard>
          )}

          {/* Right Column: Selected Inspector + Live Events */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Selected Student Inspector Drawer */}
            <AnimatePresence>
              {selectedStudent && (
                <motion.div
                  key={selectedStudent.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <GlowCard glowColor={
                    selectedStudent.status === 'cheating' ? 'rgba(239,68,68,0.4)' :
                    selectedStudent.status === 'active' ? 'rgba(16,185,129,0.25)' :
                    'rgba(43,127,255,0.25)'
                  } style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1.2rem', display: 'inline-flex', alignItems: 'center' }}>
                          {selectedStudent.status === 'cheating' ? <IconAlert size={18} color="#EF4444" /> : selectedStudent.status === 'offline' ? <IconCheck size={18} color="#64748B" /> : <IconUsers size={18} color="var(--color-primary)" />}
                        </span>
                        <div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92rem', fontWeight: 800 }}>
                            {selectedStudent.hallTicket}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)' }}>
                            {selectedStudent.name}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedStudent(null)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer', fontSize: '1.1rem' }}
                      >
                        ×
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8rem', marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-faint)' }}>Status</span>
                        <span style={{
                          color: selectedStudent.status === 'active' ? '#10B981' :
                            selectedStudent.status === 'cheating' ? '#EF4444' :
                            selectedStudent.status === 'idle' ? '#F59E0B' : '#64748B',
                          fontWeight: 700,
                        }}>
                          {selectedStudent.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-faint)' }}>Current Question</span>
                        <span style={{ fontWeight: 700 }}>Q{selectedStudent.currentQuestion || 1} / 15</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--color-text-faint)' }}>Auto-graded (MCQ)</span>
                        <span style={{ fontWeight: 700, color: (selectedStudent.score || 0) >= 60 ? '#10B981' : '#F59E0B' }}>
                          {selectedStudent.score !== undefined ? `${selectedStudent.score}%` : 'Evaluating'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--color-text-faint)' }}>Coding Questions</span>
                        <span style={{
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          color: '#38BDF8',
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}>
                          Pending Manual Review
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-faint)' }}>Violations</span>
                        <span style={{ fontWeight: 800, color: (selectedStudent.flagCount || 0) > 0 ? '#EF4444' : '#10B981' }}>
                          {selectedStudent.flagCount || 0} Flags
                        </span>
                      </div>
                    </div>

                    {/* AI Threat Index & Integrity Assessment */}
                    {(() => {
                      const flags = selectedStudent.flagCount || 0
                      const threatScore = Math.min(100, flags * 25 + (selectedStudent.status === 'cheating' ? 45 : selectedStudent.status === 'idle' ? 15 : 5))
                      const threatColor = threatScore > 70 ? '#EF4444' : threatScore > 35 ? '#F59E0B' : '#10B981'
                      const threatLabel = threatScore > 70 ? 'CRITICAL RISK' : threatScore > 35 ? 'ELEVATED' : 'NOMINAL'
                      const recommendation = threatScore > 70
                        ? 'RECOM: Disqualify session'
                        : threatScore > 35
                        ? 'RECOM: Issue whisper reprimand'
                        : 'INTEGRITY: Verified healthy'

                      return (
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${threatColor}35`, borderRadius: 8, padding: '8px 10px', marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--color-text-faint)', textTransform: 'uppercase' }}>
                              AI Threat Index
                            </span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: threatColor }}>
                              {threatScore}% • {threatLabel}
                            </span>
                          </div>
                          <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
                            <div style={{ width: `${threatScore}%`, height: '100%', background: threatColor, transition: 'width 0.4s ease' }} />
                          </div>
                          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: threatColor, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            {threatScore > 70 ? <IconAlert size={11} color={threatColor} /> : threatScore > 35 ? <IconAlert size={11} color={threatColor} /> : <IconShield size={11} color={threatColor} />}
                            <span>{recommendation}</span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <MagneticButton
                          className="btn btn-warning btn-sm"
                          onClick={() => handleSendWarning(selectedStudent)}
                          style={{ fontSize: '0.72rem', padding: '6px 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        >
                          <IconAlert size={12} />
                          <span>Warn</span>
                        </MagneticButton>
                        <MagneticButton
                          className="btn btn-danger btn-sm"
                          onClick={() => handleTerminateStudent(selectedStudent)}
                          style={{ fontSize: '0.72rem', padding: '6px 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        >
                          <IconStop size={12} />
                          <span>Terminate</span>
                        </MagneticButton>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                        <button
                          onClick={() => setWhisperModalStudent(selectedStudent)}
                          style={{
                            background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)',
                            color: '#60A5FA', borderRadius: 6, padding: '5px 4px', fontSize: '0.68rem',
                            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                          }}
                        >
                          <IconChat size={12} />
                          <span>Whisper</span>
                        </button>
                        <button
                          onClick={() => handleExtendTime(selectedStudent, 5)}
                          style={{
                            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
                            color: '#34D399', borderRadius: 6, padding: '5px 4px', fontSize: '0.68rem',
                            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                          }}
                        >
                          <IconClock size={12} />
                          <span>+5m</span>
                        </button>
                        <button
                          onClick={() => handlePauseResume(selectedStudent)}
                          style={{
                            background: selectedStudent.status === 'idle' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                            border: `1px solid ${selectedStudent.status === 'idle' ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'}`,
                            color: selectedStudent.status === 'idle' ? '#34D399' : '#FBBF24',
                            borderRadius: 6, padding: '5px 4px', fontSize: '0.68rem',
                            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                          }}
                        >
                          {selectedStudent.status === 'idle' ? (
                            <>
                              <IconFlash size={12} />
                              <span>Resume</span>
                            </>
                          ) : (
                            <>
                              <IconStop size={12} />
                              <span>Pause</span>
                            </>
                          )}
                        </button>
                      </div>

                      <MagneticButton
                        className="btn btn-ghost btn-sm w-full"
                        onClick={() => setTimelineCandidate(selectedStudent)}
                        style={{ fontSize: '0.72rem', padding: '6px 8px', border: '1px solid rgba(255,255,255,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        <IconClipboard size={14} />
                        <span>Full Forensic Dossier & Timeline</span>
                      </MagneticButton>
                    </div>
                  </GlowCard>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Real-time Proctor Events Feed */}
            <GlowCard style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{
                  fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 800,
                  color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
                }}>
                  Live Violations Feed
                </h4>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)' }}>
                  {events.length} events
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
                <AnimatePresence initial={false}>
                  {events.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', textAlign: 'center', padding: '32px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <IconShield size={14} color="#10B981" />
                      <span>All clear — no violations logged</span>
                    </div>
                  ) : (
                    events.map(ev => {
                      const isFace = ev.event_type.includes('face')
                      const isTab = ev.event_type === 'tab_switch'
                      const isDanger = isFace || isTab

                      return (
                        <motion.div
                          key={ev.id}
                          initial={{ opacity: 0, x: 16, height: 0 }}
                          animate={{ opacity: 1, x: 0, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          style={{
                            padding: '8px 10px',
                            background: isDanger ? 'rgba(239,68,68,0.08)' : 'rgba(43,127,255,0.06)',
                            border: '1px solid',
                            borderColor: isDanger ? 'rgba(239,68,68,0.25)' : 'var(--color-border)',
                            borderRadius: 8, fontSize: '0.74rem',
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                            <span>{getEventIcon(ev.event_type)}</span>
                            <span style={{ fontWeight: 800, color: isDanger ? '#EF4444' : 'var(--color-text)' }}>
                              {ev.event_type.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-faint)', fontSize: '0.68rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)' }}>{ev.candidate_id}</span>
                            <span>{new Date(ev.created_at).toLocaleTimeString()}</span>
                          </div>
                        </motion.div>
                      )
                    })
                  )}
                </AnimatePresence>
              </div>
            </GlowCard>

            {/* Quick Dial Card */}
            {stats.total > 0 && (
              <GlowCard style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ position: 'relative', width: 74, height: 74, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#2B7FFF" strokeWidth="8" strokeDasharray={`${(stats.avgScore / 100) * 251.3} 251.3`} strokeLinecap="round" />
                  </svg>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>{Math.round(stats.avgScore)}%</div>
                    <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginTop: 2 }}>Avg</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  <div>Completion: <strong style={{ color: 'var(--color-text)' }}>{stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%</strong></div>
                  <div>Cheat rate: <strong style={{ color: stats.cheat > 0 ? '#EF4444' : '#10B981' }}>{stats.total > 0 ? Math.round((stats.cheat / stats.total) * 100) : 0}%</strong></div>
                  <div>Status: <strong style={{ color: '#10B981' }}>STREAMING</strong></div>
                </div>
              </GlowCard>
            )}
          </div>
        </div>
      </main>

      <CandidateViolationTimelineModal
        isOpen={Boolean(timelineCandidate)}
        onClose={() => setTimelineCandidate(null)}
        attemptId={timelineCandidate?.id || timelineCandidate?.hallTicket || ''}
        candidateName={timelineCandidate?.name}
        hallTicket={timelineCandidate?.hallTicket}
        examCode={examCode}
      />

      {/* ── Broadcast Announcement Modal ── */}
      <AnimatePresence>
        {broadcastModalOpen && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(5, 7, 15, 0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              style={{
                width: '100%', maxWidth: 540,
                background: '#0B1120', border: '1px solid rgba(43, 127, 255, 0.4)',
                borderRadius: 16, padding: 24, boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(43,127,255,0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconChat size={20} color="#38BDF8" />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      Broadcast to Exam Room
                    </h3>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Transmits an instant high-priority banner to all candidates taking <strong>{examCode}</strong>.
                  </p>
                </div>
                <button
                  onClick={() => setBroadcastModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label="Close"
                >
                  <IconCross size={16} />
                </button>
              </div>

              {/* Preset Quick Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {[
                  '10 minutes remaining in this examination.',
                  'Ensure your webcam and face remain centered.',
                  'Tab switches are being recorded into forensic ledger.',
                  'Remember to review and submit before time expires.'
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setBroadcastMessage(preset)}
                    style={{
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--color-text-muted)', borderRadius: 20, padding: '4px 10px',
                      fontSize: '0.7rem', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <textarea
                value={broadcastMessage}
                onChange={e => setBroadcastMessage(e.target.value)}
                placeholder="Type your official announcement here..."
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box', background: '#070D18',
                  border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: 8,
                  padding: 12, color: 'var(--color-text)', fontSize: '0.86rem',
                  fontFamily: 'inherit', resize: 'vertical', marginBottom: 16,
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setBroadcastModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!broadcastMessage.trim()}
                  onClick={handleBroadcastToAll}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <IconChat size={14} />
                  <span>Broadcast to All Candidates</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Candidate Direct Whisper / Notice Modal ── */}
      <AnimatePresence>
        {whisperModalStudent && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(5, 7, 15, 0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              style={{
                width: '100%', maxWidth: 520,
                background: '#0B1120', border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: 16, padding: 24, boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(245, 158, 11, 0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconChat size={20} color="#F59E0B" />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      Direct Notice to Candidate
                    </h3>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Recipient: <strong style={{ color: '#60A5FA' }}>{whisperModalStudent.name}</strong> ({whisperModalStudent.hallTicket})
                  </p>
                </div>
                <button
                  onClick={() => setWhisperModalStudent(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label="Close"
                >
                  <IconCross size={16} />
                </button>
              </div>

              {/* Direct Warning Preset Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {[
                  'Look directly at the screen; multiple off-screen glances detected.',
                  'Ensure no one else is present in your testing environment.',
                  'Disable any unauthorized browser extensions immediately.',
                  'Stay focused on the quiz window to avoid auto-disqualification.'
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setWhisperMessage(preset)}
                    style={{
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--color-text-muted)', borderRadius: 20, padding: '4px 10px',
                      fontSize: '0.7rem', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <textarea
                value={whisperMessage}
                onChange={e => setWhisperMessage(e.target.value)}
                placeholder="Type direct proctor instruction to this candidate..."
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box', background: '#070D18',
                  border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: 8,
                  padding: 12, color: 'var(--color-text)', fontSize: '0.86rem',
                  fontFamily: 'inherit', resize: 'vertical', marginBottom: 16,
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setWhisperModalStudent(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-warning btn-sm"
                  disabled={!whisperMessage.trim()}
                  onClick={handleSendWhisper}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <IconChat size={14} />
                  <span>Send Direct Reprimand</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Email Dispatch & Live Mailbox Hub Modal ── */}
      <AnimatePresence>
        {emailHubOpen && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(5, 7, 15, 0.88)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              style={{
                width: '100%', maxWidth: 780, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                background: '#0B1120', border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 16, padding: 24, boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(16,185,129,0.15)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <IconMail size={22} color="#10B981" />
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      Outbound Mail & Invigilator Dispatch Hub
                    </h3>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Authoritative transmission ledger for candidate hall tickets, OTPs, submission receipts, and proctoring violation alerts for <strong>{examCode}</strong>.
                  </p>
                </div>
                <button
                  onClick={() => setEmailHubOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', fontSize: '1.3rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label="Close"
                >
                  <IconCross size={16} />
                </button>
              </div>

              {/* Stats Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', textTransform: 'uppercase' }}>Total Dispatches</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38BDF8', marginTop: 2 }}>{emailLogs.length} Records</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', textTransform: 'uppercase' }}>Delivery Rate</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10B981', marginTop: 2 }}>100% Verified</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', textTransform: 'uppercase' }}>Exam Room</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#A78BFA', marginTop: 2 }}>{examCode}</div>
                </div>
              </div>

              {/* Test Dispatch Workbench */}
              <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconFlash size={14} color="#34D399" />
                  <span>Live Interactive Email Dispatch Workbench</span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    type="email"
                    placeholder="Recipient email (e.g. proctor@university.edu)..."
                    value={testEmailRecipient}
                    onChange={e => setTestEmailRecipient(e.target.value)}
                    style={{
                      flex: 1, minWidth: 220, background: '#070D18', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 6, padding: '6px 12px', color: '#FFF', fontSize: '0.82rem',
                    }}
                  />
                  <select
                    value={testEmailType}
                    onChange={e => setTestEmailType(e.target.value)}
                    style={{
                      background: '#070D18', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 6, padding: '6px 10px', color: '#FFF', fontSize: '0.82rem',
                    }}
                  >
                    <option value="invitation">Hall Ticket & Passcode</option>
                    <option value="otp">OTP Verification Passcode</option>
                    <option value="submission_receipt">Submission Receipt</option>
                    <option value="inspector_issue_alert">Anomaly Proctor Alert</option>
                    <option value="inspector_notice">Direct Invigilator Reprimand</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={testEmailSending || !testEmailRecipient.trim()}
                    onClick={handleTestEmailDispatch}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}
                  >
                    {testEmailSending ? <span className="btn-spinner" /> : <><IconLaunch size={14} /> <span>Dispatch Now</span></>}
                  </button>
                </div>
              </div>

              {/* Stream Logs Table */}
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--color-text-faint)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Type</th>
                      <th style={{ padding: '8px 12px' }}>Recipient</th>
                      <th style={{ padding: '8px 12px' }}>Subject</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-faint)' }}>
                          No outbound dispatches logged for this examination session yet.
                        </td>
                      </tr>
                    ) : (
                      emailLogs.map(log => {
                        const isAlert = log.type.includes('alert')
                        const isWarn = log.type.includes('notice')
                        const typeBadgeColor = isAlert ? '#EF4444' : isWarn ? '#F59E0B' : '#38BDF8'

                        return (
                          <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{
                                background: `${typeBadgeColor}15`, border: `1px solid ${typeBadgeColor}40`,
                                color: typeBadgeColor, borderRadius: 4, padding: '2px 6px',
                                fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase'
                              }}>
                                {log.type.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', color: '#FFF', fontWeight: 600 }}>
                              {log.recipient}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>
                              {log.subject}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <span style={{ color: '#10B981', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <IconCheck size={12} color="#10B981" />
                                <span>{log.status}</span>
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-faint)', fontFamily: 'monospace' }}>
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Close Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEmailHubOpen(false)}
                >
                  Close Mail Hub
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
