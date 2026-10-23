import { useRef, useEffect } from 'react';
import { isReducedMotion, isLowEndDevice } from './shared3d';

interface NodeNetworkProps {
  nodeCount?: number;
  maxDistance?: number;
  className?: string;
  lineColor?: string; // default rgba(56, 189, 248, 0.35)
  nodeColor?: string; // default #38BDF8
}

export default function NodeNetwork({
  nodeCount = 45,
  maxDistance = 130,
  className = 'w-full h-full',
  lineColor = 'rgba(56, 189, 248, 0.35)',
  nodeColor = '#38BDF8',
}: NodeNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Hard Rule: Respect prefers-reduced-motion
    const reducedMotion = isReducedMotion();
    const lowEnd = isLowEndDevice();

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let width = canvas.parentElement?.offsetWidth || window.innerWidth;
    let height = canvas.parentElement?.offsetHeight || window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.parentElement?.offsetWidth || window.innerWidth;
      height = canvas.parentElement?.offsetHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    window.addEventListener('resize', handleResize);

    // Mouse interaction tracking
    const mouse = { x: -1000, y: -1000, active: false };
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };
    const handleMouseLeave = () => {
      mouse.active = false;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);

    // Performance rule: If mobile or low-end device, throttle particle count
    const isMobile = width < 768;
    const activeNodeCount = lowEnd ? 16 : isMobile ? 22 : nodeCount;

    // Initialize nodes
    const nodes = Array.from({ length: activeNodeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.75,
      vy: (Math.random() - 0.5) * 0.75,
      radius: Math.random() * 1.6 + 1.2,
    }));

    let animId = 0;
    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      ctx.clearRect(0, 0, width, height);

      // Move nodes & gentle mouse repulsion
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;

        if (mouse.active) {
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110 && dist > 0) {
            const force = (110 - dist) / 110;
            n.x += (dx / dist) * force * 2.5;
            n.y += (dy / dist) * force * 2.5;
          }
        }

        if (n.x < 0) { n.x = 0; n.vx *= -1; }
        else if (n.x > width) { n.x = width; n.vx *= -1; }

        if (n.y < 0) { n.y = 0; n.vy *= -1; }
        else if (n.y > height) { n.y = height; n.vy *= -1; }
      }

      // Draw proximity connecting lines
      ctx.lineWidth = 0.8;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const alpha = (1 - dist / maxDistance) * 0.4;
            ctx.strokeStyle = lineColor.replace('0.35', String(alpha.toFixed(3)));
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor;
        ctx.shadowBlur = 6;
        ctx.shadowColor = nodeColor;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (!reducedMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    // Hard Rule: Pause when tab hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isRunning = false;
        cancelAnimationFrame(animId);
      } else {
        isRunning = true;
        if (!reducedMotion) {
          animId = requestAnimationFrame(render);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial render
    render();

    return () => {
      isRunning = false;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [nodeCount, maxDistance, lineColor, nodeColor]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'block',
      }}
      aria-label="Interactive Proximity Node Network"
    />
  );
}
