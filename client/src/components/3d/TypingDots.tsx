import { useEffect, useState } from 'react'

interface TypingDotsProps {
  text?: string
  className?: string
}

export default function TypingDots({ text = 'Processing', className = '' }: TypingDotsProps) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const id = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 400)
    return () => clearInterval(id)
  }, [])

  return (
    <span className={className} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
      {text}
      <span style={{ display: 'inline-block', width: '1.5ch', color: 'var(--color-accent)' }}>{dots}</span>
    </span>
  )
}
