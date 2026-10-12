import { useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

interface MagneticButtonProps {
  children: React.ReactNode
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  className?: string
  style?: React.CSSProperties
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  id?: string
  radius?: number
  strength?: number
  [key: string]: unknown
}

export default function MagneticButton({
  children,
  onClick,
  className = '',
  style = {},
  disabled = false,
  type = 'button',
  id,
  radius = 80,
  strength = 0.4,
  ...rest
}: MagneticButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const animRef = useRef<number | undefined>(undefined)
  const posRef = useRef({ x: 0, y: 0 })
  const targetRef = useRef({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!btnRef.current || disabled) return
    const rect = btnRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top  + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < radius) {
      targetRef.current = {
        x: dx * strength,
        y: dy * strength,
      }
    }
  }, [disabled, radius, strength])

  const handleMouseLeave = useCallback(() => {
    targetRef.current = { x: 0, y: 0 }
  }, [])

  useEffect(() => {
    if (disabled) return
    const btn = btnRef.current
    if (!btn) return
    window.addEventListener('mousemove', handleMouseMove)
    btn.addEventListener('mouseleave', handleMouseLeave)

    const animate = () => {
      posRef.current.x += (targetRef.current.x - posRef.current.x) * 0.12
      posRef.current.y += (targetRef.current.y - posRef.current.y) * 0.12
      if (btn) {
        btn.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`
      }
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      btn.removeEventListener('mouseleave', handleMouseLeave)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [disabled, handleMouseMove, handleMouseLeave])

  // Ripple effect
  const createRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!btnRef.current) return
    const btn = btnRef.current
    const rect = btn.getBoundingClientRect()
    const ripple = document.createElement('span')
    const size = Math.max(rect.width, rect.height)
    ripple.style.cssText = `
      position:absolute;
      width:${size}px;height:${size}px;
      left:${e.clientX-rect.left-size/2}px;
      top:${e.clientY-rect.top-size/2}px;
      background:rgba(255,255,255,0.2);
      border-radius:50%;
      animation:ripple 0.6s ease-out forwards;
      pointer-events:none;
    `
    btn.style.position = 'relative'
    btn.style.overflow = 'hidden'
    btn.appendChild(ripple)
    setTimeout(() => ripple.remove(), 600)
    onClick?.(e)
  }

  return (
    <motion.button
      ref={btnRef}
      id={id}
      type={type}
      disabled={disabled}
      onClick={createRipple}
      className={className}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', ...style }}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  )
}
