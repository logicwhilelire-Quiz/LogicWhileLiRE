import { useEffect, useRef } from 'react'
import { motion, useInView, useAnimation } from 'framer-motion'

interface ShimmerTextProps {
  text: string
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div'
  className?: string
  shimmer?: boolean
  stagger?: boolean
  delay?: number
}

export default function ShimmerText({
  text,
  as: Tag = 'span',
  className = '',
  shimmer = true,
  stagger = false,
  delay = 0,
}: ShimmerTextProps) {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref as React.RefObject<Element>, { once: true, margin: '-10% 0px' })
  const controls = useAnimation()

  useEffect(() => {
    if (isInView) {
      controls.start('visible')
    }
  }, [isInView, controls])

  if (stagger) {
    const words = text.split(' ')
    return (
      <Tag ref={ref as React.RefObject<HTMLElement & HTMLHeadingElement>} className={className} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25em' }}>
        {words.map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={controls}
            variants={{
              visible: { opacity: 1, y: 0 },
            }}
            transition={{
              duration: 0.5,
              delay: delay + i * 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={shimmer ? 'shimmer-text' : ''}
            style={shimmer ? { animationDelay: `${i * 0.1}s` } : {}}
          >
            {word}
          </motion.span>
        ))}
      </Tag>
    )
  }

  return (
    <motion.span
      ref={ref as React.RefObject<HTMLSpanElement>}
      className={`${shimmer ? 'shimmer-text' : ''} ${className}`}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {text}
    </motion.span>
  )
}
