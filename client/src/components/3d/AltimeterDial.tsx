import { useEffect, useRef, useState } from 'react'

interface AltimeterDialProps {
  value: number
  label: string
  suffix?: string
  color?: string
  size?: number
  duration?: number
}

/**
 * AltimeterDial — circular progress dial with count-up animation
 * Used for stats like 50K+ students, 200+ colleges, etc.
 */
export default function AltimeterDial({
  value,
  label,
  suffix = '+',
  color = '#2B7FFF',
  size = 120,
  duration = 2000,
}: AltimeterDialProps) {
  const [count, setCount] = useState(0)
  const [progress, setProgress] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const startTimeRef = useRef<number | undefined>(undefined)
  const animRef = useRef<number | undefined>(undefined)
  const inViewRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  const startAnim = () => {
    if (started.current) return
    started.current = true

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

    const tick = (ts: number) => {
      if (!startTimeRef.current) startTimeRef.current = ts
      const elapsed = ts - startTimeRef.current
      const t = Math.min(elapsed / duration, 1)
      const eased = easeOut(t)
      setCount(Math.round(eased * value))
      setProgress(eased)
      if (t < 1) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) startAnim() },
      { threshold: 0.5 }
    )
    if (inViewRef.current) obs.observe(inViewRef.current)
    return () => { obs.disconnect(); if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])

  // Draw dial on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    canvas.width  = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2, cy = size / 2
    const radius = size / 2 - 8
    const startAngle = -Math.PI * 1.25
    const endAngle   = Math.PI * 0.25
    const sweep = endAngle - startAngle

    ctx.clearRect(0, 0, size, size)

    // Background track
    ctx.beginPath()
    ctx.arc(cx, cy, radius, startAngle, endAngle)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.stroke()

    if (progress > 0) {
      // Filled arc with gradient
      const grad = ctx.createLinearGradient(0, 0, size, size)
      grad.addColorStop(0, color)
      grad.addColorStop(1, '#60a5fa')
      ctx.beginPath()
      ctx.arc(cx, cy, radius, startAngle, startAngle + sweep * progress)
      ctx.strokeStyle = grad
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.stroke()

      // Glow effect
      ctx.shadowColor = color
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(cx, cy, radius, startAngle, startAngle + sweep * progress)
      ctx.strokeStyle = grad
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.shadowBlur = 0

      // Needle dot at current position
      const angle = startAngle + sweep * progress
      const nx = cx + radius * Math.cos(angle)
      const ny = cy + radius * Math.sin(angle)
      ctx.beginPath()
      ctx.arc(nx, ny, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.shadowColor = color
      ctx.shadowBlur = 10
      ctx.fill()
      ctx.shadowBlur = 0
    }

    // Tick marks
    for (let i = 0; i <= 10; i++) {
      const angle = startAngle + (sweep * i) / 10
      const inner = radius - 8
      const outer = radius - 2
      ctx.beginPath()
      ctx.moveTo(cx + inner * Math.cos(angle), cy + inner * Math.sin(angle))
      ctx.lineTo(cx + outer * Math.cos(angle), cy + outer * Math.sin(angle))
      ctx.strokeStyle = i <= progress * 10
        ? color + 'cc'
        : 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 1.5
      ctx.lineCap = 'round'
      ctx.stroke()
    }
  }, [progress, color, size])

  return (
    <div
      ref={inViewRef}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size, display: 'block' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          marginTop: 8,
        }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: size * 0.22,
            fontWeight: 800,
            background: `linear-gradient(135deg, #fff, ${color})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            lineHeight: 1,
          }}>
            {count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count}{suffix}
          </span>
        </div>
      </div>
      <span style={{
        fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--color-text-muted)',
        textAlign: 'center', maxWidth: size + 16,
      }}>
        {label}
      </span>
    </div>
  )
}
