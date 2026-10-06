import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { API_BASE_URL } from '../../lib/config'
import { supabase } from '../../lib/supabaseClient'
import LiveGridWall, { type StudentTile } from '../../components/3d/LiveGridWall'
import GlowCard from '../../components/3d/GlowCard'
import MagneticButton from '../../components/3d/MagneticButton'
import FlightPathLines from '../../components/3d/FlightPathLines'
import AltimeterDial from '../../components/3d/AltimeterDial'
import ShimmerText from '../../components/3d/ShimmerText'
import CandidateViolationTimelineModal from '../../components/CandidateViolationTimelineModal'
import InspectorRadarMatrix3D from '../../components/3d/InspectorRadarMatrix3D'
import AdminSidebar from '../../components/layout/AdminSidebar'

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

/* ── 100 Live Students Cohort Generator ────────────────── */
function generate100Students(examCode: string): StudentTile[] {
  const departments = ['CSE', 'ECE', 'IT', 'AI&DS', 'MECH']
  const students: StudentTile[] = []

  for (let i = 1; i <= 100; i++) {
    const pad = String(i).padStart(3, '0')
    const dept = departments[i % departments.length]
    const hallTicket = `2201A${dept === 'CSE' ? '05' : dept === 'IT' ? '12' : '04'}${pad}`

    // Realistic distribution: 73 active, 15 idle, 8 flagged (cheating), 4 offline (submitted)
    let status: StudentTile['status'] = 'active'
    let flagCount = 0
    let score = Math.floor(45 + Math.random() * 50)

    if (i % 12 === 0) {
      status = 'cheating'
      flagCount = Math.floor(3 + Math.random() * 4)
    } else if (i % 7 === 0) {
      status = 'idle'
      flagCount = Math.random() > 0.5 ? 1 : 0
    } else if (i > 96) {
      status = 'offline'
      score = Math.floor(75 + Math.random() * 25)
    }

    students.push({
      id: hallTicket,
      name: `Candidate ${pad}`,
      hallTicket,
      status,
      score,
      flagCount,
      joinedAt: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
      lastSeen: new Date().toISOString(),
      currentQuestion: Math.floor(1 + Math.random() * 15),
    })
  }

  return students
}

/* ── Main Monitor Component ───────────────────────────── */
export default function AdminMonitorPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()

  const defaultExamCode = (examId || 'DEMO123').toUpperCase()
  const [examCode, setExamCode] = useState(defaultExamCode)
  const [inputCode, setInputCode] = useState(defaultExamCode)
  const [students, setStudents] = useState<StudentTile[]>([])
  const [events, setEvents] = useState<ProctoringEvent[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentTile | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [actionNotice, setActionNotice] = useState('')
  const [timelineCandidate, setTimelineCandidate] = useState<StudentTile | null>(null)
  const [show3DMatrix, setShow3DMatrix] = useState(false)
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [whisperModalStudent, setWhisperModalStudent] = useState<StudentTile | null>(null)
  const [whisperMessage, setWhisperMessage] = useState('')
  const [isRoomFrozen, setIsRoomFrozen] = useState(false)

  /* ── College & Exam Scoping State ── */
  const [colleges, setColleges] = useState<Array<{ id: number; college_name: string; college_code: string }>>([])
  const [selectedCollege, setSelectedCollege] = useState<string>('ALL')
  const [availableExamCodes, setAvailableExamCodes] = useState<string[]>([])

  /* ── Outbound Email Hub State ── */
  const [emailHubOpen, setEmailHubOpen] = useState(false)
  const [emailLogs, setEmailLogs] = useState<Array<{ id: string; type: string; recipient: string; recipientName?: string; examCode: string; subject: string; status: string; timestamp: string }>>([])
  const [testEmailType, setTestEmailType] = useState('invitation')
  const [testEmailRecipient, setTestEmailRecipient] = useState('')
  const [testEmailSending, setTestEmailSending] = useState(false)

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const idleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── Initial Mount: Load Colleges & Active Exam Codes ── */
  useEffect(() => {
    axios.get(`${BASE_URL}/api/colleges`)
      .then(res => {
        if (res.data?.colleges) setColleges(res.data.colleges)
      })
      .catch(() => {
        axios.get(`${BASE_URL}/api/exam-code/colleges`)
          .then(res => { if (res.data?.colleges) setColleges(res.data.colleges) })
          .catch(() => {})
      })

    supabase.from('exam_codes').select('code, title').then(({ data }) => {
      if (data && data.length > 0) {
        setAvailableExamCodes(Array.from(new Set(data.map(d => d.code).filter(Boolean))))
      }
    })
  }, [])

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

  /* ── Load initial snapshot from DB ── */
  const loadSnapshot = useCallback(async (code: string) => {
    if (!code) return
    setLoading(true)
    try {
      const { data: attempts } = await supabase
        .from('exam_code_attempts')
        .select('hall_ticket, score, percentage, started_at, submitted_at, status')
        .eq('exam_code', code)

      const { data: violations } = await supabase
        .from('proctor_logs')
        .select('candidate_id, event_type, created_at, metadata')
        .eq('exam_id', code)

      const flagMap = new Map<string, number>()
      ;(violations || []).forEach(v => {
        flagMap.set(v.candidate_id, (flagMap.get(v.candidate_id) || 0) + 1)
      })

      if (attempts && attempts.length > 0) {
        const tiles: StudentTile[] = attempts.map(a => {
          const flags = flagMap.get(a.hall_ticket) || 0
          const isTerminated = a.status === 'terminated_cheating' || a.status === 'terminated' || a.status === 'Terminated - violation'
          const isCheating = !isTerminated && flags >= 3
          const isDone = !!a.submitted_at || a.status === 'completed'
          return {
            id: a.hall_ticket,
            name: a.hall_ticket,
            hallTicket: a.hall_ticket,
            status: isTerminated ? 'terminated' : isCheating ? 'cheating' : isDone ? 'offline' : 'active',
            score: a.percentage ? Math.round(a.percentage) : undefined,
            flagCount: flags,
            joinedAt: a.started_at,
          }
        })
        setStudents(tiles)
      } else {
        // Auto-seed initial cohort for DEMO123 / DEMO100
        const cohort = generate100Students(code)
        setStudents(cohort)
      }

      if (violations && violations.length > 0) {
        setEvents((violations as unknown as ProctoringEvent[]).slice(0, 50))
      }

      setConnected(true)
    } catch (err) {
      console.error('[Monitor] Snapshot load fallback', err)
      const cohort = generate100Students(code)
      setStudents(cohort)
      setConnected(true)
    } finally {
      setLoading(false)
    }
  }, [])

  /* ── Connect to Supabase Realtime Channels ── */
  const subscribe = useCallback((code: string) => {
    if (!code) return
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (broadcastChannelRef.current) {
      supabase.removeChannel(broadcastChannelRef.current)
      broadcastChannelRef.current = null
    }

    setExamCode(code)
    loadSnapshot(code)

    // Channel 1: Database Postgres changes (exam_code_attempts & proctor_logs)
    const attemptsChannel = supabase
      .channel(`monitor-db-${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_code_attempts', filter: `exam_code=eq.${code}` },
        payload => {
          const row = (payload.new || payload.old) as Record<string, unknown>
          const hallTicket = (row.hall_ticket || row.hall_ticket_no) as string
          if (!hallTicket) return

          if (payload.eventType === 'INSERT') {
            setStudents(prev => {
              if (prev.find(s => s.id === hallTicket)) return prev
              return [{
                id: hallTicket,
                name: hallTicket,
                hallTicket,
                status: 'active',
                flagCount: 0,
                joinedAt: new Date().toISOString(),
              }, ...prev]
            })
            resetIdleTimer(hallTicket)
          }

          if (payload.eventType === 'UPDATE') {
            const submitted = !!(row.submitted_at || row.end_time)
            const pct = row.percentage ? Math.round(row.percentage as number) : undefined
            setStudents(prev =>
              prev.map(s => s.id === hallTicket
                ? { ...s, status: submitted ? 'offline' : s.status, score: pct !== undefined ? pct : s.score }
                : s
              )
            )
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'proctor_logs', filter: `exam_id=eq.${code}` },
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
      .channel(`realtime:monitor-${code}`)
      .on('broadcast', { event: 'student_heartbeat' }, payload => {
        const data = payload.payload as { hallTicket: string; currentQuestion?: number; answeredCount?: number }
        if (!data?.hallTicket) return

        setStudents(prev => {
          const exists = prev.find(s => s.id === data.hallTicket)
          if (!exists) {
            return [{
              id: data.hallTicket,
              name: data.hallTicket,
              hallTicket: data.hallTicket,
              status: 'active',
              flagCount: 0,
              currentQuestion: data.currentQuestion,
              joinedAt: new Date().toISOString(),
            }, ...prev]
          }
          return prev.map(s => s.id === data.hallTicket
            ? { ...s, status: s.status === 'cheating' ? 'cheating' : 'active', currentQuestion: data.currentQuestion, lastSeen: new Date().toISOString() }
            : s
          )
        })
        resetIdleTimer(data.hallTicket)
      })
      .on('broadcast', { event: 'student_violation' }, payload => {
        const data = payload.payload as { hallTicket: string; eventType: string; message: string; violationCount: number }
        if (!data?.hallTicket) return

        recordEvent({
          id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          candidate_id: data.hallTicket,
          event_type: data.eventType,
          metadata: { message: data.message },
          created_at: new Date().toISOString(),
        })

        setStudents(prev =>
          prev.map(s => {
            if (s.id !== data.hallTicket) return s
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
  }, [loadSnapshot, recordEvent, resetIdleTimer])

  useEffect(() => {
    subscribe(examCode)
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (broadcastChannelRef.current) supabase.removeChannel(broadcastChannelRef.current)
      if (simTimerRef.current) clearInterval(simTimerRef.current)
      idleTimers.current.forEach(t => clearTimeout(t))
    }
  }, [examCode, subscribe])

  /* ── 100 Live Students Cohort Generator ── */
  const handleGenerateCohort = () => {
    const cohort = generate100Students(examCode)
    setStudents(cohort)
    setActionNotice(`⚡ 100 Students generated for ${examCode}!`)
    setTimeout(() => setActionNotice(''), 3000)
  }

  /* ── Interactive Live Simulation Toggle ── */
  const toggleSimulation = () => {
    if (isSimulating) {
      if (simTimerRef.current) clearInterval(simTimerRef.current)
      simTimerRef.current = null
      setIsSimulating(false)
      setActionNotice('⏸️ Simulation paused')
      setTimeout(() => setActionNotice(''), 2500)
      return
    }

    if (students.length === 0) {
      handleGenerateCohort()
    }

    setIsSimulating(true)
    setActionNotice('▶️ 100-student live simulation active!')
    setTimeout(() => setActionNotice(''), 3000)

    const eventTypes = ['tab_switch', 'multiple_faces', 'no_face', 'copy_paste']

    simTimerRef.current = setInterval(() => {
      setStudents(prev => {
        if (prev.length === 0) return prev
        const clone = [...prev]
        const idx = Math.floor(Math.random() * clone.length)
        const target = { ...clone[idx] }

        const actionRand = Math.random()

        if (actionRand < 0.35) {
          // Student answers question & score updates
          target.status = 'active'
          target.score = Math.min(100, (target.score || 50) + Math.floor(Math.random() * 5))
          target.currentQuestion = Math.min(15, (target.currentQuestion || 1) + 1)
        } else if (actionRand < 0.65) {
          // Cheat violation occurs
          const violationType = eventTypes[Math.floor(Math.random() * eventTypes.length)]
          target.flagCount = (target.flagCount || 0) + 1
          if (target.flagCount >= 3) {
            target.status = 'cheating'
          }
          recordEvent({
            id: `sim-ev-${Date.now()}`,
            candidate_id: target.hallTicket || target.name,
            event_type: violationType,
            metadata: { simulated: true },
            created_at: new Date().toISOString(),
          })
        } else if (actionRand < 0.85) {
          // Student goes idle or active
          target.status = target.status === 'active' ? 'idle' : 'active'
        } else {
          // Student submits exam
          if (target.status !== 'offline') {
            target.status = 'offline'
            target.score = Math.floor(65 + Math.random() * 35)
          }
        }

        clone[idx] = target
        return clone
      })
    }, 2200)
  }

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
    setActionNotice(`⚠️ Warning broadcasted to ${student.hallTicket}`)
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
    setActionNotice(`🛑 Terminated session for ${student.hallTicket}`)
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

    setActionNotice(`📢 Announcement broadcasted to all ${students.length} candidates in ${examCode}!`)
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

    setActionNotice(`💬 Direct notice sent to ${whisperModalStudent.hallTicket}`)
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
    setActionNotice(`📥 Downloaded forensic audit report for ${examCode}!`)
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
      setActionNotice(`📨 Test ${testEmailType} dispatched to ${testEmailRecipient}!`)
      fetchEmailLogs()
      setTimeout(() => setActionNotice(''), 3500)
    } catch {
      setActionNotice('❌ Failed to dispatch test email')
      setTimeout(() => setActionNotice(''), 3000)
    } finally {
      setTestEmailSending(false)
    }
  }

  /* ── Stats ── */
  const stats = {
    total:    students.length,
    active:   students.filter(s => s.status === 'active').length,
    idle:     students.filter(s => s.status === 'idle').length,
    cheat:    students.filter(s => s.status === 'cheating').length,
    done:     students.filter(s => s.status === 'offline').length,
    avgScore: students.filter(s => s.score !== undefined).length > 0
      ? Math.round(students.reduce((sum, s) => sum + (s.score || 0), 0) / students.filter(s => s.score !== undefined).length)
      : 0,
  }

  const getEventIcon = (type: string) => {
    const map: Record<string, string> = {
      tab_switch: '🔀', multiple_faces: '👥', no_face: '👤', copy_paste: '📋',
    }
    return map[type] || '⚠️'
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

          {/* Quick exam picker + Action Buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['DEMO123', 'DEMO100', 'CS2026'].map(code => (
                <button
                  key={code}
                  onClick={() => { setInputCode(code); subscribe(code) }}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                    fontSize: '0.74rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
                    border: '1px solid',
                    borderColor: examCode === code ? 'var(--color-primary)' : 'var(--color-border)',
                    background: examCode === code ? 'rgba(43,127,255,0.2)' : 'rgba(0,0,0,0.2)',
                    color: examCode === code ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {code}
                </button>
              ))}
            </div>

            <input
              className="form-input"
              style={{ width: 140, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', fontSize: '0.85rem', padding: '6px 10px' }}
              placeholder="Code..."
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && inputCode && subscribe(inputCode)}
            />
            <MagneticButton
              className="btn btn-primary btn-sm"
              onClick={() => inputCode && subscribe(inputCode)}
              disabled={loading || !inputCode}
            >
              {loading ? <span className="btn-spinner" /> : '📡 Connect'}
            </MagneticButton>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute alert sounds' : 'Enable alert sounds'}
              style={{
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: soundEnabled ? 'rgba(43,127,255,0.1)' : 'rgba(0,0,0,0.2)',
                color: soundEnabled ? 'var(--color-primary)' : 'var(--color-text-faint)',
                cursor: 'pointer', fontSize: '0.85rem',
              }}
            >
              {soundEnabled ? '🔊' : '🔇'}
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
              <span>📢 Broadcast Alert</span>
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
              <span>{isRoomFrozen ? '▶️ Resume All' : '⏸️ Master Room Freeze'}</span>
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
              <span>🌐 {show3DMatrix ? 'Hide 3D Matrix' : '3D Orbital Matrix'}</span>
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
              <span>📥 Export Audit</span>
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
              <span>📨 Mail Dispatch Hub</span>
            </button>
          </div>
        </div>

        {/* ─── College & Exam Scoping Control Bar ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
          background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 14, padding: '14px 20px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-primary, #38BDF8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🏛️ Active College:
              </span>
              <select
                value={selectedCollege}
                onChange={(e) => setSelectedCollege(e.target.value)}
                style={{
                  background: '#0B1120', border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#FFF', padding: '6px 12px', borderRadius: 8, fontSize: '0.86rem', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Colleges (Global Admin Scope)</option>
                {colleges.map(c => (
                  <option key={c.id} value={c.college_name}>{c.college_name} ({c.college_code})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🔑 Exam Code:
              </span>
              <select
                value={examCode}
                onChange={(e) => {
                  setInputCode(e.target.value)
                  subscribe(e.target.value)
                }}
                style={{
                  background: '#0B1120', border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#38BDF8', padding: '6px 12px', borderRadius: 8, fontSize: '0.86rem', fontWeight: 700, fontFamily: 'var(--font-mono)'
                }}
              >
                {Array.from(new Set(['DEMO123', 'DEMO100', 'CS2026', ...availableExamCodes])).map(code => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              Monitored Scope: <strong style={{ color: '#10B981' }}>{selectedCollege === 'ALL' ? 'All Verified Colleges' : selectedCollege}</strong> &bull; Exam: <strong style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>{examCode}</strong>
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
              <span>⚡</span> {actionNotice}
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
              ? `🔴 REALTIME LIVE — Monitoring "${examCode}" (${stats.total} Candidates)`
              : 'Connecting to Realtime stream...'}
          </div>

          {/* 100 Cohort Simulator Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button
              onClick={handleGenerateCohort}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: '6px 14px', borderRadius: 999,
                fontSize: '0.76rem', fontWeight: 700,
                border: '1px solid rgba(43,127,255,0.4)',
                background: 'rgba(43,127,255,0.1)',
                color: 'var(--color-primary)',
                cursor: 'pointer',
              }}
            >
              ⚡ 100 Students Cohort
            </motion.button>

            <motion.button
              onClick={toggleSimulation}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: '6px 14px', borderRadius: 999,
                fontSize: '0.76rem', fontWeight: 700,
                border: '1px solid',
                borderColor: isSimulating ? '#10B981' : 'rgba(245,158,11,0.5)',
                background: isSimulating ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.1)',
                color: isSimulating ? '#10B981' : '#F59E0B',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{isSimulating ? '⏸️ Stop Sim' : '▶️ Live Simulation'}</span>
            </motion.button>
          </div>
        </div>

        {/* ─── 5-Stats Cards ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Total Enrolled', value: stats.total,   color: 'var(--color-primary)',  icon: '👥' },
            { label: 'Active Answering',value: stats.active, color: '#10B981',               icon: '🟢' },
            { label: 'Idle / Paused',  value: stats.idle,    color: '#F59E0B',               icon: '🟡' },
            { label: 'Flagged Cheating',value: stats.cheat,  color: '#EF4444',               icon: '🔴' },
            { label: 'Completed',     value: stats.done,     color: '#64748B',               icon: '✅' },
          ].map(({ label, value, color, icon }) => (
            <GlowCard key={label} glowColor={color + '25'} style={{ padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', marginBottom: 2 }}>{icon}</div>
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
                students={students}
                onSelectStudent={s => setSelectedStudent(s)}
                selectedId={selectedStudent?.id}
                height={380}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Main 2-Column: LiveGridWall + Event/Inspector Stream ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 16, alignItems: 'start' }}>

          {/* Student Grid Wall */}
          <GlowCard noPadding style={{ padding: 18 }}>
            <LiveGridWall
              students={students}
              selectedId={selectedStudent?.id}
              onSelectStudent={s => setSelectedStudent(s)}
              onWarnStudent={handleSendWarning}
              onTerminateStudent={handleTerminateStudent}
              onExtendTime={s => handleExtendTime(s, 5)}
              onPauseResume={handlePauseResume}
              onOpenDossier={s => setTimelineCandidate(s)}
            />
          </GlowCard>

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
                        <span style={{ fontSize: '1.2rem' }}>
                          {selectedStudent.status === 'cheating' ? '🚨' : selectedStudent.status === 'offline' ? '🏁' : '👤'}
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
                        ? '🚨 RECOM: Disqualify session'
                        : threatScore > 35
                        ? '⚠️ RECOM: Issue whisper reprimand'
                        : '🛡️ INTEGRITY: Verified healthy'

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
                          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: threatColor, textAlign: 'center' }}>
                            {recommendation}
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
                          style={{ fontSize: '0.72rem', padding: '6px 6px' }}
                        >
                          ⚠️ Warn
                        </MagneticButton>
                        <MagneticButton
                          className="btn btn-danger btn-sm"
                          onClick={() => handleTerminateStudent(selectedStudent)}
                          style={{ fontSize: '0.72rem', padding: '6px 6px' }}
                        >
                          🛑 Terminate
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
                          💬 Whisper
                        </button>
                        <button
                          onClick={() => handleExtendTime(selectedStudent, 5)}
                          style={{
                            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
                            color: '#34D399', borderRadius: 6, padding: '5px 4px', fontSize: '0.68rem',
                            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                          }}
                        >
                          ⏱️ +5m
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
                          {selectedStudent.status === 'idle' ? '▶️ Resume' : '⏸️ Pause'}
                        </button>
                      </div>

                      <MagneticButton
                        className="btn btn-ghost btn-sm w-full"
                        onClick={() => setTimelineCandidate(selectedStudent)}
                        style={{ fontSize: '0.72rem', padding: '6px 8px', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        📋 Full Forensic Dossier & Timeline
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
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)', textAlign: 'center', padding: '32px 0' }}>
                      🛡️ All clear — no violations logged
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
                <AltimeterDial value={stats.avgScore} label="Cohort Avg" suffix="%" color="#2B7FFF" size={80} duration={1200} />
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
                    <span style={{ fontSize: '1.4rem' }}>📢</span>
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
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Preset Quick Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {[
                  '⏱️ 10 minutes remaining in this examination.',
                  '⚠️ Ensure your webcam and face remain centered.',
                  '🛡️ Tab switches are being recorded into forensic ledger.',
                  '✅ Remember to review and submit before time expires.'
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
                  <span>📢</span> Broadcast to All Candidates
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
                    <span style={{ fontSize: '1.4rem' }}>💬</span>
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
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  ✕
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
                  <span>💬</span> Send Direct Reprimand
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
                    <span style={{ fontSize: '1.5rem' }}>📨</span>
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
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', fontSize: '1.3rem', cursor: 'pointer' }}
                >
                  ✕
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
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  ⚡ Live Interactive Email Dispatch Workbench
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
                    <option value="invitation">🎓 Hall Ticket & Passcode</option>
                    <option value="otp">🔐 OTP Verification Passcode</option>
                    <option value="submission_receipt">✅ Submission Receipt</option>
                    <option value="inspector_issue_alert">🚨 Anomaly Proctor Alert</option>
                    <option value="inspector_notice">⚠️ Direct Invigilator Reprimand</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={testEmailSending || !testEmailRecipient.trim()}
                    onClick={handleTestEmailDispatch}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}
                  >
                    {testEmailSending ? <span className="btn-spinner" /> : '🚀 Dispatch Now'}
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
                              <span style={{ color: '#10B981', fontWeight: 800 }}>✓ {log.status}</span>
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
