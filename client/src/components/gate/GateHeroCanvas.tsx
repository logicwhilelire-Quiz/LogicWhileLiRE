import { useEffect, useRef, useState } from 'react';

interface GateHeroCanvasProps {
  wsLatency?: number;
}

export default function GateHeroCanvas({ wsLatency = 18 }: GateHeroCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 440);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 620);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.parentElement.clientWidth;
      height = canvas.parentElement.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      mouseRef.current.targetX = x * 0.45;
      mouseRef.current.targetY = y * 0.35;
    };

    const handleMouseLeave = () => {
      mouseRef.current.targetX = 0;
      mouseRef.current.targetY = 0;
    };

    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // ——— Icosahedron Geometry Setup ———
    const phi = (1 + Math.sqrt(5)) / 2;
    const s = 1 / Math.sqrt(1 + phi * phi);
    const baseVertices = [
      [-1, phi, 0],
      [1, phi, 0],
      [-1, -phi, 0],
      [1, -phi, 0],
      [0, -1, phi],
      [0, 1, phi],
      [0, -1, -phi],
      [0, 1, -phi],
      [phi, 0, -1],
      [phi, 0, 1],
      [-phi, 0, -1],
      [-phi, 0, 1],
    ].map(([x, y, z]) => [x * s, y * s, z * s]);

    // Find the 30 edges (pairs where distance squared ~ 4s^2)
    const edges: Array<[number, number]> = [];
    const targetDistSq = (2 * s) * (2 * s);
    for (let i = 0; i < baseVertices.length; i++) {
      for (let j = i + 1; j < baseVertices.length; j++) {
        const dx = baseVertices[i][0] - baseVertices[j][0];
        const dy = baseVertices[i][1] - baseVertices[j][1];
        const dz = baseVertices[i][2] - baseVertices[j][2];
        const dSq = dx * dx + dy * dy + dz * dz;
        if (Math.abs(dSq - targetDistSq) < 0.15) {
          edges.push([i, j]);
        }
      }
    }

    // ——— Node Network Setup (surrounding point cloud) ———
    interface NetworkNode {
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      radius: number;
      pulsePhase: number;
      pulseSpeed: number;
      color: string;
    }

    const nodeCount = 38;
    const nodes: NetworkNode[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phiAngle = Math.acos(2.0 * v - 1.0);
      const r = 110 + Math.random() * 110;
      nodes.push({
        x: r * Math.sin(phiAngle) * Math.cos(theta),
        y: r * Math.sin(phiAngle) * Math.sin(theta),
        z: r * Math.cos(phiAngle),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        vz: (Math.random() - 0.5) * 0.3,
        radius: 1.5 + Math.random() * 2,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.04,
        color: Math.random() > 0.4 ? '#06b6d4' : '#8b5cf6',
      });
    }

    // Traveling Data Pulses (representing WebSocket leaderboard stream)
    interface DataPulse {
      edgeIndex: number;
      progress: number;
      speed: number;
      color: string;
    }

    const dataPulses: DataPulse[] = [];
    for (let i = 0; i < 7; i++) {
      dataPulses.push({
        edgeIndex: Math.floor(Math.random() * edges.length),
        progress: Math.random(),
        speed: 0.006 + Math.random() * 0.012,
        color: i % 2 === 0 ? '#38bdf8' : '#10b981',
      });
    }

    let angleX = 0.2;
    let angleY = 0.3;
    let angleZ = 0.1;
    let tick = 0;

    const render = () => {
      tick++;
      // Parallax smooth interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.06;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.06;

      const rotSpeed = isReducedMotion ? 0.001 : 0.006;
      angleY += rotSpeed;
      angleX += rotSpeed * 0.7;
      angleZ += rotSpeed * 0.4;

      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height * 0.46;
      const fov = 420;
      const coreScale = Math.min(width, height) * 0.24;

      // Current 3D rotation angles including parallax
      const curAngleX = angleX + mouseRef.current.y;
      const curAngleY = angleY + mouseRef.current.x;

      const cosX = Math.cos(curAngleX);
      const sinX = Math.sin(curAngleX);
      const cosY = Math.cos(curAngleY);
      const sinY = Math.sin(curAngleY);
      const cosZ = Math.cos(angleZ);
      const sinZ = Math.sin(angleZ);

      // 3D rotation helper
      const rotate3D = (x: number, y: number, z: number): [number, number, number] => {
        // Yaw (Y)
        let x1 = x * cosY - z * sinY;
        let z1 = x * sinY + z * cosY;
        let y1 = y;

        // Pitch (X)
        let y2 = y1 * cosX - z1 * sinX;
        let z2 = y1 * sinX + z1 * cosX;
        let x2 = x1;

        // Roll (Z)
        let x3 = x2 * cosZ - y2 * sinZ;
        let y3 = x2 * sinZ + y2 * cosZ;
        let z3 = z2;

        return [x3, y3, z3];
      };

      // Project 3D to 2D
      const project = (x: number, y: number, z: number): [number, number, number] => {
        const distance = fov + z;
        const scale = distance > 10 ? fov / distance : 1;
        return [cx + x * scale, cy + y * scale, z];
      };

      // 1. Draw glowing ambient core back-glow
      const pulseGlow = Math.sin(tick * 0.04) * 0.15 + 0.85;
      const coreGradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, coreScale * 1.5);
      coreGradient.addColorStop(0, `rgba(6, 182, 212, ${0.18 * pulseGlow})`);
      coreGradient.addColorStop(0.4, `rgba(124, 58, 237, ${0.12 * pulseGlow})`);
      coreGradient.addColorStop(1, 'rgba(7, 10, 20, 0)');
      ctx.fillStyle = coreGradient;
      ctx.fillRect(0, 0, width, height);

      // 2. Project Icosahedron vertices
      const projVertices = baseVertices.map(([vx, vy, vz]) => {
        const [rx, ry, rz] = rotate3D(vx * coreScale, vy * coreScale, vz * coreScale);
        return project(rx, ry, rz);
      });

      // 3. Update & Project Network Nodes
      const projNodes = nodes.map((node) => {
        if (!isReducedMotion) {
          node.x += node.vx;
          node.y += node.vy;
          node.z += node.vz;
          const distSq = node.x * node.x + node.y * node.y + node.z * node.z;
          if (distSq > 240 * 240 || distSq < 100 * 100) {
            node.vx = -node.vx;
            node.vy = -node.vy;
            node.vz = -node.vz;
          }
          node.pulsePhase += node.pulseSpeed;
        }
        const [rx, ry, rz] = rotate3D(node.x, node.y, node.z);
        return {
          ...project(rx, ry, rz),
          color: node.color,
          radius: node.radius,
          pulse: Math.sin(node.pulsePhase) * 0.4 + 0.6,
        };
      });

      // 4. Draw Connecting Lines in Node Network
      ctx.lineWidth = 1;
      for (let i = 0; i < projNodes.length; i++) {
        for (let j = i + 1; j < projNodes.length; j++) {
          const n1 = projNodes[i];
          const n2 = projNodes[j];
          const dx = n1[0] - n2[0];
          const dy = n1[1] - n2[1];
          const dist2D = Math.sqrt(dx * dx + dy * dy);
          if (dist2D < 78) {
            const alpha = (1 - dist2D / 78) * 0.22;
            ctx.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(n1[0], n1[1]);
            ctx.lineTo(n2[0], n2[1]);
            ctx.stroke();
          }
        }
      }

      // 5. Draw Icosahedron Wireframe Edges
      edges.forEach(([i, j]) => {
        const p1 = projVertices[i];
        const p2 = projVertices[j];
        const avgZ = (p1[2] + p2[2]) / 2;
        const depthAlpha = Math.max(0.25, Math.min(0.9, (avgZ + coreScale) / (coreScale * 2)));

        ctx.strokeStyle = `rgba(56, 189, 248, ${depthAlpha * 0.8})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();

        // Inner complementary violet edge
        ctx.strokeStyle = `rgba(167, 139, 250, ${depthAlpha * 0.4})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });

      // 6. Draw Data Pulses traveling along Icosahedron edges
      dataPulses.forEach((pulse) => {
        if (!isReducedMotion) {
          pulse.progress += pulse.speed;
          if (pulse.progress > 1) {
            pulse.progress = 0;
            pulse.edgeIndex = Math.floor(Math.random() * edges.length);
          }
        }
        const [idx1, idx2] = edges[pulse.edgeIndex];
        const p1 = projVertices[idx1];
        const p2 = projVertices[idx2];
        const px = p1[0] + (p2[0] - p1[0]) * pulse.progress;
        const py = p1[1] + (p2[1] - p1[1]) * pulse.progress;

        ctx.fillStyle = pulse.color;
        ctx.shadowColor = pulse.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // 7. Draw Icosahedron Vertices
      projVertices.forEach(([vx, vy, vz]) => {
        const depthAlpha = Math.max(0.4, (vz + coreScale) / (coreScale * 2));
        ctx.fillStyle = `rgba(6, 182, 212, ${depthAlpha})`;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(vx, vy, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Core dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(vx, vy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      });

      // 8. Draw Network Nodes
      projNodes.forEach((node) => {
        const alpha = Math.max(0.2, (node[2] + 200) / 400);
        ctx.fillStyle = node.color;
        ctx.globalAlpha = alpha * node.pulse;
        ctx.beginPath();
        ctx.arc(node[0], node[1], node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // 9. Floating Stream Telemetry Ring
      const ringRadius = coreScale * 1.35;
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isReducedMotion]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 520,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: 20,
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(13, 22, 48, 0.95) 0%, rgba(7, 10, 20, 0.98) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        padding: '24px 20px',
      }}
    >
      {/* 3D Canvas Layer */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          pointerEvents: 'auto',
        }}
      />

      {/* Top HUD: Brand & System Check */}
      <div style={{ position: 'relative', zIndex: 2, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-heading, "Space Grotesk", sans-serif)',
                fontSize: '1.45rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>LogicWhileLiRE</span>
            </div>
            <div
              style={{
                fontSize: '0.72rem',
                color: '#4A7DBE',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              Logic. While. LiRE.
            </div>
          </div>

          {/* Pulsing Live Status Line */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 600,
              color: '#34d399',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981',
                animation: 'pulse 1.8s infinite',
              }}
            />
            <span>System check: websocket ready</span>
            <span style={{ color: '#6ee7b7' }}>({wsLatency}ms)</span>
          </div>
        </div>

        {/* Gate Module Banner */}
        <div
          style={{
            marginTop: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px',
            borderRadius: 6,
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            fontSize: '0.68rem',
            fontFamily: 'var(--font-mono, monospace)',
            color: '#38bdf8',
            letterSpacing: '0.04em',
          }}
        >
          <span>GATE ENTRANCE PROTOCOL</span>
          <span>•</span>
          <span style={{ color: '#a78bfa' }}>AL-SPEC-2026-REG</span>
        </div>
      </div>

      {/* Middle Floating Telemetry Badge */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          pointerEvents: 'none',
          alignSelf: 'center',
          textAlign: 'center',
          margin: 'auto 0',
          padding: '6px 14px',
          borderRadius: 20,
          background: 'rgba(7, 10, 20, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.06em' }}>
          WEBSOCKET STREAM · REDIS SORTED SET LEADER CHANNEL
        </div>
      </div>

      {/* Bottom HUD: 4 Prominent Stat Badges */}
      <div style={{ position: 'relative', zIndex: 2, pointerEvents: 'none' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
          }}
        >
          {/* Badge 1 */}
          <div
            style={{
              background: 'rgba(7, 10, 20, 0.75)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: 10,
              padding: '10px 12px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-heading)' }}>
              100%
            </div>
            <div style={{ fontSize: '0.68rem', color: '#cbd5e1', fontWeight: 600, letterSpacing: '0.02em', marginTop: 1 }}>
              Identity Uniqueness
            </div>
            <div style={{ fontSize: '0.62rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              (college_id × roll_no)
            </div>
          </div>

          {/* Badge 2 */}
          <div
            style={{
              background: 'rgba(7, 10, 20, 0.75)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 10,
              padding: '10px 12px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-heading)' }}>
              4 Batches
            </div>
            <div style={{ fontSize: '0.68rem', color: '#cbd5e1', fontWeight: 600, letterSpacing: '0.02em', marginTop: 1 }}>
              YOP 2027–2030
            </div>
            <div style={{ fontSize: '0.62rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              Cohort Normalization
            </div>
          </div>

          {/* Badge 3 */}
          <div
            style={{
              background: 'rgba(7, 10, 20, 0.75)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: 10,
              padding: '10px 12px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#a78bfa', fontFamily: 'var(--font-heading)' }}>
              5 Sections
            </div>
            <div style={{ fontSize: '0.68rem', color: '#cbd5e1', fontWeight: 600, letterSpacing: '0.02em', marginTop: 1 }}>
              Sections A–E
            </div>
            <div style={{ fontSize: '0.62rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              Classroom Micro-Rankings
            </div>
          </div>

          {/* Badge 4 */}
          <div
            style={{
              background: 'rgba(7, 10, 20, 0.75)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 10,
              padding: '10px 12px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-heading)' }}>
              Argon2id
            </div>
            <div style={{ fontSize: '0.68rem', color: '#cbd5e1', fontWeight: 600, letterSpacing: '0.02em', marginTop: 1 }}>
              Credential Security
            </div>
            <div style={{ fontSize: '0.62rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              12 Salt Rounds · TLS 1.3
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
