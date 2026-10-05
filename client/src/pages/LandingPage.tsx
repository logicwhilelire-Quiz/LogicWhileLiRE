import React, { Suspense, lazy, useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import MagneticButton from '../components/3d/MagneticButton';
import ShimmerText from '../components/3d/ShimmerText';
import GlowCard from '../components/3d/GlowCard';
import AltimeterDial from '../components/3d/AltimeterDial';
import FlightPathLines from '../components/3d/FlightPathLines';
import LogicCoil from '../components/LogicCoil';
import api from '../lib/api';

// Lazy-load 3D components
const CollegeGlobe = lazy(() => import('../components/3d/CollegeGlobe'));
const ParticleField = lazy(() => import('../components/3d/ParticleField'));
const NodeNetwork = lazy(() => import('../components/3d/NodeNetwork'));

const STATS = [
  { value: 10000, label: 'Concurrent Capacity', suffix: '+', color: '#2B7FFF' },
  { value: 50, label: 'WebSocket Latency', suffix: 'ms', color: '#38BDF8' },
  { value: 100, label: 'Server Timing Integrity', suffix: '%', color: '#10B981' },
  { value: 99.9, label: 'Telemetry Reliability', suffix: '%', color: '#F59E0B' },
];

const FEATURES = [
  {
    icon: '⚡',
    title: 'Synchronous Live Exam Dispatch',
    desc: 'Instant global exam initialization over Socket.io with waiting lobbies, late-join time adjustment, and microsecond reconnection synchronization.',
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
    a: 'We offer an early access pilot program for engineering colleges, coding bootcamps, and recruitment teams. Our engineering team provisions a dedicated cloud sandbox with custom institutional branding, admin credentials, and question authoring in under 24 hours.',
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
        maxWidth: 380,
        aspectRatio: '1/1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Suspense
        fallback={
          <div
            style={{
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(43,127,255,0.2), transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
              fontSize: '0.9rem',
            }}
          >
            Loading Globe...
          </div>
        }
      >
        <CollegeGlobe className="w-full h-full max-w-[360px] max-h-[360px]" />
      </Suspense>

      {/* Orbital rings */}
      <motion.div
        style={{
          position: 'absolute',
          inset: -16,
          borderRadius: '50%',
          border: '1px solid rgba(43,127,255,0.18)',
          pointerEvents: 'none',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        style={{
          position: 'absolute',
          inset: -32,
          borderRadius: '50%',
          border: '1px dashed rgba(43,127,255,0.1)',
          pointerEvents: 'none',
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0.4]);
  const heroY = useTransform(scrollY, [0, 400], [0, -60]);

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
      badgeColor: '#38BDF8',
      icon: '🛡️',
      description: 'Direct entry for scheduled candidates. Verify your Hall Ticket and unique Exam Code, complete pre-flight environment clearance, and access your live proctored station.',
      primaryActionText: 'Enter Candidate Gate',
      path: '/gate',
      gradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.16) 0%, rgba(37, 99, 235, 0.06) 100%)',
      borderColor: 'rgba(56, 189, 248, 0.4)',
      glowColor: 'rgba(56, 189, 248, 0.45)',
      btnGradient: 'linear-gradient(135deg, #0284C7 0%, #2563EB 100%)',
    },
    {
      id: 'student-id',
      title: 'Student ID',
      badge: 'Candidate Portal',
      badgeColor: '#10B981',
      icon: '🎓',
      description: 'Authenticate with your institutional Student ID or Roll Number to access your section-targeted upcoming assessments, live countdowns, and performance reports.',
      primaryActionText: 'Student ID Login',
      path: '/login',
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(5, 150, 105, 0.06) 100%)',
      borderColor: 'rgba(16, 185, 129, 0.4)',
      glowColor: 'rgba(16, 185, 129, 0.45)',
      btnGradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
    },
    {
      id: 'admin',
      title: 'Admin',
      badge: 'Staff Command Hub',
      badgeColor: '#A855F7',
      icon: '🏛️',
      description: 'Master control portal for Super Admins, College Inspectors, and Section Faculty. Manage colleges, academic hierarchies, question banks, and live room monitoring.',
      primaryActionText: 'Staff & Admin Login',
      path: '/admin',
      gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.16) 0%, rgba(124, 58, 237, 0.06) 100%)',
      borderColor: 'rgba(168, 85, 247, 0.4)',
      glowColor: 'rgba(168, 85, 247, 0.45)',
      btnGradient: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)',
    },
  ];

  return (
    <div style={{ background: 'var(--color-bg, #030712)', minHeight: '100vh', color: '#F8FAFC' }}>
      <SiteHeader />

      <main id="main-content">
        {/* ─── FLIGHT PATH BACKGROUND (fixed) ─── */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <FlightPathLines color="#bf9f62" opacity={0.06} count={16} className="" />
        </div>

        {/* ─── HERO SECTION ─── */}
        <motion.section
          style={{
            opacity: heroOpacity,
            y: heroY,
            minHeight: 'calc(100vh - 72px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
            paddingTop: 88,
            paddingBottom: 48,
          }}
        >
          {/* Hero Interactive 3D Node Network background */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <Suspense fallback={null}>
              <NodeNetwork nodeCount={36} maxDistance={140} lineColor="rgba(27, 95, 181, 0.16)" nodeColor="#1B5FB5" />
            </Suspense>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(27, 95, 181, 0.08), transparent)',
              }}
            />
          </div>

          <div className="page-content" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
            {/* Top Row: Title, Subtitle, and Globe */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 36, alignItems: 'center', marginBottom: 40 }}>
              {/* Left Column: Branding and Overview */}
              <div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                    background: 'rgba(37, 99, 235, 0.12)',
                    border: '1px solid rgba(37, 99, 235, 0.3)',
                    borderRadius: 999,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#38BDF8',
                    marginBottom: 16,
                    letterSpacing: '0.04em',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', flexShrink: 0, boxShadow: '0 0 8px #10B981' }} />
                  <span>AUTONOMOUS CAMPUS &amp; SEMESTER ASSESSMENT PLATFORM</span>
                </div>

                <h1
                  style={{
                    fontFamily: 'var(--font-display, sans-serif)',
                    fontSize: 'clamp(2.4rem, 5vw, 4.2rem)',
                    fontWeight: 900,
                    lineHeight: 1.05,
                    letterSpacing: '-0.03em',
                    marginBottom: 8,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.2em' }}>
                    <span style={{ color: '#FF7A00' }}>Logic</span>
                    <span style={{ color: '#60A5FA' }}>
                      Whi<span style={{ color: '#FF7A00', fontWeight: 900 }}>1</span>e
                    </span>
                    <span
                      style={{
                        border: '2px solid #FFC200',
                        padding: '2px 10px',
                        borderRadius: 8,
                        background: 'rgba(255, 194, 0, 0.12)',
                        marginLeft: 4,
                        display: 'inline-flex',
                        alignItems: 'baseline',
                      }}
                    >
                      <span style={{ color: '#60A5FA' }}>Li</span>
                      <span style={{ color: '#FF7A00' }}>R</span>
                      <span style={{ color: '#60A5FA' }}>E</span>
                    </span>
                  </span>
                </h1>

                <div
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#38BDF8',
                    letterSpacing: '0.12em',
                    marginBottom: 10,
                  }}
                >
                  Li: Live &bull; R: Real &bull; E: Engine
                </div>

                <h2
                  style={{
                    fontFamily: 'var(--font-display, sans-serif)',
                    fontSize: 'clamp(1.25rem, 2.2vw, 1.75rem)',
                    fontWeight: 800,
                    lineHeight: 1.3,
                    color: '#FF7A00',
                    marginBottom: 14,
                  }}
                >
                  Elevating Coding Knowledge
                </h2>

                <p
                  style={{
                    color: '#94A3B8',
                    fontSize: '1.02rem',
                    lineHeight: 1.65,
                    marginBottom: 24,
                    maxWidth: 580,
                  }}
                >
                  Enterprise-grade standardized examination system featuring server-authoritative timers, on-device AI proctoring, college-scoped governance, and real-time invigilator telemetry.
                </p>

                {/* Quick Action Buttons */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  {studentUser ? (
                    <>
                      <Link to="/enter-exam" style={{ textDecoration: 'none' }}>
                        <MagneticButton
                          className="btn btn-primary"
                          style={{
                            background: 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)',
                            boxShadow: '0 8px 24px rgba(255, 122, 0, 0.4)',
                            color: '#FFFFFF',
                            fontWeight: 700,
                            padding: '12px 28px',
                            borderRadius: 12,
                          }}
                        >
                          🚀 Enter Assigned Exam &rarr;
                        </MagneticButton>
                      </Link>
                      <Link to="/student/dashboard" style={{ textDecoration: 'none' }}>
                        <MagneticButton
                          className="btn btn-secondary"
                          style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#FFFFFF',
                            fontWeight: 600,
                            padding: '12px 24px',
                            borderRadius: 12,
                          }}
                        >
                          🎓 Student Dashboard
                        </MagneticButton>
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link to="/enter-exam" style={{ textDecoration: 'none' }}>
                        <MagneticButton
                          className="btn btn-primary"
                          style={{
                            background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
                            color: '#FFFFFF',
                            fontWeight: 700,
                            padding: '12px 28px',
                            borderRadius: 12,
                          }}
                        >
                          ⚡ Quick Exam Code Entry &rarr;
                        </MagneticButton>
                      </Link>
                      <Link to="/gate" style={{ textDecoration: 'none' }}>
                        <MagneticButton
                          className="btn btn-secondary"
                          style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#FFFFFF',
                            fontWeight: 600,
                            padding: '12px 24px',
                            borderRadius: 12,
                          }}
                        >
                          🛡️ Candidate Gate Pass
                        </MagneticButton>
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column: 3D Interactive Globe */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <GlobeSection />
              </div>
            </div>

            {/* ─── THE THREE PROMINENT 3D ENTRY CARDS ─── */}
            <div style={{ marginBottom: 36 }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#38BDF8' }}>
                  CENTRALIZED ACCESS PORTALS
                </span>
                <h3 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '6px 0 0 0', color: '#FFFFFF' }}>
                  Select Your Evaluation Gate
                </h3>
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
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: idx * 0.12, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: 'flex' }}
                  >
                    <GlowCard
                      glowColor={card.glowColor}
                      style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        background: card.gradient,
                        border: `1px solid ${card.borderColor}`,
                        borderRadius: 20,
                        padding: '30px 24px',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.35)',
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

                      <h4 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 10px 0' }}>
                        {card.title}
                      </h4>

                      <p style={{ fontSize: '0.9rem', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 24px 0', flex: 1 }}>
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

            {/* ─── HERO STAT COUNTERS ─── */}
            <motion.div
              className="hero-stats-grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              style={{
                marginTop: 10,
                padding: '16px 20px',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 16,
                backdropFilter: 'blur(12px)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
              }}
            >
              {STATS.map((stat, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 8px' }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 10,
                      background: `${stat.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                      flexShrink: 0,
                    }}
                  >
                    {i === 0 ? '⚡' : i === 1 ? '📡' : i === 2 ? '🛡️' : '💻'}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.1 }}>
                      {stat.value.toLocaleString()}
                      {stat.suffix}
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* ─── MARQUEE — Domains ─── */}
        <section
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '32px 0',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(10, 17, 40, 0.6)',
            overflow: 'hidden',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#60A5FA' }}>
              STANDARDIZED EVALUATION ACROSS CORE ENGINEERING DISCIPLINES
            </span>
          </div>
          <div className="marquee-wrapper">
            <div className="marquee-track">
              {[...DOMAINS, ...DOMAINS].map((name, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px 20px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    color: '#E2E8F0',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  ⚡ {name}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── STATS — 4x AltimeterDial ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '80px 0' }}>
          <div className="page-content" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{ textAlign: 'center', marginBottom: 48 }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#38BDF8' }}>
                EXAMINATION PLATFORM METRICS
              </span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 12px 0', color: '#FFFFFF' }}>
                Performance &amp; Reliability Benchmarks
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '1rem', maxWidth: 640, margin: '0 auto' }}>
                Engineered for university-scale concurrent exams, microsecond-synchronized timers, and automated anti-cheat monitoring.
              </p>
            </motion.div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
              {STATS.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <div
                    style={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 16,
                      padding: '24px 20px',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <AltimeterDial value={stat.value} label={stat.label} suffix={stat.suffix} color={stat.color} size={130} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FEATURES — Core Capabilities ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '80px 0', background: 'rgba(10, 17, 40, 0.4)' }}>
          <div className="page-content" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{ textAlign: 'center', marginBottom: 54 }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#10B981' }}>
                PLATFORM CAPABILITIES
              </span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 12px 0', color: '#FFFFFF' }}>
                Core Evaluation Features
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '1rem', maxWidth: 640, margin: '0 auto' }}>
                Modular exam management, anti-tamper safeguards, and evaluation engines designed for institutional workflows.
              </p>
            </motion.div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {FEATURES.map((feat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                >
                  <div
                    style={{
                      height: '100%',
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 16,
                      padding: 24,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ fontSize: '2.2rem', marginBottom: 14 }}>{feat.icon}</div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8, color: '#FFFFFF' }}>
                      {feat.title}
                    </h3>
                    <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.65, flex: 1 }}>
                      {feat.desc}
                    </p>
                    <div style={{ marginTop: 18, height: 2, background: `${feat.color}40`, borderRadius: 999 }} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── LOGIC COIL DIVIDER ─── */}
        <LogicCoil variant="divider" size={26} />

        {/* ─── SECURITY & PROCTORING SHOWCASE ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '80px 0' }}>
          <div className="page-content" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{ textAlign: 'center', marginBottom: 54 }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2563EB' }}>
                PROCTORING STANDARDS
              </span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 12px 0', color: '#FFFFFF' }}>
                Privacy-Preserving On-Device Verification
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '1rem', maxWidth: 640, margin: '0 auto' }}>
                Client-side vision models process facial verification locally. Incident event timestamps are transmitted without persisting raw video streams on servers.
              </p>
            </motion.div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              {PROCTORING_PILLARS.map((pillar, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <div
                    style={{
                      height: '100%',
                      padding: 26,
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ fontSize: '2.2rem' }}>{pillar.icon}</div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          padding: '4px 12px',
                          borderRadius: 999,
                          background: `${pillar.color}20`,
                          color: pillar.color,
                          border: `1px solid ${pillar.color}50`,
                        }}
                      >
                        {pillar.badge}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4, color: '#FFFFFF' }}>
                      {pillar.title}
                    </h3>
                    <div style={{ fontSize: '0.84rem', color: pillar.color, fontWeight: 600, marginBottom: 12 }}>
                      {pillar.subtitle}
                    </div>
                    <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.65 }}>
                      {pillar.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '80px 0', background: 'rgba(10, 17, 40, 0.4)' }}>
          <div className="page-content" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{ textAlign: 'center', marginBottom: 54 }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F59E0B' }}>
                WORKFLOW
              </span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 12px 0', color: '#FFFFFF' }}>
                3 Steps to Assessment
              </h2>
            </motion.div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28 }}>
              {[
                { step: '01', title: 'Admin Creates Exam', desc: 'Select targeted college, branch, and section. Configure question banks, time limits, and invigilation rules. Generate secure exam code.', icon: '📋' },
                { step: '02', title: 'Students Enter Exam', desc: 'Candidate verifies identity with Hall Ticket and Exam Code. Pre-flight hardware clearance confirms webcam and single session lock.', icon: '🎓' },
                { step: '03', title: 'Authoritative Scoring & Telemetry', desc: 'Instant server-side grading, real-time invigilator live monitoring wall, automated anti-tamper ledger, and comprehensive scorecards.', icon: '📊' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.5 }}
                >
                  <div
                    style={{
                      height: '100%',
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 16,
                      padding: 26,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                      <div style={{ fontSize: '2.4rem' }}>{item.icon}</div>
                      <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'rgba(56, 189, 248, 0.25)', lineHeight: 1 }}>
                        {item.step}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8, color: '#FFFFFF' }}>
                      {item.title}
                    </h3>
                    <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.65 }}>
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

        {/* ─── DEPLOYMENT ARCHITECTURE SHOWCASE ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '80px 0' }}>
          <div className="page-content" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{ textAlign: 'center', marginBottom: 54 }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A855F7' }}>
                DEPLOYMENT ARCHITECTURE
              </span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 12px 0', color: '#FFFFFF' }}>
                Engineered for Every High-Stakes Evaluation
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '1rem', maxWidth: 640, margin: '0 auto' }}>
                Purpose-built infrastructure supporting high-concurrency semester finals, campus placement drives, and remote proctoring.
              </p>
            </motion.div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {DEPLOYMENT_MODES.map((col, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                >
                  <div
                    style={{
                      height: '100%',
                      padding: 24,
                      display: 'flex',
                      flexDirection: 'column',
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38BDF8', background: 'rgba(56, 189, 248, 0.12)', padding: '3px 8px', borderRadius: 4 }}>
                        {col.tag}
                      </span>
                      <span style={{ fontSize: '0.76rem', color: '#64748B' }}>{col.city}</span>
                    </div>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 4, color: '#FFFFFF' }}>
                      {col.short}
                    </h4>
                    <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: 12, minHeight: 36 }}>
                      {col.name}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10B981', marginBottom: 10, fontFamily: 'var(--font-mono, monospace)' }}>
                      {col.metric}
                    </div>
                    <p style={{ fontSize: '0.86rem', color: '#94A3B8', lineHeight: 1.6, marginTop: 'auto' }}>
                      {col.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FREQUENTLY ASKED QUESTIONS (FAQ) ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '80px 0', background: 'rgba(10, 17, 40, 0.4)' }}>
          <div className="page-content" style={{ maxWidth: 840, margin: '0 auto', padding: '0 20px' }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{ textAlign: 'center', marginBottom: 48 }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#38BDF8' }}>
                CLARITY FIRST
              </span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 12px 0', color: '#FFFFFF' }}>
                Frequently Asked Questions
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '1rem', margin: '0 auto' }}>
                Everything you need to know about exam integrity, timer mechanics, and privacy.
              </p>
            </motion.div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {FAQS.map((faq, i) => {
                const isOpen = activeFaq === i;
                const panelId = `faq-panel-${i}`;
                const btnId = `faq-btn-${i}`;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    style={{
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: `1px solid ${isOpen ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                      borderRadius: 14,
                      overflow: 'hidden',
                      transition: 'border-color 0.2s ease',
                    }}
                  >
                    <button
                      id={btnId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setActiveFaq(isOpen ? null : i)}
                      style={{
                        width: '100%',
                        padding: '18px 22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: '#FFFFFF',
                        fontFamily: 'var(--font-display, sans-serif)',
                        fontSize: '1.02rem',
                        fontWeight: 600,
                      }}
                    >
                      <span>{faq.q}</span>
                      <motion.span
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ fontSize: '1.2rem', color: '#38BDF8', flexShrink: 0, marginLeft: 16 }}
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
                          transition={{ duration: 0.25 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div
                            style={{
                              padding: '0 22px 20px 22px',
                              color: '#94A3B8',
                              fontSize: '0.92rem',
                              lineHeight: 1.7,
                              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                              paddingTop: 14,
                            }}
                          >
                            {faq.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── CONTACT & PILOT ONBOARDING REQUEST ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '80px 0' }}>
          <div className="page-content" style={{ maxWidth: 840, margin: '0 auto', padding: '0 20px' }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{ textAlign: 'center', marginBottom: 40 }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#10B981' }}>
                STARTUP PILOT PROGRAM
              </span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '8px 0 12px 0', color: '#FFFFFF' }}>
                Apply for Early Campus Sandbox Access
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '1rem', margin: '0 auto' }}>
                We partner with universities, institutes, and placement cells to deploy pilot assessments with dedicated engineering support.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div
                style={{
                  padding: '36px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 18,
                  backdropFilter: 'blur(16px)',
                }}
              >
                {demoForm.submitted ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10B981', marginBottom: 8 }}>
                      Application Received!
                    </h3>
                    <p style={{ color: '#94A3B8', fontSize: '0.95rem', maxWidth: 500, margin: '0 auto 20px auto' }}>
                      Thank you, <strong>{demoForm.name}</strong>. Our engineering team will reach out to <strong>{demoForm.email}</strong> within 4 business hours to provision your dedicated pilot sandbox.
                    </p>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setDemoForm((prev) => ({ ...prev, submitted: false }))}
                      style={{ padding: '10px 20px', borderRadius: 8, cursor: 'pointer' }}
                    >
                      Submit Another Request
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleDemoSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginBottom: 16 }}>
                      <div>
                        <label htmlFor="pilot-name" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#CBD5E1', marginBottom: 6 }}>
                          Full Name *
                        </label>
                        <input
                          id="pilot-name"
                          name="name"
                          type="text"
                          className="form-input"
                          placeholder="e.g. Dr. Rajesh Sharma"
                          required
                          value={demoForm.name}
                          onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF' }}
                        />
                      </div>

                      <div>
                        <label htmlFor="pilot-email" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#CBD5E1', marginBottom: 6 }}>
                          Official / University Email *
                        </label>
                        <input
                          id="pilot-email"
                          name="email"
                          type="email"
                          className="form-input"
                          placeholder="e.g. dean.academics@university.edu"
                          required
                          value={demoForm.email}
                          onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginBottom: 16 }}>
                      <div>
                        <label htmlFor="pilot-institution" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#CBD5E1', marginBottom: 6 }}>
                          Institution / College Name *
                        </label>
                        <input
                          id="pilot-institution"
                          name="institution"
                          type="text"
                          className="form-input"
                          placeholder="e.g. National Institute of Technology"
                          required
                          value={demoForm.institution}
                          onChange={(e) => setDemoForm({ ...demoForm, institution: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF' }}
                        />
                      </div>

                      <div>
                        <label htmlFor="pilot-candidate-count" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#CBD5E1', marginBottom: 6 }}>
                          Estimated Student Batch Size
                        </label>
                        <select
                          id="pilot-candidate-count"
                          name="candidateCount"
                          value={demoForm.candidateCount}
                          onChange={(e) => setDemoForm({ ...demoForm, candidateCount: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#0F172A', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF' }}
                        >
                          <option value="50 - 200 candidates (Pilot Class)">50 - 200 candidates (Pilot Class)</option>
                          <option value="200 - 1,000 candidates (Department)">200 - 1,000 candidates (Department)</option>
                          <option value="1,000 - 5,000 candidates (Campus Wide)">1,000 - 5,000 candidates (Campus Wide)</option>
                          <option value="5,000+ candidates (University Scale)">5,000+ candidates (University Scale)</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <label htmlFor="pilot-message" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#CBD5E1', marginBottom: 6 }}>
                        Target Evaluation Format / Requirements
                      </label>
                      <textarea
                        id="pilot-message"
                        name="message"
                        rows={3}
                        placeholder="Describe your upcoming assessment format (e.g. Semester Final, Campus Placement Drive, Coding Hackathon)..."
                        value={demoForm.message}
                        onChange={(e) => setDemoForm({ ...demoForm, message: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFF', resize: 'vertical' }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={demoForm.loading}
                      style={{
                        width: '100%',
                        padding: '14px',
                        background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '1rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {demoForm.loading ? 'Provisioning Sandbox...' : '🚀 Apply for Campus Pilot Sandbox'}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── CTA BANNER ─── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '60px 0' }}>
          <div className="page-content" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              style={{
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: 24,
                padding: '54px 36px',
                textAlign: 'center',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-display, sans-serif)',
                  fontSize: 'clamp(2rem, 3.5vw, 3rem)',
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                  marginBottom: 14,
                }}
              >
                Ready to Deploy
                <br />
                <ShimmerText text="LogicWhileLiRE on Your Campus?" shimmer />
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '1.05rem', marginBottom: 30, maxWidth: 600, margin: '0 auto 30px auto' }}>
                Run scheduled midterm assessments, campus placement screening drives, and automated proctoring with institutional pilot access.
              </p>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/enter-exam" style={{ textDecoration: 'none' }}>
                  <MagneticButton
                    className="btn btn-primary"
                    style={{
                      minWidth: 200,
                      background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      padding: '14px 32px',
                      borderRadius: 12,
                    }}
                  >
                    🚀 Start Assessment
                  </MagneticButton>
                </Link>
                <Link to="/admin" style={{ textDecoration: 'none' }}>
                  <MagneticButton
                    className="btn btn-secondary"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#FFFFFF',
                      fontWeight: 600,
                      padding: '14px 28px',
                      borderRadius: 12,
                    }}
                  >
                    🏛️ Staff &amp; Admin Console
                  </MagneticButton>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── PARTICLE FIELD (bottom section) ─── */}
        <div style={{ position: 'relative', height: 160, overflow: 'hidden' }}>
          <Suspense fallback={null}>
            <ParticleField count={40} />
          </Suspense>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
