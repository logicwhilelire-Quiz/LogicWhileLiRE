import { useEffect, useRef, useState } from 'react'

/** CustomCursor — dot + ring, ring follows with 0.15s delay, scales on interactive hover */
export default function CustomCursor() {
  const dotRef  = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const pos     = useRef({ x: -100, y: -100 })
  const ring    = useRef({ x: -100, y: -100 })
  const animId  = useRef<number | undefined>(undefined)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY }
    }

    const animate = () => {
      ring.current.x += (pos.current.x - ring.current.x) * 0.12
      ring.current.y += (pos.current.y - ring.current.y) * 0.12

      if (dotRef.current) {
        dotRef.current.style.left = `${pos.current.x}px`
        dotRef.current.style.top  = `${pos.current.y}px`
      }
      if (ringRef.current) {
        ringRef.current.style.left = `${ring.current.x}px`
        ringRef.current.style.top  = `${ring.current.y}px`
      }

      animId.current = requestAnimationFrame(animate)
    }

    const onEnter = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (
        t.matches('button, a, [role="button"], input, textarea, select, [tabindex], .glow-card, label') ||
        t.closest('button, a, [role="button"]')
      ) {
        setHovered(true)
      }
    }
    const onLeave = () => setHovered(false)

    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseover', onEnter)
    document.addEventListener('mouseout',  onLeave)
    animId.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onEnter)
      document.removeEventListener('mouseout',  onLeave)
      if (animId.current) cancelAnimationFrame(animId.current)
    }
  }, [])

  // Only show on non-touch devices
  if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return null

  return (
    <>
      <div ref={dotRef} className="cursor-dot" style={{ zIndex: 99999 }} />
      <div ref={ringRef} className={`cursor-ring ${hovered ? 'hovered' : ''}`} style={{ zIndex: 99998 }} />
    </>
  )
}
