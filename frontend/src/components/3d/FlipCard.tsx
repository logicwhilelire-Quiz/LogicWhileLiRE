import { motion } from 'framer-motion'

export default function FlipCard({
  children,
  isFlipping,
  frontContent,
}: {
  children?: React.ReactNode
  isFlipping: boolean
  frontContent?: React.ReactNode
  [key: string]: any
}) {
  const content = children ?? frontContent

  return (
    <motion.div
      animate={{ rotateY: isFlipping ? 90 : 0 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {content}
    </motion.div>
  )
}
