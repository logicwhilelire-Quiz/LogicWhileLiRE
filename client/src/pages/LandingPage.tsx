import { Suspense, lazy, useRef, useEffect, useState } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import MagneticButton from '../components/3d/MagneticButton'
import ShimmerText from '../components/3d/ShimmerText'
import GlowCard from '../components/3d/GlowCard'
import AltimeterDial from '../components/3d/AltimeterDial'
import FlightPathLines from '../components/3d/FlightPathLines'
import LogicCoil from '../components/LogicCoil'
import SectorRadar3D from '../components/3d/SectorRadar3D'
import api from '../lib/api'

// Lazy-load 3D heavy components
const CollegeGlobe = lazy(() => import('../components/3d/CollegeGlobe'))
const LiquidBlob   = lazy(() => import('../components/3d/LiquidBlob'))
const ParticleField = lazy(() => import('../components/3d/ParticleField'))
const NodeNetwork   = lazy(() => import('../components/3d/NodeNetwork'))

const STATS = [
  { value: 10000,  label: 'Concurrent Capacity',      suffix: '+', color: '#2B7FFF' },
  { value: 50,     label: 'WebSocket Latency',        suffix: 'ms', color: '#38BDF8' },
  { value: 100,    label: 'Server Timing Integrity', suffix: '%', color: '#10B981' },
  { value: 99.9,   label: 'Telemetry Reliability',    suffix: '%', color: '#F59E0B' },
]

const FEATURES = [
  {
    icon: '⚡',
    title: 'Synchronous Live Exam Dispatch',
    desc: 'Instant global exam initialization over Socket.io with waiting lobbies, late-join time adjustment, and reconnection synchronization.',
    color: '#2B7FFF',
  },
  {
    icon: '👁️',
    title: 'Client-Side AI Proctoring',
    desc: 'On-device facial landmarking and active gaze tracking running entirely in browser Web Workers. Zero raw video ever transmitted to servers.',
    color: '#10B981',
  },
  {
    icon: '⏱️',
    title: 'Server-Authoritative Timing',
    desc: 'Eliminates client-side clock tampering. Server drives authoritative ticks and remaining duration math across all candidate terminals.',
    color: '#38BDF8',
  },
  {
    icon: '🛡️',
    title: 'Anti-Leak & Forensic Ledger',
    desc: 'Dynamic candidate watermark tiles, browser devtools detection, tab-switch monitoring, and real-time invigilator anomaly logging.',
    color: '#A855F7',
  },
  {
    icon: '📶',
    title: 'Offline Answer Resilience',
    desc: 'Local IndexedDB write-ahead answer buffer with automatic synchronization upon network reconnection to protect student responses.',
    color: '#F59E0B',
  },
  {
    icon: '📊',
    title: 'Real-Time Invigilator Console',
    desc: 'Comprehensive multi-candidate monitor wall with live status indicators, remote proctor warnings, time extensions, and session terminations.',
    color: '#6366F1',
  },
]

const DOMAINS = [
  'Data Structures & Algorithms', 'Full-Stack Web Systems', 'System Design & Microservices',
  'Operating Systems & Concurrency', 'Database Normalization & SQL', 'Machine Learning & Neural Networks',
  'Cloud Infrastructure & DevOps', 'Cybersecurity & Cryptography', 'Quantitative Aptitude & Logic',
  'Compiler Design & AST Trees', 'Distributed Consensus & Caching', 'Object-Oriented Design & Clean Code',
]

const PROCTORING_PILLARS = [
  {
    icon: '🛡️',
    title: 'Client-Side AI Sentinel',
    subtitle: 'Low-CPU Web Worker Inference',
    desc: 'Continuous facial landmarking via TensorFlow & MediaPipe running in background threads. Detects absence, multiple persons, or sustained gaze aversion (~1.5s interval).',
    badge: '100% On-Device',
    color: '#38BDF8',
  },
  {
    icon: '🔒',
    title: 'Zero-Cloud-Video Privacy',
    subtitle: 'Zero Raw Video Stored',
    desc: 'Candidate cameras are strictly processed on-device. No streaming video ever touches any server. Only audited timestamped event logs and lightweight thumbnail frames are preserved.',
    badge: 'Privacy Compliant',
    color: '#10B981',
  },
  {
    icon: '⚡',
    title: 'Authoritative Server Timer',
    subtitle: 'Microsecond Socket Synchronization',
    desc: 'Eliminates client-side clock tampering. Server drives authoritative ticks over Socket.io, surviving network hiccups, browser crashes, and refreshes without time drift.',
    badge: 'Tamper Proof',
    color: '#F59E0B',
  },
  {
    icon: '📡',
    title: 'Offline Resilience Engine',
    subtitle: 'IndexedDB & Service Worker Queue',
    desc: 'Zero lost answers during campus WiFi drops. Responses buffer instantaneously to IndexedDB and automatically sync with the server once connectivity is restored.',
    badge: 'Zero Data Loss',
    color: '#A855F7',
  },
]

const DEPLOYMENT_MODES = [
  {
    name: 'University Semester & Midterm Examinations',
    short: 'Academic Finals',
    city: 'Campus Scale',
    metric: 'Zero-Drift Timer',
    desc: 'Locked full-screen environment, randomized multi-set question distribution, and microsecond-synchronized server timing preventing peer collaboration.',
    tag: 'University Scale',
  },
  {
    name: 'Technical Campus Placement Screening',
    short: 'Placement Drives',
    city: 'Corporate Hiring',
    metric: 'Instant Percentiles',
    desc: 'Comprehensive multi-disciplinary screening across core engineering, DSA, and quantitative logic with real-time candidate rank aggregation.',
    tag: 'Campus Placement',
  },
  {
    name: 'Competitive Coding Sprints & Lab Exams',
    short: 'Code Sandbox',
    city: '30+ Runtimes',
    metric: 'Sub-Second Verdict',
    desc: 'In-browser Monaco code editor with multi-tier test cases (public validation + hidden memory & CPU boundary suites) and instant feedback.',
    tag: 'Coding Arena',
  },
  {
    name: 'Autonomous Remote Proctored Assessments',
    short: 'Remote Proctoring',
    city: 'Edge AI Vision',
    metric: '100% Privacy',
    desc: 'Client-side WebAssembly facial landmarking, multi-face alerts, and acoustic spike detection with zero persistent raw video stored on servers.',
    tag: 'Zero-Cloud Video',
  },
]

const FAQS = [
  {
    q: 'How does our institution join the LogicWhileLiRE Early Pilot Program?',
    a: 'We offer an early access pilot program for engineering colleges, coding bootcamps, and recruitment teams. Our engineering team provisions a dedicated, zero-cost cloud sandbox with custom branding, institutional admin credentials, and AI question authoring in under 24 hours.',
  },
  {
    q: 'How does the server-authoritative timer prevent cheating?',
    a: 'Traditional web exams rely on the candidate’s browser timer, which can be paused or altered by freezing browser tabs or adjusting system clocks. LogicWhileLiRE’s timer is driven by the server. The server dispatches live time ticks over Socket.io, and remaining duration is calculated against server timestamps. Even if candidates disconnect or refresh, their timer continues accurately without granting unauthorized time.',
  },
  {
    q: 'What happens if a candidate loses internet connection during the test?',
    a: 'LogicWhileLiRE features enterprise-grade offline resilience. Supported by a Service Worker and local IndexedDB retry queue, all selected responses are saved locally with microsecond timestamps. If the network drops, candidates can continue answering questions while an unobtrusive status banner indicates offline mode. When connectivity resumes, the queue automatically syncs all pending answers.',
  },
  {
    q: 'Does LogicWhileLiRE record or store student webcam videos?',
    a: 'No. We strictly adhere to student privacy regulations. All computer vision and facial detection algorithms execute locally in a client-side Web Worker. Raw video streams never leave the candidate’s device. Only numerical incident logs and optional low-resolution thumbnail snapshots (under 20KB) are transmitted when explicit violation thresholds are exceeded.',
  },
  {
    q: 'Can a student log in simultaneously from multiple devices using the same hall ticket?',
    a: 'No. LogicWhileLiRE enforces strict single-active-session concurrency per hall ticket and exam code. If a second device attempts login, it is blocked immediately, or triggers a verified takeover that immediately terminates and evicts the previous session, logging an audit event.',
  },
  {
    q: 'How do instructors onboard their question banks and configure custom exams?',
    a: 'Colleges and instructors can bulk-import questions via Excel or CSV with automatic format validation and duplicate detection. Alternatively, instructors can use the integrated AI question generator to build structured question pools with tagged difficulty levels, sections, and randomized candidate shuffling.',
  },
]

function GlobeSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setMousePos({
      x: (e.clientX - rect.left - rect.width / 2) / (rect.width / 2),
      y: (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2),
    })
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="hero-globe-wrapper"
      style={{
        position: 'relative',
        transform: `rotateX(${mousePos.y * -8}deg) rotateY(${mousePos.x * 8}deg)`,
        transition: 'transform 0.1s ease',
        transformStyle: 'preserve-3d',
        width: '100%',
        maxWidth: 360,
        aspectRatio: '1/1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Suspense fallback={
        <div style={{
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(43,127,255,0.2), transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-muted)', fontSize: '0.9rem',
        }}>
          Loading Globe...
        </div>
      }>
        <CollegeGlobe className="w-full h-full max-w-[340px] max-h-[340px]" />
      </Suspense>

      {/* Orbital ring */}
      <motion.div
        style={{
          position: 'absolute', inset: -16,
          borderRadius: '50%',
          border: '1px solid rgba(43,127,255,0.15)',
          pointerEvents: 'none',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        style={{
          position: 'absolute', inset: -32,
          borderRadius: '50%',
          border: '1px dashed rgba(43,127,255,0.08)',
          pointerEvents: 'none',
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

export default function LandingPage() {
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0.3])
  const heroY       = useTransform(scrollY, [0, 400], [0, -80])

  const [activeFaq, setActiveFaq] = useState<number | null>(0)
  const [studentUser, setStudentUser] = useState<any>(null)

  useEffect(() => {
    try {
      const u = localStorage.getItem('student_user')
      const t = localStorage.getItem('student_token')
      if (u && t) setStudentUser(JSON.parse(u))
    } catch {
      setStudentUser(null)
    }
  }, [])

  const [demoForm, setDemoForm] = useState({
    name: '',
    email: '',
    institution: '',
    candidateCount: '500 - 2,000 students',
    message: '',
    submitted: false,
    loading: false,
  })

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDemoForm(prev => ({ ...prev, loading: true }))
    try {
      await api.post('/api/contact', {
        name: demoForm.name,
        email: demoForm.email,
        subject: `Pilot Sandbox Request — ${demoForm.institution}`,
        message: demoForm.message || `Campus pilot application for ${demoForm.institution} with estimated batch size: ${demoForm.candidateCount}`,
        institution: demoForm.institution,
        candidateCount: demoForm.candidateCount,
      })
    } catch (err) {
      console.warn('Contact request submission fallback:', err)
    } finally {
      setDemoForm(prev => ({ ...prev, loading: false, submitted: true }))
    }
  }

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <SiteHeader />

      <main id="main-content">
        {/* ─── FLIGHT PATH BACKGROUND (fixed) ─── */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <FlightPathLines color="#bf9f62" opacity={0.08} count={16} className="" />
        </div>

        {/* ─── HERO SECTION ─── */}
        <motion.section
          style={{
            opacity: heroOpacity, y: heroY,
            minHeight: 'calc(100vh - 72px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            position: 'relative', zIndex: 1,
            paddingTop: 96,
            paddingBottom: 40,
          }}
        >
          {/* Hero Interactive 3D Node Network background */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <Suspense fallback={null}>
              <NodeNetwork nodeCount={36} maxDistance={140} lineColor="rgba(27, 95, 181, 0.16)" nodeColor="#1B5FB5" />
            </Suspense>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(27, 95, 181, 0.05), transparent)',
            }} />
          </div>

          <div className="page-content" style={{ position: 'relative', zIndex: 1, width: '100%' }}>
            <div className="hero-main-grid">
              {/* Left: Text */}
              <div className="hero-text-col">
                <div
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '6px 14px',
                    background: 'rgba(37, 99, 235, 0.1)',
                    border: '1px solid rgba(37, 99, 235, 0.25)',
                    borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
                    color: 'var(--color-primary)', marginBottom: 16,
                    letterSpacing: '0.03em', maxWidth: '100%', boxSizing: 'border-box',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', flexShrink: 0 }} />
                  <span>CAMPUS &amp; SEMESTER EXAMINATION PLATFORM</span>
                </div>

              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.4rem, 5.5vw, 4.4rem)',
                fontWeight: 800, lineHeight: 1.05,
                letterSpacing: '-0.03em',
                marginBottom: 8,
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  flexWrap: 'wrap',
                  gap: '0.18em',
                }}>
                  <span style={{ color: '#FF7A00' }}>Logic</span>
                  <span style={{ color: 'var(--color-primary-dark, #0A3F8F)' }}>Whi<span style={{ color: '#FF7A00', fontWeight: 900 }}>1</span>e</span>
                  <span style={{
                    border: '2px solid #FFC200',
                    padding: '2px 10px',
                    borderRadius: 8,
                    background: 'rgba(255, 194, 0, 0.1)',
                    marginLeft: 4,
                    display: 'inline-flex',
                    alignItems: 'baseline',
                  }}>
                    <span style={{ color: 'var(--color-primary-dark, #0A3F8F)' }}>Li</span>
                    <span style={{ color: '#FF7A00' }}>R</span>
                    <span style={{ color: 'var(--color-primary-dark, #0A3F8F)' }}>E</span>
                  </span>
                </span>
              </h1>

              <div style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--color-primary, #1B5FB5)',
                letterSpacing: '0.12em',
                marginBottom: 8,
              }}>
                Li: Live  •  R: Real  •  E: Engine
              </div>

              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.3rem, 2.5vw, 1.85rem)',
                  fontWeight: 800, lineHeight: 1.3,
                  color: '#FF7A00',
                  marginBottom: 16,
                  letterSpacing: '0.01em',
                }}
              >
                Elevating Coding Knowledge
              </h2>

              <p
                style={{
                  color: 'var(--color-text-muted)', fontSize: '1.02rem',
                  lineHeight: 1.7, marginBottom: 28, maxWidth: 520,
                }}
              >
                Standardized examination and synchronous assessment platform featuring server-authoritative timing, on-device AI proctoring, and live invigilator telemetry.
              </p>

              <div
                style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}
              >
                {studentUser ? (
                  <>
                    <Link to="/enter-exam" id="hero-enter-assessment-cta" style={{ textDecoration: 'none' }}>
                      <MagneticButton
                        className="btn btn-primary btn-xl"
                        style={{
                          minWidth: 220,
                          background: 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)',
                          boxShadow: '0 12px 32px -4px rgba(255, 122, 0, 0.45)',
                          color: '#ffffff',
                          fontSize: '1.14rem',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                          padding: '16px 36px',
                          borderRadius: 14,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 10,
                        }}
                      >
                        <span>🚀 Enter Assigned Exam</span>
                        <span style={{ fontSize: '1.2rem' }}>→</span>
                      </MagneticButton>
                    </Link>
                    <Link to="/student/dashboard" style={{ textDecoration: 'none' }}>
                      <MagneticButton
                        className="btn btn-secondary btn-xl"
                        style={{
                          background: 'var(--color-surface)',
                          border: '1.5px solid var(--color-border)',
                          color: 'var(--color-text)',
                          fontSize: '1.05rem',
                          fontWeight: 600,
                          padding: '16px 28px',
                          borderRadius: 12,
                          cursor: 'pointer',
                        }}
                      >
                        🎓 Candidate Dashboard
                      </MagneticButton>
                    </Link>
                    <Link to="/practice" style={{ textDecoration: 'none' }}>
                      <MagneticButton
                        className="btn btn-ghost btn-xl"
                        style={{
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-muted)',
                          fontSize: '1.02rem',
                          fontWeight: 600,
                          padding: '16px 22px',
                          borderRadius: 12,
                        }}
                      >
                        🪐 5 Technical Sectors
                      </MagneticButton>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/login" id="hero-student-portal-cta" style={{ textDecoration: 'none' }}>
                      <MagneticButton
                        className="btn btn-primary btn-xl"
                        style={{
                          minWidth: 220,
                          background: 'linear-gradient(135deg, #2563EB 0%, #1B5FB5 50%, #0A3F8F 100%)',
                          boxShadow: '0 12px 32px -4px rgba(37, 99, 235, 0.5)',
                          color: '#ffffff',
                          fontSize: '1.14rem',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                          padding: '16px 36px',
                          borderRadius: 14,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 10,
                        }}
                      >
                        <span>🎓 Student Portal Login</span>
                        <span style={{ fontSize: '1.2rem' }}>→</span>
                      </MagneticButton>
                    </Link>
                    <Link to="/gate" style={{ textDecoration: 'none' }}>
                      <MagneticButton
                        className="btn btn-secondary btn-xl"
                        style={{
                          background: 'var(--color-surface)',
                          border: '1.5px solid var(--color-border)',
                          color: 'var(--color-text)',
                          fontSize: '1.05rem',
                          fontWeight: 600,
                          padding: '16px 28px',
                          borderRadius: 12,
                          cursor: 'pointer',
                        }}
                      >
                        🛡️ Candidate Gate
                      </MagneticButton>
                    </Link>
                  </>
                )}
              </div>

              {/* Trust badges */}
              <div className="hero-trust-badges">
                {['🔒 Verified Single-Session Auth', '⚡ WebSocket Realtime Telemetry', '👁️ Client-Side Vision Models', '🏫 Campus Deployment Ready'].map(badge => (
                  <div key={badge} style={{
                    fontSize: '0.82rem', color: 'var(--color-text-faint)',
                    display: 'flex', alignItems: 'center', gap: 4,
                    whiteSpace: 'nowrap',
                  }}>
                    {badge}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Globe */}
            <div
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', maxWidth: '100%', overflow: 'hidden' }}
            >
              <GlobeSection />
            </div>
          </div>

          {/* ─── HERO STAT COUNTERS (Visible on First Load without scrolling) ─── */}
          <motion.div
            className="hero-stats-grid"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.95, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{
              marginTop: 20,
              padding: '16px 20px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 16,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
              width: '100%',
              maxWidth: 1280,
            }}
          >
            {STATS.map((stat, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '4px 10px',
                  borderRight: i < 3 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: `${stat.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    flexShrink: 0,
                  }}
                >
                  {i === 0 ? '⚡' : i === 1 ? '📡' : i === 2 ? '🛡️' : '💻'}
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.45rem',
                      fontWeight: 800,
                      color: 'var(--color-text)',
                      lineHeight: 1.1,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {stat.value.toLocaleString()}{stat.suffix}
                  </div>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginTop: 2,
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            style={{
              marginTop: 20,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              color: 'var(--color-text-faint)', fontSize: '0.74rem', letterSpacing: '0.08em',
              textAlign: 'center',
            }}
          >
            <span>SCROLL TO EXPLORE</span>
            <div style={{ width: 1, height: 28, background: 'linear-gradient(to bottom, var(--color-primary), transparent)' }} />
          </motion.div>
        </div>
      </motion.section>

      {/* ─── MARQUEE — Domains ─── */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: 'relative', zIndex: 1, padding: '40px 0', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
            ARCHITECTED FOR UNIVERSITIES, CODING BOOTCAMPS & ENTERPRISE RECRUITMENT
          </span>
        </div>
        <div className="marquee-wrapper">
          <div className="marquee-track">
            {[...DOMAINS, ...DOMAINS].map((name, i) => (
              <motion.div
                key={i}
                style={{
                  padding: '8px 24px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                whileHover={{ background: 'rgba(43,127,255,0.12)', color: 'var(--color-primary)', scale: 1.02 }}
              >
                ⚡ {name}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>



      {/* ─── STATS — 4x AltimeterDial ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0' }}>
        <div className="page-content">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center', marginBottom: 64 }}
          >
            <span className="section-label">EXAMINATION PLATFORM METRICS</span>
            <h2 className="section-title">Performance &amp; Reliability Benchmarks</h2>
            <p className="section-subtitle" style={{ margin: '12px auto' }}>
              Engineered for high-concurrency exams, server-synchronized timers, and automated anti-cheat monitoring.
            </p>
          </motion.div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 24,
          }}>
            {STATS.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <div
                  className="stat-card"
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '24px 20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                >
                  <AltimeterDial
                    value={stat.value}
                    label={stat.label}
                    suffix={stat.suffix}
                    color={stat.color}
                    size={130}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES — Solid Cards ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0', background: 'var(--color-bg)' }}>
        <div className="page-content">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center', marginBottom: 64 }}
          >
            <span className="section-label">PLATFORM CAPABILITIES</span>
            <h2 className="section-title">Core Evaluation Features</h2>
            <p className="section-subtitle" style={{ margin: '12px auto' }}>
              Modular exam management, proctoring tools, and evaluation engines designed for academic workflows.
            </p>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {FEATURES.map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ delay: i * 0.08, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              >
                <div style={{
                  height: '100%',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 24,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>{feat.icon}</div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.1rem', fontWeight: 700,
                    marginBottom: 10, color: 'var(--color-text)',
                  }}>
                    {feat.title}
                  </h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                    {feat.desc}
                  </p>

                  {/* Bottom accent line */}
                  <div style={{
                    marginTop: 20, height: 2,
                    background: `${feat.color}40`,
                    borderRadius: 999,
                  }} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LOGIC COIL DIVIDER ─── */}
      <LogicCoil variant="divider" size={26} />

      {/* ─── SECURITY & PROCTORING SHOWCASE ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0', background: 'var(--color-bg)' }}>
        <div className="page-content">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center', marginBottom: 64 }}
          >
            <span className="section-label" style={{ color: '#2563EB' }}>PROCTORING STANDARDS</span>
            <h2 className="section-title">Privacy-Preserving On-Device Verification</h2>
            <p className="section-subtitle" style={{ margin: '12px auto', maxWidth: 640 }}>
              Client-side vision models process facial verification locally. Incident event timestamps are transmitted without persisting raw video streams on servers.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {PROCTORING_PILLARS.map((pillar, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
              >
                <div style={{
                  height: '100%',
                  padding: '28px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ fontSize: '2.2rem' }}>{pillar.icon}</div>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      padding: '4px 12px',
                      borderRadius: 999,
                      background: `${pillar.color}18`,
                      color: pillar.color,
                      border: `1px solid ${pillar.color}40`,
                    }}>
                      {pillar.badge}
                    </span>
                  </div>

                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, marginBottom: 4 }}>
                    {pillar.title}
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: pillar.color, fontWeight: 600, marginBottom: 12 }}>
                    {pillar.subtitle}
                  </div>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', lineHeight: 1.7 }}>
                    {pillar.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0' }}>
        <div className="page-content">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center', marginBottom: 64 }}
          >
            <span className="section-label">WORKFLOW</span>
            <h2 className="section-title">3 Steps to Assessment</h2>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {[
              { step: '01', title: 'Admin Creates Exam', desc: 'Upload questions, set time limit, configure proctoring rules. Get a shareable exam code.', icon: '📋' },
              { step: '02', title: 'Students Enter Exam', desc: 'Enter hall ticket + exam code. Face verified. Instructions reviewed. Timer starts.', icon: '🎓' },
              { step: '03', title: 'Authoritative Scoring & Analytics', desc: 'Instant server-side grading, granular psychometric skill radar, and real-time live 3D leaderboards.', icon: '📊' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <div style={{
                  height: '100%',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 28,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div style={{ fontSize: '2.5rem' }}>{item.icon}</div>
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '2.5rem', fontWeight: 800,
                      color: 'rgba(37,99,235,0.2)', lineHeight: 1,
                    }}>
                      {item.step}
                    </span>
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, marginBottom: 10 }}>
                    {item.title}
                  </h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LOGIC COIL DIVIDER ─── */}
      <LogicCoil variant="divider" size={26} />

      {/* ─── ENTERPRISE ARCHITECTURE SHOWCASE ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0' }}>
        <div className="page-content">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center', marginBottom: 64 }}
          >
            <span className="section-label">DEPLOYMENT ARCHITECTURE</span>
            <h2 className="section-title">Engineered for Every High-Stakes Evaluation</h2>
            <p className="section-subtitle" style={{ margin: '12px auto', maxWidth: 640 }}>
              Purpose-built infrastructure supporting high-concurrency semester finals, campus placement screening, competitive coding hackathons, and remote proctoring.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            {DEPLOYMENT_MODES.map((col, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
              >
                <div style={{
                  height: '100%',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', background: 'rgba(37,99,235,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                      {col.tag}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)' }}>{col.city}</span>
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, marginBottom: 4 }}>
                    {col.short}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 12, minHeight: 36 }}>
                    {col.name}
                  </div>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    color: '#10B981',
                    marginBottom: 10,
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {col.metric}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6, marginTop: 'auto' }}>
                    {col.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LOGIC COIL DIVIDER ─── */}
      <LogicCoil variant="divider" size={26} />

      {/* ─── FREQUENTLY ASKED QUESTIONS (FAQ) ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0', background: 'rgba(15,23,42,0.4)' }}>
        <div className="page-content" style={{ maxWidth: 840, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center', marginBottom: 56 }}
          >
            <span className="section-label">CLARITY FIRST</span>
            <h2 className="section-title">Frequently Asked Questions</h2>
            <p className="section-subtitle" style={{ margin: '12px auto' }}>
              Everything you need to know about exam integrity, timer mechanics, and privacy.
            </p>
          </motion.div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FAQS.map((faq, i) => {
              const isOpen = activeFaq === i
              const panelId = `faq-panel-${i}`
              const btnId = `faq-btn-${i}`
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    background: 'var(--color-surface)',
                    border: `1px solid ${isOpen ? 'rgba(27,95,181,0.35)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    transition: 'border-color 0.22s ease',
                  }}
                >
                  <button
                    id={btnId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setActiveFaq(isOpen ? null : i)}
                    style={{
                      width: '100%',
                      padding: '20px 24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'var(--color-text)',
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.05rem',
                      fontWeight: 600,
                    }}
                  >
                    <span>{faq.q}</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ fontSize: '1.2rem', color: 'var(--color-primary)', flexShrink: 0, marginLeft: 16 }}
                      aria-hidden="true"
                    >
                      ▾
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={panelId}
                        role="region"
                        aria-labelledby={btnId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{
                          padding: '0 24px 22px 24px',
                          color: 'var(--color-text-muted)',
                          fontSize: '0.94rem',
                          lineHeight: 1.75,
                          borderTop: '1px solid rgba(255,255,255,0.04)',
                          paddingTop: 16,
                        }}>
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── LOGIC COIL DIVIDER ─── */}
      <LogicCoil variant="divider" size={26} />

      {/* ─── CONTACT & DEMO REQUEST ─── */}
      {/* ─── CONTACT & PILOT ONBOARDING REQUEST ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0' }}>
        <div className="page-content" style={{ maxWidth: 840, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center', marginBottom: 48 }}
          >
            <span className="section-label">STARTUP PILOT PROGRAM</span>
            <h2 className="section-title">Apply for Early Campus Sandbox Access</h2>
            <p className="section-subtitle" style={{ margin: '12px auto' }}>
              We are partnering with forward-thinking universities, institutes, and placement cells to deploy pilot assessments with dedicated engineering support.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{
              padding: '36px 40px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
            {demoForm.submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ textAlign: 'center', padding: '40px 20px' }}
              >
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, marginBottom: 10 }}>
                  Pilot Application Received!
                </h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', maxWidth: 520, margin: '0 auto 24px' }}>
                  Thank you, <strong>{demoForm.name}</strong>. Our engineering team will reach out to <strong>{demoForm.email}</strong> within 4 business hours to provision your dedicated pilot sandbox.
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={() => setDemoForm(prev => ({ ...prev, submitted: false }))}
                >
                  Submit Another Request
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleDemoSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div className="form-group">
                    <label htmlFor="pilot-name" className="form-label">Full Name *</label>
                    <input
                      id="pilot-name"
                      name="name"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Dr. Rajesh Sharma"
                      required
                      value={demoForm.name}
                      onChange={e => setDemoForm({ ...demoForm, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="pilot-email" className="form-label">Official / University Email *</label>
                    <input
                      id="pilot-email"
                      name="email"
                      type="email"
                      className="form-input"
                      placeholder="e.g. dean.academics@university.edu"
                      required
                      value={demoForm.email}
                      onChange={e => setDemoForm({ ...demoForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div className="form-group">
                    <label htmlFor="pilot-institution" className="form-label">Institution / College Name *</label>
                    <input
                      id="pilot-institution"
                      name="institution"
                      type="text"
                      className="form-input"
                      placeholder="e.g. National Institute of Technology"
                      required
                      value={demoForm.institution}
                      onChange={e => setDemoForm({ ...demoForm, institution: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="pilot-candidate-count" className="form-label">Estimated Student Batch Size</label>
                    <select
                      id="pilot-candidate-count"
                      name="candidateCount"
                      className="form-select"
                      value={demoForm.candidateCount}
                      onChange={e => setDemoForm({ ...demoForm, candidateCount: e.target.value })}
                    >
                      <option value="50 - 200 candidates (Pilot Class)">50 - 200 candidates (Pilot Class)</option>
                      <option value="200 - 1,000 candidates (Department)">200 - 1,000 candidates (Department)</option>
                      <option value="1,000 - 5,000 candidates (Campus Wide)">1,000 - 5,000 candidates (Campus Wide)</option>
                      <option value="5,000+ candidates (University Scale)">5,000+ candidates (University Scale)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="pilot-message" className="form-label">Target Evaluation Format / Requirements</label>
                  <textarea
                    id="pilot-message"
                    name="message"
                    className="form-textarea"
                    rows={3}
                    placeholder="Describe your upcoming assessment format (e.g. Semester Final, Campus Placement Drive, Coding Hackathon)..."
                    value={demoForm.message}
                    onChange={e => setDemoForm({ ...demoForm, message: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  disabled={demoForm.loading}
                  className="btn btn-primary btn-xl"
                  style={{ width: '100%', marginTop: 8 }}
                >
                  {demoForm.loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <div className="btn-spinner" />
                      <span>Provisioning Sandbox...</span>
                    </div>
                  ) : (
                    '🚀 Apply for Pilot Sandbox'
                  )}
                </button>
              </form>
            )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── CTA BANNER ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '80px 0' }}>
        <div className="page-content">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-2xl)',
              padding: '64px 48px',
              textAlign: 'center',
              position: 'relative', overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
            }}
          >
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 4vw, 3.5rem)',
              fontWeight: 800, letterSpacing: '-0.03em',
              marginBottom: 16, position: 'relative',
            }}>
              Ready to Deploy<br />
              <ShimmerText text="LogicWhileLiRE on Your Campus?" shimmer />
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem', marginBottom: 36, position: 'relative' }}>
              Run scheduled midterm assessments, campus placement screening drives, and automated proctoring with institutional pilot access.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
              <Link to="/enter-exam" style={{ textDecoration: 'none' }}>
                <MagneticButton
                  className="btn btn-primary btn-xl"
                  style={{
                    minWidth: 220,
                    background: 'linear-gradient(135deg, #2563EB 0%, #1B5FB5 50%, #0A3F8F 100%)',
                    boxShadow: '0 12px 32px -4px rgba(37, 99, 235, 0.5)',
                    color: '#ffffff',
                    fontWeight: 700,
                    borderRadius: 14,
                  }}
                >
                  🚀 Start Assessment
                </MagneticButton>
              </Link>
              <Link to="/admin" style={{ textDecoration: 'none' }}>
                <MagneticButton className="btn btn-secondary btn-xl">
                  Admin — Create Exam
                </MagneticButton>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── PARTICLE FIELD (bottom section) ─── */}
      <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
        <Suspense fallback={null}>
          <ParticleField count={40} />
        </Suspense>
      </div>
      </main>

      <SiteFooter />
    </div>
  )
}
