import { motion } from 'framer-motion'

export default function PageWipe({ isActive }: { isActive: boolean }){
  return (
    <motion.div
      initial={{ scaleY: 0 }}
      animate={{ scaleY: isActive ? 1 : 0 }}
      transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
      className="fixed inset-0 z-[9999] bg-[#060914] origin-top"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#060914',
        transformOrigin: 'top',
        pointerEvents: isActive ? 'auto' : 'none',
      }}
    />
  )
}
