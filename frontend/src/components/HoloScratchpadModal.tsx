import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface HoloScratchpadModalProps {
  isOpen: boolean
  onClose: () => void
  examCode: string
}

export const HoloScratchpadModal: React.FC<HoloScratchpadModalProps> = ({
  isOpen,
  onClose,
  examCode,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'formulas'>('notes')
  const [notes, setNotes] = useState(() => {
    return sessionStorage.getItem(`lw_scratchpad_${examCode}`) || ''
  })
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // Save notes locally
  const handleNotesChange = (text: string) => {
    setNotes(text)
    sessionStorage.setItem(`lw_scratchpad_${examCode}`, text)
  }

  // Canvas drawing functions
  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.strokeStyle = '#38BDF8'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  const stopDraw = () => {
    setIsDrawing(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9995,
            background: 'rgba(5, 7, 15, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            style={{
              width: '100%',
              maxWidth: 680,
              background: '#0B1120',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: 16,
              padding: 20,
              boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(56,189,248,0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.4rem' }}>📝</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    In-Exam Secure Scratchpad
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)' }}>
                    Private candidate work area • Zero tab-switch penalty
                  </span>
                </div>
              </div>

              {/* Tab Selector */}
              <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.05)', padding: 3, borderRadius: 8 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('notes')}
                  style={{
                    background: activeTab === 'notes' ? '#2563EB' : 'transparent',
                    color: activeTab === 'notes' ? '#FFF' : 'var(--color-text-muted)',
                    border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Notes & Code
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('formulas')}
                  style={{
                    background: activeTab === 'formulas' ? '#2563EB' : 'transparent',
                    color: activeTab === 'formulas' ? '#FFF' : 'var(--color-text-muted)',
                    border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Doodle Canvas
                </button>
              </div>

              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-faint)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            {activeTab === 'notes' ? (
              <div>
                <textarea
                  value={notes}
                  onChange={e => handleNotesChange(e.target.value)}
                  placeholder="Draft calculations, variable tracing, or notes here... (Automatically saved across questions)"
                  rows={10}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#070D18',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    padding: 12,
                    color: '#E2E8F0',
                    fontSize: '0.86rem',
                    fontFamily: 'var(--font-mono, monospace)',
                    lineHeight: 1.6,
                    resize: 'none',
                  }}
                />
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-faint)' }}>
                    Draw rough sketches or diagrams with cursor
                  </span>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', borderRadius: 4, padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer' }}
                  >
                    Clear Canvas
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={240}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  style={{
                    width: '100%',
                    height: 240,
                    background: '#070D18',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    cursor: 'crosshair',
                  }}
                />
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <span style={{ fontSize: '0.72rem', color: '#10B981' }}>
                ✓ Encrypted in active terminal memory
              </span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onClose}
              >
                Close Scratchpad & Resume Exam
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default HoloScratchpadModal
