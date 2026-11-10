import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { sound } from '../lib/soundService';

interface Coordinate {
  x: number;
  y: number;
}

interface InspectTag {
  id: string;
  label: string;
  spec: string;
  domain: string;
  color: string;
  top: string;
  left?: string;
  right?: string;
  bounds?: string;
  desc: string;
}

const INSPECT_NODES: InspectTag[] = [
  {
    id: 'node-hero',
    label: 'HERO_VIEWPORT',
    spec: '1240 × 640 px · Z:10',
    domain: 'Platform Gateway',
    color: '#38BDF8',
    top: '12%',
    left: '8%',
    bounds: '1240 × 640 px',
    desc: 'Central hero presentation layer with architectural wordmark and real-time cluster health status.',
  },
  {
    id: 'node-gateway',
    label: 'EXPRESS_GATEWAY',
    spec: '720 × 90 px · 0-OTP',
    domain: 'Instant Authentication',
    color: '#10B981',
    top: '26%',
    left: '12%',
    bounds: '720 × 90 px',
    desc: 'High-velocity exam entry gateway with in-memory caching (<1ms response) and canonical roll normalization.',
  },
  {
    id: 'node-stats',
    label: 'CLUSTER_TELEMETRY',
    spec: '1100 × 120 px · Live Metrics',
    domain: 'Infrastructure Metrics',
    color: '#FBBF24',
    top: '38%',
    right: '10%',
    bounds: '1100 × 120 px',
    desc: 'Live telemetry runway reporting 10,000+ candidate capacity and sub-50ms database latency.',
  },
  {
    id: 'node-sec1',
    label: 'SEC_01_QUANT',
    spec: '240 × 260 px · Aptitude',
    domain: 'Curriculum Sector 1',
    color: '#F59E0B',
    top: '50%',
    left: '6%',
    bounds: '240 × 260 px',
    desc: 'Quantitative Velocity: Relative speed, modular arithmetic, probabilistic combinations and geometry.',
  },
  {
    id: 'node-sec2',
    label: 'SEC_02_LOGIC',
    spec: '240 × 260 px · Deduction',
    domain: 'Curriculum Sector 2',
    color: '#8B5CF6',
    top: '50%',
    left: '24%',
    bounds: '240 × 260 px',
    desc: 'Deductive Logic & Cognitive Networks: Constraint networks, syllogisms, pattern decoders.',
  },
  {
    id: 'node-sec3',
    label: 'SEC_03_SYSTEMS',
    spec: '240 × 260 px · Core CS',
    domain: 'Curriculum Sector 3',
    color: '#10B981',
    top: '50%',
    left: '42%',
    bounds: '240 × 260 px',
    desc: 'Core CS Foundations: OS scheduling, virtual memory paging, deadlock avoidance, TCP/IP flow control.',
  },
  {
    id: 'node-sec4',
    label: 'SEC_04_DSA',
    spec: '240 × 260 px · Algorithms',
    domain: 'Curriculum Sector 4',
    color: '#38BDF8',
    top: '50%',
    left: '60%',
    bounds: '240 × 260 px',
    desc: 'Advanced DSA: Longest Increasing Subsequence, Monotonic Stacks, Disjoint Set Union & Kruskal MST.',
  },
  {
    id: 'node-sec5',
    label: 'SEC_05_FULLSTACK',
    spec: '240 × 260 px · Cloud Arch',
    domain: 'Curriculum Sector 5',
    color: '#F43F5E',
    top: '50%',
    left: '78%',
    bounds: '240 × 260 px',
    desc: 'Distributed Architecture: Token bucket rate limiting, event loop simulator, microtask priority engines.',
  },
  {
    id: 'node-portals',
    label: 'PORTAL_MATRIX',
    spec: '5-ROLES · Zero-Trust RBAC',
    domain: 'Access Management',
    color: '#F59E0B',
    top: '68%',
    right: '8%',
    bounds: '1100 × 320 px',
    desc: 'Institutional role matrix separating Super Admin, College Inspector, Faculty, and Student portals.',
  },
  {
    id: 'node-lire',
    label: 'LiRE_ENGINE',
    spec: 'Continuous Continuous Rank',
    domain: 'Real-Time Telemetry',
    color: '#8B5CF6',
    top: '80%',
    left: '8%',
    bounds: '1200 × 380 px',
    desc: 'Synchronous live assessment engine with drift-immune server timers and deterministic tie-breaking.',
  },
  {
    id: 'node-proctor',
    label: 'PROCTOR_LOCKDOWN',
    spec: 'Dual-Stream AI Security',
    domain: 'Anti-Cheat Subsystem',
    color: '#EC4899',
    top: '88%',
    right: '12%',
    bounds: '1100 × 280 px',
    desc: 'WebRTC dual-stream video proctoring, audio spike classification, fullscreen lockdown, and face detection.',
  },
];

export default function HorizonXOverlay() {
  const [active, setActive] = useState(false);
  const [mousePos, setMousePos] = useState<Coordinate>({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [activeTab, setActiveTab] = useState<'blueprint' | 'wireframe' | 'sectors' | 'metrics'>('blueprint');
  const [selectedNode, setSelectedNode] = useState<InspectTag>(INSPECT_NODES[0]);
  const location = useLocation();

  // Smart security dampener: unmount during active examinations
  const isTakingQuiz = location.pathname.startsWith('/quiz/');

  // Listen to mouse coordinates
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    const handleResize = () => {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Listen for both keyboard shortcut (H) and custom event 'toggle-horizonx' from SiteHeader
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setActive((prev) => {
          const next = !prev;
          if (next) sound.playSwell();
          else sound.playClick();
          return next;
        });
      }
    };
    const handleCustomToggle = () => {
      setActive((prev) => {
        const next = !prev;
        if (next) sound.playSwell();
        else sound.playClick();
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('toggle-horizonx', handleCustomToggle);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('toggle-horizonx', handleCustomToggle);
    };
  }, []);

  if (isTakingQuiz) return null;

  return (
    <>
      {/* ── Fixed Floating Toggle Pill (Always Accessible) ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          zIndex: 9990,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          onClick={() => {
            setActive((p) => {
              const next = !p;
              if (next) sound.playSwell();
              else sound.playClick();
              return next;
            });
          }}
          title="Toggle HorizonX Architectural Blueprint Mode (Key: H)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 999,
            background: active ? 'linear-gradient(135deg, #0EA5E9, #8B5CF6)' : 'rgba(10, 16, 35, 0.88)',
            border: active ? '1.5px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.18)',
            color: '#FFFFFF',
            fontSize: '0.76rem',
            fontWeight: 800,
            cursor: 'pointer',
            backdropFilter: 'blur(16px)',
            boxShadow: active ? '0 0 25px rgba(56, 189, 248, 0.5)' : '0 4px 16px rgba(0,0,0,0.3)',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: '0.04em',
          }}
        >
          <span style={{ fontSize: '0.95rem' }}>{active ? '📐' : '🏛️'}</span>
          <span>{active ? 'HORIZONX ACTIVE' : 'HORIZONX BLUEPRINT'}</span>
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.2)',
              fontSize: '0.66rem',
              fontWeight: 700,
            }}
          >
            H
          </span>
        </button>
      </div>

      {/* ── FULL HORIZONX ARCHITECTURAL INSPECT OVERLAY ── */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9980,
              pointerEvents: 'none',
              overflow: 'hidden',
              background: 'rgba(3, 7, 18, 0.55)',
              backdropFilter: 'saturate(1.2)',
            }}
          >
            {/* 1. Precision Architectural Grid Runway */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `
                  linear-gradient(rgba(56, 189, 248, 0.08) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(56, 189, 248, 0.08) 1px, transparent 1px),
                  linear-gradient(rgba(56, 189, 248, 0.03) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(56, 189, 248, 0.03) 1px, transparent 1px)
                `,
                backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
                opacity: 0.85,
              }}
            />

            {/* 2. Precision 12-Column Alignment Runway */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(12, 1fr)',
                borderLeft: '1px solid rgba(56, 189, 248, 0.15)',
                borderRight: '1px solid rgba(56, 189, 248, 0.15)',
              }}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    borderRight: '1px solid rgba(56, 189, 248, 0.06)',
                    height: '100%',
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: 6,
                      fontSize: '0.6rem',
                      fontFamily: "'Space Grotesk', monospace",
                      color: 'rgba(56, 189, 248, 0.35)',
                    }}
                  >
                    COL_{String(i + 1).padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>

            {/* 3. Top Mode Banner */}
            <div
              style={{
                position: 'absolute',
                top: 14,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(6, 12, 28, 0.92)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: 20,
                padding: '4px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: '0.72rem',
                fontFamily: "'Space Grotesk', monospace",
                fontWeight: 700,
                color: '#38BDF8',
                boxShadow: '0 0 20px rgba(56, 189, 248, 0.25)',
                pointerEvents: 'auto',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
              <span>HORIZONX BLUEPRINT ENGINE v4.0.0 &bull; LIVE ARCHITECTURAL INSPECTOR</span>
              <span style={{ color: '#64748B' }}>|</span>
              <span style={{ color: '#F8FAFC' }}>HOTKEY: <kbd style={{ background: 'rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: 3 }}>H</kbd></span>
            </div>

            {/* 4. Dynamic Cursor Reticle & Dimension Crosshairs */}
            <div
              style={{
                position: 'absolute',
                left: mousePos.x,
                top: 0,
                bottom: 0,
                width: 1,
                background: 'rgba(56, 189, 248, 0.35)',
                boxShadow: '0 0 8px rgba(56, 189, 248, 0.4)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: mousePos.y,
                left: 0,
                right: 0,
                height: 1,
                background: 'rgba(56, 189, 248, 0.35)',
                boxShadow: '0 0 8px rgba(56, 189, 248, 0.4)',
              }}
            />

            {/* Mouse Coordinates Badge */}
            <div
              style={{
                position: 'absolute',
                left: mousePos.x + 16,
                top: mousePos.y + 16,
                background: 'rgba(5, 10, 24, 0.92)',
                border: '1px solid #38BDF8',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: '0.68rem',
                fontFamily: "'Space Grotesk', monospace",
                fontWeight: 700,
                color: '#38BDF8',
                boxShadow: '0 0 14px rgba(56, 189, 248, 0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              X: {mousePos.x}px &bull; Y: {mousePos.y}px
            </div>

            {/* 5. Section & Sector Architectural Spec Pins (Interactive) */}
            {INSPECT_NODES.map((node) => {
              const isSelected = selectedNode.id === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => {
                    sound.playClick();
                    setSelectedNode(node);
                  }}
                  onMouseEnter={() => {
                    setSelectedNode(node);
                  }}
                  style={{
                    position: 'absolute',
                    top: node.top,
                    left: node.left,
                    right: node.right,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    transition: 'all 0.2s ease',
                    transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: node.color,
                      boxShadow: `0 0 12px ${node.color}`,
                    }}
                  />
                  <div
                    style={{
                      background: isSelected ? 'rgba(10, 20, 45, 0.96)' : 'rgba(5, 10, 24, 0.88)',
                      border: `1.5px solid ${isSelected ? node.color : node.color + '66'}`,
                      borderLeft: `4px solid ${node.color}`,
                      borderRadius: 6,
                      padding: '5px 12px',
                      fontFamily: "'Space Grotesk', monospace",
                      boxShadow: isSelected ? `0 0 20px ${node.color}66` : `0 0 14px ${node.color}22`,
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: node.color }}>
                      {node.label}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: '#94A3B8' }}>
                      {node.spec}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 6. Floating Bottom Architectural Console Terminal (Exact HorizonX Design) */}
            <div
              style={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'min(820px, calc(100vw - 48px))',
                background: 'rgba(6, 11, 28, 0.94)',
                border: '1.5px solid rgba(56, 189, 248, 0.4)',
                borderRadius: 14,
                padding: '14px 20px',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 35px rgba(56, 189, 248, 0.2)',
                pointerEvents: 'auto',
                fontFamily: "'Space Grotesk', monospace",
              }}
            >
              {/* Terminal Top Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingBottom: 8,
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#F8FAFC', letterSpacing: '0.04em' }}>
                    INSPECT ELEMENT // {selectedNode.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['blueprint', 'wireframe', 'sectors', 'metrics'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        sound.playClick();
                        setActiveTab(tab);
                      }}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 4,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        border: activeTab === tab ? '1px solid #38BDF8' : '1px solid transparent',
                        background: activeTab === tab ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
                        color: activeTab === tab ? '#38BDF8' : '#94A3B8',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        fontFamily: "'Space Grotesk', monospace",
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                  <button
                    onClick={() => setActive(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94A3B8',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      padding: '0 6px',
                    }}
                    title="Close HorizonX Mode (Key: H)"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Terminal Active Node Detailed Specifications */}
              <div
                style={{
                  background: 'rgba(3, 7, 18, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 12,
                  fontSize: '0.72rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: selectedNode.color, fontWeight: 800 }}>
                    TAG: &lt;section#{selectedNode.id}&gt;
                  </span>
                  <span style={{ color: '#34D399', fontWeight: 700 }}>
                    STATUS: 200 OK &bull; SYNC ACTIVE
                  </span>
                </div>
                <div style={{ color: '#CBD5E1', fontSize: '0.7rem', lineHeight: 1.45, marginBottom: 6 }}>
                  {selectedNode.desc}
                </div>
                <div style={{ display: 'flex', gap: 16, color: '#64748B', fontSize: '0.65rem' }}>
                  <span>BOUNDS: <strong style={{ color: '#F8FAFC' }}>{selectedNode.bounds}</strong></span>
                  <span>DOMAIN: <strong style={{ color: '#F8FAFC' }}>{selectedNode.domain}</strong></span>
                  <span>LATENCY: <strong style={{ color: '#FBBF24' }}>153ms DB Ping</strong></span>
                </div>
              </div>

              {/* Terminal System Overview Bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 12,
                  fontSize: '0.72rem',
                }}
              >
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.62rem' }}>VIEWPORT RUNWAY</div>
                  <div style={{ color: '#38BDF8', fontWeight: 700 }}>{viewportSize.w} × {viewportSize.h} px</div>
                </div>
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.62rem' }}>5 SECTOR ENGINES</div>
                  <div style={{ color: '#34D399', fontWeight: 700 }}>Quant &bull; Logic &bull; Core &bull; DSA &bull; Cloud</div>
                </div>
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.62rem' }}>DATABASE BACKEND</div>
                  <div style={{ color: '#FBBF24', fontWeight: 700 }}>Supabase Managed PG (SSL)</div>
                </div>
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.62rem' }}>PLATFORM</div>
                  <div style={{ color: '#A78BFA', fontWeight: 700 }}>LogicWhile</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
