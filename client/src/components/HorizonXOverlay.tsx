import { useState, useEffect, useRef } from 'react';
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
  color: string;
  top: string;
  left?: string;
  right?: string;
}

const INSPECT_NODES: InspectTag[] = [
  { id: 'node-hero', label: 'HERO_VIEWPORT', spec: '1240×620 · Z:10', color: '#38BDF8', top: '14%', left: '8%' },
  { id: 'node-gateway', label: 'EXPRESS_GATEWAY', spec: '720×90 · 0-OTP', color: '#10B981', top: '38%', left: '12%' },
  { id: 'node-portals', label: 'PORTAL_MATRIX', spec: '5-ROLES · RBAC', color: '#F59E0B', top: '52%', right: '10%' },
  { id: 'node-lire', label: 'LiRE_ENGINE', spec: 'SUB-50ms · TIE-BREAK', color: '#8B5CF6', top: '68%', left: '7%' },
  { id: 'node-sectors', label: '5_SECTOR_RADAR', spec: '5-AXIS · HOLOGRAPHIC', color: '#EC4899', top: '82%', right: '12%' },
];

export default function HorizonXOverlay() {
  const [active, setActive] = useState(false);
  const [mousePos, setMousePos] = useState<Coordinate>({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [activeTab, setActiveTab] = useState<'blueprint' | 'wireframe' | 'metrics'>('blueprint');
  const location = useLocation();

  // Smart security dampener: never display during active quiz
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

  // Keyboard shortcut: Press 'H' to toggle HorizonX mode
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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
            background: active ? 'linear-gradient(135deg, #0EA5E9, #8B5CF6)' : 'rgba(10, 16, 35, 0.85)',
            border: active ? '1.5px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.15)',
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
              pointerEvents: 'none',
              zIndex: 9980,
              overflow: 'hidden',
            }}
          >
            {/* 1. Architectural Blueprint Grid Background */}
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

            {/* 2. Precision Vertical Alignment Tracks (HorizonX Runway) */}
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
                      color: 'rgba(56, 189, 248, 0.3)',
                    }}
                  >
                    COL_{String(i + 1).padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>

            {/* 3. Dynamic Cursor Reticle & Dimension Crosshairs */}
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
                background: 'rgba(5, 10, 24, 0.9)',
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

            {/* 4. Section Architectural Spec Pins */}
            {INSPECT_NODES.map((node) => (
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  top: node.top,
                  left: node.left,
                  right: node.right,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
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
                    background: 'rgba(5, 10, 24, 0.88)',
                    border: `1px solid ${node.color}88`,
                    borderLeft: `3px solid ${node.color}`,
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontFamily: "'Space Grotesk', monospace",
                    boxShadow: `0 0 16px ${node.color}33`,
                  }}
                >
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: node.color }}>
                    {node.label}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#94A3B8' }}>
                    {node.spec}
                  </div>
                </div>
              </div>
            ))}

            {/* 5. Floating Bottom Architectural Console Terminal (as shown in video) */}
            <div
              style={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'min(760px, calc(100vw - 48px))',
                background: 'rgba(6, 11, 28, 0.92)',
                border: '1.5px solid rgba(56, 189, 248, 0.35)',
                borderRadius: 14,
                padding: '14px 20px',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(56, 189, 248, 0.15)',
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
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#F8FAFC', letterSpacing: '0.04em' }}>
                    HORIZONX AGENT OVERVIEW: ARCHITECTURE v4.0.0
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['blueprint', 'wireframe', 'metrics'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        sound.playClick();
                        setActiveTab(tab);
                      }}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        border: activeTab === tab ? '1px solid #38BDF8' : '1px solid transparent',
                        background: activeTab === tab ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                        color: activeTab === tab ? '#38BDF8' : '#94A3B8',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
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
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      padding: '0 4px',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Terminal Live Telemetry Output */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 12,
                  fontSize: '0.72rem',
                }}
              >
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.64rem' }}>VIEWPORT MATRIX</div>
                  <div style={{ color: '#38BDF8', fontWeight: 700 }}>{viewportSize.w} × {viewportSize.h} px</div>
                </div>
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.64rem' }}>SECTOR ENGINES</div>
                  <div style={{ color: '#34D399', fontWeight: 700 }}>5/5 Synchronized</div>
                </div>
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.64rem' }}>DB LATENCY (SUPABASE)</div>
                  <div style={{ color: '#FBBF24', fontWeight: 700 }}>153ms &bull; SSL/TLS</div>
                </div>
                <div>
                  <div style={{ color: '#64748B', fontSize: '0.64rem' }}>DEVELOPED BY</div>
                  <div style={{ color: '#A78BFA', fontWeight: 700 }}>R. Charan Sai Krishna</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

