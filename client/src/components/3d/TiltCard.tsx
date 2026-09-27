import React, { useRef, useState, useCallback } from 'react';

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  perspective?: number;
  sensitivity?: number; // Divisor, default 20
  glareEffect?: boolean;
}

export default function TiltCard({
  children,
  perspective = 900,
  sensitivity = 20,
  glareEffect = false,
  className = '',
  style = {},
  ...props
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transformStyle, setTransformStyle] = useState<string>('');
  const [glarePosition, setGlarePosition] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    const rotX = -y / sensitivity;
    const rotY = x / sensitivity;

    setTransformStyle(`perspective(${perspective}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`);

    if (glareEffect) {
      setGlarePosition({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    }
  }, [perspective, sensitivity, glareEffect]);

  const handleMouseLeave = useCallback(() => {
    setTransformStyle(`perspective(${perspective}px) rotateX(0deg) rotateY(0deg)`);
    if (glareEffect) setGlarePosition(null);
  }, [perspective, glareEffect]);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`tilt-card-container ${className}`}
      style={{
        transform: transformStyle,
        transition: 'transform 0.15s ease-out',
        transformStyle: 'preserve-3d',
        position: 'relative',
        ...style,
      }}
      {...props}
    >
      {children}
      {glareEffect && glarePosition && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: 'inherit',
            background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(255, 255, 255, 0.15) 0%, transparent 60%)`,
            mixBlendMode: 'overlay',
          }}
        />
      )}
    </div>
  );
}
