import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import BrandLogo from '../components/BrandLogo';
import { sound } from '../lib/soundService';
import { API_BASE_URL } from '../lib/config';
import {
  IconClock,
  IconShield,
  IconTrophy,
  IconRadio,
  IconLaunch,
  IconGraduation,
  IconBuilding,
  IconRadar,
  IconHierarchy,
  IconEye,
  IconLock,
  IconKey,
  IconCode,
  IconTarget,
  IconFileText,
  IconDownload,
  IconSpeedometer,
  IconGlobe,
  IconMail,
  IconPulse,
  IconFlash,
  IconCpu,
} from '../components/icons/HumanIcons';

/* ── Institutional Architectural Backdrop (LogicWhile Logo Color System) ── */
function InstitutionalGridBackdrop() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,180,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,180,0,0.03) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />
    </div>
  );
}

interface StatPillProps { icon: React.ReactNode; value: string; label: string }
function StatPill({ icon, value, label }: StatPillProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: '#0A1332',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 10, padding: '10px 16px',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>{icon}</span>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: '1.05rem', color: '#FFB400', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

interface PortalCardProps {
  icon: React.ReactNode; badge: string; badgeColor: string; badgeBg: string;
  title: string; desc: string; specs?: string[]; href: string; btnId: string; btnLabel: string;
  btnGradient: string; glowColor: string; borderColor: string; delay?: number;
}
function PortalCard({ icon, badge, badgeColor, badgeBg, title, desc, specs, href, btnId, btnLabel, glowColor, delay = 0 }: PortalCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#0D1942' : '#081232',
        border: `1px solid ${hovered ? `${glowColor}66` : 'rgba(255,255,255,0.09)'}`,
        borderRadius: 14, padding: '22px 20px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transition: 'background-color 160ms cubic-bezier(0.22,1,0.36,1), border-color 160ms cubic-bezier(0.22,1,0.36,1), transform 160ms cubic-bezier(0.22,1,0.36,1)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        position: 'relative', overflow: 'hidden', minHeight: 276,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
          <span style={{
            background: badgeBg, color: badgeColor, fontSize: '0.72rem', fontWeight: 600,
            padding: '4px 10px', borderRadius: 6,
            border: `1px solid ${badgeColor}33`,
          }}>{badge}</span>
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>{title}</h3>
        <p style={{ color: '#A1A9BC', fontSize: '0.84rem', lineHeight: 1.6, margin: '0 0 16px' }}>{desc}</p>
        {specs && specs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            {specs.map((sp) => (
              <span key={sp} style={{
                fontSize: '0.72rem', fontWeight: 500, color: '#CBD5E1',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, padding: '2px 8px',
              }}>{sp}</span>
            ))}
          </div>
        )}
      </div>
      <Link to={href} id={btnId} style={{
        textAlign: 'center',
        background: hovered ? '#FFB400' : 'rgba(255,255,255,0.06)',
        color: hovered ? '#050B22' : '#E2E8F0', fontWeight: 600, fontSize: '0.86rem',
        padding: '10px 16px', borderRadius: 8, textDecoration: 'none',
        border: `1px solid ${hovered ? '#FFB400' : 'rgba(255,255,255,0.1)'}`,
        transition: 'background-color 150ms cubic-bezier(0.22,1,0.36,1), color 150ms cubic-bezier(0.22,1,0.36,1), border-color 150ms cubic-bezier(0.22,1,0.36,1)',
        display: 'block',
      }}>{btnLabel} →</Link>
    </motion.div>
  );
}

interface SecurityCardProps {
  icon: React.ReactNode;
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
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#0D1942' : '#081232',
        border: `1px solid ${hovered ? `${glow}55` : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 14,
        padding: '22px 20px',
        transition: 'background-color 160ms cubic-bezier(0.22,1,0.36,1), border-color 160ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 500,
            color: glow,
            background: `${glow}14`,
            border: `1px solid ${glow}30`,
            padding: '3px 8px',
            borderRadius: 6,
          }}
        >
          {badge}
        </span>
      </div>
      <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
        {title}
      </h4>
      <p style={{ fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
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
      initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onClick={() => {
        sound.playClick();
        navigate('/practice', { state: { selectedSectorId: sectorId } });
      }}
      style={{
        background: hovered ? '#0D1942' : '#081232',
        border: `1px solid ${hovered ? `${color}66` : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 14, borderTop: `3px solid ${color}`,
        padding: '20px 18px',
        transition: 'background-color 160ms cubic-bezier(0.22,1,0.36,1), border-color 160ms cubic-bezier(0.22,1,0.36,1), transform 160ms cubic-bezier(0.22,1,0.36,1)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div style={{ fontSize: '0.74rem', fontWeight: 600, color, marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>{badge}</div>
        <div style={{ fontSize: '1.02rem', fontWeight: 600, color: '#F1F5F9', marginBottom: 8, fontFamily: "'Rajdhani',sans-serif" }}>{name}</div>
        <p style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.55, margin: 0 }}>{desc}</p>
      </div>
      <div style={{ marginTop: 14, fontSize: '0.78rem', fontWeight: 600, color, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>Launch sprint</span>
        <span>→</span>
      </div>
    </motion.div>
  );
}

function FeaturePill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: '#0A1332', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, padding: '7px 12px', fontSize: '0.82rem', color: '#CBD5E1', fontWeight: 500,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', color: '#94A3B8' }}>{icon}</span> {text}
    </div>
  );
}

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [quickExamCode, setQuickExamCode] = useState('');
  const [quickHallTicket, setQuickHallTicket] = useState('');
  const [engineHealth, setEngineHealth] = useState<{ state: 'checking' | 'online' | 'standby'; latencyMs: number | null; version: string }>({
    state: 'checking',
    latencyMs: null,
    version: '4.0.0',
  });

  useEffect(() => {
    const controller = new AbortController();
    const t0 = performance.now();
    const timer = setTimeout(() => controller.abort(), 5000);
    fetch(`${API_BASE_URL}/api/health`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Health check failed'))))
      .then((data) => {
        const ms = Math.max(1, Math.round(performance.now() - t0));
        setEngineHealth({
          state: 'online',
          latencyMs: ms,
          version: data?.version || '4.0.0',
        });
      })
      .catch(() => {
        setEngineHealth((prev) => ({ ...prev, state: 'standby', latencyMs: null }));
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

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

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050B22',
      color: '#F8FAFC',
      fontFamily: "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif",
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <style>{`
        .landing-grid-bg { background-image: linear-gradient(rgba(255,180,0,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,180,0,0.035) 1px,transparent 1px); background-size:48px 48px; }
      `}</style>

      <InstitutionalGridBackdrop />
      <SiteHeader />

      {/* ── HERO ── */}
      <section className="landing-grid-bg" style={{ position: 'relative', padding: '64px 24px 72px', textAlign: 'center', overflow: 'hidden', zIndex: 1 }}>
        <div ref={heroRef} style={{ maxWidth: 880, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          
          {/* Parent Enterprise > Sub-Branch Hierarchy Bar + Live Cluster Health */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} style={{ marginBottom: 20, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#0A1332',
              border: '1px solid rgba(255, 180, 0, 0.32)',
              borderRadius: 8, padding: '5px 12px',
              fontSize: '0.76rem', fontWeight: 600,
            }}>
              <span style={{ color: '#FF7A00', fontWeight: 600 }}>LogicWhile</span>
              <span style={{ color: '#64748B' }}>›</span>
              <span style={{ color: '#FFB400', fontWeight: 500 }}>LiRE Assessment Sub-Branch</span>
            </div>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#0A1332',
              border: `1px solid ${engineHealth.state === 'standby' ? 'rgba(245, 158, 11, 0.32)' : 'rgba(16, 185, 129, 0.32)'}`,
              borderRadius: 8, padding: '5px 12px',
              fontSize: '0.76rem', fontWeight: 500,
              color: engineHealth.state === 'standby' ? '#FBBF24' : '#34D399',
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: engineHealth.state === 'standby' ? '#F59E0B' : '#10B981',
              }} />
              <span>
                v{engineHealth.version} ·{' '}
                {engineHealth.state === 'online' && engineHealth.latencyMs !== null
                  ? `Engine online (${engineHealth.latencyMs}ms)`
                  : engineHealth.state === 'standby'
                  ? 'Engine standby (cold-wake ready)'
                  : 'Checking engine status'}
              </span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} style={{ marginBottom: 20 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              background: '#081232', border: '1px solid rgba(255, 180, 0, 0.3)',
              borderRadius: 12, padding: '12px 20px',
            }}>
              <BrandLogo size="md" variant="standard" showTagline={true} themeOverride="dark" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontSize: 'clamp(2.25rem, 5vw, 3.6rem)', fontWeight: 600, lineHeight: 1.08,
              margin: '0 0 16px', letterSpacing: '-0.025em',
              fontFamily: "'Rajdhani',sans-serif", color: '#FFFFFF',
            }}
          >
            <span style={{ color: '#FF7A00' }}>Logic</span><span style={{ color: '#FFFFFF' }}>While</span>{' '}
            <span style={{ color: '#FFB400' }}>LiRE Assessment Engine</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ fontSize: '1.05rem', color: '#A3A9B8', maxWidth: 660, margin: '0 auto 28px', lineHeight: 1.65 }}
          >
            <strong style={{ color: '#FFB400', fontWeight: 600 }}>LiRE (Live · Real · Engine)</strong> is the institutional examination
            and technical assessment sub-branch of <strong style={{ color: '#FF7A00', fontWeight: 600 }}>LogicWhile</strong> — built for
            server-authoritative timing, proctored cohort sessions, and sub-50ms live ranking.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}
          >
            <Link to="/enter-exam" id="hero-enter-exam-btn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, height: 44,
              background: '#FFB400',
              color: '#050B22', fontWeight: 600, fontSize: '0.94rem',
              padding: '0 24px', borderRadius: 8, textDecoration: 'none',
              transition: 'background-color 150ms cubic-bezier(0.22,1,0.36,1)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#FFC83B'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#FFB400'; }}
            >
              <IconLaunch size={18} color="#050B22" /> Enter Exam Code
            </Link>
            <Link to="/login" id="hero-student-gate-btn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, height: 44,
              background: '#0D1942',
              color: '#FFFFFF', fontWeight: 600, fontSize: '0.94rem',
              padding: '0 22px', borderRadius: 8, textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.14)',
              transition: 'background-color 150ms cubic-bezier(0.22,1,0.36,1), border-color 150ms cubic-bezier(0.22,1,0.36,1)',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#13245C'; el.style.borderColor = 'rgba(255,180,0,0.4)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#0D1942'; el.style.borderColor = 'rgba(255,255,255,0.14)'; }}
            >
              <IconGraduation size={18} color="#FFB400" /> Student Portal
            </Link>
          </motion.div>

          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32, fontSize: '0.84rem' }}>
            <Link to="/practice" id="hero-practice-btn" style={{ color: '#94A3B8', textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconTarget size={16} color="#FF7A00" /> 5 Sectors Practice Arena
            </Link>
            <Link to="/inspector" id="hero-inspector-btn" style={{ color: '#94A3B8', textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconRadar size={16} color="#60A5FA" /> Inspector Console
            </Link>
            <Link to="/admin" id="hero-admin-btn" style={{ color: '#94A3B8', textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconHierarchy size={16} color="#FFB400" /> Admin Hub
            </Link>
          </div>

          {/* Quick Exam Passcode Entry Station */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{
              maxWidth: 740,
              margin: '0 auto 32px',
              background: '#081232',
              border: '1px solid rgba(255, 180, 0, 0.28)',
              borderRadius: 14,
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconFlash size={16} color="#FFB400" />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#FFB400' }}>
                  LiRE Express Exam Gateway
                </span>
              </div>
              <span style={{ fontSize: '0.76rem', color: '#94A3B8', fontWeight: 500 }}>
                Instant Hall Ticket &amp; Exam Code Verification
              </span>
            </div>

            <form onSubmit={handleQuickEntry} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Exam code (e.g. GR-RVIT-XXXX)"
                value={quickExamCode}
                onChange={(e) => setQuickExamCode(e.target.value.toUpperCase())}
                style={{
                  flex: '1 1 180px',
                  height: 40,
                  padding: '0 12px',
                  borderRadius: 8,
                  background: '#050B22',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#F8FAFC',
                  fontSize: '0.86rem',
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: 500,
                }}
              />
              <input
                type="text"
                placeholder="Hall ticket / Roll number"
                value={quickHallTicket}
                onChange={(e) => setQuickHallTicket(e.target.value)}
                style={{
                  flex: '1 1 180px',
                  height: 40,
                  padding: '0 12px',
                  borderRadius: 8,
                  background: '#050B22',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#F8FAFC',
                  fontSize: '0.86rem',
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: 500,
                }}
              />
              <button
                type="submit"
                style={{
                  height: 40,
                  padding: '0 20px',
                  borderRadius: 8,
                  background: '#FF7A00',
                  color: '#050B22',
                  fontWeight: 600,
                  fontSize: '0.86rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'background-color 150ms cubic-bezier(0.22,1,0.36,1)',
                  whiteSpace: 'nowrap',
                }}
              >
                <IconLaunch size={16} color="#050B22" /> Start Assessment
              </button>
            </form>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <StatPill icon={<IconClock size={18} color="#FFB400" />} value="< 50ms" label="Timer sync" />
            <StatPill icon={<IconShield size={18} color="#FF7A00" />} value="5-Layer" label="Anti-cheat" />
            <StatPill icon={<IconTrophy size={18} color="#60A5FA" />} value="Real-time" label="Leaderboard" />
            <StatPill icon={<IconRadio size={18} color="#10B981" />} value="IndexedDB" label="Offline buffer" />
          </motion.div>
        </div>
      </section>

      {/* ── ACCESS PORTALS ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '64px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 40 }}>
            <span style={{
              display: 'inline-block', background: 'rgba(255,180,0,0.1)', color: '#FFB400',
              border: '1px solid rgba(255,180,0,0.25)', padding: '4px 12px', borderRadius: 6,
              fontSize: '0.76rem', fontWeight: 600, marginBottom: 12,
            }}>Official access gateways</span>
            <h2 style={{
              fontSize: 'clamp(1.8rem,3.5vw,2.5rem)', fontWeight: 600, margin: '0 0 8px',
              color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif",
            }}>Institutional Portals &amp; Gateways</h2>
            <p style={{ color: '#94A3B8', fontSize: '0.94rem', margin: 0 }}>Role-isolated authenticated access with continuous proctoring synchronization</p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16 }}>
            <PortalCard icon={<IconLaunch size={28} color="#10B981" />} badge="Portal I · Exam Entry" badgeColor="#34D399" badgeBg="rgba(16,185,129,0.12)" title="Exam Code Gate" desc="Direct candidate exam access using assigned Exam Code and Hall Ticket Number. Section eligibility is verified server-side with zero OTP friction." specs={['No-OTP Entry', 'Server Clock', 'SVG Watermark']} href="/enter-exam" btnId="landing-enter-exam-btn" btnLabel="Enter Exam Session" btnGradient="#10B981" glowColor="#10B981" borderColor="rgba(16,185,129,0.28)" delay={0.03} />
            <PortalCard icon={<IconGraduation size={28} color="#60A5FA" />} badge="Portal II · Student" badgeColor="#60A5FA" badgeBg="rgba(37,99,235,0.14)" title="Student Intelligence" desc="Authenticated candidate hub with upcoming section-matched exams, 5-Sector Practice Arena, 4-page performance dossiers, and rank tracking." specs={['5-Sector Arena', '4-Page Dossier', 'Live Ranks']} href="/login" btnId="landing-student-login-btn" btnLabel="Enter Candidate Gate" btnGradient="#1D4ED8" glowColor="#3B82F6" borderColor="rgba(59,130,246,0.32)" delay={0.06} />
            <PortalCard icon={<IconBuilding size={28} color="#FF7A00" />} badge="Portal III · Faculty" badgeColor="#FB923C" badgeBg="rgba(255,122,0,0.14)" title="Faculty Mentorship" desc="Zero-trust section-scoped command for accredited department faculty: review assigned sections, author papers, and track cohort accuracy." specs={['Section Scoping', 'Paper Authoring', 'Cohort Metrics']} href="/faculty" btnId="landing-faculty-login-btn" btnLabel="Sign In as Faculty" btnGradient="#FF7A00" glowColor="#FF7A00" borderColor="rgba(255,122,0,0.30)" delay={0.09} />
            <PortalCard icon={<IconRadar size={28} color="#A78BFA" />} badge="Portal IV · Proctor" badgeColor="#C4B5FD" badgeBg="rgba(139,92,246,0.14)" title="Inspector Command" desc="Live invigilation bridge with waiting hall release controls, authoritative exam start dispatch, dynamic 1–10 tab strike policy, and violation feed." specs={['Sync Start', '1-10 Tab Strikes', 'Release Queue']} href="/inspector" btnId="landing-inspector-login-btn" btnLabel="Sign In as Inspector" btnGradient="#8B5CF6" glowColor="#8B5CF6" borderColor="rgba(139,92,246,0.26)" delay={0.12} />
            <PortalCard icon={<IconHierarchy size={28} color="#FFB400" />} badge="Portal V · Master" badgeColor="#FFB400" badgeBg="rgba(255,180,0,0.14)" title="Super Admin Hub" desc="Complete multi-tenant governance — manage colleges, academic hierarchy, 5-sector banks, bulk XLSX rosters, RBAC staff, and backups." specs={['College Taxonomy', 'Bulk XLSX', 'Audit & Backups']} href="/admin" btnId="landing-admin-login-btn" btnLabel="Sign In as Admin" btnGradient="#FFB400" glowColor="#FFB400" borderColor="rgba(255,180,0,0.30)" delay={0.15} />
          </div>
        </div>
      </section>

      {/* ── FEATURES STRIP ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 24px 64px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{
            background: '#081232', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '24px 28px',
          }}>
            <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600, marginBottom: 14 }}>Platform capabilities</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <FeaturePill icon={<IconClock size={16} color="#38BDF8" />} text="Server-Authoritative Timers" />
              <FeaturePill icon={<IconEye size={16} color="#A78BFA" />} text="Webcam + Screen Proctoring" />
              <FeaturePill icon={<IconLock size={16} color="#FBBF24" />} text="Strict Fullscreen Integrity" />
              <FeaturePill icon={<IconRadio size={16} color="#34D399" />} text="Offline Answer Buffering" />
              <FeaturePill icon={<IconTrophy size={16} color="#F59E0B" />} text="Real-Time Leaderboard" />
              <FeaturePill icon={<IconKey size={16} color="#38BDF8" />} text="Multi-Role RBAC" />
              <FeaturePill icon={<IconCode size={16} color="#10B981" />} text="Live Code Execution" />
              <FeaturePill icon={<IconShield size={16} color="#F43F5E" />} text="Anti-Cheat Engine" />
              <FeaturePill icon={<IconTarget size={16} color="#8B5CF6" />} text="Radar Skill Analytics" />
              <FeaturePill icon={<IconFileText size={16} color="#FFB400" />} text="Hall Ticket Generation" />
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '24px 24px 64px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 40 }}>
            <span style={{
              display: 'inline-block', background: 'rgba(255,180,0,0.1)', color: '#FFB400',
              border: '1px solid rgba(255,180,0,0.25)', padding: '4px 12px', borderRadius: 6,
              fontSize: '0.76rem', fontWeight: 600, marginBottom: 12,
            }}>Operational workflow</span>
            <h2 style={{
              fontSize: 'clamp(1.8rem,3.5vw,2.45rem)', fontWeight: 600, margin: '0 0 8px',
              color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif",
            }}>How LogicWhile Operates</h2>
            <p style={{ color: '#94A3B8', fontSize: '0.94rem', margin: '0 auto', maxWidth: 640 }}>
              From student verification to synchronized examination kickoff and instant competitive telemetry.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
            <div style={{
              background: '#081232', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '22px 20px',
            }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#38BDF8', fontFamily: "var(--font-mono, monospace)", marginBottom: 8 }}>Step 01</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
                Entry &amp; Gate Verification
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                Candidates sign in strictly using their institutional Hall Ticket Number and targeted Exam Code. Access is restricted to designated batches and departments.
              </p>
            </div>

            <div style={{
              background: '#081232', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '22px 20px',
            }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#FFB400', fontFamily: "var(--font-mono, monospace)", marginBottom: 8 }}>Step 02</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
                Synchronous Waiting Lobby
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                Candidates hold in a zero-leak waiting lobby while College Inspectors verify roster presence. Questions remain inaccessible until official kickoff.
              </p>
            </div>

            <div style={{
              background: '#081232', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '22px 20px',
            }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#10B981', fontFamily: "var(--font-mono, monospace)", marginBottom: 8 }}>Step 03</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
                Unified Server Kickoff
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                When the Inspector starts the exam, all candidates receive the identical server-authoritative timestamp via WebSocket with continuous anti-cheat checks.
              </p>
            </div>

            <div style={{
              background: '#081232', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '22px 20px',
            }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#A78BFA', fontFamily: "var(--font-mono, monospace)", marginBottom: 8 }}>Step 04</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
                Live Rank Engine (LiRE)
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                Upon submission, responses are graded against master keys, calculating sector percentiles, negative marking, and real-time cohort ranks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE RANK ENGINE (LiRE) SHOWCASE ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '24px 24px 64px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            background: '#081232',
            border: '1px solid rgba(255,180,0,0.28)',
            borderRadius: 16, padding: '32px 28px',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 28, alignItems: 'center',
          }}>
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.28)',
                borderRadius: 6, padding: '4px 10px', marginBottom: 12,
                fontSize: '0.74rem', fontWeight: 600, color: '#FFB400',
              }}>
                LogicWhile Assessment Sub-Branch
              </div>
              <h2 style={{
                fontSize: 'clamp(1.9rem,3.6vw,2.6rem)', fontWeight: 600, margin: '0 0 12px',
                color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif", lineHeight: 1.15,
              }}>
                <span style={{ color: '#FF7A00' }}>Logic</span>While <span style={{ color: '#FFB400' }}>· LiRE Engine</span>
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '0.94rem', lineHeight: 1.65, margin: '0 0 24px' }}>
                The Live Rank Engine (LiRE) benchmarks thousands of simultaneous participants with sub-50ms velocity. Standardized tie-breaking incorporates accuracy percentages, negative marking deductibles, and submission time.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ background: '#0A1332', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#FFB400', fontFamily: "'Rajdhani',sans-serif", fontVariantNumeric: 'tabular-nums' }}>100% Deterministic</div>
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>Tie-breaking rules</div>
                </div>
                <div style={{ background: '#0A1332', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#38BDF8', fontFamily: "'Rajdhani',sans-serif", fontVariantNumeric: 'tabular-nums' }}>Sub-50ms</div>
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>Leaderboard sync</div>
                </div>
              </div>
            </div>

            <div style={{
              background: '#050B22', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFB400' }}>Deterministic Tie-Break Pipeline</span>
                <span style={{ fontSize: '0.74rem', color: engineHealth.state === 'standby' ? '#FBBF24' : '#34D399', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: engineHealth.state === 'standby' ? '#F59E0B' : '#10B981' }} />
                  {engineHealth.state === 'online' && engineHealth.latencyMs !== null ? `Live · ${engineHealth.latencyMs}ms` : 'Verified Engine'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,180,0,0.08)', borderRadius: 8, border: '1px solid rgba(255,180,0,0.28)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600, color: '#FFB400', fontSize: '0.84rem', fontFamily: 'monospace' }}>01</span>
                    <span style={{ fontWeight: 600, color: '#FFFFFF', fontSize: '0.84rem' }}>Net Score &amp; Negative Marking</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#FFB400', fontSize: '0.76rem' }}>Primary key</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#0A1332', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600, color: '#38BDF8', fontSize: '0.84rem', fontFamily: 'monospace' }}>02</span>
                    <span style={{ fontWeight: 500, color: '#E2E8F0', fontSize: '0.84rem' }}>Correctness Accuracy %</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#94A3B8', fontSize: '0.76rem' }}>Tie-break 1</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#0A1332', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600, color: '#10B981', fontSize: '0.84rem', fontFamily: 'monospace' }}>03</span>
                    <span style={{ fontWeight: 500, color: '#E2E8F0', fontSize: '0.84rem' }}>Elapsed Submission Velocity</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#94A3B8', fontSize: '0.76rem' }}>Lowest time</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#0A1332', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600, color: '#A78BFA', fontSize: '0.84rem', fontFamily: 'monospace' }}>04</span>
                    <span style={{ fontWeight: 500, color: '#E2E8F0', fontSize: '0.84rem' }}>Set A / B / C / D Seed Integrity</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#94A3B8', fontSize: '0.76rem' }}>SHA-256 seed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECURITY & INTEGRITY ARCHITECTURE ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '24px 24px 64px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 40 }}>
            <span style={{
              display: 'inline-block', background: 'rgba(56,189,248,0.1)', color: '#38BDF8',
              border: '1px solid rgba(56,189,248,0.25)', padding: '4px 12px', borderRadius: 6,
              fontSize: '0.76rem', fontWeight: 600, marginBottom: 12,
            }}>Enterprise integrity engine</span>
            <h2 style={{
              fontSize: 'clamp(1.8rem,3.5vw,2.45rem)', fontWeight: 600, margin: '0 0 8px',
              color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif",
            }}>Institutional Security &amp; Anti-Cheat Architecture</h2>
            <p style={{ color: '#94A3B8', fontSize: '0.94rem', margin: '0 auto', maxWidth: 640 }}>
              End-to-end cryptographic integrity guaranteeing fair exam administration and verifiable student evaluation.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
            <SecurityCard
              icon={<IconClock size={24} color="#38BDF8" />}
              badge="Timing protocol"
              title="Server-Authoritative Clock"
              desc="Centralized cluster timers dictate exam windows. Local workstation clock manipulation cannot bypass countdowns, start times, or automated submission locks."
              glow="#38BDF8"
              delay={0.04}
            />
            <SecurityCard
              icon={<IconKey size={24} color="#FFB400" />}
              badge="Session concurrency"
              title="Cryptographic Single-Session Lock"
              desc="Every candidate attempt receives a high-entropy 32-hex session token. Simultaneous browser tabs or secondary device logins instantly evict prior sessions."
              glow="#FFB400"
              delay={0.08}
            />
            <SecurityCard
              icon={<IconEye size={24} color="#F43F5E" />}
              badge="Proctoring"
              title="Multi-Vector Anti-Cheat Monitor"
              desc="Integrated tab-switch detection, fullscreen loss interception, copy-paste blocking, and automated strike counters trigger immediate proctor escalation."
              glow="#F43F5E"
              delay={0.12}
            />
            <SecurityCard
              icon={<IconShield size={24} color="#10B981" />}
              badge="Access control"
              title="Strict Multi-Role Isolation (RBAC)"
              desc="Cryptographic JWT tokens securely isolate Student, Faculty, College Inspector, and Admin scopes. Database queries strictly enforce college tenant boundaries."
              glow="#10B981"
              delay={0.16}
            />
            <SecurityCard
              icon={<IconDownload size={24} color="#8B5CF6" />}
              badge="Network resilience"
              title="Zero-Loss Offline Data Buffering"
              desc="Answers are buffered immediately in client IndexedDB storage with microsecond timestamps, synchronizing seamlessly during transient campus Wi-Fi drops."
              glow="#8B5CF6"
              delay={0.2}
            />
            <SecurityCard
              icon={<IconFileText size={24} color="#F59E0B" />}
              badge="Audit & compliance"
              title="Immutable Audit Trails & Alerts"
              desc="Administrative modifications, test cancellations, score adjustments, and gate pass verifications are immutably logged with IP and role fingerprints."
              glow="#F59E0B"
              delay={0.24}
            />
          </div>
        </div>
      </section>

      {/* ── 5 SECTORS ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '24px 24px 72px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 56 }}>
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 40 }}>
            <span style={{
              display: 'inline-block', background: 'rgba(16,185,129,0.1)', color: '#34D399',
              border: '1px solid rgba(52,211,153,0.25)', padding: '4px 12px', borderRadius: 6,
              fontSize: '0.76rem', fontWeight: 600, marginBottom: 12,
            }}>5 institutional technical sectors</span>
            <h2 style={{
              fontSize: 'clamp(1.7rem,3vw,2.4rem)', fontWeight: 600, margin: '0 0 8px',
              color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif",
            }}>Standardized Assessment Sectors</h2>
            <p style={{ color: '#94A3B8', fontSize: '0.92rem', margin: '0 auto', maxWidth: 620 }}>
              Every evaluation benchmarks candidates across 5 core engineering domains with synchronized radar telemetry.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16 }}>
            <SectorCard sectorId="sector-quant" color="#F59E0B" badge="10 Qs · 10 Marks · 80%" name="Sector 1: Quantitative Velocity" desc="Relative speed, angular geometry, probability, combinatorics, and ratio velocity." delay={0} />
            <SectorCard sectorId="sector-logic" color="#8B5CF6" badge="10 Qs · 10 Marks · 85%" name="Sector 2: Deductive Logic" desc="Pattern decryption, constraint networks, syllogistic deduction, and truth tables." delay={0.05} />
            <SectorCard sectorId="sector-core-cs" color="#10B981" badge="10 Qs · 15 Marks · 75%" name="Sector 3: Core CS & OS" desc="Page fault replacement (FIFO/LRU), Banker's deadlock safety, TCP/IP, and memory paging." delay={0.1} />
            <SectorCard sectorId="sector-dsa" color="#38BDF8" badge="10 Qs · 20 Marks · 80%" name="Sector 4: Algorithms & DSA" desc="Longest increasing subsequence, monotonic stacks, dynamic programming, and MSTs." delay={0.15} />
            <SectorCard sectorId="sector-fullstack" color="#F43F5E" badge="5 Qs · 15 Marks · 80%" name="Sector 5: Cloud & Full-Stack" desc="Token bucket rate limiters, Node event loop microtasks, REST/GraphQL caching, and locks." delay={0.2} />
          </div>

          <div style={{
            marginTop: 20,
            background: '#081232',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: '0.82rem',
            color: '#94A3B8',
            fontVariantNumeric: 'tabular-nums',
          }}>
            <span><strong style={{ color: '#F8FAFC', fontWeight: 600 }}>Standard blueprint:</strong> 45 Total Questions · 70 Max Marks · 80% Competency Target</span>
            <span style={{ color: '#34D399', fontWeight: 600 }}>Sets A / B / C / D Deterministic Permutation</span>
          </div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} style={{ textAlign: 'center', marginTop: 32 }}>
            <Link to="/practice" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, height: 42,
              background: '#0D1942', color: '#FFB400',
              border: '1px solid rgba(255,180,0,0.32)',
              padding: '0 24px', borderRadius: 8,
              fontWeight: 600, fontSize: '0.88rem', textDecoration: 'none',
              transition: 'background-color 150ms cubic-bezier(0.22,1,0.36,1)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#13245C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#0D1942'; }}
            >
              <IconTarget size={16} color="#FFB400" /> Explore 5-Sector Practice Arena →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── CONTACT & HYDERABAD CAMPUS ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '24px 24px 72px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 32 }}>
            <span style={{
              display: 'inline-block', background: 'rgba(255,180,0,0.1)', color: '#FFB400',
              border: '1px solid rgba(255,180,0,0.25)', padding: '4px 12px', borderRadius: 6,
              fontSize: '0.76rem', fontWeight: 600, marginBottom: 12,
            }}>Institutional operations</span>
            <h2 style={{
              fontSize: 'clamp(1.7rem,3vw,2.35rem)', fontWeight: 600, margin: '0 0 8px',
              color: '#FFFFFF', fontFamily: "'Rajdhani',sans-serif",
            }}>Contact &amp; Hyderabad Campus</h2>
            <p style={{ color: '#94A3B8', fontSize: '0.92rem', margin: '0 auto', maxWidth: 620 }}>
              Official administrative headquarters and institutional technical support.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            <div style={{
              background: '#081232', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '24px 20px',
            }}>
              <div style={{ marginBottom: 12 }}>
                <IconBuilding size={26} color="#FFB400" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
                Hyderabad Campus Headquarters
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 12px' }}>
                <strong style={{ color: '#FF7A00', fontWeight: 600 }}>LogicWhile</strong> (Main Enterprise)<br />
                LiRE Assessment Sub-Branch · Madhapur, HITEC City<br />
                Hyderabad, Telangana 500081, India
              </p>
              <div style={{ fontSize: '0.78rem', color: '#FFB400', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconTarget size={14} color="#FFB400" /> Main Technological Center
              </div>
            </div>

            <div style={{
              background: '#081232', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '24px 20px',
            }}>
              <div style={{ marginBottom: 12 }}>
                <IconMail size={26} color="#38BDF8" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
                Administrative &amp; Helpdesk Email
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 12px' }}>
                Primary Admin: admin@logicwhilelire.com<br />
                Inspector Desk: inspector@logicwhilelire.com<br />
                Support Desk: support@logicwhilelire.com
              </p>
              <div style={{ fontSize: '0.78rem', color: '#38BDF8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconFlash size={14} color="#38BDF8" /> 24/7 Monitored Dispatch
              </div>
            </div>

            <div style={{
              background: '#081232', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '24px 20px',
            }}>
              <div style={{ marginBottom: 12 }}>
                <IconPulse size={26} color="#10B981" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#FFFFFF', margin: '0 0 8px', fontFamily: "'Rajdhani',sans-serif" }}>
                Institutional Exam Helpline
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 12px', fontVariantNumeric: 'tabular-nums' }}>
                Helpline: +91 91212 23344<br />
                Examination Technical Support Desk<br />
                Operating: Mon–Sat 08:00 – 20:00 IST
              </p>
              <div style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconShield size={14} color="#10B981" /> Live Invigilation Hotlines
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
