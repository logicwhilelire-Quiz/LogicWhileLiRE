import { useRef, useEffect } from 'react'

interface Star {
  x: number; y: number; z: number; px: number; py: number; size: number; speed: number
}

interface StarFieldProps {
  count?: number
  speed?: number
  color?: string
  className?: string
}

export default function StarField({ count = 180, speed = 0.6, color = '#00d2ff', className = '' }: StarFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let animId: number

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const stars: Star[] = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width - canvas.width / 2,
      y: Math.random() * canvas.height - canvas.height / 2,
      z: Math.random() * canvas.width,
      px: 0, py: 0,
      size: Math.random() * 2 + 0.5,
      speed: (Math.random() * 0.5 + 0.5) * speed,
    }))

    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      ctx.fillStyle = 'rgba(7,10,20,1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2, cy = canvas.height / 2;
      stars.forEach((s) => {
        const nx = (s.x / s.z) * canvas.width + cx;
        const ny = (s.y / s.z) * canvas.height + cy;
        ctx.beginPath();
        ctx.arc(nx, ny, s.size * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = color + '99';
        ctx.fill();
      });
      return () => { window.removeEventListener('resize', resize); };
    }

    const render = () => {
      ctx.fillStyle = 'rgba(7,10,20,0.15)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const cx = canvas.width / 2, cy = canvas.height / 2

      stars.forEach(s => {
        s.px = (s.x / s.z) * canvas.width + cx
        s.py = (s.y / s.z) * canvas.height + cy

        s.z -= s.speed * 2
        if (s.z <= 0) {
          s.z = canvas.width
          s.x = Math.random() * canvas.width - cx
          s.y = Math.random() * canvas.height - cy
        }

        const nx = (s.x / s.z) * canvas.width + cx
        const ny = (s.y / s.z) * canvas.height + cy
        const size = Math.max(0.1, (1 - s.z / canvas.width) * 3)
        const alpha = 1 - s.z / canvas.width

        ctx.beginPath()
        ctx.moveTo(s.px, s.py)
        ctx.lineTo(nx, ny)
        ctx.strokeStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0')
        ctx.lineWidth = size
        ctx.stroke()
      })

      animId = requestAnimationFrame(render)
    }

    render()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [count, speed, color])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
