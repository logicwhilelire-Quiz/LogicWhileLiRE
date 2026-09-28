import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'
import LiveGridWall, { type StudentTile } from '../../components/3d/LiveGridWall'
import GlowCard from '../../components/3d/GlowCard'
import MagneticButton from '../../components/3d/MagneticButton'
import FlightPathLines from '../../components/3d/FlightPathLines'
import AltimeterDial from '../../components/3d/AltimeterDial'
import ShimmerText from '../../components/3d/ShimmerText'
import CandidateViolationTimelineModal from '../../components/CandidateViolationTimelineModal'

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

/* ── Shared Admin Sidebar ─────────────────────────────── */
function AdminSidebar({ active = '' }: { active?: string }) {
  const navigate = useNavigate()

  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard',      path: '/admin/dashboard' },
    { id: 'exam-codes',icon: '🔑', label: 'Exam Codes',     path: '/admin/exam-codes' },
    { id: 'create',    icon: '➕', label: 'Create Exam',    path: '/admin/create-exam' },
    { id: 'monitor',   icon: '👁️', label: 'Live Monitor',   path: '/admin/monitor' },
    { id: 'analytics', icon: '🔬', label: 'Analytics',      path: '/admin/analytics' },
    { id: 'questions', icon: '🤖', label: 'AI Questions',   path: '/admin/questions' },
    { id: 'colleges',  icon: '🏛️', label: 'Colleges',       path: '/admin/colleges' },
  ]

  return (
    <aside className="admin-sidebar" style={{ background: 'rgba(20,28,47,0.95)', backdropFilter: 'blur(20px)', borderRight: '1px solid var(--color-border)' }}>
      {/* Brand */}
      <div style={{ marginBottom: 24, padding: '0 4px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, var(--color-text), var(--color-primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          ⚡ GROWTHRAN
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--color-primary)', fontWeight: 700, letterSpacing: '0.1em', marginTop: 2 }}>4.0 ULTRA ADMIN</div>
      </div>

      {navItems.map(item => (
        <motion.button
          key={item.id}
          className={`admin-nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
          whileHover={{ x: 3 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <span>{item.icon}</span>
          {item.label}
          {item.id === 'monitor' && (
            <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: '#10B981', animation: 'blink 1.5s infinite', flexShrink: 0 }} />
          )}
        </motion.button>
      ))}

      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <motion.button
          className="admin-nav-item"
          onClick={() => {
            localStorage.removeItem('admin_token')
            navigate('/admin')
          }}
          whileHover={{ x: 3 }}
        >
          <span>🚪</span> Logout
        </motion.button>
      </div>
    </aside>
  )
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

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const idleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
          const isDone = !!a.submitted_at || a.status === 'completed'
          const isCheating = flags >= 3 || a.status === 'terminated_cheating'
          return {
            id: a.hall_ticket,
            name: a.hall_ticket,
            hallTicket: a.hall_ticket,
            status: isDone ? 'offline' : isCheating ? 'cheating' : 'active',
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

      <AdminSidebar active="monitor" />

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

        {/* ─── Main 2-Column: LiveGridWall + Event/Inspector Stream ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 16, alignItems: 'start' }}>

          {/* Student Grid Wall */}
          <GlowCard noPadding style={{ padding: 18 }}>
            <LiveGridWall
              students={students}
              selectedId={selectedStudent?.id}
              onSelectStudent={s => setSelectedStudent(s)}
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
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-faint)' }}>Estimated Score</span>
                        <span style={{ fontWeight: 700, color: (selectedStudent.score || 0) >= 60 ? '#10B981' : '#F59E0B' }}>
                          {selectedStudent.score !== undefined ? `${selectedStudent.score}%` : 'Evaluating'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-faint)' }}>Violations</span>
                        <span style={{ fontWeight: 800, color: (selectedStudent.flagCount || 0) > 0 ? '#EF4444' : '#10B981' }}>
                          {selectedStudent.flagCount || 0} Flags
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <MagneticButton
                          className="btn btn-warning btn-sm w-full"
                          onClick={() => handleSendWarning(selectedStudent)}
                          style={{ fontSize: '0.74rem', padding: '6px 8px' }}
                        >
                          ⚠️ Warn Student
                        </MagneticButton>
                        <MagneticButton
                          className="btn btn-danger btn-sm w-full"
                          onClick={() => handleTerminateStudent(selectedStudent)}
                          style={{ fontSize: '0.74rem', padding: '6px 8px' }}
                        >
                          🛑 Terminate
                        </MagneticButton>
                      </div>
                      <MagneticButton
                        className="btn btn-ghost btn-sm w-full"
                        onClick={() => setTimelineCandidate(selectedStudent)}
                        style={{ fontSize: '0.74rem', padding: '6px 8px', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        📋 View Violation Timeline & Overrides
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
      />
    </div>
  )
}
