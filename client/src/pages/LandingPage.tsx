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

// Lazy-load 3D heavy components
const CollegeGlobe = lazy(() => import('../components/3d/CollegeGlobe'))
const LiquidBlob   = lazy(() => import('../components/3d/LiquidBlob'))
const ParticleField = lazy(() => import('../components/3d/ParticleField'))
const NodeNetwork   = lazy(() => import('../components/3d/NodeNetwork'))

const STATS = [
  { value: 50000,  label: 'Students Assessed', suffix: '+', color: '#bf9f62' },
  { value: 200,    label: 'Partner Colleges',  suffix: '+', color: '#064484' },
  { value: 99,     label: 'Uptime',            suffix: '%', color: '#10B981' },
  { value: 5000,   label: 'Questions Bank',    suffix: '+', color: '#bf9f62' },
]

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI Question Generator',
    desc: 'Generate 100 DBMS questions in seconds with GPT-4. Set difficulty, topic, and format. Human-review then publish.',
    color: '#bf9f62',
  },
  {
    icon: '👁️',
    title: 'Live Face Proctoring',
    desc: 'TensorFlow.js detects face count in real-time. Auto-flags when face leaves frame or multiple faces appear.',
    color: '#10B981',
  },
  {
    icon: '💻',
    title: 'Code Execution Engine',
    desc: 'Monaco Editor + Piston API. Run code in 30+ languages with hidden test cases and instant verdict.',
    color: '#064484',
  },
  {
    icon: '📊',
    title: 'Real-time Analytics',
    desc: '3D radar charts, placement analysis, department rankings, and downloadable PDF certificates with QR verification.',
    color: '#bf9f62',
  },
  {
    icon: '🏆',
    title: '3D Leaderboard',
    desc: 'Live ranked leaderboard with animated 3D podium. PlasmaBall for 1st, CodeCube for 2nd, NeonGrid for 3rd.',
    color: '#e45d5d',
  },
  {
    icon: '⚡',
    title: 'Bulk Enrollment',
    desc: 'Upload Excel with thousands of candidates. Auto-generate hall tickets. Send invites via email/SMS.',
    color: '#093569',
  },
]

const COLLEGES = [
  'IARE (Institute of Aeronautical Engineering)', 'IARE Autonomous', 'Samvidha Portal', 'BuildIT Arena',
  'VRSEC', 'KL University', 'GITAM', 'RVR & JC', 'VIT-AP', 'SRM', 'Amrita', 'BITS Pilani',
  'NIT Warangal', 'JNTU Hyderabad', 'Andhra University', 'Vignan', 'Shri Vishnu', 'Centurion',
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

const COLLEGE_SPOTLIGHTS = [
  {
    name: 'Institute of Aeronautical Engineering',
    short: 'IARE (Autonomous)',
    city: 'Dundigal, Hyderabad, TS',
    metric: '20,000+ Assessments',
    desc: 'Autonomous engineering college ranked in NIRF Top 200 band with NAAC A++ accreditation. Deployed LogicWhile Ultra for high-stakes semester exams and campus placement pre-assessments.',
    tag: 'Autonomous Flagship',
  },
  {
    name: 'Velagapudi Ramakrishna Siddhartha Engineering College',
    short: 'VRSEC',
    city: 'Vijayawada, AP',
    metric: '12,500+ Candidates',
    desc: 'Conducted simultaneous department assessments with zero server lag and automated hall-ticket seat verification.',
    tag: 'Placement Drives',
  },
  {
    name: 'Koneru Lakshmaiah Education Foundation',
    short: 'KL University',
    city: 'Vaddeswaram, AP',
    metric: '99.8% Integrity Index',
    desc: 'Adopted automated AI question generation across 14 engineering streams with multi-tenant college admin controls.',
    tag: 'Campus Assessments',
  },
  {
    name: 'SRM University AP',
    short: 'SRM-AP',
    city: 'Amaravati, AP',
    metric: '450+ Concurrent Coders',
    desc: 'Utilized real-time code sandboxes and live proctored evaluation for annual hackathons and mid-term lab exams.',
    tag: 'Code Execution',
  },
  {
    name: 'Gandhi Institute of Technology and Management',
    short: 'GITAM',
    city: 'Visakhapatnam, AP',
    metric: '8,000+ Certificates',
    desc: 'Issued cryptographic QR-verified merit and participation certificates with direct public verification portals.',
    tag: 'Digital Credentials',
  },
]

const FAQS = [
  {
    q: 'How does the server-authoritative timer prevent cheating?',
    a: 'Traditional web exams rely on the candidate’s browser timer, which can be paused or altered by freezing browser tabs or adjusting system clocks. LogicWhile’s timer is driven by the server. The server dispatches live time ticks over Socket.io, and remaining duration is calculated against server timestamps. Even if candidates disconnect or refresh, their timer continues accurately without granting unauthorized time.',
  },
  {
    q: 'What happens if a candidate loses internet connection during the test?',
    a: 'LogicWhile features enterprise-grade offline resilience. Supported by a Service Worker and local IndexedDB retry queue, all selected responses are saved locally with microsecond timestamps. If the network drops, candidates can continue answering questions while an unobtrusive status banner indicates offline mode. When connectivity resumes, the queue automatically syncs all pending answers.',
  },
  {
    q: 'Does LogicWhile record or store student webcam videos?',
    a: 'No. We strictly adhere to student privacy regulations. All computer vision and facial detection algorithms execute locally in a client-side Web Worker. Raw video streams never leave the candidate’s device. Only numerical incident logs and optional low-resolution thumbnail snapshots (under 20KB) are transmitted when explicit violation thresholds are exceeded.',
  },
  {
    q: 'Can a student log in simultaneously from multiple devices using the same hall ticket?',
    a: 'No. LogicWhile enforces strict single-active-session concurrency per hall ticket and exam code. If a second device attempts login, it is blocked immediately, or triggers a verified takeover that immediately terminates and evicts the previous session, logging an audit event.',
  },
  {
    q: 'How do colleges onboard their question banks and configure custom exams?',
    a: 'Colleges can bulk-import existing questions via Excel or CSV with automatic format validation and duplicate detection. Alternatively, instructors can use the integrated AI question generator to build structured question pools with tagged difficulty levels, sections, and randomized candidate shuffling.',
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
      style={{
        position: 'relative',
        transform: `rotateX(${mousePos.y * -8}deg) rotateY(${mousePos.x * 8}deg)`,
        transition: 'transform 0.1s ease',
        transformStyle: 'preserve-3d',
      }}
    >
      <Suspense fallback={
        <div style={{
          width: 420, height: 420, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(43,127,255,0.2), transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-muted)', fontSize: '0.9rem',
        }}>
          Loading Globe...
        </div>
      }>
        <CollegeGlobe className="w-[420px] h-[420px]" />
      </Suspense>

      {/* Orbital ring */}
      <motion.div
        style={{
          position: 'absolute', inset: -24,
          borderRadius: '50%',
          border: '1px solid rgba(43,127,255,0.15)',
          pointerEvents: 'none',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        style={{
          position: 'absolute', inset: -48,
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
  const [demoForm, setDemoForm] = useState({
    name: '',
    email: '',
    institution: '',
    candidateCount: '500 - 2,000 students',
    message: '',
    submitted: false,
    loading: false,
  })

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setDemoForm(prev => ({ ...prev, loading: true }))
    setTimeout(() => {
      setDemoForm(prev => ({ ...prev, loading: false, submitted: true }))
    }, 700)
  }

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', overflow: 'hidden' }}>
      <SiteHeader />

      {/* ─── IARE INSTITUTIONAL TICKERS (Official https://www.iare.ac.in) ─── */}
      <div style={{ marginTop: 72, position: 'relative', zIndex: 10 }}>
        {/* Placements Hot News Ticker */}
        <div style={{
          background: '#190F3B',
          color: '#ffffff',
          padding: '6px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          borderBottom: '1px solid rgba(191,159,98,0.25)',
          fontSize: '0.8rem',
        }}>
          <strong style={{
            background: 'linear-gradient(135deg, #bf9f62, #a28b40)',
            color: '#190F3B',
            padding: '2px 10px',
            borderRadius: 3,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            fontSize: '0.72rem',
            letterSpacing: '0.04em',
            fontFamily: 'var(--font-display)',
          }}>
            812 Campus Placements - 2026 :
          </strong>
          <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <motion.div
              animate={{ x: ['0%', '-50%'] }}
              transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-block', whiteSpace: 'nowrap', color: '#E2E8F0', fontWeight: 500 }}
            >
              Microsoft (5) &nbsp;||&nbsp; Rubrik (1) &nbsp;||&nbsp; Juspay (7) &nbsp;||&nbsp; New Relic (2) &nbsp;||&nbsp; JPMorgan Chase & Co. (8) &nbsp;||&nbsp; FactSet (3) &nbsp;||&nbsp; TCS (65) &nbsp;||&nbsp; EPAM (4) &nbsp;||&nbsp; Lumen Technologies (21) &nbsp;||&nbsp; DeltaX (2) &nbsp;||&nbsp; Capgemini (124) &nbsp;||&nbsp; Cognizant (199) &nbsp;||&nbsp; Virtusa (57) &nbsp;||&nbsp; IBM (25) &nbsp;||&nbsp; LTI Mindtree (130) &nbsp;||&nbsp; Infosys (32) &nbsp;||&nbsp; Deloitte (5) &nbsp;||&nbsp; Microsoft (5) &nbsp;||&nbsp; Rubrik (1) &nbsp;||&nbsp; Juspay (7) &nbsp;||&nbsp; JPMorgan Chase & Co. (8) &nbsp;||&nbsp; TCS (65) &nbsp;||&nbsp; Capgemini (124) &nbsp;||&nbsp; Cognizant (199) &nbsp;||&nbsp; LTI Mindtree (130)
            </motion.div>
          </div>
        </div>

        {/* NIRF & Autonomous Accreditation Ticker */}
        <div style={{
          background: 'rgba(6, 68, 132, 0.95)',
          color: '#ffffff',
          padding: '4px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: '0.74rem',
          borderBottom: '2px solid #bf9f62',
        }}>
          <span style={{ fontWeight: 800, color: '#bf9f62', whiteSpace: 'nowrap', fontFamily: 'var(--font-display)' }}>
            🏛️ IARE RECOGNITION :
          </span>
          <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <motion.div
              animate={{ x: ['0%', '-50%'] }}
              transition={{ duration: 38, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-block', whiteSpace: 'nowrap', color: '#F8F9FC' }}
            >
              Institute of Aeronautical Engineering (IARE) — Autonomous Engineering College, Dundigal, Hyderabad • Ranked in 151–200 Band in Engineering Category under NIRF (MoE, Govt. of India) • NAAC 'A++' Grade Accreditation • NBA Accredited Programmes • Integrated with Samvidha, Akanksha & BuildIT Platforms • Institute of Aeronautical Engineering (IARE) — Ranked in 151–200 Band NIRF • NAAC 'A++' Grade
            </motion.div>
          </div>
        </div>
      </div>

      {/* ─── FLIGHT PATH BACKGROUND (fixed) ─── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <FlightPathLines color="#bf9f62" opacity={0.08} count={16} className="" />
      </div>

      {/* ─── HERO SECTION ─── */}
      <motion.section
        style={{
          opacity: heroOpacity, y: heroY,
          minHeight: 'calc(100vh - 140px)',
          display: 'flex', alignItems: 'center',
          position: 'relative', zIndex: 1,
          paddingTop: 36,
          paddingBottom: 48,
        }}
      >
        {/* Hero Interactive 3D Node Network & Blob background */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <Suspense fallback={null}>
            <LiquidBlob />
            <NodeNetwork nodeCount={36} maxDistance={140} lineColor="rgba(191, 159, 98, 0.22)" nodeColor="#bf9f62" />
          </Suspense>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(191,159,98,0.10), transparent)',
          }} />
        </div>

        <div className="page-content" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            alignItems: 'center',
            gap: 64,
            minHeight: 'calc(100vh - 160px)',
          }}>
            {/* Left: Text */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '6px 16px',
                  background: 'rgba(191,159,98,0.12)',
                  border: '1px solid rgba(191,159,98,0.35)',
                  borderRadius: 999, fontSize: '0.8rem', fontWeight: 600,
                  color: 'var(--color-primary)', marginBottom: 20,
                  letterSpacing: '0.04em',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', animation: 'blink 2s infinite' }} />
                INSTITUTE OF AERONAUTICAL ENGINEERING (IARE) — AUTONOMOUS
              </motion.div>

              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(3rem, 6vw, 5rem)',
                fontWeight: 800, lineHeight: 1.0,
                letterSpacing: '-0.04em',
                marginBottom: 8,
              }}>
                <ShimmerText text="LOGICWHILE" shimmer stagger delay={0.3} className="section-title" />
              </h1>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.2rem, 2.5vw, 1.8rem)',
                  fontWeight: 500, lineHeight: 1.3,
                  color: 'var(--color-text-muted)',
                  marginBottom: 24,
                }}
              >
                India's most advanced<br />
                <span style={{ color: 'var(--color-primary)' }}>Assessment Platform</span>
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.7 }}
                style={{
                  color: 'var(--color-text-muted)', fontSize: '1.05rem',
                  lineHeight: 1.75, marginBottom: 36, maxWidth: 480,
                }}
              >
                AI-powered question generation, live face proctoring, code execution in 30+ languages,
                3D leaderboards, and instant certificate QR verification — all in one platform.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.7 }}
                style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}
              >
                <Link to="/enter-exam" style={{ textDecoration: 'none' }}>
                  <MagneticButton className="btn btn-primary btn-xl" style={{ minWidth: 200 }}>
                    🚀 Enter Assessment
                  </MagneticButton>
                </Link>
                <Link to="/admin/dashboard" style={{ textDecoration: 'none' }}>
                  <MagneticButton className="btn btn-secondary btn-xl">
                    ⚙️ Admin Portal
                  </MagneticButton>
                </Link>
              </motion.div>

              {/* Trust badges */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1, duration: 0.7 }}
                style={{ display: 'flex', gap: 24, marginTop: 40, alignItems: 'center' }}
              >
                {['🔒 Secure', '⚡ 99.9% Uptime', '🌍 200+ Colleges'].map(badge => (
                  <div key={badge} style={{
                    fontSize: '0.82rem', color: 'var(--color-text-faint)',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {badge}
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right: Globe */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              <GlobeSection />
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          style={{
            position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            color: 'var(--color-text-faint)', fontSize: '0.75rem', letterSpacing: '0.06em',
          }}
        >
          <span>SCROLL TO EXPLORE</span>
          <div style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, var(--color-primary), transparent)' }} />
        </motion.div>
      </motion.section>

      {/* ─── MARQUEE — Trusted by ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '40px 0', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', background: 'rgba(20,28,47,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-faint)' }}>
            TRUSTED BY INDIA'S PREMIER INSTITUTIONS
          </span>
        </div>
        <div className="marquee-wrapper">
          <div className="marquee-track">
            {[...COLLEGES, ...COLLEGES].map((name, i) => (
              <motion.div
                key={i}
                style={{
                  padding: '8px 24px',
                  background: 'rgba(43,127,255,0.06)',
                  border: '1px solid rgba(43,127,255,0.12)',
                  borderRadius: 8,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                whileHover={{ background: 'rgba(43,127,255,0.12)', color: 'var(--color-text)', scale: 1.02 }}
              >
                🎓 {name}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS — 4x AltimeterDial ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0' }}>
        <div className="page-content">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="section-label">BY THE NUMBERS</span>
            <h2 className="section-title">Impact at Scale</h2>
            <p className="section-subtitle" style={{ margin: '12px auto' }}>
              Real numbers from real campuses across India.
            </p>
          </div>
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
                <GlowCard
                  className="stat-card"
                  glowColor={stat.color + '40'}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <AltimeterDial
                    value={stat.value}
                    label={stat.label}
                    suffix={stat.suffix}
                    color={stat.color}
                    size={130}
                  />
                </GlowCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES — 6x GlowCard ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0', background: 'rgba(20,28,47,0.4)' }}>
        <div className="page-content">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="section-label">CAPABILITIES</span>
            <h2 className="section-title">Built Different</h2>
            <p className="section-subtitle" style={{ margin: '12px auto' }}>
              Every feature engineered for the future of academic assessment.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {FEATURES.map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ delay: i * 0.08, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              >
                <GlowCard glowColor={feat.color + '40'} style={{ height: '100%' }}>
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
                    background: `linear-gradient(90deg, ${feat.color}, transparent)`,
                    borderRadius: 999,
                  }} />
                </GlowCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LOGIC COIL DIVIDER ─── */}
      <LogicCoil variant="divider" size={26} />

      {/* ─── SECURITY & PROCTORING SHOWCASE ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0', background: 'rgba(15,23,42,0.6)' }}>
        <div className="page-content">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="section-label" style={{ color: '#38BDF8' }}>MILITARY-GRADE INTEGRITY</span>
            <h2 className="section-title">Zero-Compromise Proctoring</h2>
            <p className="section-subtitle" style={{ margin: '12px auto', maxWidth: 640 }}>
              Engineered with on-device computer vision and zero-cloud-video privacy standards so candidate trust and examination fairness are never in question.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {PROCTORING_PILLARS.map((pillar, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
              >
                <GlowCard glowColor={pillar.color + '33'} style={{ height: '100%', padding: '28px' }}>
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
                </GlowCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0' }}>
        <div className="page-content">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="section-label">WORKFLOW</span>
            <h2 className="section-title">3 Steps to Assessment</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {[
              { step: '01', title: 'Admin Creates Exam', desc: 'Upload questions, set time limit, configure proctoring rules. Get a shareable exam code.', icon: '📋' },
              { step: '02', title: 'Students Enter Exam', desc: 'Enter hall ticket + exam code. Face verified. Instructions reviewed. Timer starts.', icon: '🎓' },
              { step: '03', title: 'Instant Results + Certificate', desc: 'Auto-graded with AI insights. PDF certificate with QR code. Leaderboard live.', icon: '🏆' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <GlowCard style={{ height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div style={{ fontSize: '2.5rem' }}>{item.icon}</div>
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '2.5rem', fontWeight: 800,
                      color: 'rgba(43,127,255,0.15)', lineHeight: 1,
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
                </GlowCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LOGIC COIL DIVIDER ─── */}
      <LogicCoil variant="divider" size={26} />

      {/* ─── INSTITUTIONAL COLLEGE SHOWCASE ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0' }}>
        <div className="page-content">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="section-label">PARTNER INSTITUTIONS</span>
            <h2 className="section-title">Tested in High-Stakes Campus Drives</h2>
            <p className="section-subtitle" style={{ margin: '12px auto', maxWidth: 640 }}>
              Discover how leading universities run institutional midterm assessments, semester finals, and placement drives on LogicWhile.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            {COLLEGE_SPOTLIGHTS.map((col, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
              >
                <GlowCard style={{ height: '100%', padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', background: 'rgba(43,127,255,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                      {col.tag}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-faint)' }}>{col.city}</span>
                  </div>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, marginBottom: 4 }}>
                    {col.short}
                  </h4>
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
                </GlowCard>
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
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span className="section-label">CLARITY FIRST</span>
            <h2 className="section-title">Frequently Asked Questions</h2>
            <p className="section-subtitle" style={{ margin: '12px auto' }}>
              Everything you need to know about exam integrity, timer mechanics, and privacy.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FAQS.map((faq, i) => {
              const isOpen = activeFaq === i
              return (
                <div
                  key={i}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    transition: 'border-color var(--transition-fast)',
                  }}
                >
                  <button
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
                    >
                      ▾
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
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
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── LOGIC COIL DIVIDER ─── */}
      <LogicCoil variant="divider" size={26} />

      {/* ─── CONTACT & DEMO REQUEST ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0' }}>
        <div className="page-content" style={{ maxWidth: 840, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span className="section-label">GET STARTED</span>
            <h2 className="section-title">Schedule an Institutional Demo</h2>
            <p className="section-subtitle" style={{ margin: '12px auto' }}>
              Connect with our assessment engineers to pilot LogicWhile in your next semester examination or placement test.
            </p>
          </div>

          <GlowCard style={{ padding: '36px 40px' }}>
            {demoForm.submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ textAlign: 'center', padding: '40px 20px' }}
              >
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, marginBottom: 10 }}>
                  Demo Request Received!
                </h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', maxWidth: 520, margin: '0 auto 24px' }}>
                  Thank you, <strong>{demoForm.name}</strong>. Our enterprise team will reach out to <strong>{demoForm.email}</strong> within 4 business hours to set up your dedicated institution sandbox.
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
                    <label className="form-label">Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Dr. Rajesh Sharma"
                      required
                      value={demoForm.name}
                      onChange={e => setDemoForm({ ...demoForm, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Official / University Email *</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="r.sharma@vrsec.ac.in"
                      required
                      value={demoForm.email}
                      onChange={e => setDemoForm({ ...demoForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div className="form-group">
                    <label className="form-label">Institution / College Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VR Siddhartha Engineering College"
                      required
                      value={demoForm.institution}
                      onChange={e => setDemoForm({ ...demoForm, institution: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Estimated Student Batch Size</label>
                    <select
                      className="form-select"
                      value={demoForm.candidateCount}
                      onChange={e => setDemoForm({ ...demoForm, candidateCount: e.target.value })}
                    >
                      <option value="100 - 500 students">100 - 500 students</option>
                      <option value="500 - 2,000 students">500 - 2,000 students</option>
                      <option value="2,000 - 10,000 students">2,000 - 10,000 students</option>
                      <option value="10,000+ students (University Scale)">10,000+ students (University Scale)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Special Requirements / Target Exam Date</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="We plan to run placement assessments for 1,200 final-year B.Tech students in Python & DBMS next month..."
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
                      <span>Scheduling Demo...</span>
                    </div>
                  ) : (
                    '🚀 Request Institutional Demo Sandbox'
                  )}
                </button>
              </form>
            )}
          </GlowCard>
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
              background: 'linear-gradient(135deg, rgba(43,127,255,0.12), rgba(27,95,204,0.08))',
              border: '1px solid rgba(43,127,255,0.25)',
              borderRadius: 'var(--radius-2xl)',
              padding: '64px 48px',
              textAlign: 'center',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Glow orbs */}
            <div style={{ position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(43,127,255,0.1)', filter: 'blur(80px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(27,95,204,0.08)', filter: 'blur(80px)', pointerEvents: 'none' }} />

            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 4vw, 3.5rem)',
              fontWeight: 800, letterSpacing: '-0.03em',
              marginBottom: 16, position: 'relative',
            }}>
              Ready to Elevate Your<br />
              <ShimmerText text="Assessment Game?" shimmer />
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem', marginBottom: 36, position: 'relative' }}>
              Join 200+ colleges using LogicWhile 4.0 ULTRA for fair, smart, and beautiful assessments.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
              <Link to="/enter-exam" style={{ textDecoration: 'none' }}>
                <MagneticButton className="btn btn-primary btn-xl" style={{ minWidth: 220 }}>
                  🚀 Start Your Exam
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

      <SiteFooter />
    </div>
  )
}
