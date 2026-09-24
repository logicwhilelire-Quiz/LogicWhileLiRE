import type { ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function AnimatedPage({ children, className = '', style }: AnimatedPageProps) {
  const shouldReduceMotion = useReducedMotion();

  // If user prefers reduced motion, disable translation and shorten duration
  const variants: Variants = {
    initial: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 12,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.15 : 0.25,
        ease: 'easeOut',
      },
    },
    exit: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : -10,
      transition: {
        duration: shouldReduceMotion ? 0.1 : 0.18,
        ease: 'easeIn',
      },
    },
  };

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
      style={{ width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column', flex: 1, ...style }}
    >
      {children}
    </motion.div>
  );
}
