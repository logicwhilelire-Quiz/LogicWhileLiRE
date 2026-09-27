import { Suspense, lazy, useRef, useEffect, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import MagneticButton from '../components/3d/MagneticButton'
import ShimmerText from '../components/3d/ShimmerText'
import GlowCard from '../components/3d/GlowCard'
import AltimeterDial from '../components/3d/AltimeterDial'
import FlightPathLines from '../components/3d/FlightPathLines'

// Lazy-load 3D heavy components
const CollegeGlobe = lazy(() => import('../components/3d/CollegeGlobe'))
const LiquidBlob   = lazy(() => import('../components/3d/LiquidBlob'))
const ParticleField = lazy(() => import('../components/3d/ParticleField'))

const STATS = [
  { value: 50000,  label: 'Students Assessed', suffix: '+', color: '#2B7FFF' },
  { value: 200,    label: 'Partner Colleges',  suffix: '+', color: '#10B981' },
  { value: 99,     label: 'Uptime',            suffix: '%', color: '#F59E0B' },
  { value: 5000,   label: 'Questions Bank',    suffix: '+', color: '#A78BFA' },
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
    color: '#F59E0B',
  },
  {
    icon: '📊',
    title: 'Real-time Analytics',
    desc: '3D radar charts, placement analysis, department rankings, and downloadable PDF certificates with QR verification.',
    color: '#A78BFA',
  },
  {
    icon: '🏆',
    title: '3D Leaderboard',
    desc: 'Live ranked leaderboard with animated 3D podium. PlasmaBall for 1st, CodeCube for 2nd, NeonGrid for 3rd.',
    color: '#EF4444',
  },
  {
    icon: '⚡',
    title: 'Bulk Enrollment',
    desc: 'Upload Excel with thousands of candidates. Auto-generate hall tickets. Send invites via email/SMS.',
    color: '#06B6D4',
  },
]

const COLLEGES = [
  'VRSEC', 'KL University', 'GITAM', 'RVR & JC', 'VIT-AP', 'SRM', 'Amrita', 'BITS Pilani',
  'NIT Warangal', 'JNTU', 'Andhra University', 'Vignan', 'Shri Vishnu', 'Centurion',
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

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', overflow: 'hidden' }}>
      <SiteHeader />

      {/* ─── FLIGHT PATH BACKGROUND (fixed) ─── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <FlightPathLines color="#2B7FFF" opacity={0.06} count={16} className="" />
      </div>

      {/* ─── HERO SECTION ─── */}
      <motion.section
        style={{
          opacity: heroOpacity, y: heroY,
          minHeight: '100vh',
          display: 'flex', alignItems: 'center',
          position: 'relative', zIndex: 1,
          paddingTop: 80,
        }}
      >
        {/* Blob background */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <Suspense fallback={null}>
            <LiquidBlob />
          </Suspense>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(43,127,255,0.08), transparent)',
          }} />
        </div>

        <div className="page-content" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            alignItems: 'center',
            gap: 64,
            minHeight: 'calc(100vh - 80px)',
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
                  background: 'rgba(43,127,255,0.1)',
                  border: '1px solid rgba(43,127,255,0.25)',
                  borderRadius: 999, fontSize: '0.8rem', fontWeight: 600,
                  color: 'var(--color-primary)', marginBottom: 20,
                  letterSpacing: '0.04em',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', animation: 'blink 2s infinite' }} />
                NOW LIVE — LogicWhile 4.0 ULTRA
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
