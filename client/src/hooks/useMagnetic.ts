import { useRef, useEffect } from 'react'

export default function useMagnetic() {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const btn = ref.current
    if (!btn) return
    const move = (e: MouseEvent) => {
      const rect = btn.getBoundingClientRect()
      const x = e.clientX - rect.left - rect.width / 2
      const y = e.clientY - rect.top - rect.height / 2
      btn.style.transform = `translate(${x * 0.15}px, ${y * 0.25}px) scale(1.02)`
    }
    const leave = () => {
      btn.style.transform = 'translate(0, 0) scale(1)'
    }
    btn.addEventListener('mousemove', move)
    btn.addEventListener('mouseleave', leave)
    return () => {
      btn.removeEventListener('mousemove', move)
      btn.removeEventListener('mouseleave', leave)
    }
  }, [])
  return ref
}
