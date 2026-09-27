import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import SiteHeader from '../components/SiteHeader'
import GlowCard from '../components/3d/GlowCard'
import MagneticButton from '../components/3d/MagneticButton'
import HoloScan from '../components/3d/HoloScan'
import FlightPathLines from '../components/3d/FlightPathLines'
import TypingDots from '../components/3d/TypingDots'
import GridDistortion from '../components/3d/GridDistortion'

interface FormState {
  examCode: string
  hallTicket: string
}

interface ApiError {
  message?: string
  [key: string]: unknown
}

export default function EnterExamPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>({ examCode: '', hallTicket: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [typingField, setTypingField] = useState<string | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: field === 'examCode' ? value.toUpperCase() : value }))
    setError('')
    setTypingField(field)
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => setTypingField(null), 1000)
  }

  const triggerShake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.examCode.trim() || !form.hallTicket.trim()) {
      setError('Please fill in all fields.')
      triggerShake()
      return
    }

    setLoading(true)
    setError('')

    try {
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const { data } = await axios.get(
        `${BASE}/api/exam-code/${encodeURIComponent(form.examCode.trim())}/verify`,
        { params: { hallTicket: form.hallTicket.trim() } }
      )
      if (data.success || data.valid) {
        localStorage.setItem('lw_attempt', JSON.stringify({
          attemptId: data.attempt_id || data.attemptId || `att_${Date.now()}`,
          examCode: form.examCode.trim().toUpperCase(),
          hallTicket: form.hallTicket.trim(),
          examDetails: data.examDetails || data.exam || {
            exam_name: form.examCode.trim().toUpperCase(),
            duration_minutes: 45,
            total_questions: 15,
          },
        }))
        navigate(`/instructions/${form.examCode.trim()}`, {
          state: { hallTicket: form.hallTicket.trim() }
        })
      } else {
        throw new Error(data.message || 'Exam code or hall ticket not found.')
      }
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : (err as { response?: { data?: ApiError } }).response?.data?.message || 'Entry failed. Please check your credentials.'
      setError(msg)
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', position: 'relative' }}>
      <SiteHeader />

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <FlightPathLines color="#2B7FFF" opacity={0.05} count={10} className="" />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(43,127,255,0.06), transparent)',
        }} />
      </div>

      {/* Grid Distortion — reacts to field focus */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: focusedField ? 1 : 0, transition: 'opacity 0.4s ease' }}>
        <GridDistortion />
      </div>

      {/* Center card */}
      <div className="page-center" style={{ position: 'relative', zIndex: 1, paddingTop: 100 }}>
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: '100%', maxWidth: 480 }}
        >
          {/* HoloScan border at top */}
          <HoloScan color="#2B7FFF">
            <motion.div
              className={shaking ? 'shake-animation' : ''}
              style={{ willChange: 'transform' }}
            >
              <GlowCard glowColor="rgba(43,127,255,0.35)">
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                  <motion.div
                    style={{
                      width: 64, height: 64, borderRadius: 16,
                      background: 'linear-gradient(135deg, #2B7FFF, #1B5FCC)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '2rem', margin: '0 auto 16px',
                      boxShadow: '0 0 32px rgba(43,127,255,0.4)',
                    }}
                    animate={{ boxShadow: ['0 0 20px rgba(43,127,255,0.3)', '0 0 40px rgba(43,127,255,0.5)', '0 0 20px rgba(43,127,255,0.3)'] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                  >
                    🚀
                  </motion.div>
                  <h1 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.75rem', fontWeight: 800,
                    letterSpacing: '-0.02em', marginBottom: 6,
                  }}>
                    Enter Assessment
                  </h1>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    Enter your exam code and hall ticket number to proceed
                  </p>
                </div>

                <form onSubmit={handleSubmit}>
                  {/* Exam Code */}
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" htmlFor="examCode">
                      Exam Code
                      {typingField === 'examCode' && (
                        <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          <TypingDots />
                        </span>
                      )}
                    </label>
                    <motion.input
                      id="examCode"
                      className={`form-input${error && !form.examCode ? ' error' : ''}`}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1.1rem', letterSpacing: '0.12em',
                        textAlign: 'center',
                        transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                      }}
                      type="text"
                      placeholder="e.g. EXAM2024"
                      value={form.examCode}
                      onChange={e => handleChange('examCode', e.target.value)}
                      onFocus={() => setFocusedField('examCode')}
                      onBlur={() => setFocusedField(null)}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={20}
                      animate={focusedField === 'examCode' ? {
                        boxShadow: ['0 0 0 3px rgba(43,127,255,0.2)', '0 0 0 3px rgba(43,127,255,0.4)', '0 0 0 3px rgba(43,127,255,0.2)'],
                      } : {}}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    />
                  </div>

                  {/* Hall Ticket */}
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label className="form-label" htmlFor="hallTicket">
                      Hall Ticket Number
                      {typingField === 'hallTicket' && (
                        <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          <TypingDots />
                        </span>
                      )}
                    </label>
                    <motion.input
                      id="hallTicket"
                      className={`form-input${error && !form.hallTicket ? ' error' : ''}`}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1rem', letterSpacing: '0.06em',
                        transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                      }}
                      type="text"
                      placeholder="e.g. 20A31A0501"
                      value={form.hallTicket}
                      onChange={e => handleChange('hallTicket', e.target.value)}
                      onFocus={() => setFocusedField('hallTicket')}
                      onBlur={() => setFocusedField(null)}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={20}
                    />
                  </div>

                  {/* Error message */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, height: 0 }}
                        animate={{ opacity: 1, y: 0,  height: 'auto' }}
                        exit={{ opacity: 0, y: -8,   height: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{ marginBottom: 16, overflow: 'hidden' }}
                      >
                        <div className="alert alert-error" style={{
                          border: '1px solid rgba(239,68,68,0.3)',
                          boxShadow: '0 0 16px rgba(239,68,68,0.15)',
                        }}>
                          ⚠️ {error}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit Button */}
                  <MagneticButton
                    type="submit"
                    className="btn btn-primary btn-full btn-lg"
                    disabled={loading}
                    style={{ letterSpacing: '0.02em' }}
                  >
                    {loading ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="btn-spinner" />
                        Verifying<TypingDots />
                      </span>
                    ) : (
                      '🚀 Enter Exam'
                    )}
                  </MagneticButton>
                </form>

                {/* Info footer */}
                <div style={{
                  marginTop: 24,
                  padding: '12px 16px',
                  background: 'rgba(43,127,255,0.06)',
                  border: '1px solid rgba(43,127,255,0.12)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem', color: 'var(--color-text-faint)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span>🔒</span>
                  <span>Your session is encrypted and face-verified for integrity.</span>
                </div>
              </GlowCard>
            </motion.div>
          </HoloScan>

          {/* Floating tips */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            style={{
              marginTop: 24, textAlign: 'center',
              color: 'var(--color-text-faint)', fontSize: '0.82rem',
              display: 'flex', justifyContent: 'center', gap: 24,
            }}
          >
            <span>💡 Exam code from invigilator</span>
            <span>📋 Hall ticket from admit card</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
