import { useEffect, useRef } from 'react'

export default function CodeRain({ opacity, className }: { opacity?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const chars = ['0', '1', '{', '}', '</>', '&&', '=>', '()']
    const drops: number[] = []
    for (let i = 0; i < 80; i++) drops[i] = Math.random() * -100

    let animId: number
    const draw = () => {
      ctx.fillStyle = 'rgba(6,9,20,0.08)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.font = '14px JetBrains Mono'
      drops.forEach((y, i) => {
        const text = chars[Math.floor(Math.random() * chars.length)]
        const isAmber = (i % 7 === 0);
        ctx.fillStyle = isAmber ? 'rgba(251, 191, 36, 0.45)' : 'rgba(0, 210, 255, 0.35)'
        ctx.fillText(text, i * 20, y)
        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0
        drops[i] += 2 + Math.random() * 3
      })
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas
      ref={ref}
      className={className || 'fixed inset-0 pointer-events-none opacity-[0.07]'}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        opacity: opacity !== undefined ? opacity : 0.07,
        zIndex: 0,
      }}
    />
  )
}
