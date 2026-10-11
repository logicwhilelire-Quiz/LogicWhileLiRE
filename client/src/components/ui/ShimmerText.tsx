import { type ReactNode, type CSSProperties, type ElementType } from 'react'

interface ShimmerTextProps {
  children: ReactNode
  color?: string
  shimmerColor?: string
  as?: ElementType
  className?: string
  style?: CSSProperties
  duration?: number
}

/**
 * Text with an animated shimmer / shine sweep effect.
 * Uses a CSS background-clip trick — works on any element.
 */
export default function ShimmerText({
  children,
  color = '#f0f4fc',
  shimmerColor = '#00d2ff',
  as: Tag = 'span',
  className = '',
  style,
  duration = 2.2,
}: ShimmerTextProps) {
  const id = `shimmer-${Math.random().toString(36).slice(2, 7)}`

  return (
    <>
      <style>{`
        @keyframes shimmer-sweep-${id} {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .${id} {
          background: linear-gradient(
            105deg,
            ${color} 30%,
            ${shimmerColor} 45%,
            #fff 50%,
            ${shimmerColor} 55%,
            ${color} 70%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer-sweep-${id} ${duration}s linear infinite;
        }
      `}</style>
      {/* @ts-ignore – dynamic polymorphic tag */}
      <Tag className={`${id}${className ? ' ' + className : ''}`} style={style}>
        {children}
      </Tag>
    </>
  )
}
