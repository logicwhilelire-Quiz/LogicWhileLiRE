import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

/** GlowCard — 3D tilt card with mouse-tracked glow + border glow */
export default function GlowCard({
  children,
  className = '',
  style = {},
  glowColor = 'rgba(43,127,255,0.3)',
  noPadding = false,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  glowColor?: string
  noPadding?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [hovering, setHovering] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width   // 0–1
    const y = (e.clientY - rect.top)  / rect.height  // 0–1
    setTilt({ x, y })
    ref.current.style.setProperty('--mouse-x', String(x))
    ref.current.style.setProperty('--mouse-y', String(y))
  }

  const handleMouseLeave = () => {
    setHovering(false)
    setTilt({ x: 0.5, y: 0.5 })
    if (ref.current) {
      ref.current.style.setProperty('--mouse-x', '0.5')
      ref.current.style.setProperty('--mouse-y', '0.5')
    }
  }

  const rotateX = hovering ? (tilt.y - 0.5) * -8 : 0
  const rotateY = hovering ? (tilt.x - 0.5) * 8  : 0

  return (
    <motion.div
      ref={ref}
      className={`glow-card ${noPadding ? '!p-0' : ''} ${className}`}
      style={{
        ...style,
        transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transition: hovering
          ? 'transform 0.1s ease, border-color 0.3s ease, box-shadow 0.3s ease'
          : 'transform 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.4s ease, box-shadow 0.4s ease',
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      whileHover={{
        boxShadow: `0 0 24px ${glowColor}, 0 8px 32px rgba(0,0,0,0.2)`,
      }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  )
}
