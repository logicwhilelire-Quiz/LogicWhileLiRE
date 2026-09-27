import { useRef, useEffect } from 'react'

interface FlightPathLinesProps {
  color?: string
  opacity?: number
  count?: number
  className?: string
}

/**
 * FlightPathLines — Navy/white subtle background lines
 * Recolored from NeonGrid concept to aerospace aesthetic
 */
export default function FlightPathLines({
  color = '#2B7FFF',
  opacity = 0.06,
  count = 12,
  className = '',
}: FlightPathLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let animId: number
    let t = 0

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Parse hex to rgb
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)

    // Generate paths
    interface Path {
      x1: number; y1: number
      x2: number; y2: number
      cx: number; cy: number
      speed: number; phase: number
      dotPos: number
    }
    const paths: Path[] = Array.from({ length: count }, (_, i) => ({
      x1: Math.random() * canvas.width,
      y1: Math.random() * canvas.height,
      x2: Math.random() * canvas.width,
      y2: Math.random() * canvas.height,
      cx: Math.random() * canvas.width,
      cy: Math.random() * canvas.height,
      speed: 0.002 + Math.random() * 0.003,
      phase: (i / count) * Math.PI * 2,
      dotPos: Math.random(),
    }))

    const render = () => {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      paths.forEach(p => {
        // Draw the curved path
        ctx.beginPath()
        ctx.moveTo(p.x1, p.y1)
        ctx.quadraticCurveTo(p.cx, p.cy, p.x2, p.y2)
        ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`
        ctx.lineWidth = 0.8
        ctx.stroke()

        // Animated dot travelling along the path
        const dotT = (p.dotPos + t * p.speed) % 1
        const px = (1-dotT)*(1-dotT)*p.x1 + 2*(1-dotT)*dotT*p.cx + dotT*dotT*p.x2
        const py = (1-dotT)*(1-dotT)*p.y1 + 2*(1-dotT)*dotT*p.cy + dotT*dotT*p.y2

        const glow = ctx.createRadialGradient(px, py, 0, px, py, 6)
        glow.addColorStop(0, `rgba(${r},${g},${b},0.8)`)
        glow.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.beginPath()
        ctx.arc(px, py, 6, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(px, py, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,0.9)`
        ctx.fill()
      })

      // Subtle grid overlay
      const cellSize = Math.max(W, H) / 18
      for (let x = 0; x < W; x += cellSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0); ctx.lineTo(x, H)
        ctx.strokeStyle = `rgba(${r},${g},${b},${opacity * 0.4})`
        ctx.lineWidth = 0.3
        ctx.stroke()
      }
      for (let y = 0; y < H; y += cellSize) {
        ctx.beginPath()
        ctx.moveTo(0, y); ctx.lineTo(W, y)
        ctx.strokeStyle = `rgba(255,255,255,${opacity * 0.15})`
        ctx.lineWidth = 0.3
        ctx.stroke()
      }

      t++
      animId = requestAnimationFrame(render)
    }

    render()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [color, opacity, count])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
