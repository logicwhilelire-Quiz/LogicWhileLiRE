import React, { Suspense, lazy, useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import CosmicCanvas from '../components/CosmicCanvas';
import MagneticButton from '../components/3d/MagneticButton';
import ShimmerText from '../components/3d/ShimmerText';
import GlowCard from '../components/3d/GlowCard';
import AltimeterDial from '../components/3d/AltimeterDial';
import LogicCoil from '../components/LogicCoil';
import api from '../lib/api';

// Lazy-load 3D components for peak performance
const CollegeGlobe = lazy(() => import('../components/3d/CollegeGlobe'));
const ParticleField = lazy(() => import('../components/3d/ParticleField'));
const NodeNetwork = lazy(() => import('../components/3d/NodeNetwork'));

// ─── 100% AUTHENTIC LOGIC WHI1E LIRE PLATFORM DATA ───
const STATS = [
  { value: 10000, label: 'Concurrent Capacity', suffix: '+', color: '#00b4d8', numStr: '10,000+' },
  { value: 50, label: 'WebSocket Latency', suffix: 'ms', color: '#0284c7', numStr: '<50ms' },
  { value: 100, label: 'Server Timing Integrity', suffix: '%', color: '#f59e0b', numStr: '100%' },
  { value: 99.9, label: 'Telemetry Reliability', suffix: '%', color: '#ea580c', numStr: '99.9%' },
];

const DOMAINS = [
  'Data Structures & Algorithms',
  'Full-Stack Web Systems',
  'System Design & Microservices',
  'Operating Systems & Concurrency',
  'Database Normalization & SQL',
  'Machine Learning & Neural Networks',
  'Cloud Infrastructure & DevOps',
  'Cybersecurity & Cryptography',
  'Quantitative Aptitude & Logic',
  'Compiler Design & AST Trees',
  'Distributed Consensus & Caching',
  'Object-Oriented Design & Clean Code',
];

const FEATURES = [
  {
    icon: '⚡',
    title: 'Synchronous Live Exam Dispatch',
    desc: 'Instant global exam initialization over Socket.io with waiting lobbies, late-join time adjustments, and microsecond reconnection synchronization.',
    trackColor: '#00b4d8',
    tags: ['Socket.io', 'Sub-50ms', 'Auto-Sync'],
  },
  {
    icon: '👁️',
    title: 'Client-Side AI Proctoring',
    desc: 'On-device facial landmarking and active gaze tracking running entirely in browser Web Workers. Zero raw video ever transmitted to servers.',
    trackColor: '#10b981',
    tags: ['MediaPipe', 'Web Worker', '100% On-Device'],
  },
  {
    icon: '⏱️',
    title: 'Server-Authoritative Timing',
    desc: 'Eliminates client-side clock tampering. Server drives authoritative ticks and remaining duration calculations across all candidate stations.',
    trackColor: '#f59e0b',
    tags: ['Zero Drift', 'Anti-Tamper', 'Heartbeat'],
  },
  {
    icon: '🛡️',
    title: 'Anti-Leak Forensic Ledger',
    desc: 'Dynamic candidate watermark tiles, browser devtools detection, tab-switch monitoring, and real-time invigilator anomaly logging.',
    trackColor: '#ea580c',
    tags: ['Watermarks', 'Audit Log', 'Tab Guard'],
  },
  {
    icon: '📶',
    title: 'Offline Answer Resilience',
    desc: 'Local IndexedDB write-ahead answer buffer with automatic background synchronization upon network reconnection to protect student responses.',
    trackColor: '#0284c7',
    tags: ['IndexedDB', 'Zero Data Loss', 'Auto-Retry'],
  },
  {
    icon: '📊',
    title: 'Real-Time Invigilator Console',
    desc: 'Comprehensive multi-candidate monitor wall with live status indicators, remote proctor warnings, time extensions, and session terminations.',
    trackColor: '#1d4ed8',
    tags: ['Live Monitor', 'Multi-Room', 'Instant Evict'],
  },
];

const PROCTORING_PILLARS = [
  {
    icon: '🛡️',
    title: 'Client-Side AI Sentinel',
    subtitle: 'Low-CPU Web Worker Inference',
    desc: 'Continuous facial landmarking via TensorFlow & MediaPipe running in background threads. Detects absence, multiple persons, or sustained gaze aversion (~1.5s interval).',
    badge: '100% On-Device',
    color: '#00b4d8',
  },
  {
    icon: '🔒',
    title: 'Zero-Cloud-Video Privacy',
    subtitle: 'Zero Raw Video Stored',
    desc: 'Candidate cameras are strictly processed on-device. No streaming video ever touches any server. Only audited timestamped event logs and lightweight incident frames are preserved.',
    badge: 'Privacy Compliant',
    color: '#10b981',
  },
  {
    icon: '⚡',
    title: 'Authoritative Server Timer',
    subtitle: 'Microsecond Socket Synchronization',
    desc: 'Eliminates client-side clock tampering. Server drives authoritative ticks over Socket.io, surviving network hiccups, browser crashes, and refreshes without time drift.',
    badge: 'Tamper Proof',
    color: '#f59e0b',
  },
  {
    icon: '📡',
    title: 'Offline Resilience Engine',
    subtitle: 'IndexedDB & Service Worker Queue',
    desc: 'Zero lost answers during campus WiFi drops. Responses buffer instantaneously to IndexedDB and automatically sync with the server once connectivity is restored.',
    badge: 'Zero Data Loss',
    color: '#ea580c',
  },
];

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
    desc: 'In-browser code editor with multi-tier test cases (public validation + hidden memory & CPU boundary suites) and instant feedback.',
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
];

const FAQS = [
  {
    q: 'How does our institution join the LogicWhileLiRE Early Pilot Program?',
    a: 'We offer an early access pilot program for engineering colleges, universities, and recruitment teams. Our engineering team provisions a dedicated cloud sandbox with custom institutional branding, admin credentials, and question authoring in under 24 hours.',
  },
  {
    q: 'How does the server-authoritative timer prevent cheating?',
    a: 'Traditional web exams rely on the candidate’s browser timer, which can be paused or altered by freezing browser tabs or adjusting system clocks. LogicWhileLiRE’s timer is driven by the server. The server dispatches live time ticks over Socket.io, and remaining duration is calculated against server timestamps. Even if candidates disconnect or refresh, their timer continues accurately without granting unauthorized time.',
  },
  {
    q: 'What happens if a candidate loses internet connection during the test?',
    a: 'LogicWhileLiRE features enterprise-grade offline resilience. Supported by local IndexedDB retry queues, all selected responses are saved locally with microsecond timestamps. If the network drops, candidates continue answering while an unobtrusive status banner indicates offline mode. When connectivity resumes, the queue automatically syncs all pending answers.',
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
];

function GlobeSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left - rect.width / 2) / (rect.width / 2),
      y: (e.clientY - rect.top - rect.height / 2) / (rect.height / 2),
    });
  };

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
        maxWidth: 290,
        aspectRatio: '1/1',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Suspense
        fallback={
          <div
            style={{
              width: 240,
              height: 240,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0,180,216,0.2), transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-display)',
            }}
          >
            Loading Telemetry Globe...
          </div>
        }
      >
        <CollegeGlobe className="w-full h-full max-w-[280px] max-h-[280px]" />
      </Suspense>

      {/* Orbital glowing rings with HackPradesh theme colors */}
      <motion.div
        style={{
          position: 'absolute',
          inset: -12,
          borderRadius: '50%',
          border: '1.5px solid rgba(0, 180, 216, 0.25)',
          pointerEvents: 'none',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        style={{
          position: 'absolute',
          inset: -28,
          borderRadius: '50%',
          border: '1px dashed rgba(245, 158, 11, 0.2)',
          pointerEvents: 'none',
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 38, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0.45]);
  const heroY = useTransform(scrollY, [0, 400], [0, -40]);

  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [studentUser, setStudentUser] = useState<any>(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem('student_user');
      const t = localStorage.getItem('student_token');
      if (u && t) setStudentUser(JSON.parse(u));
    } catch {
      setStudentUser(null);
    }
  }, []);

  const [demoForm, setDemoForm] = useState({
    name: '',
    email: '',
    institution: '',
    candidateCount: '500 - 2,000 students',
    message: '',
    submitted: false,
    loading: false,
  });

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemoForm((prev) => ({ ...prev, loading: true }));
    try {
      await api.post('/api/contact', {
        name: demoForm.name,
        email: demoForm.email,
        subject: `Pilot Sandbox Request — ${demoForm.institution}`,
        message: demoForm.message || `Campus pilot application for ${demoForm.institution} with estimated batch size: ${demoForm.candidateCount}`,
        institution: demoForm.institution,
        candidateCount: demoForm.candidateCount,
      });
    } catch (err) {
      console.warn('Contact request submission fallback:', err);
    } finally {
      setDemoForm((prev) => ({ ...prev, loading: false, submitted: true }));
    }
  };

  const portalEntries = [
    {
      id: 'candidate-gate',
      title: 'Candidate Gate',
      badge: 'Live Assessment Gate',
      badgeColor: 'var(--hp-cyan-bright, #00d2ff)',
      icon: '🛡️',
      description: 'Direct entry for scheduled candidates. Verify your Hall Ticket and unique Exam Code, complete pre-flight environment clearance, and access your live proctored station.',
      primaryActionText: 'Enter Candidate Gate',
      path: '/gate',
      borderColor: 'rgba(0, 180, 216, 0.4)',
      glowColor: 'rgba(0, 180, 216, 0.35)',
      btnGradient: 'linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%)',
    },
    {
      id: 'student-id',
      title: 'Student ID',
      badge: 'Candidate Portal',
      badgeColor: '#10b981',
      icon: '🎓',
      description: 'Authenticate with your institutional Student ID or Roll Number to access your section-targeted upcoming assessments, live countdowns, and performance reports.',
      primaryActionText: 'Student ID Login',
      path: '/login',
      borderColor: 'rgba(16, 185, 129, 0.4)',
      glowColor: 'rgba(16, 185, 129, 0.35)',
      btnGradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    },
    {
      id: 'admin',
      title: 'Admin Command',
      badge: 'Staff Command Hub',
      badgeColor: 'var(--hp-amber, #f59e0b)',
      icon: '🏛️',
      description: 'Master control portal for Super Admins, College Inspectors, and Section Faculty. Manage colleges, academic hierarchies, question banks, and live room monitoring.',
      primaryActionText: 'Staff & Admin Login',
      path: '/admin',
      borderColor: 'rgba(245, 158, 11, 0.4)',
      glowColor: 'rgba(245, 158, 11, 0.35)',
      btnGradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
    },
  ];

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* ─── 1. INTERACTIVE COSMIC CANVAS BACKGROUND ─── */}
      <CosmicCanvas />

      {/* ─── 2. FLOATING NAVIGATION ─── */}
      <SiteHeader />

      <main style={{ position: 'relative', zIndex: 1, paddingTop: 100 }} id="main-content">
        {/* ─── 3. SPLIT HERO SECTION (HACKPRADESH AESTHETIC WITH LOGIC WHILE LIRE CONTENT) ─── */}
        <motion.header
          className="hp-hero"
          id="home"
          style={{ opacity: heroOpacity, y: heroY, width: '100%', display: 'flex', justifyContent: 'center' }}
        >
          <div className="wrap hp-hero-wrap" style={{ margin: '0 auto', width: '100%' }}>
            {/* Left Column: Authentic Logic Whi1e LiRE Copy */}
            <motion.div
              className="hp-hero-left"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Live Status Pulse Badge */}
              <div className="live-badge">
                <span className="pulse-dot" />
                <span>AUTONOMOUS ASSESSMENT ENGINE • 5 TECHNICAL SECTORS</span>
              </div>

              {/* Main Headline with HackPradesh Dual-Gradient Typography */}
              <h1 className="hp-hero-title">
                <span className="brand-hack">LOGIC</span>
                <span className="brand-pradesh">WHI1E</span>
                <span
                  style={{
                    display: 'inline-block',
                    marginLeft: 12,
                    padding: '2px 14px',
                    borderRadius: 12,
                    border: '2px solid var(--hp-amber, #f59e0b)',
                    background: 'rgba(245, 158, 11, 0.12)',
                    color: 'var(--hp-amber, #f59e0b)',
                    fontSize: 'clamp(26px, 3.8vw, 42px)',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    verticalAlign: 'middle',
                    boxShadow: '0 0 20px rgba(245, 158, 11, 0.25)',
                  }}
                >
                  LiRE
                </span>
              </h1>

              {/* Subhead Tagline Badge */}
              <div className="tagline-badge">
                <span>[ Li: LIVE • R: REAL • E: ENGINE ] — ELEVATING CODING KNOWLEDGE</span>
              </div>

              {/* Lead Mission Description */}
              <p className="sec-body" style={{ textAlign: 'left', margin: '0 0 22px', maxWidth: 580 }}>
                Enterprise-grade standardized examination platform featuring{' '}
                <strong style={{ color: 'var(--text-pure)' }}>server-authoritative timers</strong>,{' '}
                <strong style={{ color: 'var(--hp-cyan-bright)' }}>on-device AI proctoring</strong>,{' '}
                college-scoped governance, and real-time invigilator telemetry across{' '}
                <strong style={{ color: 'var(--hp-amber)' }}>5 core technical sectors</strong>.
              </p>

              {/* Meta Feature Pills */}
              <div className="hero-meta">
                <div className="hp-pill">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Server-Authoritative Timing (Zero Drift)</span>
                </div>
                <div className="hp-pill">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>Client-Side AI Vision (100% Privacy)</span>
                </div>
                <div className="hp-pill">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2.5">
                    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                    <line x1="12" y1="20" x2="12.01" y2="20" />
                  </svg>
                  <span>Offline Answer Resilience (Zero Loss)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="cta-row" style={{ marginTop: 24 }}>
                {studentUser ? (
                  <>
                    <button
                      className="btn-hp btn-hp-primary"
                      onClick={() => navigate('/enter-exam')}
                    >
                      <span>🚀 Enter Assigned Exam</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                    <button
                      className="btn-hp btn-hp-ghost"
                      onClick={() => navigate('/student/dashboard')}
                    >
                      <span>🎓 Student Dashboard</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn-hp btn-hp-primary"
                      onClick={() => navigate('/enter-exam')}
                    >
                      <span>⚡ Quick Exam Code Entry</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                    <button
                      className="btn-hp btn-hp-ghost"
                      onClick={() => navigate('/gate')}
                    >
                      <span>🛡️ Candidate Gate Pass</span>
                    </button>
                    <button
                      className="btn-hp btn-hp-ghost"
                      onClick={() => navigate('/admin')}
                      style={{ borderStyle: 'dashed' }}
                    >
                      <span>🏛️ Staff & Admin</span>
                    </button>
                  </>
                )}
              </div>

              {/* Trust Endorsement */}
              <div className="hero-trust" style={{ marginTop: 20 }}>
                <span className="trust-icon">✓</span>
                <span>Sub-50ms WebSocket Dispatch • WebAssembly On-Device Vision • Microsecond Synchronization</span>
              </div>
            </motion.div>

            {/* Right Column: Hero Stage Card with 3D Telemetry Globe */}
            <motion.div
              className="hp-hero-right"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="hero-stage-card">
                {/* Radial Glow Halo */}
                <div className="card-glow-bg" />

                {/* HUD Live Pulse Badge */}
                <div className="hud-pill">
                  <span className="hud-pulse" />
                  <span>AUTONOMOUS ENGINE TELEMETRY</span>
                </div>

                {/* Globe Telemetry Stage */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 16px' }}>
                  <GlobeSection />
                </div>

                {/* Real-time Status Metric Boxes */}
                <div className="countdown" style={{ margin: '8px 0 14px' }}>
                  <div className="cd-box">
                    <span className="cd-num" style={{ color: 'var(--hp-cyan)' }}>10K+</span>
                    <span className="cd-label">CAPACITY</span>
                  </div>
                  <div className="cd-box">
                    <span className="cd-num" style={{ color: 'var(--hp-blue)' }}>&lt;50ms</span>
                    <span className="cd-label">LATENCY</span>
                  </div>
                  <div className="cd-box">
                    <span className="cd-num" style={{ color: 'var(--hp-amber)' }}>100%</span>
                    <span className="cd-label">INTEGRITY</span>
                  </div>
                  <div className="cd-box">
                    <span className="cd-num" style={{ color: 'var(--hp-flame)' }}>0 LOST</span>
                    <span className="cd-label">DATA LOSS</span>
                  </div>
                </div>

                <div className="cd-footer-status">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  <span>CORE DISPATCH ENGINE: ACTIVE &bull; 100% AUTHORITATIVE</span>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.header>

        {/* ─── 4. THREE CENTRALIZED ACCESS PORTALS ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '40px 0 60px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div className="wrap" style={{ margin: '0 auto', width: '100%' }}>
            <div className="sec-head-center">
              <span className="eyebrow">CENTRALIZED EVALUATION ACCESS</span>
              <h2 className="sec-title">Select Your Evaluation Gate</h2>
              <p className="sec-body">
                Dedicated gateways configured for live examination candidates, student academic portals, and institutional administrators.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 24,
                width: '100%',
              }}
            >
              {portalEntries.map((card, idx) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  style={{ display: 'flex' }}
                >
                  <GlowCard
                    glowColor={card.glowColor}
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      background: 'var(--glass-bg)',
                      border: `1.5px solid ${card.borderColor}`,
                      borderRadius: 20,
                      padding: '30px 24px',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      boxShadow: 'var(--shadow-glass)',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 12px',
                          borderRadius: 999,
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: `1px solid ${card.borderColor}`,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: card.badgeColor,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: card.badgeColor,
                            boxShadow: `0 0 8px ${card.badgeColor}`,
                          }}
                        />
                        {card.badge}
                      </span>
                      <span style={{ fontSize: '2.2rem' }}>{card.icon}</span>
                    </div>

                    <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-pure)', margin: '0 0 10px 0', fontFamily: 'var(--font-heading)' }}>
                      {card.title}
                    </h3>

                    <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 24px 0', flex: 1 }}>
                      {card.description}
                    </p>

                    <button
                      onClick={() => navigate(card.path)}
                      style={{
                        width: '100%',
                        padding: '12px 20px',
                        background: card.btnGradient,
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 12,
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        fontFamily: 'var(--font-body)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      <span>{card.primaryActionText}</span>
                      <span>&rarr;</span>
                    </button>
                  </GlowCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 5. INFINITE MARQUEE TICKER — 5 TECHNICAL SECTORS & CORE DISCIPLINES ─── */}
        <section className="marquee-wrap">
          <div className="marquee-content">
            {[...DOMAINS, ...DOMAINS].map((name, i) => (
              <div key={i} className="marquee-item">
                <span className="symbol">⚡</span>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 6. PLATFORM PERFORMANCE & RELIABILITY BENCHMARKS (STAT GRID) ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '70px 0', width: '100%', display: 'flex', justifyContent: 'center' }} id="benchmarks">
          <div className="wrap" style={{ margin: '0 auto', width: '100%' }}>
            <div className="sec-head-center">
              <span className="eyebrow">EXAMINATION PLATFORM METRICS</span>
              <h2 className="sec-title">Performance &amp; Reliability Benchmarks</h2>
              <p className="sec-body">
                Engineered for university-scale concurrent exams, microsecond-synchronized timers, and automated anti-cheat monitoring.
              </p>
            </div>

            <div className="stat-grid">
              {STATS.map((stat, i) => (
                <motion.div
                  key={i}
                  className="stat-card"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <div className="num" style={{ color: stat.color }}>
                    {stat.numStr}
                  </div>
                  <div className="lbl">{stat.label}</div>
                  <div className="corner-accent">●</div>
                </motion.div>
              ))}
            </div>

            {/* Altimeter Dials Visual Showcase */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginTop: 24 }}>
              {STATS.map((stat, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: 16,
                    padding: '24px 20px',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <AltimeterDial value={stat.value} label={stat.label} suffix={stat.suffix} color={stat.color} size={130} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 7. CORE PLATFORM CAPABILITIES (HACKPRADESH DOMAIN CARDS) ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '70px 0', width: '100%', display: 'flex', justifyContent: 'center' }} id="capabilities">
          <div className="wrap" style={{ margin: '0 auto', width: '100%' }}>
            <div className="sec-head-center">
              <span className="eyebrow">PLATFORM CAPABILITIES</span>
              <h2 className="sec-title">Core Evaluation Features</h2>
              <p className="sec-body">
                Modular exam management, anti-tamper safeguards, and evaluation engines designed for rigorous institutional workflows.
              </p>
            </div>

            <div className="domain-grid">
              {FEATURES.map((feat, i) => (
                <motion.div
                  key={i}
                  className="domain-card"
                  style={{ '--track-color': feat.trackColor } as React.CSSProperties}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                >
                  <div className="domain-icon-wrap" style={{ fontSize: '22px' }}>
                    {feat.icon}
                  </div>
                  <h3>{feat.title}</h3>
                  <p>{feat.desc}</p>
                  <div className="track-tags">
                    {feat.tags.map((tag, tIdx) => (
                      <span key={tIdx} className="track-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 8. LOGIC COIL BRAND DIVIDER ─── */}
        <LogicCoil variant="divider" size={26} />

        {/* ─── 9. SECURITY & PROCTORING SHOWCASE (WHY-JOIN STYLE CARDS) ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '70px 0', width: '100%', display: 'flex', justifyContent: 'center' }} id="proctoring">
          <div className="wrap" style={{ margin: '0 auto', width: '100%' }}>
            <div className="sec-head-center">
              <span className="eyebrow">ACADEMIC INTEGRITY & PRIVACY</span>
              <h2 className="sec-title">Privacy-Preserving On-Device Verification</h2>
              <p className="sec-body">
                Client-side vision models process facial verification locally. Incident event timestamps are transmitted without persisting raw video streams on servers.
              </p>
            </div>

            <div className="why-grid">
              {PROCTORING_PILLARS.map((pillar, i) => (
                <motion.div
                  key={i}
                  className="why-card"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <div className="why-icon" style={{ fontSize: '24px' }}>
                    {pillar.icon}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '3px 10px',
                        borderRadius: 999,
                        background: `${pillar.color}20`,
                        color: pillar.color,
                        border: `1px solid ${pillar.color}50`,
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {pillar.badge}
                    </span>
                  </div>
                  <h3>{pillar.title}</h3>
                  <div style={{ fontSize: '13px', color: pillar.color, fontWeight: 700, marginBottom: 8, fontFamily: 'var(--font-display)' }}>
                    {pillar.subtitle}
                  </div>
                  <p>{pillar.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 10. 3-STEP ASSESSMENT WORKFLOW ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '70px 0', width: '100%', display: 'flex', justifyContent: 'center' }} id="workflow">
          <div className="wrap" style={{ margin: '0 auto', width: '100%' }}>
            <div className="sec-head-center">
              <span className="eyebrow">INSTITUTIONAL WORKFLOW</span>
              <h2 className="sec-title">3 Steps to Autonomous Assessment</h2>
              <p className="sec-body">
                Seamless end-to-end examination deployment designed for high-concurrency campus environments.
              </p>
            </div>

            <div className="eval-rounds-grid">
              {[
                {
                  step: '01',
                  title: 'Admin Configures Exam',
                  meta: 'Targeted Roster & Rules',
                  desc: 'Select targeted college, branch, and section. Configure question banks, time limits, and invigilation rules. Generate secure exam codes.',
                  badge: 'Step 1: Setup',
                  badgeClass: 'green',
                },
                {
                  step: '02',
                  title: 'Candidate Verifies Identity',
                  meta: 'Pre-Flight Clearance',
                  desc: 'Candidate verifies identity with Hall Ticket and Exam Code. Pre-flight hardware clearance confirms webcam and single session lock.',
                  badge: 'Step 2: Gate Check',
                  badgeClass: 'gold',
                },
                {
                  step: '03',
                  title: 'Scoring & Live Telemetry',
                  meta: 'Authoritative Ledger',
                  desc: 'Instant server-side grading, real-time invigilator live monitoring wall, automated anti-tamper ledger, and comprehensive scorecards.',
                  badge: 'Step 3: Verification',
                  badgeClass: 'red',
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="eval-card"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.5 }}
                >
                  <div className="eval-num">{item.step}</div>
                  <div className="eval-body">
                    <div className="eval-meta">{item.meta}</div>
                    <h4>{item.title}</h4>
                    <p>{item.desc}</p>
                    <span className={`eval-badge ${item.badgeClass}`}>{item.badge}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 11. DEPLOYMENT ARCHITECTURE ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '70px 0', width: '100%', display: 'flex', justifyContent: 'center' }} id="deployment">
          <div className="wrap" style={{ margin: '0 auto', width: '100%' }}>
            <div className="sec-head-center">
              <span className="eyebrow">DEPLOYMENT ARCHITECTURE</span>
              <h2 className="sec-title">Engineered for High-Stakes Evaluation</h2>
              <p className="sec-body">
                Purpose-built infrastructure supporting high-concurrency semester finals, campus placement drives, and remote proctoring.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {DEPLOYMENT_MODES.map((col, i) => (
                <motion.div
                  key={i}
                  className="stat-card"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--hp-cyan)', background: 'rgba(0, 180, 216, 0.12)', padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-display)' }}>
                      {col.tag}
                    </span>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{col.city}</span>
                  </div>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 4, color: 'var(--text-pure)', fontFamily: 'var(--font-heading)' }}>
                    {col.short}
                  </h4>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12, minHeight: 36 }}>
                    {col.name}
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
                    {col.metric}
                  </div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 'auto' }}>
                    {col.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 12. FREQUENTLY ASKED QUESTIONS (FAQ) ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '70px 0', width: '100%', display: 'flex', justifyContent: 'center' }} id="faq">
          <div className="wrap" style={{ maxWidth: 840, margin: '0 auto', width: '100%' }}>
            <div className="sec-head-center">
              <span className="eyebrow">CLARITY FIRST</span>
              <h2 className="sec-title">Frequently Asked Questions</h2>
              <p className="sec-body">
                Everything you need to know about exam integrity, timer mechanics, privacy standards, and question banking.
              </p>
            </div>

            <div className="faq-grid">
              {FAQS.map((faq, i) => {
                const isOpen = activeFaq === i;
                return (
                  <details
                    key={i}
                    className="faq-item"
                    open={isOpen}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveFaq(isOpen ? null : i);
                    }}
                  >
                    <summary>{faq.q}</summary>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          <p>{faq.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </details>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── 13. STARTUP PILOT PROGRAM APPLICATION FORM ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '70px 0', width: '100%', display: 'flex', justifyContent: 'center' }} id="pilot">
          <div className="wrap" style={{ maxWidth: 840, margin: '0 auto', width: '100%' }}>
            <div className="sec-head-center">
              <span className="eyebrow">CAMPUS PILOT PROGRAM</span>
              <h2 className="sec-title">Apply for Early Campus Sandbox Access</h2>
              <p className="sec-body">
                We partner with engineering institutions, universities, and placement cells to deploy pilot assessments with dedicated engineering support.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div
                style={{
                  padding: '36px',
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: 20,
                  backdropFilter: 'blur(16px)',
                  boxShadow: 'var(--shadow-glass)',
                }}
              >
                {demoForm.submitted ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginBottom: 8, fontFamily: 'var(--font-heading)' }}>
                      Pilot Application Received!
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 500, margin: '0 auto 20px auto' }}>
                      Thank you, <strong>{demoForm.name}</strong>. Our engineering team will reach out to <strong>{demoForm.email}</strong> within 4 business hours to provision your dedicated institutional sandbox.
                    </p>
                    <button
                      className="btn-hp btn-hp-ghost"
                      onClick={() => setDemoForm((prev) => ({ ...prev, submitted: false }))}
                      style={{ padding: '10px 20px', borderRadius: 10 }}
                    >
                      Submit Another Request
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleDemoSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginBottom: 16 }}>
                      <div>
                        <label htmlFor="pilot-name" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-pure)', marginBottom: 6 }}>
                          Full Name *
                        </label>
                        <input
                          id="pilot-name"
                          name="name"
                          type="text"
                          placeholder="e.g. Dr. Rajesh Sharma"
                          required
                          value={demoForm.name}
                          onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--panel-border)',
                            color: 'var(--text-pure)',
                            fontSize: '14.5px',
                          }}
                        />
                      </div>

                      <div>
                        <label htmlFor="pilot-email" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-pure)', marginBottom: 6 }}>
                          Official / Institutional Email *
                        </label>
                        <input
                          id="pilot-email"
                          name="email"
                          type="email"
                          placeholder="e.g. dean.academics@college.edu"
                          required
                          value={demoForm.email}
                          onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--panel-border)',
                            color: 'var(--text-pure)',
                            fontSize: '14.5px',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginBottom: 16 }}>
                      <div>
                        <label htmlFor="pilot-institution" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-pure)', marginBottom: 6 }}>
                          Institution / College Name *
                        </label>
                        <input
                          id="pilot-institution"
                          name="institution"
                          type="text"
                          placeholder="e.g. Engineering Institute of Technology"
                          required
                          value={demoForm.institution}
                          onChange={(e) => setDemoForm({ ...demoForm, institution: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--panel-border)',
                            color: 'var(--text-pure)',
                            fontSize: '14.5px',
                          }}
                        />
                      </div>

                      <div>
                        <label htmlFor="pilot-candidate-count" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-pure)', marginBottom: 6 }}>
                          Estimated Student Batch Size
                        </label>
                        <select
                          id="pilot-candidate-count"
                          name="candidateCount"
                          value={demoForm.candidateCount}
                          onChange={(e) => setDemoForm({ ...demoForm, candidateCount: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--panel-border)',
                            color: 'var(--text-pure)',
                            fontSize: '14.5px',
                          }}
                        >
                          <option value="50 - 200 candidates (Pilot Class)">50 - 200 candidates (Pilot Class)</option>
                          <option value="200 - 1,000 candidates (Department)">200 - 1,000 candidates (Department)</option>
                          <option value="1,000 - 5,000 candidates (Campus Wide)">1,000 - 5,000 candidates (Campus Wide)</option>
                          <option value="5,000+ candidates (University Scale)">5,000+ candidates (University Scale)</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <label htmlFor="pilot-message" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-pure)', marginBottom: 6 }}>
                        Evaluation Format / Requirements
                      </label>
                      <textarea
                        id="pilot-message"
                        name="message"
                        rows={3}
                        placeholder="Describe your upcoming assessment format (e.g. Semester Finals, Campus Placement Drive, Code Contest)..."
                        value={demoForm.message}
                        onChange={(e) => setDemoForm({ ...demoForm, message: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: 10,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--panel-border)',
                          color: 'var(--text-pure)',
                          resize: 'vertical',
                          fontSize: '14.5px',
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={demoForm.loading}
                      className="btn-hp btn-hp-primary"
                      style={{ width: '100%', padding: '14px', borderRadius: 12, justifyContent: 'center' }}
                    >
                      {demoForm.loading ? 'Provisioning Sandbox...' : '🚀 Apply for Campus Pilot Sandbox'}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── 14. FINAL CALL-TO-ACTION BANNER ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '40px 0 80px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div className="wrap" style={{ maxWidth: 1080, margin: '0 auto', width: '100%' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              style={{
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(29, 78, 216, 0.1) 45%, rgba(234, 88, 12, 0.08) 100%)',
                border: '1.5px solid rgba(0, 180, 216, 0.35)',
                borderRadius: 24,
                padding: '54px 36px',
                textAlign: 'center',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35), 0 0 30px rgba(0, 180, 216, 0.15)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'clamp(2.1rem, 3.8vw, 3.2rem)',
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                  marginBottom: 14,
                  color: 'var(--text-pure)',
                }}
              >
                Ready to Deploy
                <br />
                <ShimmerText text="LogicWhileLiRE on Your Campus?" shimmer />
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: 640, margin: '0 auto 30px auto' }}>
                Run scheduled midterm assessments, campus placement screening drives, and automated proctoring with institutional pilot access.
              </p>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn-hp btn-hp-primary"
                  onClick={() => navigate('/enter-exam')}
                >
                  <span>🚀 Start Assessment</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
                <button
                  className="btn-hp btn-hp-ghost"
                  onClick={() => navigate('/admin')}
                >
                  <span>🏛️ Staff &amp; Admin Console</span>
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── 15. PARTICLE FIELD CANVAS (BOTTOM ACCENT) ─── */}
        <div style={{ position: 'relative', height: 140, overflow: 'hidden' }}>
          <Suspense fallback={null}>
            <ParticleField count={36} />
          </Suspense>
        </div>
      </main>

      {/* ─── 16. SYSTEM FOOTER (DOCUMENTATION & PROBES) ─── */}
      <SiteFooter />
    </div>
  );
}
