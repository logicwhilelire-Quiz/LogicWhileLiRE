import { type ReactNode, type CSSProperties } from 'react'

interface GlowCardProps {
  children: ReactNode
  color?: string
  className?: string
  style?: CSSProperties
  hover?: boolean
  onClick?: () => void
}

/**
 * Glassmorphism card with a customisable glow border.
 * Uses CSS custom properties from the design token system.
 */
export default function GlowCard({ children, color = '#6C5CE7', className = '', style, hover = true, onClick }: GlowCardProps) {
  const base: CSSProperties = {
    position: 'relative',
    background: 'rgba(13,19,38,0.72)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: `1px solid ${color}30`,
    borderRadius: 'var(--radius-lg)',
    boxShadow: `0 0 0 1px ${color}18, 0 8px 32px rgba(0,0,0,0.45)`,
    transition: 'box-shadow 0.3s ease, transform 0.3s ease, border-color 0.3s ease',
    ...style,
  }

  const hoverStyle = hover ? {
    '--glow-card-hover-shadow': `0 0 32px ${color}40, 0 8px 32px rgba(0,0,0,0.55)`,
  } as CSSProperties : {}

  return (
    <div
      className={`glow-card${className ? ' ' + className : ''}`}
      style={{ ...base, ...hoverStyle }}
      onClick={onClick}
      onMouseEnter={e => {
        if (!hover) return
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = `0 0 28px ${color}44, 0 16px 48px rgba(0,0,0,0.6)`
        el.style.borderColor = `${color}70`
        el.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        if (!hover) return
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = `0 0 0 1px ${color}18, 0 8px 32px rgba(0,0,0,0.45)`
        el.style.borderColor = `${color}30`
        el.style.transform = 'translateY(0)'
      }}
    >
      {/* Gradient top-edge shimmer */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: 1,
          background: `linear-gradient(90deg, transparent, ${color}80, transparent)`,
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  )
}
