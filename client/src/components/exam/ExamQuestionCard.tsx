import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Question {
  id: string | number
  text: string
  options?: string[]
  type?: 'mcq' | 'code' | 'aptitude'
}

interface ExamQuestionCardProps {
  question: Question
  onOptionSelect?: (optionIdx: number) => void
  selectedOption?: number | null
  questionIndex: number
}

/**
 * ExamQuestionCard — Focused, high-contrast, distraction-free question card for exams.
 * Smooth 2D directional transition with zero Three.js overhead.
 */
export default function ExamQuestionCard({
  question,
  onOptionSelect,
  selectedOption,
  questionIndex,
}: ExamQuestionCardProps) {
  const [prev, setPrev] = useState(questionIndex)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')

  useEffect(() => {
    if (questionIndex !== prev) {
      setDirection(questionIndex > prev ? 'next' : 'prev')
      setPrev(questionIndex)
    }
  }, [questionIndex, prev])

  const LABELS = ['A', 'B', 'C', 'D']

  const slideVariants = {
    enter: (dir: 'next' | 'prev') => ({
      x: dir === 'next' ? 24 : -24,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: 'next' | 'prev') => ({
      x: dir === 'next' ? -24 : 24,
      opacity: 0,
    }),
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={question.id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="question-card"
            style={{
              background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(7, 12, 28, 0.98))',
              border: '1px solid rgba(43, 127, 255, 0.3)',
              borderRadius: 16,
              padding: '24px 28px',
              boxShadow: '0 15px 35px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
              position: 'relative',
            }}
          >
            {/* Question meta header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display, "Space Grotesk", sans-serif)',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#60A5FA',
                  }}
                >
                  Question {questionIndex + 1}
                </span>
                {question.type && (
                  <span
                    className={`badge ${
                      question.type === 'code'
                        ? 'badge-warning'
                        : question.type === 'aptitude'
                        ? 'badge-primary'
                        : 'badge-neutral'
                    }`}
                    style={{
                      padding: '3px 10px',
                      borderRadius: 999,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}
                  >
                    {question.type.toUpperCase()}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                Single Choice
              </span>
            </div>

            {/* Question text */}
            <p
              style={{
                fontSize: '1.15rem',
                fontWeight: 600,
                lineHeight: 1.65,
                color: '#FFFFFF',
                letterSpacing: '-0.01em',
                marginBottom: 24,
                fontFamily: 'var(--font-body, "Inter", sans-serif)',
                WebkitFontSmoothing: 'antialiased',
              }}
            >
              {question.text}
            </p>

            {/* Options list */}
            {question.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {question.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx

                  return (
                    <motion.div
                      key={idx}
                      className="exam-option-card"
                      onClick={() => onOptionSelect?.(idx)}
                      whileHover={{ x: 4, borderColor: 'rgba(96,165,250,0.6)' }}
                      whileTap={{ scale: 0.99 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      style={{
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
                        boxShadow: isSelected ? '0 0 20px rgba(59, 130, 246, 0.25)' : 'none',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'background 0.2s, border-color 0.2s',
                      }}
                    >
                      <div
                        style={{
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
                      </div>

                      <span
                        style={{
                          fontSize: '1rem',
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? '#FFFFFF' : '#E2E8F0',
                          lineHeight: 1.5,
                          WebkitFontSmoothing: 'antialiased',
                        }}
                      >
                        {opt}
                      </span>
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
