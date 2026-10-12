import { useRef, useEffect } from 'react';

interface ConfettiProps {
  particleCount?: number;
  durationMs?: number;
}

export default function Confetti({
  particleCount = 150,
  durationMs = 4000,
}: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#00d2ff', '#FFC200', '#10B981', '#0284c7', '#ea580c'];

    const centerX = canvas.width / 2;
    const centerY = canvas.height * 0.45;

    // 150 particles burst from center with physics
    const particles = Array.from({ length: particleCount }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 4;
      return {
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4, // initial upward kick
        width: Math.random() * 8 + 4,
        height: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        alpha: 1,
      };
    });

    let animId = 0;
    const gravity = 0.2;
    const friction = 0.99;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Physics: velocity.y += gravity (0.2), velocity.x *= 0.99 (friction)
        p.vy += gravity;
        p.vx *= friction;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    const timer = setTimeout(() => {
      cancelAnimationFrame(animId);
    }, durationMs);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(timer);
    };
  }, [particleCount, durationMs]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        width: '100vw',
        height: '100vh',
      }}
      aria-label="Celebration Particle Confetti"
    />
  );
}
