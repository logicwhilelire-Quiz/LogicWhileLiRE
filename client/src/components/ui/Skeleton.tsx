import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  circle?: boolean;
  style?: React.CSSProperties;
}

export default function Skeleton({
  className = '',
  width,
  height,
  borderRadius,
  circle = false,
  style = {},
}: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width: circle ? height || 40 : width || '100%',
        height: height || 20,
        borderRadius: circle ? '50%' : borderRadius || 'var(--radius-md, 12px)',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonWave 1.6s ease-in-out infinite',
        ...style,
      }}
    />
  );
}
