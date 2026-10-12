import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Question {
  id: string | number
  text: string
  options?: string[]
  type?: 'mcq' | 'code' | 'aptitude'
}

interface QuestionMorphProps {
  question: Question
  onOptionSelect?: (optionIdx: number) => void
  selectedOption?: number | null
  questionIndex: number
}

/**
 * QuestionMorph — question card with PageWipe + FlipCard transition between questions
 * Each option has lift + glow on hover, 3D flip on select
 */
export default function QuestionMorph({
  question,
  onOptionSelect,
  selectedOption,
  questionIndex,
}: QuestionMorphProps) {
  const [flippedOption, setFlippedOption] = useState<number | null>(null)
  const [prev, setPrev] = useState(questionIndex)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [wipeActive, setWipeActive] = useState(false)

  useEffect(() => {
    if (questionIndex !== prev) {
      setDirection(questionIndex > prev ? 'next' : 'prev')
      setWipeActive(true)
      setFlippedOption(null)
      const t = setTimeout(() => setWipeActive(false), 100)
      setPrev(questionIndex)
      return () => clearTimeout(t)
    }
  }, [questionIndex, prev])

  const handleOptionClick = (idx: number) => {
    if (flippedOption === idx) return
    setFlippedOption(idx)
    setTimeout(() => onOptionSelect?.(idx), 200)
  }

  const slideVariants = {
    enter: (dir: 'next' | 'prev') => ({
      x: dir === 'next' ? 40 : -40,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: 'next' | 'prev') => ({
      x: dir === 'next' ? -40 : 40,
      opacity: 0,
    }),
  }

  const LABELS = ['A', 'B', 'C', 'D']

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* PageWipe transition overlay — crisp, no blur */}
      <AnimatePresence>
        {wipeActive && (
          <motion.div
            key="wipe"
            initial={{ scaleX: 0, originX: direction === 'next' ? '0%' : '100%' }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0, originX: direction === 'next' ? '100%' : '0%' }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, rgba(43,127,255,0.25), rgba(96,165,250,0.15))',
              zIndex: 10, pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={question.id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Question card */}
          <div className="question-card" style={{
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(7, 12, 28, 0.98))',
            border: '1px solid rgba(43, 127, 255, 0.3)',
            borderRadius: 16,
            padding: '24px 28px',
            boxShadow: '0 15px 35px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            position: 'relative',
          }}>
            {/* Question meta */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="question-number" style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#60A5FA',
                }}>
                  Question {questionIndex + 1}
                </span>
                {question.type && (
                  <span className={`badge ${
                    question.type === 'code' ? 'badge-warning' :
                    question.type === 'aptitude' ? 'badge-primary' : 'badge-neutral'
                  }`} style={{
                    padding: '3px 10px',
                    borderRadius: 999,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}>
                    {question.type.toUpperCase()}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                Single Choice
              </span>
            </div>

            {/* Question text — Ultra crisp & high contrast */}
            <p className="question-text" style={{
              fontSize: '1.18rem',
              fontWeight: 600,
              lineHeight: 1.65,
              color: '#FFFFFF',
              letterSpacing: '-0.01em',
              marginBottom: 24,
              fontFamily: "'Inter', sans-serif",
              WebkitFontSmoothing: 'antialiased',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
            }}>
              {question.text}
            </p>

            {/* Options — high-contrast flip card effect */}
            {question.options && (
              <div className="option-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {question.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx || flippedOption === idx

                  return (
                    <motion.div
                      key={idx}
                      className={`option-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleOptionClick(idx)}
                      whileHover={{
                        x: 6,
                        boxShadow: '0 0 20px rgba(43,127,255,0.25)',
                        borderColor: 'rgba(96,165,250,0.6)',
                      }}
                      whileTap={{ scale: 0.99 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      style={{
                        perspective: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 18px',
                        borderRadius: 12,
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(43, 127, 255, 0.22), rgba(27, 95, 204, 0.25))'
                          : 'rgba(255, 255, 255, 0.03)',
                        border: `1.5px solid ${isSelected ? '#3B82F6' : 'rgba(255, 255, 255, 0.09)'}`,
                        boxShadow: isSelected ? '0 0 25px rgba(59, 130, 246, 0.25)' : 'none',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'background 0.2s, border-color 0.2s',
                      }}
                    >
                      <motion.div
                        animate={isSelected ? { rotateY: [0, 10, 0] } : { rotateY: 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="option-key"
                        style={{
                          transformStyle: 'preserve-3d',
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          flexShrink: 0,
                          background: isSelected
                            ? 'linear-gradient(135deg, #2B7FFF, #1B5FCC)'
                            : 'rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#FFFFFF' : '#94A3B8',
                          boxShadow: isSelected ? '0 2px 10px rgba(43, 127, 255, 0.5)' : 'none',
                        }}
                      >
                        {isSelected ? '✓' : LABELS[idx]}
                      </motion.div>

                      <span className="option-text" style={{
                        fontSize: '1rem',
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? '#FFFFFF' : '#E2E8F0',
                        lineHeight: 1.5,
                        WebkitFontSmoothing: 'antialiased',
                      }}>
                        {opt}
                      </span>

                      {/* Shimmer on select */}
                      {isSelected && (
                        <motion.div
                          initial={{ x: '-100%', opacity: 0.6 }}
                          animate={{ x: '200%', opacity: 0 }}
                          transition={{ duration: 0.5 }}
                          style={{
                            position: 'absolute', top: 0, bottom: 0, left: 0,
                            width: '30%',
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
