import { useRef, useEffect } from 'react'

interface GridDistortionProps {
  rows?: number
  cols?: number
  color?: string
  className?: string
}

export default function GridDistortion({ rows = 14, cols = 20, color = '#6C5CE7', className = '' }: GridDistortionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let animId: number
    let mouse = { x: -999, y: -999 }
    let t = 0

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }
    canvas.addEventListener('mousemove', onMove)

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const W = canvas.width, H = canvas.height
      const cw = W / cols, ch = H / rows

      ctx.lineWidth = 0.6

      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          const bx = c * cw
          const by = r * ch

          const dx = bx - mouse.x
          const dy = by - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const force = Math.max(0, 80 - dist) / 80
          const waveX = Math.sin(t + c * 0.4) * 6
          const waveY = Math.cos(t + r * 0.4) * 6
          const repX = (dx / (dist + 1)) * force * 30
          const repY = (dy / (dist + 1)) * force * 30

          const x = bx + waveX + repX
          const y = by + waveY + repY

          const alpha = 0.12 + force * 0.5
          ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0')
          ctx.beginPath()
          ctx.arc(x, y, 1.2 + force * 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Draw connecting grid lines
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath()
        for (let c = 0; c <= cols; c++) {
          const bx = c * cw, by = r * ch
          const dx = bx - mouse.x, dy = by - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const force = Math.max(0, 80 - dist) / 80
          const x = bx + Math.sin(t + c * 0.4) * 6 + (dx / (dist + 1)) * force * 30
          const y = by + Math.cos(t + r * 0.4) * 6 + (dy / (dist + 1)) * force * 30
          if (c === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = color + '18'
        ctx.stroke()
      }
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath()
        for (let r = 0; r <= rows; r++) {
          const bx = c * cw, by = r * ch
          const dx = bx - mouse.x, dy = by - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const force = Math.max(0, 80 - dist) / 80
          const x = bx + Math.sin(t + c * 0.4) * 6 + (dx / (dist + 1)) * force * 30
          const y = by + Math.cos(t + r * 0.4) * 6 + (dy / (dist + 1)) * force * 30
          if (r === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = color + '18'
        ctx.stroke()
      }

      t += 0.015
      animId = requestAnimationFrame(render)
    }

    render()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', onMove)
    }
  }, [rows, cols, color])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
