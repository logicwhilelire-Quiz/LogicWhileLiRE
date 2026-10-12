import { useRef, useEffect } from 'react'

interface NeonGridProps {
  color?: string
  accentColor?: string
  cellSize?: number
  className?: string
  perspective?: boolean
}

export default function NeonGrid({
  color = '#0284c7',
  accentColor = '#00d2ff',
  cellSize = 60,
  className = '',
  perspective = true,
}: NeonGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let animId: number
    let t = 0

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return { r, g, b }
    }

    const render = () => {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      if (perspective) {
        // Perspective grid (vanishing point at top center)
        const vx = W / 2
        const vy = H * 0.3
        const horizon = H * 0.4
        const rows = 14
        const cols = 20

        // Horizontal lines (perspective)
        for (let r = 0; r <= rows; r++) {
          const progress = (r / rows)
          const y = horizon + (H - horizon) * (progress * progress)
          const spread = W * 0.5 + (W * 0.5) * progress
          const pulse = r === Math.floor(((t * 0.8) % rows)) ? 0.9 : 0.15

          const { r: cr, g: cg, b: cb } = r % 3 === 0 ? hexToRgb(accentColor) : hexToRgb(color)
          ctx.beginPath()
          ctx.moveTo(vx - spread, y)
          ctx.lineTo(vx + spread, y)
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${pulse + 0.05})`
          ctx.lineWidth = pulse > 0.5 ? 1.5 : 0.5
          ctx.stroke()

          // Glow on moving line
          if (pulse > 0.5) {
            ctx.shadowBlur = 12
            ctx.shadowColor = accentColor
            ctx.stroke()
            ctx.shadowBlur = 0
          }
        }

        // Vertical lines
        for (let c = -cols / 2; c <= cols / 2; c++) {
          const xTop = vx + (c / (cols / 2)) * W * 0.05
          const xBot = vx + (c / (cols / 2)) * W * 0.55
          const { r: cr, g: cg, b: cb } = hexToRgb(color)
          ctx.beginPath()
          ctx.moveTo(xTop, horizon)
          ctx.lineTo(xBot, H)
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.15)`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      } else {
        // Flat glowing grid
        const { r: cr, g: cg, b: cb } = hexToRgb(color)
        const { r: ar, g: ag, b: ab } = hexToRgb(accentColor)

        for (let x = 0; x < W; x += cellSize) {
          const pulse = Math.abs(Math.sin(t * 0.5 + x * 0.05)) * 0.3
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, H)
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${0.08 + pulse})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
        for (let y = 0; y < H; y += cellSize) {
          const pulse = Math.abs(Math.sin(t * 0.5 + y * 0.05)) * 0.3
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(W, y)
          ctx.strokeStyle = `rgba(${ar},${ag},${ab},${0.08 + pulse})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }

        // Intersection dots
        for (let x = 0; x < W; x += cellSize) {
          for (let y = 0; y < H; y += cellSize) {
            const dist = Math.sin(t + x * 0.02 + y * 0.02)
            const alpha = 0.1 + Math.abs(dist) * 0.5
            ctx.beginPath()
            ctx.arc(x, y, 1.5, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`
            ctx.fill()
          }
        }
      }

      const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reducedMotion) {
        t += 0.025;
        animId = requestAnimationFrame(render);
      }
    }

    render()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [color, accentColor, cellSize, perspective])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
