import { useState, useCallback, useRef } from 'react';

interface Use3DTiltOptions {
  perspective?: number;
  sensitivity?: number; // Divisor (default: 20)
}

export function use3DTilt<T extends HTMLElement = HTMLDivElement>({
  perspective = 900,
  sensitivity = 20,
}: Use3DTiltOptions = {}) {
  const ref = useRef<T>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg)`,
    transition: 'transform 0.15s ease-out',
    transformStyle: 'preserve-3d',
  });

  const onMouseMove = useCallback((e: React.MouseEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    setStyle({
      transform: `perspective(${perspective}px) rotateX(${-y / sensitivity}deg) rotateY(${x / sensitivity}deg)`,
      transition: 'transform 0.1s ease-out',
      transformStyle: 'preserve-3d',
      willChange: 'transform',
    });
  }, [perspective, sensitivity]);

  const onMouseLeave = useCallback(() => {
    setStyle({
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg)`,
      transition: 'transform 0.3s ease-out',
      transformStyle: 'preserve-3d',
    });
  }, [perspective]);

  return { ref, style, onMouseMove, onMouseLeave };
}
