import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import BrandLogo from '../components/BrandLogo';
import { sound } from '../lib/soundService';

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

interface SecurityCardProps {
  icon: string;
  badge: string;
  title: string;
  desc: string;
  glow: string;
  delay?: number;
}
function SecurityCard({ icon, badge, title, desc, glow, delay = 0 }: SecurityCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.45 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? 'linear-gradient(145deg, rgba(15,23,42,0.98), rgba(6,12,30,0.95))'
          : 'rgba(10,16,35,0.7)',
        border: `1.5px solid ${hovered ? glow : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 16,
        padding: '22px 20px',
        backdropFilter: 'blur(16px)',
        boxShadow: hovered ? `0 12px 35px rgba(0,0,0,0.4), 0 0 25px ${glow}22` : '0 4px 16px rgba(0,0,0,0.25)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: '1.8rem' }}>{icon}</span>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            color: glow,
            background: `${glow}18`,
            border: `1px solid ${glow}40`,
            padding: '3px 10px',
            borderRadius: 20,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {badge}
        </span>
      </div>
      <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
        {title}
      </h4>
      <p style={{ fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
        {desc}
      </p>
    </motion.div>
  );
}

interface SectorCardProps { sectorId: string; color: string; badge: string; name: string; desc: string; delay?: number }
function SectorCard({ sectorId, color, badge, name, desc, delay = 0 }: SectorCardProps) {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }} whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }} transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onClick={() => {
        sound.playClick();
        navigate('/practice', { state: { selectedSectorId: sectorId } });
      }}
      style={{
        background: hovered ? 'linear-gradient(145deg,rgba(15,23,42,0.98),rgba(5,12,28,0.95))' : 'rgba(10,16,35,0.72)',
        border: `1.5px solid ${hovered ? color + '80' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 16, borderTop: `3px solid ${color}`,
        padding: '20px 18px', backdropFilter: 'blur(16px)',
        boxShadow: hovered ? `0 12px 40px rgba(0,0,0,0.4),0 0 24px ${color}33` : '0 4px 16px rgba(0,0,0,0.25)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.28s cubic-bezier(0.16,1,0.3,1)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div style={{ fontSize: '0.76rem', fontWeight: 800, color, marginBottom: 8, letterSpacing: '0.03em' }}>{badge}</div>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#F1F5F9', marginBottom: 8, fontFamily: "'Rajdhani',sans-serif" }}>{name}</div>
        <p style={{ fontSize: '0.77rem', color: '#64748B', lineHeight: 1.55, margin: 0 }}>{desc}</p>
      </div>
      <div style={{ marginTop: 14, fontSize: '0.74rem', fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>⚡ Launch Sprint</span>
        <span>→</span>
      </div>
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
  const navigate = useNavigate();
  const [quickExamCode, setQuickExamCode] = useState('');
  const [quickHallTicket, setQuickHallTicket] = useState('');

  const handleQuickEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickExamCode.trim() || !quickHallTicket.trim()) {
      sound.playClick();
      navigate('/enter-exam');
      return;
    }
    sound.playChime(3);
    navigate(`/enter-exam?code=${encodeURIComponent(quickExamCode.trim().toUpperCase())}&hallTicket=${encodeURIComponent(quickHallTicket.trim())}`);
  };

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
      <section className="landing-grid-bg" style={{ position: 'relative', padding: '70px 24px 85px', textAlign: 'center', overflow: 'hidden', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: 800, height: 400, background: 'radial-gradient(ellipse,rgba(2,132,199,0.2) 0%,transparent 70%)', pointerEvents: 'none' }} />
        
        {/* Giant Architectural Wordmark (HorizonX Altura Aesthetic) */}
        <div
          style={{
            position: 'absolute',
            top: '46%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 'clamp(5rem, 16vw, 13rem)',
            fontWeight: 900,
            fontFamily: "'Space Grotesk', 'Rajdhani', sans-serif",
            letterSpacing: '-0.05em',
            color: 'rgba(255, 255, 255, 0.035)',
            textTransform: 'lowercase',
            userSelect: 'none',
            pointerEvents: 'none',
            zIndex: 0,
            whiteSpace: 'nowrap',
            lineHeight: 1,
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.1) 100%)',
            WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.1) 100%)',
          }}
        >
          logicwhile
        </div>

        {/* Left Architectural Spec Flank Card (HorizonX Style) */}
        <div
          className="architectural-flank-card"
          style={{
            position: 'absolute',
            left: 28,
            top: '38%',
            transform: 'translateY(-50%)',
            zIndex: 2,
            maxWidth: 240,
            textAlign: 'left',
            fontFamily: "'Space Grotesk', monospace",
            background: 'rgba(6, 12, 30, 0.78)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderLeft: '3px solid #38BDF8',
            borderRadius: 12,
            padding: '14px 18px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 16px rgba(56, 189, 248, 0.1)',
          }}
        >
          <div style={{ fontSize: '0.64rem', color: '#38BDF8', fontWeight: 800, letterSpacing: '0.08em', marginBottom: 4 }}>
            LOCATION // HYDERABAD
          </div>
          <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#F8FAFC', marginBottom: 4, fontFamily: "'Rajdhani', sans-serif" }}>
            LogicWhile Institute
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.45 }}>
            17.3850° N, 78.4867° E<br />
            Autonomous Assessment Hub<br />
            <strong style={{ color: '#10B981' }}>10,000+ Synchronous Nodes</strong>
          </div>
        </div>

        {/* Right Architectural Spec Flank Card (HorizonX Style) */}
        <div
          className="architectural-flank-card"
          style={{
            position: 'absolute',
            right: 28,
            top: '38%',
            transform: 'translateY(-50%)',
            zIndex: 2,
            maxWidth: 240,
            textAlign: 'left',
            fontFamily: "'Space Grotesk', monospace",
            background: 'rgba(6, 12, 30, 0.78)',
            border: '1px solid rgba(234, 168, 18, 0.25)',
            borderLeft: '3px solid #EAA812',
            borderRadius: 12,
            padding: '14px 18px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 16px rgba(234, 168, 18, 0.1)',
          }}
        >
          <div style={{ fontSize: '0.64rem', color: '#EAA812', fontWeight: 800, letterSpacing: '0.08em', marginBottom: 4 }}>
            SPECIFICATION // LiRE v4.0.0
          </div>
          <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#F8FAFC', marginBottom: 4, fontFamily: "'Rajdhani', sans-serif" }}>
            5 Technical Sectors
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.45 }}>
            Quant &bull; Logic &bull; Core CS<br />
            DSA &bull; Cloud Systems<br />
            <strong style={{ color: '#38BDF8' }}>153ms DB Latency &bull; SSL/TLS</strong>
          </div>
        </div>

        <div ref={heroRef} style={{ maxWidth: 860, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          
          {/* Live Cluster Health Badge */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} style={{ marginBottom: 18 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 20, padding: '5px 16px',
              fontSize: '0.74rem', fontWeight: 800, color: '#34D399', letterSpacing: '0.04em',
              boxShadow: '0 0 16px rgba(16, 185, 129, 0.15)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981' }} />
              <span>LIVE CLUSTER ONLINE &bull; 153ms DB LATENCY &bull; V4.0.0</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ marginBottom: 24 }}>
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
            style={{ fontSize: '1.08rem', color: '#94A3B8', maxWidth: 680, margin: '0 auto 30px', lineHeight: 1.72 }}
          >
            Synchronous live assessment with server-authoritative timers, automated anti-cheat monitoring,
            real-time proctoring and instantaneous competitive telemetry.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}
          >
            <Link to="/enter-exam" id="hero-enter-exam-btn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg,#10B981 0%,#059669 100%)',
              color: '#FFFFFF', fontWeight: 800, fontSize: '0.98rem',
              padding: '13px 30px', borderRadius: 12, textDecoration: 'none',
              boxShadow: '0 4px 26px rgba(16,185,129,0.45)', transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 34px rgba(16,185,129,0.65)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 4px 26px rgba(16,185,129,0.45)'; }}
            >
              🚀 Enter Exam Code
            </Link>
            <Link to="/login" id="hero-student-gate-btn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg,#0284c7 0%,#1d4ed8 100%)',
              color: '#FFFFFF', fontWeight: 800, fontSize: '0.98rem',
              padding: '13px 28px', borderRadius: 12, textDecoration: 'none',
              boxShadow: '0 4px 26px rgba(2,132,199,0.45)', transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 34px rgba(2,132,199,0.65)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 4px 26px rgba(2,132,199,0.45)'; }}
            >
              🎓 Student Gate
            </Link>
            <Link to="/practice" id="hero-practice-btn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg,#8B5CF6 0%,#6D28D9 100%)',
              color: '#FFFFFF', fontWeight: 800, fontSize: '0.95rem',
              padding: '13px 26px', borderRadius: 12, textDecoration: 'none',
              boxShadow: '0 4px 24px rgba(139,92,246,0.35)', transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 32px rgba(139,92,246,0.55)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 4px 24px rgba(139,92,246,0.35)'; }}
            >
              🪐 5 Sectors Arena
            </Link>
            <Link to="/admin" id="hero-admin-btn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg,#EAA812 0%,#F59E0B 100%)',
              color: '#001A38', fontWeight: 800, fontSize: '0.95rem',
              padding: '13px 26px', borderRadius: 12, textDecoration: 'none',
              boxShadow: '0 4px 24px rgba(234,168,18,0.35)', transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 32px rgba(234,168,18,0.55)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '0 4px 24px rgba(234,168,18,0.35)'; }}
            >
              🏛️ Admin Console
            </Link>
            <Link to="/inspector" id="hero-inspector-btn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.07)',
              color: '#A78BFA', fontWeight: 800, fontSize: '0.95rem',
              padding: '13px 26px', borderRadius: 12, textDecoration: 'none',
              border: '1.5px solid rgba(167,139,250,0.4)', transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(167,139,250,0.12)'; el.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.07)'; el.style.transform = ''; }}
            >
              🔍 Inspector Console
            </Link>
          </motion.div>

          {/* Quick Exam Passcode Entry Station */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48, duration: 0.55 }}
            style={{
              maxWidth: 720,
              margin: '0 auto 36px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: '1.5px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 16,
              padding: '16px 20px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.4), 0 0 24px rgba(16, 185, 129, 0.12)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.1rem' }}>⚡</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#34D399', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Exam Morning Express Gateway
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                Zero OTP &bull; Instant Passcode Authentication
              </span>
            </div>

            <form onSubmit={handleQuickEntry} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="EXAM CODE (e.g. EXAM2026)"
                value={quickExamCode}
                onChange={(e) => setQuickExamCode(e.target.value.toUpperCase())}
                style={{
                  flex: '1 1 180px',
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(5, 10, 24, 0.85)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#F8FAFC',
                  fontSize: '0.86rem',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              />
              <input
                type="text"
                placeholder="HALL TICKET / ROLL NO."
                value={quickHallTicket}
                onChange={(e) => setQuickHallTicket(e.target.value)}
                style={{
                  flex: '1 1 180px',
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(5, 10, 24, 0.85)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#F8FAFC',
                  fontSize: '0.86rem',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '10px 22px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 4px 18px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>🚀</span> Start Assessment
              </button>
            </form>
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
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 48 }}>
            <span style={{
              display: 'inline-block', background: 'rgba(234,168,18,0.12)', color: '#EAA812',
              border: '1px solid rgba(234,168,18,0.3)', padding: '5px 16px', borderRadius: 20,
              fontSize: '0.73rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14,
            }}>Official Access Gateways</span>
            <h2 style={{
              fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', fontWeight: 900, margin: '0 0 10px',
              color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '-0.02em',
            }}>Institutional Portals & Gateways</h2>
            <p style={{ color: '#64748B', fontSize: '0.93rem', margin: 0 }}>Role-isolated authenticated access with continuous proctoring synchronization.</p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 20 }}>
            <PortalCard icon="🚀" badge="Exam Entry" badgeColor="#10B981" badgeBg="rgba(16,185,129,0.12)" title="Exam Code Portal" desc="Direct candidate exam access using assigned Exam Code and Roll Number. Zero email/OTP required for pre-registered candidates." href="/enter-exam" btnId="landing-enter-exam-btn" btnLabel="Enter Exam Session" btnGradient="linear-gradient(135deg,#10B981 0%,#059669 100%)" glowColor="#10B981" borderColor="rgba(16,185,129,0.25)" delay={0.04} />
            <PortalCard icon="🎓" badge="Candidate Gate" badgeColor="#38BDF8" badgeBg="rgba(56,189,248,0.12)" title="Student Portal" desc="Official examination portal for verified candidates. Sign in to view comprehensive performance analytics, scorecards, and ranking history." href="/login" btnId="landing-student-login-btn" btnLabel="Enter Candidate Gate" btnGradient="linear-gradient(135deg,#0284c7 0%,#1d4ed8 100%)" glowColor="#38BDF8" borderColor="rgba(56,189,248,0.25)" delay={0.08} />
            <PortalCard icon="👨‍🏫" badge="Academic Staff" badgeColor="#F43F5E" badgeBg="rgba(244,63,94,0.12)" title="Faculty Portal" desc="Curriculum & question paper setting, section-scoped student management, and assessment creation for accredited trainers." href="/faculty" btnId="landing-faculty-login-btn" btnLabel="Sign In as Faculty" btnGradient="linear-gradient(135deg,#E11D48 0%,#F43F5E 100%)" glowColor="#F43F5E" borderColor="rgba(244,63,94,0.25)" delay={0.12} />
            <PortalCard icon="🔍" badge="Invigilation" badgeColor="#A78BFA" badgeBg="rgba(167,139,250,0.12)" title="Inspector Console" desc="Live invigilation dashboard with real-time leaderboards, violation alerts, whisper messaging, and candidate communication." href="/inspector" btnId="landing-inspector-login-btn" btnLabel="Sign In as Inspector" btnGradient="linear-gradient(135deg,#7C3AED 0%,#8B5CF6 100%)" glowColor="#8B5CF6" borderColor="rgba(139,92,246,0.16)" delay={0.16} />
            <PortalCard icon="🏛️" badge="Master Authority" badgeColor="#FBBF24" badgeBg="rgba(251,191,36,0.12)" title="Admin Console" desc="Complete administrative control — manage colleges, question papers, academic hierarchy, live exam orchestration, and backups." href="/admin" btnId="landing-admin-login-btn" btnLabel="Sign In as Admin" btnGradient="linear-gradient(135deg,#D97706 0%,#EAA812 100%)" glowColor="#EAA812" borderColor="rgba(234,168,18,0.18)" delay={0.20} />
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
              <FeaturePill icon="🔒" text="Strict Fullscreen Integrity" />
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

      {/* ── HOW IT WORKS ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '20px 24px 70px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 44 }}>
            <span style={{
              display: 'inline-block', background: 'rgba(234,168,18,0.12)', color: '#EAA812',
              border: '1px solid rgba(234,168,18,0.3)', padding: '5px 16px', borderRadius: 20,
              fontSize: '0.73rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14,
            }}>Operational Workflow</span>
            <h2 style={{
              fontSize: 'clamp(1.8rem,3.5vw,2.5rem)', fontWeight: 900, margin: '0 0 10px',
              color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '-0.02em',
            }}>How LogicWhile Operates</h2>
            <p style={{ color: '#64748B', fontSize: '0.92rem', margin: '0 auto', maxWidth: 660 }}>
              From student verification to synchronized examination kickoff and instant competitive telemetry.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
            <div style={{
              background: 'rgba(10,16,35,0.7)', border: '1.5px solid rgba(56,189,248,0.25)',
              borderRadius: 16, padding: '24px 20px', backdropFilter: 'blur(16px)',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.08em', marginBottom: 10 }}>STEP 01</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
                1. Entry &amp; Gate Verification
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                Candidates sign in strictly using their institutional Hall Ticket Number and targeted Exam Code. Access is restricted to designated batches and departments.
              </p>
            </div>

            <div style={{
              background: 'rgba(10,16,35,0.7)', border: '1.5px solid rgba(234,168,18,0.25)',
              borderRadius: 16, padding: '24px 20px', backdropFilter: 'blur(16px)',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#EAA812', letterSpacing: '0.08em', marginBottom: 10 }}>STEP 02</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
                2. Synchronous Waiting Lobby
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                Candidates hold in a zero-leak waiting lobby while College Inspectors verify roster presence. Questions remain completely inaccessible until the official kickoff.
              </p>
            </div>

            <div style={{
              background: 'rgba(10,16,35,0.7)', border: '1.5px solid rgba(16,185,129,0.25)',
              borderRadius: 16, padding: '24px 20px', backdropFilter: 'blur(16px)',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10B981', letterSpacing: '0.08em', marginBottom: 10 }}>STEP 03</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
                3. Unified Server Kickoff
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                When Inspector initiates the exam, all candidates receive the identical server-authoritative timestamp via WebSocket/Realtime with continuous anti-cheat enforcement.
              </p>
            </div>

            <div style={{
              background: 'rgba(10,16,35,0.7)', border: '1.5px solid rgba(167,139,250,0.25)',
              borderRadius: 16, padding: '24px 20px', backdropFilter: 'blur(16px)',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#A78BFA', letterSpacing: '0.08em', marginBottom: 10 }}>STEP 04</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
                4. Live Rank Engine (LiRE)
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                Upon auto-submission or final hand-in, responses are graded instantaneously against master keys, calculating sector percentiles, negative marking, and real-time ranks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE RANK ENGINE (LiRE) SHOWCASE ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '20px 24px 70px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(15,23,42,0.95), rgba(6,12,30,0.95))',
            border: '1.5px solid rgba(234,168,18,0.35)',
            borderRadius: 24, padding: '40px 36px', backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(234,168,18,0.1)',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 32, alignItems: 'center',
          }}>
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(234,168,18,0.15)', border: '1px solid rgba(234,168,18,0.4)',
                borderRadius: 20, padding: '4px 14px', marginBottom: 14,
                fontSize: '0.75rem', fontWeight: 800, color: '#FBBF24', letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                Institutional Tagline
              </div>
              <h2 style={{
                fontSize: 'clamp(2rem,4vw,2.8rem)', fontWeight: 900, margin: '0 0 14px',
                color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '-0.02em', lineHeight: 1.2,
              }}>
                Logic. While. LiRE.
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '0.94rem', lineHeight: 1.7, margin: '0 0 24px' }}>
                The Live Rank Engine (LiRE) benchmarks thousands of simultaneous participants with sub-50ms velocity. Standardized tie-breaking incorporates accuracy percentages, negative marking deductibles, and submission velocity.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#EAA812', fontFamily: "'Rajdhani',sans-serif" }}>100% Deterministic</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>Tie-Breaking Rules</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38BDF8', fontFamily: "'Rajdhani',sans-serif" }}>Sub-50ms</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase' }}>Leaderboard Sync</div>
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(5,10,22,0.85)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: '24px 20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#EAA812', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Live Rank Telemetry</span>
                <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} /> ACTIVE
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(234,168,18,0.12)', borderRadius: 8, border: '1px solid rgba(234,168,18,0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, color: '#EAA812', fontSize: '0.9rem' }}>#1</span>
                    <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.85rem' }}>Rank 1 Contender</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#EAA812', fontSize: '0.85rem' }}>98.5% Accuracy</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, color: '#94A3B8', fontSize: '0.9rem' }}>#2</span>
                    <span style={{ fontWeight: 600, color: '#E2E8F0', fontSize: '0.85rem' }}>Rank 2 Contender</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#CBD5E1', fontSize: '0.85rem' }}>95.0% Accuracy</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, color: '#94A3B8', fontSize: '0.9rem' }}>#3</span>
                    <span style={{ fontWeight: 600, color: '#E2E8F0', fontSize: '0.85rem' }}>Rank 3 Contender</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#CBD5E1', fontSize: '0.85rem' }}>92.5% Accuracy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECURITY & INTEGRITY ARCHITECTURE ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '20px 24px 70px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 44 }}>
            <span style={{
              display: 'inline-block', background: 'rgba(56,189,248,0.12)', color: '#38BDF8',
              border: '1px solid rgba(56,189,248,0.3)', padding: '5px 16px', borderRadius: 20,
              fontSize: '0.73rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14,
            }}>Enterprise Integrity Engine</span>
            <h2 style={{
              fontSize: 'clamp(1.8rem,3.5vw,2.5rem)', fontWeight: 900, margin: '0 0 10px',
              color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '-0.02em',
            }}>Institutional Security & Anti-Cheat Architecture</h2>
            <p style={{ color: '#64748B', fontSize: '0.92rem', margin: '0 auto', maxWidth: 660 }}>
              End-to-end cryptographic integrity guaranteeing bulletproof exam administration and unforgeable student evaluation.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18 }}>
            <SecurityCard
              icon="🕒"
              badge="Timing Protocol"
              title="Server-Authoritative Clock"
              desc="Centralized cluster timers dictate exam windows. Local workstation clock manipulation cannot bypass countdowns, start times, or automated submission locks."
              glow="#38BDF8"
              delay={0.06}
            />
            <SecurityCard
              icon="🔑"
              badge="Session Concurrency"
              title="Cryptographic Single-Session Lock"
              desc="Every candidate attempt receives a high-entropy 32-hex session token. Simultaneous browser tabs or secondary device logins instantly evict prior sessions."
              glow="#EAA812"
              delay={0.12}
            />
            <SecurityCard
              icon="👁️"
              badge="Proctoring"
              title="Multi-Vector Anti-Cheat Monitor"
              desc="Integrated tab-switch detection, fullscreen loss interception, copy-paste blocking, and automated strike counters trigger immediate proctor escalation."
              glow="#F43F5E"
              delay={0.18}
            />
            <SecurityCard
              icon="🛡️"
              badge="Access Control"
              title="Strict Multi-Role Isolation (RBAC)"
              desc="Cryptographic JWT tokens securely isolate Student, Faculty, College Inspector, and Admin scopes. Database queries strictly enforce college tenant boundaries."
              glow="#10B981"
              delay={0.24}
            />
            <SecurityCard
              icon="💾"
              badge="Network Resilience"
              title="Zero-Loss Offline Data Buffering"
              desc="Answers are buffered immediately in client IndexedDB storage with microsecond timestamps, synchronizing seamlessly during transient campus Wi-Fi drops."
              glow="#8B5CF6"
              delay={0.3}
            />
            <SecurityCard
              icon="📜"
              badge="Audit & Compliance"
              title="Immutable Audit Trails & Alerts"
              desc="Administrative modifications, test cancellations, score adjustments, and gate pass verifications are immutably logged with IP and role fingerprints."
              glow="#F59E0B"
              delay={0.36}
            />
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
            <SectorCard sectorId="sector-quant" color="#F59E0B" badge="📐 Quantitative Velocity" name="Sector 1: Quant" desc="Arithmetic acceleration, algebraic transformations, geometric logic, probabilistic models." delay={0} />
            <SectorCard sectorId="sector-logic" color="#8B5CF6" badge="🧩 Deductive Logic" name="Sector 2: Logic" desc="Constraint satisfaction, inductive sequences, syllogistic deduction, Boolean matrices." delay={0.07} />
            <SectorCard sectorId="sector-core-cs" color="#10B981" badge="💻 Core CS & Systems" name="Sector 3: Core CS" desc="OS scheduling, paging, thread synchronization, TCP/IP networking, SQL indexing." delay={0.14} />
            <SectorCard sectorId="sector-dsa" color="#38BDF8" badge="⚡ Algorithms & DSA" name="Sector 4: DSA" desc="Dynamic programming, graph traversals, amortized complexity, algorithmic velocity." delay={0.21} />
            <SectorCard sectorId="sector-fullstack" color="#F43F5E" badge="🌐 Full-Stack & Cloud" name="Sector 5: Cloud" desc="Distributed architectures, microservices, cloud scaling, concurrency, fault tolerance." delay={0.28} />
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

      {/* ── CONTACT & HYDERABAD CAMPUS ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '20px 24px 80px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 36 }}>
            <span style={{
              display: 'inline-block', background: 'rgba(234,168,18,0.12)', color: '#EAA812',
              border: '1px solid rgba(234,168,18,0.3)', padding: '5px 16px', borderRadius: 20,
              fontSize: '0.73rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14,
            }}>Institutional Operations</span>
            <h2 style={{
              fontSize: 'clamp(1.7rem,3vw,2.4rem)', fontWeight: 900, margin: '0 0 10px',
              color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '-0.02em',
            }}>Contact &amp; Hyderabad Campus</h2>
            <p style={{ color: '#64748B', fontSize: '0.91rem', margin: '0 auto', maxWidth: 620 }}>
              Official administrative headquarters and institutional technical support.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
            <div style={{
              background: 'rgba(10,16,35,0.7)', border: '1.5px solid rgba(234,168,18,0.25)',
              borderRadius: 16, padding: '24px 22px', backdropFilter: 'blur(16px)',
            }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 12 }}>🏛️</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
                Hyderabad Campus Headquarters
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 12px' }}>
                LogicWhile Institute<br />
                Madhapur, HITEC City, Hyderabad<br />
                Telangana 500081, India
              </p>
              <div style={{ fontSize: '0.78rem', color: '#EAA812', fontWeight: 700 }}>
                📍 Main Technological Center
              </div>
            </div>

            <div style={{
              background: 'rgba(10,16,35,0.7)', border: '1.5px solid rgba(56,189,248,0.25)',
              borderRadius: 16, padding: '24px 22px', backdropFilter: 'blur(16px)',
            }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 12 }}>✉️</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
                Administrative &amp; Helpdesk Email
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 12px' }}>
                Primary: admin@logicwhilelire.com<br />
                Inspector Desk: inspector@logicwhilelire.com<br />
                Inquiries: contact@logicwhile.com
              </p>
              <div style={{ fontSize: '0.78rem', color: '#38BDF8', fontWeight: 700 }}>
                ⚡ 24/7 Monitored Dispatch
              </div>
            </div>

            <div style={{
              background: 'rgba(10,16,35,0.7)', border: '1.5px solid rgba(16,185,129,0.25)',
              borderRadius: 16, padding: '24px 22px', backdropFilter: 'blur(16px)',
            }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 12 }}>📞</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
                Institutional Exam Helpline
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 12px' }}>
                Helpline: +91 91212 23344<br />
                Examination Technical Support Desk<br />
                Operating: Mon–Sat 08:00 – 20:00 IST
              </p>
              <div style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700 }}>
                🛡️ Live Invigilation Hotlines
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
