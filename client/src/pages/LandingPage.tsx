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
  { value: 10000,  label: 'Concurrent Scale Engine', suffix: '+', color: '#2B7FFF' },
  { value: 50,     label: 'WebSocket Latency',        suffix: 'ms', color: '#38BDF8' },
  { value: 100,    label: 'Server Timing Integrity', suffix: '%', color: '#10B981' },
  { value: 30,     label: 'Sandboxed Code Runtimes', suffix: '+', color: '#F59E0B' },
]

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI Question Generator',
    desc: 'Generate 100 DBMS questions in seconds with GPT-4. Set difficulty, topic, and format. Human-review then publish.',
    color: '#2B7FFF',
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
    color: '#38BDF8',
  },
  {
    icon: '📊',
    title: 'Real-time Analytics',
    desc: '3D radar charts, predictive placement analysis, department micro-rankings, and comprehensive cognitive skill heatmaps.',
    color: '#A855F7',
  },
  {
    icon: '🏆',
    title: '3D Leaderboard',
    desc: 'Live ranked leaderboard with animated 3D podium. PlasmaBall for 1st, CodeCube for 2nd, NeonGrid for 3rd.',
    color: '#F59E0B',
  },
  {
    icon: '⚡',
    title: 'Bulk Enrollment',
    desc: 'Upload Excel with thousands of candidates. Auto-generate hall tickets. Send invites via email/SMS.',
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
    q: 'How does our institution join the GROWTHRAN Early Pilot Program?',
    a: 'We offer an early access pilot program for engineering colleges, coding bootcamps, and recruitment teams. Our engineering team provisions a dedicated, zero-cost cloud sandbox with custom branding, institutional admin credentials, and AI question authoring in under 24 hours.',
  },
  {
    q: 'How does the server-authoritative timer prevent cheating?',
    a: 'Traditional web exams rely on the candidate’s browser timer, which can be paused or altered by freezing browser tabs or adjusting system clocks. GROWTHRAN’s timer is driven by the server. The server dispatches live time ticks over Socket.io, and remaining duration is calculated against server timestamps. Even if candidates disconnect or refresh, their timer continues accurately without granting unauthorized time.',
  },
  {
    q: 'What happens if a candidate loses internet connection during the test?',
    a: 'GROWTHRAN features enterprise-grade offline resilience. Supported by a Service Worker and local IndexedDB retry queue, all selected responses are saved locally with microsecond timestamps. If the network drops, candidates can continue answering questions while an unobtrusive status banner indicates offline mode. When connectivity resumes, the queue automatically syncs all pending answers.',
  },
  {
    q: 'Does GROWTHRAN record or store student webcam videos?',
    a: 'No. We strictly adhere to student privacy regulations. All computer vision and facial detection algorithms execute locally in a client-side Web Worker. Raw video streams never leave the candidate’s device. Only numerical incident logs and optional low-resolution thumbnail snapshots (under 20KB) are transmitted when explicit violation thresholds are exceeded.',
  },
  {
    q: 'Can a student log in simultaneously from multiple devices using the same hall ticket?',
    a: 'No. GROWTHRAN enforces strict single-active-session concurrency per hall ticket and exam code. If a second device attempts login, it is blocked immediately, or triggers a verified takeover that immediately terminates and evicts the previous session, logging an audit event.',
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

      {/* ─── FLIGHT PATH BACKGROUND (fixed) ─── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <FlightPathLines color="#bf9f62" opacity={0.08} count={16} className="" />
      </div>

      {/* ─── HERO SECTION ─── */}
      <motion.section
        style={{
          opacity: heroOpacity, y: heroY,
          minHeight: 'calc(100vh - 80px)',
          display: 'flex', alignItems: 'center',
          position: 'relative', zIndex: 1,
          paddingTop: 96,
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
                  background: 'rgba(43,127,255,0.12)',
                  border: '1px solid rgba(43,127,255,0.35)',
                  borderRadius: 999, fontSize: '0.8rem', fontWeight: 600,
                  color: 'var(--color-primary)', marginBottom: 20,
                  letterSpacing: '0.04em',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', animation: 'blink 2s infinite' }} />
                ⚡ NEXT-GEN AI ASSESSMENT & PROCTORING PLATFORM
              </motion.div>

              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(3rem, 6vw, 5rem)',
                fontWeight: 800, lineHeight: 1.0,
                letterSpacing: '-0.04em',
                marginBottom: 8,
              }}>
                <ShimmerText text="GROWTHRAN" shimmer stagger delay={0.3} className="section-title" />
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
                AI-powered question generation, multimodal face & audio proctoring, sandboxed code execution in 30+ languages,
                and live 3D leaderboards — all in one platform.
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
                style={{ display: 'flex', gap: 20, marginTop: 40, alignItems: 'center', flexWrap: 'wrap' }}
              >
                {['🔒 Zero-Trust Security', '⚡ Sub-50ms Latency', '👁️ On-Device AI Vision', '🚀 Early Access Pilot'].map(badge => (
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

      {/* ─── MARQUEE — Domains ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '40px 0', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', background: 'rgba(20,28,47,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-faint)' }}>
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
                ⚡ {name}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS — 4x AltimeterDial ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0' }}>
        <div className="page-content">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="section-label">ENGINEERING BENCHMARKS</span>
            <h2 className="section-title">Architected for Reliability</h2>
            <p className="section-subtitle" style={{ margin: '12px auto' }}>
              Engineered from the ground up for high-concurrency exams, sub-millisecond clock sync, and zero-compromise anti-cheat integrity.
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
              { step: '03', title: 'Authoritative Scoring & Analytics', desc: 'Instant server-side grading, granular psychometric skill radar, and real-time live 3D leaderboards.', icon: '📊' },
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

      {/* ─── ENTERPRISE ARCHITECTURE SHOWCASE ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0' }}>
        <div className="page-content">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="section-label">DEPLOYMENT ARCHITECTURE</span>
            <h2 className="section-title">Engineered for Every High-Stakes Evaluation</h2>
            <p className="section-subtitle" style={{ margin: '12px auto', maxWidth: 640 }}>
              Purpose-built infrastructure supporting high-concurrency semester finals, campus placement screening, competitive coding hackathons, and remote proctoring.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            {DEPLOYMENT_MODES.map((col, i) => (
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
      {/* ─── CONTACT & PILOT ONBOARDING REQUEST ─── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 0' }}>
        <div className="page-content" style={{ maxWidth: 840, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span className="section-label">STARTUP PILOT PROGRAM</span>
            <h2 className="section-title">Apply for Early Campus Sandbox Access</h2>
            <p className="section-subtitle" style={{ margin: '12px auto' }}>
              We are partnering with forward-thinking universities, institutes, and placement cells to deploy pilot assessments with dedicated engineering support.
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
                    <label className="form-label">Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Dr. Rajesh Sharma"
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
                      placeholder="e.g. dean.academics@university.edu"
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
                      placeholder="e.g. National Institute of Technology"
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
                      <option value="50 - 200 candidates (Pilot Class)">50 - 200 candidates (Pilot Class)</option>
                      <option value="200 - 1,000 candidates (Department)">200 - 1,000 candidates (Department)</option>
                      <option value="1,000 - 5,000 candidates (Campus Wide)">1,000 - 5,000 candidates (Campus Wide)</option>
                      <option value="5,000+ candidates (University Scale)">5,000+ candidates (University Scale)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Evaluation Format / Requirements</label>
                  <textarea
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
              Ready to Deploy the<br />
              <ShimmerText text="Future of Assessment?" shimmer />
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem', marginBottom: 36, position: 'relative' }}>
              Experience uncompromised integrity, real-time proctoring, and instant analytics with our launch pilot program.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
              <Link to="/enter-exam" style={{ textDecoration: 'none' }}>
                <MagneticButton className="btn btn-primary btn-xl" style={{ minWidth: 220 }}>
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

      <SiteFooter />
    </div>
  )
}
