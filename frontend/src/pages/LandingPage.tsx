import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import BrandLogo from '../components/BrandLogo';

/* ── Floating orb background ── */
function CosmicOrbs() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '-10%', left: '-5%',
        width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(2,132,199,0.18) 0%, transparent 65%)',
        filter: 'blur(60px)', animation: 'orbFloat1 18s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: '30%', right: '-8%',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(234,168,18,0.13) 0%, transparent 65%)',
        filter: 'blur(55px)', animation: 'orbFloat2 22s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '-5%', left: '30%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.11) 0%, transparent 65%)',
        filter: 'blur(50px)', animation: 'orbFloat3 26s ease-in-out infinite',
      }} />
    </div>
  );
}

interface StatPillProps { icon: string; value: string; label: string }
function StatPill({ icon, value, label }: StatPillProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.11)',
      borderRadius: 12, padding: '10px 16px',
      backdropFilter: 'blur(12px)',
    }}>
      <span style={{ fontSize: '1.25rem' }}>{icon}</span>
      <div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 800, fontSize: '1.05rem', color: '#EAA812', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.68rem', color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      </div>
    </div>
  );
}

interface PortalCardProps {
  icon: string; badge: string; badgeColor: string; badgeBg: string;
  title: string; desc: string; href: string; btnId: string; btnLabel: string;
  btnGradient: string; glowColor: string; borderColor: string; delay?: number;
}
function PortalCard({ icon, badge, badgeColor, badgeBg, title, desc, href, btnId, btnLabel, btnGradient, glowColor, borderColor, delay = 0 }: PortalCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'linear-gradient(145deg,rgba(15,23,42,0.98),rgba(0,10,30,0.96))' : 'rgba(10,16,35,0.82)',
        border: `1.5px solid ${hovered ? glowColor : borderColor}`,
        borderRadius: 20, padding: '28px 24px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        backdropFilter: 'blur(20px)',
        boxShadow: hovered ? `0 20px 60px rgba(0,0,0,0.5),0 0 40px ${glowColor}33` : '0 8px 30px rgba(0,0,0,0.3)',
        transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        position: 'relative', overflow: 'hidden', minHeight: 260,
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: '10%', right: '10%', height: 2,
        background: `linear-gradient(90deg,transparent,${glowColor},transparent)`,
        opacity: hovered ? 1 : 0, transition: 'opacity 0.3s',
      }} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: '2.1rem', filter: `drop-shadow(0 0 10px ${glowColor}88)` }}>{icon}</span>
          <span style={{
            background: badgeBg, color: badgeColor, fontSize: '0.7rem', fontWeight: 800,
            padding: '4px 12px', borderRadius: 20, letterSpacing: '0.04em', textTransform: 'uppercase',
            border: `1px solid ${badgeColor}40`,
          }}>{badge}</span>
        </div>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 10px', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '-0.01em' }}>{title}</h3>
        <p style={{ color: '#94A3B8', fontSize: '0.83rem', lineHeight: 1.65, margin: '0 0 20px' }}>{desc}</p>
      </div>
      <Link to={href} id={btnId} style={{
        textAlign: 'center',
        background: hovered ? btnGradient : 'rgba(255,255,255,0.07)',
        color: hovered ? '#FFFFFF' : '#CBD5E1', fontWeight: 800, fontSize: '0.88rem',
        padding: '12px 16px', borderRadius: 10, textDecoration: 'none',
        border: `1px solid ${hovered ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
        boxShadow: hovered ? `0 4px 20px ${glowColor}55` : 'none',
        transition: 'all 0.25s ease', display: 'block', letterSpacing: '0.02em',
      }}>{btnLabel} →</Link>
    </motion.div>
  );
}

interface SectorCardProps { color: string; badge: string; name: string; desc: string; delay?: number }
function SectorCard({ color, badge, name, desc, delay = 0 }: SectorCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }} whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }} transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'linear-gradient(145deg,rgba(15,23,42,0.98),rgba(5,12,28,0.95))' : 'rgba(10,16,35,0.72)',
        border: `1.5px solid ${hovered ? color + '60' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 16, borderTop: `3px solid ${color}`,
        padding: '20px 18px', backdropFilter: 'blur(16px)',
        boxShadow: hovered ? `0 12px 40px rgba(0,0,0,0.4),0 0 24px ${color}22` : '0 4px 16px rgba(0,0,0,0.25)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.28s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <div style={{ fontSize: '0.76rem', fontWeight: 800, color, marginBottom: 8, letterSpacing: '0.03em' }}>{badge}</div>
      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#F1F5F9', marginBottom: 8, fontFamily: "'Rajdhani',sans-serif" }}>{name}</div>
      <p style={{ fontSize: '0.77rem', color: '#64748B', lineHeight: 1.55, margin: 0 }}>{desc}</p>
    </motion.div>
  );
}

function FeaturePill({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 99, padding: '7px 14px', fontSize: '0.8rem', color: '#CBD5E1', fontWeight: 500,
    }}>
      <span>{icon}</span> {text}
    </div>
  );
}

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) heroRef.current.style.transform = `translateY(${window.scrollY * 0.28}px)`;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #060B1A 0%, #080D22 40%, #050A18 100%)',
      color: '#F8FAFC',
      fontFamily: "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif",
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <style>{`
        @keyframes orbFloat1 { 0%,100% { transform:translate(0,0) scale(1); } 33% { transform:translate(40px,-30px) scale(1.05); } 66% { transform:translate(-20px,20px) scale(0.95); } }
        @keyframes orbFloat2 { 0%,100% { transform:translate(0,0) scale(1); } 33% { transform:translate(-30px,40px) scale(1.08); } 66% { transform:translate(20px,-25px) scale(0.97); } }
        @keyframes orbFloat3 { 0%,100% { transform:translate(0,0) scale(1); } 50% { transform:translate(25px,-35px) scale(1.06); } }
        .landing-grid-bg { background-image: linear-gradient(rgba(2,132,199,0.055) 1px,transparent 1px),linear-gradient(90deg,rgba(2,132,199,0.055) 1px,transparent 1px); background-size:44px 44px; }
      `}</style>

      <CosmicOrbs />
      <SiteHeader />

      {/* ── HERO ── */}
      <section className="landing-grid-bg" style={{ position: 'relative', padding: '80px 24px 90px', textAlign: 'center', overflow: 'hidden', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: 800, height: 400, background: 'radial-gradient(ellipse,rgba(2,132,199,0.2) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div ref={heroRef} style={{ maxWidth: 860, margin: '0 auto', position: 'relative' }}>
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 14,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(234,168,18,0.35)',
              borderRadius: 16, padding: '14px 24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4),0 0 24px rgba(234,168,18,0.10)',
            }}>
              <BrandLogo size="md" variant="standard" showTagline={true} />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', fontWeight: 900, lineHeight: 1.15,
              margin: '0 0 18px', letterSpacing: '-0.03em',
              fontFamily: "'Rajdhani',sans-serif", color: '#FFFFFF',
            }}
          >
            LogicWhile{' '}
            <span style={{
              background: 'linear-gradient(135deg,#EAA812 0%,#F59E0B 40%,#FBBF24 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              filter: 'drop-shadow(0 0 20px rgba(234,168,18,0.4))',
            }}>Live Rank Engine</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.55 }}
            style={{ fontSize: '1.08rem', color: '#94A3B8', maxWidth: 680, margin: '0 auto 32px', lineHeight: 1.72 }}
          >
            Synchronous live assessment with server-authoritative timers, automated anti-cheat monitoring,
            real-time proctoring and instantaneous competitive telemetry.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 44 }}
          >
            <Link to="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg,#0284c7 0%,#1d4ed8 100%)',
              color: '#FFFFFF', fontWeight: 800, fontSize: '0.95rem',
              padding: '13px 28px', borderRadius: 12, textDecoration: 'none',
              boxShadow: '0 4px 24px rgba(2,132,199,0.4)', transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 32px rgba(2,132,199,0.55)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 4px 24px rgba(2,132,199,0.4)'; }}
            >
              🎓 Student Portal
            </Link>
            <Link to="/practice" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.07)',
              color: '#EAA812', fontWeight: 800, fontSize: '0.95rem',
              padding: '13px 28px', borderRadius: 12, textDecoration: 'none',
              border: '1.5px solid rgba(234,168,18,0.4)', transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(234,168,18,0.12)'; el.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.07)'; el.style.transform = ''; }}
            >
              🪐 Practice Arena
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <StatPill icon="⚡" value="< 50ms" label="Timer Sync" />
            <StatPill icon="🔒" value="5-Layer" label="Anti-Cheat" />
            <StatPill icon="📡" value="Real-Time" label="Leaderboard" />
            <StatPill icon="🛡️" value="Offline" label="Resilient" />
          </motion.div>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(0deg,#060B1A,transparent)', pointerEvents: 'none' }} />
      </section>

      {/* ── ACCESS PORTALS ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '70px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 48 }}>
            <span style={{
              display: 'inline-block', background: 'rgba(234,168,18,0.12)', color: '#EAA812',
              border: '1px solid rgba(234,168,18,0.3)', padding: '5px 16px', borderRadius: 20,
              fontSize: '0.73rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14,
            }}>Official Access Gateways</span>
            <h2 style={{
              fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', fontWeight: 900, margin: '0 0 10px',
              color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '-0.02em',
            }}>Choose Your Authorized Portal</h2>
            <p style={{ color: '#64748B', fontSize: '0.93rem', margin: 0 }}>Dedicated portals with role isolation and synchronized examination control.</p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20 }}>
            <PortalCard icon="🎓" badge="Student Gateway" badgeColor="#60A5FA" badgeBg="rgba(96,165,250,0.12)" title="Student Login" desc="Access your candidate dashboard, exam schedule, performance analytics, hall ticket records, and live exam interface." href="/login" btnId="landing-student-login-btn" btnLabel="Sign In as Student" btnGradient="linear-gradient(135deg,#2563EB 0%,#1d4ed8 100%)" glowColor="#3B82F6" borderColor="rgba(59,130,246,0.16)" delay={0.1} />
            <PortalCard icon="👨‍🏫" badge="Faculty & Trainer" badgeColor="#34D399" badgeBg="rgba(52,211,153,0.12)" title="Faculty Login" desc="Manage assigned sections, inspect rosters, verify candidates, track live exam progress, and evaluate coding solutions." href="/faculty/login" btnId="landing-faculty-login-btn" btnLabel="Sign In as Faculty" btnGradient="linear-gradient(135deg,#059669 0%,#10B981 100%)" glowColor="#10B981" borderColor="rgba(16,185,129,0.16)" delay={0.2} />
            <PortalCard icon="🏛️" badge="Admin Console" badgeColor="#FBBF24" badgeBg="rgba(251,191,36,0.12)" title="Admin Login" desc="Complete administrative control — manage colleges, question papers, academic hierarchy, live exam orchestration, and backups." href="/admin" btnId="landing-admin-login-btn" btnLabel="Sign In as Admin" btnGradient="linear-gradient(135deg,#D97706 0%,#EAA812 100%)" glowColor="#EAA812" borderColor="rgba(234,168,18,0.18)" delay={0.3} />
            <PortalCard icon="🔍" badge="Invigilation" badgeColor="#A78BFA" badgeBg="rgba(167,139,250,0.12)" title="Inspector Login" desc="Live invigilation dashboard with real-time leaderboards, violation alerts, whisper messaging, and instant candidate communication." href="/inspector" btnId="landing-inspector-login-btn" btnLabel="Sign In as Inspector" btnGradient="linear-gradient(135deg,#7C3AED 0%,#8B5CF6 100%)" glowColor="#8B5CF6" borderColor="rgba(139,92,246,0.16)" delay={0.4} />
          </div>
        </div>
      </section>

      {/* ── FEATURES STRIP ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 24px 60px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20, padding: '26px 30px', backdropFilter: 'blur(16px)',
          }}>
            <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Platform Capabilities</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
              <FeaturePill icon="⚡" text="Server-Authoritative Timers" />
              <FeaturePill icon="👁️" text="Webcam + Screen Proctoring" />
              <FeaturePill icon="🎙️" text="Audio Spike Detection" />
              <FeaturePill icon="📡" text="Offline Answer Buffering" />
              <FeaturePill icon="🏆" text="Real-Time Leaderboard" />
              <FeaturePill icon="🔐" text="Multi-Role RBAC" />
              <FeaturePill icon="💻" text="Live Code Execution" />
              <FeaturePill icon="🛡️" text="Anti-Cheat Engine" />
              <FeaturePill icon="📊" text="Radar Skill Analytics" />
              <FeaturePill icon="📋" text="Hall Ticket Generation" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 5 SECTORS ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '20px 24px 80px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 60 }}>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 44 }}>
            <span style={{
              display: 'inline-block', background: 'rgba(16,185,129,0.12)', color: '#34D399',
              border: '1px solid rgba(52,211,153,0.3)', padding: '5px 16px', borderRadius: 20,
              fontSize: '0.73rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14,
            }}>5 Institutional Technical Sectors</span>
            <h2 style={{
              fontSize: 'clamp(1.7rem,3vw,2.4rem)', fontWeight: 900, margin: '0 0 10px',
              color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '-0.02em',
            }}>Standardized Assessment Sectors</h2>
            <p style={{ color: '#64748B', fontSize: '0.91rem', margin: '0 auto', maxWidth: 620 }}>
              Every evaluation benchmarks candidates across 5 core engineering domains with synchronized radar telemetry.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16 }}>
            <SectorCard color="#F59E0B" badge="📐 Quantitative Velocity" name="Sector 1: Quant" desc="Arithmetic acceleration, algebraic transformations, geometric logic, probabilistic models." delay={0} />
            <SectorCard color="#8B5CF6" badge="🧩 Deductive Logic" name="Sector 2: Logic" desc="Constraint satisfaction, inductive sequences, syllogistic deduction, Boolean matrices." delay={0.07} />
            <SectorCard color="#10B981" badge="💻 Core CS & Systems" name="Sector 3: Core CS" desc="OS scheduling, paging, thread synchronization, TCP/IP networking, SQL indexing." delay={0.14} />
            <SectorCard color="#38BDF8" badge="⚡ Algorithms & DSA" name="Sector 4: DSA" desc="Dynamic programming, graph traversals, amortized complexity, algorithmic velocity." delay={0.21} />
            <SectorCard color="#F43F5E" badge="🌐 Full-Stack & Cloud" name="Sector 5: Cloud" desc="Distributed architectures, microservices, cloud scaling, concurrency, fault tolerance." delay={0.28} />
          </div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ textAlign: 'center', marginTop: 36 }}>
            <Link to="/practice" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'rgba(234,168,18,0.10)', color: '#EAA812',
              border: '1.5px solid rgba(234,168,18,0.35)',
              padding: '12px 28px', borderRadius: 12,
              fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none',
              transition: 'all 0.22s ease', backdropFilter: 'blur(8px)',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(234,168,18,0.18)'; el.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(234,168,18,0.10)'; el.style.transform = ''; }}
            >
              <span>🪐</span> Explore 5-Sector Practice Arena →
            </Link>
          </motion.div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
