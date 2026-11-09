import React, { useEffect, useRef, useState, useCallback } from 'react';
import { sound } from '../lib/soundService';

interface SwarmAgent {
  id: string;
  name: string;
  badge: string;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  isPressing: boolean;
  action: string;
}

const PEER_ROSTER = [
  { name: 'Kiran S.', badge: 'Rank #1 · CSE', color: '#0D99FF', action: 'Solving Sector 4' },
  { name: 'Bhavana M.', badge: '98% Acc · IT', color: '#A259FF', action: 'Verified Lobby' },
  { name: 'Arjun T.', badge: 'Sector 3 Master', color: '#0ACF83', action: 'Compiling Code' },
  { name: 'Ananya P.', badge: 'Candidate #42', color: '#F24E1E', action: 'Reviewing Q14' },
  { name: 'Inspector #01', badge: 'Live Telemetry', color: '#FFC700', action: 'Audit Active' },
  { name: 'Sita R.', badge: 'Sector 1 · Quant', color: '#E8467C', action: 'Fast Speed' },
  { name: 'Rahul V.', badge: 'Candidate #118', color: '#00B5CE', action: 'Connected' },
];

export default function SwarmPresence({ active = true, maxAgents = 5 }: { active?: boolean; maxAgents?: number }) {
  const [enabled, setEnabled] = useState(active);
  const [soundMuted, setSoundMuted] = useState(sound.getMuted());
  const mousePos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
  const agentsRef = useRef<SwarmAgent[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // Auto-pause during active proctored quiz sessions
  const isQuizWriting = typeof window !== 'undefined' && window.location.pathname.startsWith('/quiz/');

  // Initialize swarm agents
  useEffect(() => {
    const list: SwarmAgent[] = [];
    const count = Math.min(maxAgents, PEER_ROSTER.length);

    for (let i = 0; i < count; i++) {
      const template = PEER_ROSTER[i];
      const startX = Math.random() * (window.innerWidth - 200) + 100;
      const startY = Math.random() * (window.innerHeight - 200) + 100;

      list.push({
        id: `agent-${i}`,
        name: template.name,
        badge: template.badge,
        color: template.color,
        action: template.action,
        x: startX,
        y: startY,
        targetX: startX,
        targetY: startY,
        vx: 0,
        vy: 0,
        isPressing: false,
      });
    }
    agentsRef.current = list;
  }, [maxAgents]);

  // Track user mouse
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  // Flocking and animation loop
  useEffect(() => {
    if (!enabled) return;

    let lastTick = performance.now();
    let actionTimer = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTick) / 1000, 0.1);
      lastTick = now;
      actionTimer += dt;

      // Periodically trigger simulated peer action
      if (actionTimer > 3.5) {
        actionTimer = 0;
        const randomAgent = agentsRef.current[Math.floor(Math.random() * agentsRef.current.length)];
        if (randomAgent) {
          randomAgent.isPressing = true;
          // Play subtle tactile click for realism
          sound.playClick(1.2);
          setTimeout(() => {
            if (randomAgent) randomAgent.isPressing = false;
          }, 180);
        }
      }

      const agents = agentsRef.current;
      const mx = mousePos.current.x;
      const my = mousePos.current.y;

      for (let i = 0; i < agents.length; i++) {
        const ag = agents[i];

        // Pick new organic target around interactive areas or user cursor
        if (Math.hypot(ag.x - ag.targetX, ag.y - ag.targetY) < 40 || Math.random() < 0.015) {
          // Orbit towards mouse with loose offset
          const angle = (now / 1500) + (i * (Math.PI * 2 / agents.length));
          const radius = 140 + (i * 35);
          ag.targetX = Math.max(40, Math.min(window.innerWidth - 220, mx + Math.cos(angle) * radius));
          ag.targetY = Math.max(60, Math.min(window.innerHeight - 100, my + Math.sin(angle) * (radius * 0.7)));
        }

        // Spring acceleration
        const k = 2.8;
        const damping = 0.82;
        const ax = (ag.targetX - ag.x) * k;
        const ay = (ag.targetY - ag.y) * k;

        ag.vx = (ag.vx + ax * dt) * damping;
        ag.vy = (ag.vy + ay * dt) * damping;

        ag.x += ag.vx * dt * 60;
        ag.y += ag.vy * dt * 60;

        // Render DOM directly for maximum 60+ FPS performance
        const el = document.getElementById(ag.id);
        if (el) {
          el.style.transform = `translate3d(${ag.x.toFixed(1)}px, ${ag.y.toFixed(1)}px, 0)`;
          const svg = el.querySelector('svg');
          if (svg) {
            svg.style.transform = ag.isPressing ? 'scale(0.88)' : 'scale(1)';
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [enabled]);

  const toggleSound = () => {
    const muted = sound.toggleMute();
    setSoundMuted(muted);
  };

  if (isQuizWriting) return null;

  return (
    <>
      {/* Floating Swarm & Sound Quick HUD */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(10, 18, 36, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 999,
          padding: '6px 14px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          fontSize: '12px',
          color: '#F8FAFC',
          userSelect: 'none',
        }}
      >
        <button
          onClick={() => {
            setEnabled(!enabled);
            sound.playClick();
          }}
          style={{
            background: enabled ? 'rgba(13, 153, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            border: enabled ? '1px solid rgba(13, 153, 255, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
            color: enabled ? '#38BDF8' : '#94A3B8',
            borderRadius: 999,
            padding: '3px 10px',
            fontSize: '11.5px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            transition: 'all 0.2s',
          }}
          title="Toggle multiplayer live swarm presence"
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: enabled ? '#10B981' : '#64748B',
              boxShadow: enabled ? '0 0 8px #10B981' : 'none',
            }}
          />
          Swarm: {enabled ? 'Live' : 'Paused'}
        </button>

        <button
          onClick={toggleSound}
          style={{
            background: 'transparent',
            border: 'none',
            color: soundMuted ? '#94A3B8' : '#FBBF24',
            cursor: 'pointer',
            fontSize: '13px',
            padding: '2px 4px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={soundMuted ? 'Unmute Tactile Sound FX' : 'Mute Tactile Sound FX'}
        >
          {soundMuted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* Swarm Cursors Overlay */}
      {enabled && (
        <div
          ref={containerRef}
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 9997,
            overflow: 'hidden',
          }}
        >
          {agentsRef.current.map((ag) => (
            <div
              key={ag.id}
              id={ag.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                willChange: 'transform',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                transition: 'opacity 0.2s',
              }}
            >
              {/* Figma-Style Precision Cursor SVG */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                style={{
                  filter: `drop-shadow(0 2px 6px ${ag.color}40)`,
                  transition: 'transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transformOrigin: 'top left',
                }}
              >
                <path
                  d="M4.6 3.9 C4.2 3.1 4.9 2.4 5.7 2.8 L20.6 9.4 C21.5 9.8 21.4 11.1 20.4 11.3 L13.9 12.9 C13.4 13 13 13.4 12.9 13.9 L11.3 20.4 C11.1 21.4 9.8 21.5 9.4 20.6 Z"
                  fill={ag.color}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Peer Name & Action Badge */}
              <div
                style={{
                  marginLeft: 14,
                  marginTop: -4,
                  background: ag.color,
                  color: '#FFFFFF',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: '11px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  pointerEvents: 'none',
                }}
              >
                <span>{ag.name}</span>
                <span
                  style={{
                    background: 'rgba(0,0,0,0.22)',
                    padding: '1px 5px',
                    borderRadius: 4,
                    fontSize: '9.5px',
                    fontWeight: 600,
                  }}
                >
                  {ag.badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
