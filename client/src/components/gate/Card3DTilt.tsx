import React, { useRef, useState, useEffect } from 'react';

interface Card3DTiltProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  maxTilt?: number;
  disabled?: boolean;
}

export default function Card3DTilt({
  children,
  className = '',
  style = {},
  maxTilt = 5,
  disabled = false,
}: Card3DTiltProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg)');
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50, opacity: 0 });
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || isReducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normX = (x / rect.width) * 2 - 1;
    const normY = (y / rect.height) * 2 - 1;

    const rotX = -normY * maxTilt;
    const rotY = normX * maxTilt;

    setTransform(`perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`);
    setSpotlight({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.15,
    });
  };

  const handleMouseLeave = () => {
    if (disabled || isReducedMotion) return;
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg)');
    setSpotlight((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        transform: disabled || isReducedMotion ? 'none' : transform,
        transition: 'transform 0.15s ease-out',
        transformStyle: 'preserve-3d',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Specular spotlight overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 10,
          background: `radial-gradient(circle 350px at ${spotlight.x}% ${spotlight.y}%, rgba(6, 182, 212, ${spotlight.opacity}), transparent 70%)`,
          transition: 'opacity 0.25s ease',
          borderRadius: 'inherit',
        }}
      />
      {children}
    </div>
  );
}
