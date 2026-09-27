import { useState, useEffect } from 'react';

export default function ParallaxGlowOrbs() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      setMouse({
        x: e.clientX - cx,
        y: e.clientY - cy,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {/* Orb 1: 400px, #6C5CE7, speed 0.02 */}
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: '#6C5CE7',
          filter: 'blur(80px)',
          opacity: 0.18,
          top: '5%',
          left: '10%',
          transform: `translate(${mouse.x * 0.02}px, ${mouse.y * 0.02}px)`,
          transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
          willChange: 'transform',
        }}
      />

      {/* Orb 2: 300px, #06B6D4, speed 0.04 */}
      <div
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: '#06B6D4',
          filter: 'blur(80px)',
          opacity: 0.16,
          bottom: '15%',
          right: '12%',
          transform: `translate(${mouse.x * 0.04}px, ${mouse.y * 0.04}px)`,
          transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
          willChange: 'transform',
        }}
      />

      {/* Orb 3: 500px, #0A1931, speed 0.01 */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: '#0A1931',
          filter: 'blur(80px)',
          opacity: 0.35,
          top: '40%',
          left: '50%',
          transform: `translate(calc(-50% + ${mouse.x * 0.01}px), calc(-50% + ${mouse.y * 0.01}px))`,
          transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
          willChange: 'transform',
        }}
      />
    </div>
  );
}
