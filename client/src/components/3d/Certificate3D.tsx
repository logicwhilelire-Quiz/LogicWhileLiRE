import { useRef } from 'react'

export default function Certificate3D({ children }: { children?: React.ReactNode }){
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    el.style.transform = `perspective(1000px) rotateY(${x / 20}deg) rotateX(${-y / 20}deg)`
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = 'perspective(1000px) rotateY(0) rotateX(0)'
  }
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative transition-transform duration-200 [transform-style:preserve-3d] bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-[24px] p-8 before:absolute before:inset-0 before:bg-[radial-gradient(400px_circle_at_var(--mx)_var(--my),rgba(108,92,231,0.15),transparent_80%)] before:opacity-0 hover:before:opacity-100"
      style={{
        position: 'relative',
        transition: 'transform 200ms ease-out',
        transformStyle: 'preserve-3d',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        padding: 32,
      }}
    >
      {children}
    </div>
  )
}
